const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const { hasRole, hasStatus } = require('../utils/userAccess');
const { reverseGeocodeCoordinates } = require('../utils/geocoding');

const ISSUE_UPLOAD_DIRECTORY = path.join(__dirname, '..', 'uploads', 'issues');
const SAFE_IMAGE_PATTERN = /^\/uploads\/issues\/[A-Za-z0-9._-]+\.(jpg|jpeg|png)$/i;

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, ISSUE_UPLOAD_DIRECTORY);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error('Only JPG, JPEG, and PNG images are allowed'));
  }
});

const parseLocationInput = (location) => {
  if (!location) return null;
  if (typeof location === 'string') {
    try {
      return JSON.parse(location);
    } catch {
      return null;
    }
  }
  return location;
};

const parseJsonInput = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
};

const formatCoordinates = (lat, lng) => `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`;

const normalizeAddress = (address) => (
  typeof address === 'string' && address.trim()
    ? address.trim()
    : ''
);

const looksLikeCoordinateAddress = (address) => /^lat\s/i.test(normalizeAddress(address));

const normalizeLocation = async (locationInput) => {
  const lat = Number(locationInput?.lat);
  const lng = Number(locationInput?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  let address = normalizeAddress(locationInput?.address);

  if (!address || looksLikeCoordinateAddress(address)) {
    address = await reverseGeocodeCoordinates(lat, lng);
  }

  return {
    lat,
    lng,
    address: address || formatCoordinates(lat, lng)
  };
};

const buildImageContext = (rawImageContext, location, imageSource) => {
  const imageContext = parseJsonInput(rawImageContext) || {};
  const capturedAt = imageContext?.capturedAt ? new Date(imageContext.capturedAt) : null;
  const validCapturedAt = capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null;

  if (!imageSource && !Object.keys(imageContext).length) {
    return null;
  }

  return {
    source: imageContext?.source || (imageSource ? 'report_upload' : undefined),
    captured_at: validCapturedAt || undefined,
    address: normalizeAddress(imageContext?.address) || location?.address || '',
    lat: Number.isFinite(Number(imageContext?.lat)) ? Number(imageContext.lat) : location?.lat,
    lng: Number.isFinite(Number(imageContext?.lng)) ? Number(imageContext.lng) : location?.lng,
    overlay_label: normalizeAddress(imageContext?.overlayLabel)
  };
};

const createNotification = async ({ userId, title, message, type = 'INFO', complaintId }) => {
  if (!userId || !message) {
    return null;
  }

  const recipient = await User.findById(userId).select('notification_preferences');
  const preferences = recipient?.notification_preferences || {};
  const normalizedType = String(type || '').toUpperCase();

  if (normalizedType === 'ASSIGNMENT' && preferences.assignment_alerts === false) {
    return null;
  }

  if (normalizedType === 'SUCCESS' && preferences.completion_alerts === false) {
    return null;
  }

  if (normalizedType === 'INFO' && preferences.issue_updates === false) {
    return null;
  }

  return Notification.create({
    user_id: userId,
    title,
    message,
    type,
    complaint_id: complaintId,
    status: 'unread',
    read: false
  });
};

const notifyCitizen = async (complaint, status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'assigned_to_worker') {
    return createNotification({
      userId: complaint.created_by,
      title: 'Worker assigned',
      message: `A worker has been assigned to your reported issue "${complaint.title}".`,
      type: 'ASSIGNMENT',
      complaintId: complaint._id
    });
  }

  if (normalizedStatus === 'in_progress') {
    return createNotification({
      userId: complaint.created_by,
      title: 'Issue in progress',
      message: `Work is now in progress for your reported issue "${complaint.title}".`,
      type: 'INFO',
      complaintId: complaint._id
    });
  }

  if (normalizedStatus === 'completed') {
    return createNotification({
      userId: complaint.created_by,
      title: 'Issue resolved',
      message: `Your reported issue "${complaint.title}" has been successfully resolved ✅`,
      type: 'SUCCESS',
      complaintId: complaint._id
    });
  }

  return createNotification({
    userId: complaint.created_by,
    title: 'Issue update',
    message: `Issue status updated to ${normalizedStatus.replace(/_/g, ' ')}: ${complaint.title}`,
    type: 'INFO',
    complaintId: complaint._id
  });
};

const isSafeExistingImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') {
    return false;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return true;
  }

  if (!SAFE_IMAGE_PATTERN.test(imagePath)) {
    return false;
  }

  const normalizedRelativePath = imagePath.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
  const resolvedPath = path.resolve(path.join(__dirname, '..', 'uploads', normalizedRelativePath));
  return resolvedPath.startsWith(ISSUE_UPLOAD_DIRECTORY) && fs.existsSync(resolvedPath);
};

// Create Complaint
router.post('/', auth, imageUpload.single('imageFile'), async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const location = await normalizeLocation(parseLocationInput(req.body.location));
    const uploadedImage = req.file ? `/uploads/issues/${req.file.filename}` : null;
    const image = uploadedImage || req.body.image;
    const imageContext = buildImageContext(req.body.imageContext, location, image);

    if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
      return res.status(400).json({ message: 'A valid issue location is required' });
    }

    if (image && !isSafeExistingImage(image)) {
      return res.status(400).json({ message: 'Invalid image selection' });
    }
    
    // Duplicate Detection (Location-based: 100m radius approximately 0.001 deg)
    const duplicate = await Complaint.findOne({
      lat: { $gt: location.lat - 0.001, $lt: location.lat + 0.001 },
      lng: { $gt: location.lng - 0.001, $lt: location.lng + 0.001 },
      status: { $in: ['pending', 'in_progress'] }
    });

    if (duplicate) {
      return res.status(400).json({ 
        message: 'Potential duplicate complaint detected at this location.',
        duplicate_id: duplicate._id 
      });
    }

    // SLA Calculation
    const slaHours = { 'high': 24, 'medium': 72, 'low': 168 };
    const sla_expiry = new Date(Date.now() + (slaHours[priority] || 72) * 3600000);

    const complaint = new Complaint({
      title,
      description,
      priority,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
      location,
      image,
      image_context: imageContext,
      created_by: req.user.id,
      sla_expiry
    });

    await complaint.save();
    res.status(201).json(complaint);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/reverse-geocode', auth, async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
    }

    const address = await reverseGeocodeCoordinates(lat, lng);
    res.json({
      lat,
      lng,
      address: address || formatCoordinates(lat, lng)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get All Complaints (Public Transparency)
router.get('/', async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('created_by', 'name')
      .populate('department_id', 'name')
      .populate('assigned_worker_id', 'name')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign to Department (Admin Only)
router.post('/assign-dept/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { department_id } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    complaint.department_id = department_id;
    complaint.status = 'assigned_to_dept';
    complaint.timeline.push({
      status: 'assigned_to_dept',
      updated_by: req.user.id,
      comments: 'Assigned to department'
    });
    await complaint.save();

    res.json({ message: 'Complaint assigned to department', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign Complaint to Worker (Dept Head Only)
router.post('/assign/:id', auth, authorize('head'), async (req, res) => {
  try {
    const { worker_id, volunteer_id, comments } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    // If assigning a worker, ensure they are approved and in the department
    if (worker_id) {
      const worker = await User.findById(worker_id);
      if (
        !worker ||
        !hasStatus(worker.status, 'approved') ||
        worker.department_id.toString() !== req.user.department_id.toString()
      ) {
        return res.status(400).json({ message: 'Invalid or unapproved worker selection' });
      }
      complaint.assigned_worker_id = worker_id;
    }

    if (volunteer_id) {
      const volunteer = await User.findById(volunteer_id);
      if (!volunteer || !hasStatus(volunteer.status, 'approved')) {
        return res.status(400).json({ message: 'Invalid or unapproved volunteer selection' });
      }
      complaint.assigned_volunteer_id = volunteer_id;
    }
    
    complaint.status = 'assigned_to_worker';
    complaint.timeline.push({
      status: 'assigned_to_worker',
      updated_by: req.user.id,
      comments: comments || 'Task assigned to worker'
    });

    await complaint.save();

    // Create Notification for Assignee
    const assigneeId = worker_id || volunteer_id;
    if (assigneeId) {
      await createNotification({
        userId: assigneeId,
        title: 'New assignment',
        message: `New task assigned: ${complaint.title}`,
        type: 'ASSIGNMENT',
        complaintId: complaint._id
      });
    }

    await notifyCitizen(complaint, 'assigned_to_worker');

    res.json({ message: 'Task assigned successfully', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Start Work (Worker/Volunteer Only)
router.post('/start-work/:id', auth, authorize('worker', 'volunteer'), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    // Check if status is assigned_to_worker
    if (complaint.status !== 'assigned_to_worker' && complaint.status !== 'assigned_to_dept') {
       return res.status(400).json({ message: 'Status must be assigned to start work' });
    }

    complaint.status = 'in_progress';
    complaint.timeline.push({
      status: 'in_progress',
      updated_by: req.user.id,
      comments: 'Worker started work on the site'
    });

    await complaint.save();
    await notifyCitizen(complaint, 'in_progress');
    res.json({ message: 'Work started', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Status & Proof (Worker/Volunteer Only)
router.post('/update-status/:id', auth, authorize('worker', 'volunteer'), async (req, res) => {
  try {
    const { status, comments, before_image, after_image } = req.body;
    
    if (status === 'completed' && (!comments || comments.trim() === '')) {
      return res.status(400).json({ message: 'Comments are mandatory for completion proof' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    // Check if assigned to this user
    if (complaint.assigned_worker_id?.toString() !== req.user.id && 
        complaint.assigned_volunteer_id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not assigned to this task' });
    }

    complaint.status = status;
    if (before_image) complaint.work_proof.before_image = before_image;
    if (after_image) {
      complaint.work_proof.after_image = after_image;
      complaint.work_proof.completed_at = new Date();
    }

    complaint.timeline.push({
      status,
      updated_by: req.user.id,
      comments
    });

    await complaint.save();

    await notifyCitizen(complaint, status);

    res.json({ message: 'Status updated successfully', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Dept Specific Issues (Unassigned)
router.get('/dept-issues', auth, authorize('head'), async (req, res) => {
  try {
    const issues = await Complaint.find({ 
      department_id: req.user.department_id,
      status: 'assigned_to_dept',
      assigned_worker_id: { $exists: false }
    }).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get My Assigned Tasks
router.get('/my-tasks', auth, authorize('worker', 'volunteer'), async (req, res) => {
  try {
    const query = hasRole(req.user.role, 'worker')
      ? { assigned_worker_id: req.user.id } 
      : { assigned_volunteer_id: req.user.id };
    
    const tasks = await Complaint.find(query).sort({ updatedAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Complaint By ID
router.get('/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('created_by', 'name')
      .populate('department_id', 'name')
      .populate('assigned_worker_id', 'name')
      .populate('assigned_volunteer_id', 'name')
      .populate('timeline.updated_by', 'name role');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Stats for Analytics
router.get('/stats', auth, authorize('admin', 'head'), async (req, res) => {
  try {
    const stats = await Complaint.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    
    const deptStats = await Complaint.aggregate([
      { $lookup: { from: "departments", localField: "department_id", foreignField: "_id", as: "dept" } },
      { $unwind: "$dept" },
      { $group: { _id: "$dept.name", count: { $sum: 1 } } }
    ]);

    res.json({ statusStats: stats, departmentStats: deptStats });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Volunteer Leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const leaderboard = await Complaint.aggregate([
      { $match: { status: 'resolved' } },
      { $group: { _id: "$assigned_to", points: { $sum: 10 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { name: "$user.name", points: 1 } },
      { $sort: { points: -1 } },
      { $limit: 10 }
    ]);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');

// Create Complaint
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, priority, location, image } = req.body;
    
    // Duplicate Detection (Location-based: 100m radius approximately 0.001 deg)
    const duplicate = await Complaint.findOne({
      location: {
        lat: { $gt: location.lat - 0.001, $lt: location.lat + 0.001 },
        lng: { $gt: location.lng - 0.001, $lt: location.lng + 0.001 }
      },
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
      location,
      created_by: req.user.id,
      sla_expiry
    });

    await complaint.save();
    res.status(201).json(complaint);
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

// Assign Complaint (Dept Head Only)
router.post('/assign/:id', auth, authorize('head'), async (req, res) => {
  try {
    const { worker_id, volunteer_id, comments } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    if (worker_id) complaint.assigned_worker_id = worker_id;
    if (volunteer_id) complaint.assigned_volunteer_id = volunteer_id;
    
    complaint.status = 'in_progress';
    complaint.timeline.push({
      status: 'in_progress',
      updated_by: req.user.id,
      comments: comments || 'Task assigned'
    });

    await complaint.save();

    // Create Notification for Assignee
    const assigneeId = worker_id || volunteer_id;
    if (assigneeId) {
      const notification = new Notification({
        user_id: assigneeId,
        message: `New task assigned: ${complaint.title}`,
        type: 'assignment',
        complaint_id: complaint._id
      });
      await notification.save();
    }

    res.json({ message: 'Task assigned successfully', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Status & Proof (Worker/Volunteer Only)
router.post('/update-status/:id', auth, authorize('worker', 'volunteer'), async (req, res) => {
  try {
    const { status, comments, before_image, after_image } = req.body;
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

    // Notify Citizen (Report Creator)
    const citizenNotification = new Notification({
      user_id: complaint.created_by,
      message: `Issue status updated to ${status.replace('_', ' ')}: ${complaint.title}`,
      type: 'status_update',
      complaint_id: complaint._id
    });
    await citizenNotification.save();

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
      status: 'pending',
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
    const query = req.user.role === 'worker' 
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

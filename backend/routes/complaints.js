const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { auth, authorize } = require('../middleware/auth');
const { getRoleValues, getStatusValues, hasRole, hasStatus } = require('../utils/userAccess');
const { reverseGeocodeCoordinates } = require('../utils/geocoding');

const ISSUE_UPLOAD_DIRECTORY = path.join(__dirname, '..', 'uploads', 'issues');
const PROOF_UPLOAD_DIRECTORY = path.join(__dirname, '..', 'uploads', 'proofs');
const TASK_UPLOAD_DIRECTORY = path.join(__dirname, '..', 'uploads', 'tasks');
const SAFE_IMAGE_PATTERN = /^\/uploads\/issues\/[A-Za-z0-9._-]+\.(jpg|jpeg|png)$/i;
const SAFE_PROOF_IMAGE_PATTERN = /^\/uploads\/proofs\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
const SAFE_TASK_IMAGE_PATTERN = /^\/uploads\/tasks\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
const WORKER_STARTABLE_STATUSES = ['pending', 'assigned_to_dept', 'assigned_to_worker', 'rework_required'];
const WORKER_WAITING_FOR_HEAD_STATUS = 'waiting_for_head';
const LEGACY_WORKER_REVIEW_STATUS = 'waiting_for_verification';
const WORKER_REVIEW_STATUSES = [WORKER_WAITING_FOR_HEAD_STATUS, LEGACY_WORKER_REVIEW_STATUS];
const ADMIN_CLOSABLE_STATUS = 'verified';
const LOCATION_MAX_ACCURACY_METERS = 200;
const TASK_POPULATION = [
  ['created_by', 'name'],
  ['department_id', 'name department_id'],
  ['assigned_worker_id', 'name'],
  ['assigned_volunteer_id', 'name'],
  ['timeline.updated_by', 'name role']
];

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

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, PROOF_UPLOAD_DIRECTORY);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname || '.jpg').toLowerCase() || '.jpg'}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (String(file.mimetype || '').startsWith('image/') && allowedMimeTypes.has(String(file.mimetype || '').toLowerCase()) && ['.jpg', '.jpeg', '.png', '.webp'].includes(extension || '.jpg')) {
      return cb(null, true);
    }

    cb(new Error('Only JPG, JPEG, PNG, and WEBP images are allowed'));
  }
});

const WORKER_PROOF_FIELDS = [
  { name: 'beforeImage', maxCount: 1 },
  { name: 'beforeImageFile', maxCount: 1 },
  { name: 'afterImageFile', maxCount: 1 },
  { name: 'billImageFile', maxCount: 1 },
  { name: 'proofImage', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 },
  { name: 'billImage', maxCount: 1 }
];

const runUpload = (middleware, req, res) => new Promise((resolve, reject) => {
  middleware(req, res, (err) => {
    if (!err) {
      return resolve();
    }

    if (err instanceof multer.MulterError) {
      return reject({ status: 400, message: err.message });
    }

    return reject({ status: 400, message: err.message || 'Invalid image upload' });
  });
});

const getUploadedFile = (files, fieldNames) => {
  const normalizedFiles = files || {};
  for (const fieldName of fieldNames) {
    const value = normalizedFiles[fieldName];
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
  }
  return null;
};

const normalizeBodyString = (value) => (typeof value === 'string' ? value.trim() : '');

const toUploadedPath = (file) => {
  if (!file?.filename) {
    return '';
  }

  const directoryName = path.basename(file.destination || '');
  return directoryName
    ? `/uploads/${directoryName}/${file.filename}`
    : '';
};

const normalizeGeoDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getProofGeoInput = (body, prefix) => {
  const nestedKey = `${prefix}Location`;
  let nestedLocation = body?.[nestedKey];

  if (typeof nestedLocation === 'string') {
    try {
      nestedLocation = JSON.parse(nestedLocation);
    } catch {
      nestedLocation = null;
    }
  }

  const lat = Number(
    nestedLocation?.lat
    ?? body?.[`${prefix}Lat`]
    ?? body?.lat
  );
  const lng = Number(
    nestedLocation?.lng
    ?? body?.[`${prefix}Lng`]
    ?? body?.lng
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    accuracy: Number(
      nestedLocation?.accuracy
      ?? body?.[`${prefix}Accuracy`]
      ?? body?.accuracy
    ),
    address: normalizeBodyString(
      nestedLocation?.address
      ?? body?.[`${prefix}Address`]
      ?? body?.address
    ),
    time: normalizeGeoDate(
      nestedLocation?.timestamp
      ?? body?.[`${prefix}Time`]
      ?? body?.submittedAt
      ?? body?.timestamp
    )
  };
};

const isAccurateProofGeo = (geo) => {
  const accuracy = Number(geo?.accuracy);
  const timestamp = geo?.time instanceof Date ? geo.time : normalizeGeoDate(geo?.time);

  if (!Number.isFinite(accuracy)) {
    return false;
  }

  if (!timestamp) {
    return false;
  }

  return accuracy <= LOCATION_MAX_ACCURACY_METERS;
};

const enrichProofGeo = async (body, prefix) => {
  const input = getProofGeoInput(body, prefix);
  if (!input) {
    return null;
  }

  const addressFromGeo = await reverseGeocodeCoordinates(input.lat, input.lng).catch(() => '');
  return {
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy,
    address: addressFromGeo || input.address || formatCoordinates(input.lat, input.lng),
    time: input.time
  };
};

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

const isSafeProofImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') {
    return false;
  }

  if (!(SAFE_IMAGE_PATTERN.test(imagePath) || SAFE_PROOF_IMAGE_PATTERN.test(imagePath) || SAFE_TASK_IMAGE_PATTERN.test(imagePath))) {
    return false;
  }

  const normalizedRelativePath = imagePath.replace(/^\/uploads\//, '').replace(/\//g, path.sep);
  const resolvedPath = path.resolve(path.join(__dirname, '..', 'uploads', normalizedRelativePath));
  const proofsDirectory = PROOF_UPLOAD_DIRECTORY;
  const tasksDirectory = TASK_UPLOAD_DIRECTORY;

  return (
    (resolvedPath.startsWith(ISSUE_UPLOAD_DIRECTORY) || resolvedPath.startsWith(proofsDirectory) || resolvedPath.startsWith(tasksDirectory))
    && fs.existsSync(resolvedPath)
  );
};

const createNotificationsForUsers = async ({ userIds, title, message, type = 'INFO', complaintId }) => {
  const uniqueUserIds = [...new Set(
    userIds
      .filter(Boolean)
      .map((userId) => userId.toString())
  )];

  if (!uniqueUserIds.length) {
    return [];
  }

  return Promise.all(
    uniqueUserIds.map((userId) => createNotification({
      userId,
      title,
      message,
      type,
      complaintId
    }))
  );
};

const getDepartmentHeadIds = async (departmentId) => {
  if (!departmentId) {
    return [];
  }

  const departmentHeads = await User.find({
    department_id: departmentId,
    role: { $in: getRoleValues('head') },
    status: { $in: getStatusValues('approved') }
  }).select('_id');

  return departmentHeads.map((user) => user._id.toString());
};

const getAdminIds = async () => {
  const admins = await User.find({
    role: { $in: getRoleValues('admin') },
    status: { $in: getStatusValues('approved') }
  }).select('_id');

  return admins.map((user) => user._id.toString());
};

const getAssignedUserIds = (complaint) => ([
  complaint?.assigned_worker_id?.toString?.() || complaint?.assigned_worker_id || null,
  complaint?.assigned_volunteer_id?.toString?.() || complaint?.assigned_volunteer_id || null
].filter(Boolean));

const isAssignedTaskUser = (complaint, userId) => {
  const normalizedUserId = String(userId || '');
  return (
    complaint.assigned_worker_id?.toString() === normalizedUserId
    || complaint.assigned_volunteer_id?.toString() === normalizedUserId
  );
};

const populateTaskQuery = (query) => {
  let nextQuery = query;

  for (const [pathValue, selectValue] of TASK_POPULATION) {
    nextQuery = nextQuery.populate(pathValue, selectValue);
  }

  return nextQuery;
};

const loadTaskForResponse = (taskId) => populateTaskQuery(Complaint.findById(taskId));

const getBeforeWorkRecord = (complaint) => {
  const image = complaint?.beforeWork?.image || complaint?.beforeImage || complaint?.work_proof?.before_image || '';
  const lat = Number(complaint?.beforeWork?.location?.lat ?? complaint?.beforeWork?.lat ?? complaint?.beforeLat);
  const lng = Number(complaint?.beforeWork?.location?.lng ?? complaint?.beforeWork?.lng ?? complaint?.beforeLng);
  const accuracy = Number(complaint?.beforeWork?.accuracy ?? complaint?.beforeAccuracy);
  const address = complaint?.beforeWork?.location?.address || complaint?.beforeWork?.address || complaint?.beforeAddress || '';
  const timestamp = complaint?.beforeWork?.submittedAt || complaint?.beforeWork?.timestamp || complaint?.beforeTime || null;

  if (!image || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    image,
    lat,
    lng,
    accuracy,
    address,
    timestamp
  };
};

const clearAfterWorkFields = (complaint) => {
  complaint.afterWork = undefined;
  complaint.afterImage = undefined;
  complaint.billImage = undefined;
  complaint.workDescription = '';
  complaint.billLat = undefined;
  complaint.billLng = undefined;
  complaint.billAccuracy = undefined;
  complaint.billAddress = '';
  complaint.billTime = undefined;
  complaint.afterLat = undefined;
  complaint.afterLng = undefined;
  complaint.afterAccuracy = undefined;
  complaint.afterAddress = '';
  complaint.afterTime = undefined;
};

const saveBeforeWorkData = (complaint, beforeWork) => {
  complaint.beforeWork = {
    image: beforeWork.image,
    location: {
      lat: beforeWork.lat,
      lng: beforeWork.lng,
      address: beforeWork.address
    },
    submittedAt: beforeWork.timestamp,
    lat: beforeWork.lat,
    lng: beforeWork.lng,
    accuracy: beforeWork.accuracy,
    address: beforeWork.address,
    timestamp: beforeWork.timestamp
  };
  complaint.work_proof = complaint.work_proof || {};
  complaint.work_proof.before_image = beforeWork.image;
  complaint.work_proof.after_image = undefined;
  complaint.work_proof.bill_image = undefined;
  complaint.work_proof.description = undefined;
  complaint.work_proof.completed_at = undefined;
  complaint.beforeImage = beforeWork.image;
  complaint.beforeLat = beforeWork.lat;
  complaint.beforeLng = beforeWork.lng;
  complaint.beforeAccuracy = beforeWork.accuracy;
  complaint.beforeAddress = beforeWork.address;
  complaint.beforeTime = beforeWork.timestamp;
  clearAfterWorkFields(complaint);
  complaint.verification = {
    status: 'pending',
    verified_by: undefined,
    verified_at: undefined,
    comments: ''
  };
};

const saveAfterWorkData = (complaint, afterWork) => {
  complaint.afterWork = {
    image: afterWork.image,
    billImage: afterWork.billImage,
    description: afterWork.description,
    location: {
      lat: afterWork.lat,
      lng: afterWork.lng,
      address: afterWork.address
    },
    submittedAt: afterWork.timestamp,
    lat: afterWork.lat,
    lng: afterWork.lng,
    accuracy: afterWork.accuracy,
    address: afterWork.address,
    timestamp: afterWork.timestamp,
    billLat: afterWork.billLat,
    billLng: afterWork.billLng,
    billAccuracy: afterWork.billAccuracy,
    billAddress: afterWork.billAddress,
    billTimestamp: afterWork.billTimestamp
  };
  complaint.work_proof = complaint.work_proof || {};
  complaint.work_proof.before_image = getBeforeWorkRecord(complaint)?.image || complaint.beforeImage || complaint.work_proof.before_image;
  complaint.work_proof.after_image = afterWork.image;
  complaint.work_proof.bill_image = afterWork.billImage;
  complaint.work_proof.description = afterWork.description;
  complaint.work_proof.completed_at = new Date();
  complaint.afterImage = afterWork.image;
  complaint.billImage = afterWork.billImage;
  complaint.workDescription = afterWork.description;
  complaint.afterLat = afterWork.lat;
  complaint.afterLng = afterWork.lng;
  complaint.afterAccuracy = afterWork.accuracy;
  complaint.afterAddress = afterWork.address;
  complaint.afterTime = afterWork.timestamp;
  complaint.billLat = afterWork.billLat;
  complaint.billLng = afterWork.billLng;
  complaint.billAccuracy = afterWork.billAccuracy;
  complaint.billAddress = afterWork.billAddress;
  complaint.billTime = afterWork.billTimestamp;
  complaint.verification = {
    status: 'pending',
    verified_by: undefined,
    verified_at: undefined,
    comments: ''
  };
};

const submitBeforeWork = async (req, res) => {
  try {
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);
    console.log('FILES:', req.files);
    console.log('TASK ID:', req.params.id);

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!isAssignedTaskUser(complaint, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not assigned to this task' });
    }

    if (!WORKER_STARTABLE_STATUSES.includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'This task is not ready for before-work submission right now' });
    }

    const beforeUpload = req.file || getUploadedFile(req.files, ['beforeImage', 'beforeImageFile', 'proofImage', 'image']);
    const beforeImage = beforeUpload
      ? toUploadedPath(beforeUpload)
      : normalizeBodyString(req.body.beforeImage || req.body.before_image || req.body.image);
    const beforeGeo = await enrichProofGeo(req.body, 'before');

    if (!beforeImage || !isSafeProofImage(beforeImage)) {
      return res.status(400).json({ success: false, message: 'A valid before-work image is required' });
    }

    if (!beforeGeo) {
      return res.status(400).json({ success: false, message: 'Valid before-work location is required' });
    }

    if (!normalizeBodyString(beforeGeo.address)) {
      return res.status(400).json({ success: false, message: 'A readable before-work address is required' });
    }

    if (!isAccurateProofGeo(beforeGeo)) {
      return res.status(400).json({ success: false, message: 'Move to open area for accurate GPS' });
    }

    const previousStatus = complaint.status;
    saveBeforeWorkData(complaint, {
      image: beforeImage,
      lat: beforeGeo.lat,
      lng: beforeGeo.lng,
      accuracy: beforeGeo.accuracy,
      address: beforeGeo.address,
      timestamp: beforeGeo.time
    });
    complaint.status = 'in_progress';
    complaint.timeline.push({
      status: 'in_progress',
      updated_by: req.user.id,
      comments: previousStatus === 'rework_required'
        ? 'Worker resubmitted before-work proof and restarted the task'
        : 'Worker submitted before-work proof and started the task'
    });

    await complaint.save();
    const task = await loadTaskForResponse(complaint._id);
    await notifyCitizen(complaint, 'in_progress');
    await createNotificationsForUsers({
      userIds: await getDepartmentHeadIds(complaint.department_id),
      title: 'Worker started the task',
      message: 'Worker started the task',
      type: 'INFO',
      complaintId: complaint._id
    });

    return res.json({
      success: true,
      message: 'Before work submitted',
      complaint: task,
      task
    });
  } catch (error) {
    console.error('[submitBeforeWork] failed', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

const submitAfterWork = async (req, res) => {
  try {
    await runUpload(proofUpload.fields(WORKER_PROOF_FIELDS), req, res);

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!isAssignedTaskUser(complaint, req.user.id)) {
      return res.status(403).json({ message: 'Not assigned to this task' });
    }

    if (complaint.status !== 'in_progress') {
      return res.status(400).json({ message: 'After-work submission is allowed only for in-progress tasks' });
    }

    const beforeWork = getBeforeWorkRecord(complaint);
    if (!beforeWork || !isSafeProofImage(beforeWork.image)) {
      return res.status(400).json({ message: 'Before work must be submitted before after-work proof' });
    }

    const afterUpload = getUploadedFile(req.files, ['afterImageFile', 'proofImage', 'afterImage']);
    const billUpload = getUploadedFile(req.files, ['billImageFile', 'billImage']);
    const afterImage = afterUpload
      ? toUploadedPath(afterUpload)
      : normalizeBodyString(req.body.afterImage || req.body.after_image);
    const billImage = billUpload
      ? toUploadedPath(billUpload)
      : normalizeBodyString(req.body.billImage || req.body.bill_image);
    const description = normalizeBodyString(req.body.workDescription || req.body.description);
    const afterGeo = await enrichProofGeo(req.body, 'after');
    const billGeo = await enrichProofGeo(req.body, 'bill');

    if (!afterImage || !isSafeProofImage(afterImage)) {
      return res.status(400).json({ message: 'A valid after-work image is required' });
    }

    if (!billImage || !isSafeProofImage(billImage)) {
      return res.status(400).json({ message: 'A valid bill copy image is required' });
    }

    if (!description) {
      return res.status(400).json({ message: 'A work description is required' });
    }

    if (!afterGeo) {
      return res.status(400).json({ message: 'Valid after-work location is required' });
    }

    if (!isAccurateProofGeo(afterGeo)) {
      return res.status(400).json({ message: 'Move to open area for accurate GPS' });
    }

    if (billGeo && !isAccurateProofGeo(billGeo)) {
      return res.status(400).json({ message: 'Move to open area for accurate GPS' });
    }

    const finalBillGeo = billGeo || afterGeo;

    saveAfterWorkData(complaint, {
      image: afterImage,
      billImage,
      description,
      lat: afterGeo.lat,
      lng: afterGeo.lng,
      accuracy: afterGeo.accuracy,
      address: afterGeo.address,
      timestamp: afterGeo.time,
      billLat: finalBillGeo.lat,
      billLng: finalBillGeo.lng,
      billAccuracy: finalBillGeo.accuracy,
      billAddress: finalBillGeo.address,
      billTimestamp: finalBillGeo.time
    });
    complaint.status = WORKER_WAITING_FOR_HEAD_STATUS;
    complaint.timeline.push({
      status: WORKER_WAITING_FOR_HEAD_STATUS,
      updated_by: req.user.id,
      comments: 'Worker completed the task and submitted after-work proof with bill'
    });

    await complaint.save();
    const task = await loadTaskForResponse(complaint._id);

    const departmentHeadIds = await getDepartmentHeadIds(complaint.department_id);
    await createNotificationsForUsers({
      userIds: departmentHeadIds,
      title: 'Worker completed the task',
      message: 'Worker completed the task',
      type: 'INFO',
      complaintId: complaint._id
    });

    return res.json({
      success: true,
      message: 'After work submitted successfully',
      complaint: task,
      task
    });
  } catch (err) {
    console.error('[submitAfterWork] failed', err);
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
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
        title: 'New Task Assigned',
        message: 'New Task Assigned',
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

router.patch('/:id/before', auth, authorize('worker', 'volunteer'), upload.single('beforeImage'), submitBeforeWork);
router.post('/:id/before', auth, authorize('worker', 'volunteer'), upload.single('beforeImage'), submitBeforeWork);
router.patch('/tasks/:id/before', auth, authorize('worker', 'volunteer'), upload.single('beforeImage'), submitBeforeWork);
router.post('/tasks/:id/before', auth, authorize('worker', 'volunteer'), upload.single('beforeImage'), submitBeforeWork);
router.post('/start-work/:id', auth, authorize('worker', 'volunteer'), submitBeforeWork);
router.patch('/:id/after', auth, authorize('worker', 'volunteer'), submitAfterWork);
router.post('/:id/after', auth, authorize('worker', 'volunteer'), submitAfterWork);
router.patch('/tasks/:id/after', auth, authorize('worker', 'volunteer'), submitAfterWork);
router.post('/tasks/:id/after', auth, authorize('worker', 'volunteer'), submitAfterWork);
router.post('/update-status/:id', auth, authorize('worker', 'volunteer'), submitAfterWork);

router.get('/verification-queue', auth, authorize('head'), async (req, res) => {
  try {
    const issues = await Complaint.find({
      department_id: req.user.department_id,
      status: { $in: WORKER_REVIEW_STATUSES }
    })
      .populate('assigned_worker_id', 'name')
      .populate('assigned_volunteer_id', 'name')
      .sort({ updatedAt: -1 });

    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/verify/:id', auth, authorize('head'), async (req, res) => {
  try {
    const action = String(req.body.action || '').trim().toLowerCase();
    const comments = String(req.body.comments || '').trim();
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (complaint.department_id?.toString() !== req.user.department_id?.toString()) {
      return res.status(403).json({ message: 'You can only verify work from your own department' });
    }

    if (!WORKER_REVIEW_STATUSES.includes(complaint.status)) {
      return res.status(400).json({ message: 'Only tasks waiting for department head review can be reviewed' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Verification action must be either approve or reject' });
    }

    const approved = action === 'approve';
    complaint.status = approved ? ADMIN_CLOSABLE_STATUS : 'rework_required';
    complaint.verification = {
      status: approved ? 'approved' : 'rejected',
      verified_by: req.user.id,
      verified_at: new Date(),
      comments
    };
    complaint.timeline.push({
      status: approved ? ADMIN_CLOSABLE_STATUS : 'rework_required',
      updated_by: req.user.id,
      comments: comments || (
        approved
          ? 'Department Head verified the submitted work'
          : 'Department Head rejected the submitted work and requested rework'
      )
    });

    await complaint.save();

    if (approved) {
      const adminIds = await getAdminIds();
      await createNotificationsForUsers({
        userIds: adminIds,
        title: 'Task verified with bill',
        message: 'Task verified with bill',
        type: 'SUCCESS',
        complaintId: complaint._id
      });

      return res.json({ message: 'Issue verified successfully', complaint });
    }

    await createNotificationsForUsers({
      userIds: getAssignedUserIds(complaint),
      title: 'Task rejected. Rework required.',
      message: 'Task rejected. Rework required.',
      type: 'ERROR',
      complaintId: complaint._id
    });

    res.json({ message: 'Issue sent back for rework', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/close/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const comments = String(req.body.comments || '').trim();
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (complaint.status !== ADMIN_CLOSABLE_STATUS) {
      return res.status(400).json({ message: 'Only verified issues can be closed by admin' });
    }

    complaint.status = 'completed';
    complaint.timeline.push({
      status: 'completed',
      updated_by: req.user.id,
      comments: comments || 'Admin closed the issue after department verification'
    });

    await complaint.save();
    await notifyCitizen(complaint, 'completed');

    res.json({ message: 'Issue closed successfully', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
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
    
    const tasks = await Complaint.find(query)
      .populate('created_by', 'name')
      .populate('department_id', 'name department_id')
      .populate('assigned_worker_id', 'name')
      .populate('assigned_volunteer_id', 'name')
      .populate('timeline.updated_by', 'name role')
      .sort({ updatedAt: -1 });
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

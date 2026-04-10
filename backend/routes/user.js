const express = require('express');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const { auth } = require('../middleware/auth');
const { hasRole, normalizeUserForClient } = require('../utils/userAccess');

const router = express.Router();

const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const VERIFIED_OR_COMPLETED_STATUSES = ['verified', 'completed'];

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '..', 'uploads', 'profile'));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
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

const buildActivitySummary = async (user) => {
  if (hasRole(user.role, 'public')) {
    const [totalIssuesReported, resolvedIssues] = await Promise.all([
      Complaint.countDocuments({ created_by: user._id }),
      Complaint.countDocuments({ created_by: user._id, status: 'completed' })
    ]);

    return [
      { label: 'Total Issues Reported', value: totalIssuesReported },
      { label: 'Resolved Reports', value: resolvedIssues }
    ];
  }

  if (hasRole(user.role, 'worker')) {
    const [tasksCompleted, assignedTasks] = await Promise.all([
      Complaint.countDocuments({ assigned_worker_id: user._id, status: { $in: VERIFIED_OR_COMPLETED_STATUSES } }),
      Complaint.countDocuments({ assigned_worker_id: user._id })
    ]);

    return [
      { label: 'Tasks Completed', value: tasksCompleted },
      { label: 'Assigned Tasks', value: assignedTasks }
    ];
  }

  if (hasRole(user.role, 'volunteer')) {
    const [tasksCompleted, assignedTasks] = await Promise.all([
      Complaint.countDocuments({ assigned_volunteer_id: user._id, status: { $in: VERIFIED_OR_COMPLETED_STATUSES } }),
      Complaint.countDocuments({ assigned_volunteer_id: user._id })
    ]);

    return [
      { label: 'Tasks Completed', value: tasksCompleted },
      { label: 'Assigned Tasks', value: assignedTasks }
    ];
  }

  if (hasRole(user.role, 'head')) {
    const [assignedTasks, activeTasks, completedTasks] = await Promise.all([
      Complaint.countDocuments({
        department_id: user.department_id,
        $or: [
          { assigned_worker_id: { $ne: null } },
          { assigned_volunteer_id: { $ne: null } }
        ]
      }),
      Complaint.countDocuments({
        department_id: user.department_id,
        status: { $in: ['assigned_to_worker', 'in_progress', 'waiting_for_verification', 'rework_required'] }
      }),
      Complaint.countDocuments({
        department_id: user.department_id,
        status: { $in: VERIFIED_OR_COMPLETED_STATUSES }
      })
    ]);

    return [
      { label: 'Assigned Tasks', value: assignedTasks },
      { label: 'Active Department Tasks', value: activeTasks },
      { label: 'Completed Department Tasks', value: completedTasks }
    ];
  }

  const [totalDepartments, totalIssues] = await Promise.all([
    require('../models/Department').countDocuments(),
    Complaint.countDocuments()
  ]);

  return [
    { label: 'Departments', value: totalDepartments },
    { label: 'Total Issues', value: totalIssues }
  ];
};

const getProfileResponse = async (userId) => {
  const user = await User.findById(userId)
    .select('-password -otp -otpExpiry -refreshToken')
    .populate('department_id', 'name department_id');

  if (!user) {
    return null;
  }

  const activitySummary = await buildActivitySummary(user);

  return {
    user: normalizeUserForClient(user.toObject()),
    activitySummary
  };
};

router.get('/profile', auth, async (req, res) => {
  try {
    const profile = await getProfileResponse(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/update-profile', auth, profileUpload.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number' });
    }

    if (email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    }

    const passwordFieldsProvided = oldPassword || newPassword || confirmPassword;
    if (passwordFieldsProvided) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Fill all password fields to change your password' });
      }

      const passwordMatches = await user.comparePassword(oldPassword);
      if (!passwordMatches) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirmation do not match' });
      }

      if (!PASSWORD_STRENGTH_REGEX.test(newPassword)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, and a number' });
      }

      user.password = newPassword;
    }

    user.name = name;
    user.email = email;
    user.phone = phone;
    user.notification_preferences = {
      issue_updates: String(req.body.issueUpdates) !== 'false',
      assignment_alerts: String(req.body.assignmentAlerts) !== 'false',
      completion_alerts: String(req.body.completionAlerts) !== 'false'
    };

    if (req.file) {
      user.profile_image = `/uploads/profile/${req.file.filename}`;
    }

    await user.save();

    const profile = await getProfileResponse(user._id);
    res.json({
      message: 'Profile updated successfully',
      ...profile
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

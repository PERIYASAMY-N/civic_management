const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, authorize } = require('../middleware/auth');

// Get Pending Users (Admin Only)
router.get('/users/pending', auth, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve User
router.post('/users/approve/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.status = 'approved';
    await user.save();
    res.json({ message: 'User approved successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject User
router.post('/users/reject/:id', auth, authorize('admin', 'head'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.status = 'rejected';
    await user.save();
    res.json({ message: 'User rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Departments
router.get('/departments', auth, async (req, res) => {
  try {
    const depts = await Department.find().populate('head_id', 'name');
    res.json(depts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Department
router.post('/departments', auth, authorize('admin'), async (req, res) => {
  try {
    const { name, department_id, head_id } = req.body;
    const dept = new Department({ name, department_id, head_id });
    await dept.save();
    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

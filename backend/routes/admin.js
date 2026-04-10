const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, authorize } = require('../middleware/auth');
const { getRoleValues, getStatusValues, hasRole } = require('../utils/userAccess');

const DEPARTMENT_COMPLETED_STATUSES = ['verified', 'completed'];

// Get Pending Users (Admin Only)
router.get('/users/pending', auth, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({ status: { $in: getStatusValues('pending') } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve User
router.post('/users/approve/:id', auth, authorize('admin', 'head'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Security: Heads can only approve workers in their department
    if (hasRole(req.user.role, 'head')) {
      if (!hasRole(user.role, 'worker')) {
        return res.status(403).json({ message: 'Heads can only approve Workers' });
      }
      if (user.department_id?.toString() !== req.user.department_id?.toString()) {
        return res.status(403).json({ message: 'You can only approve users from your own department' });
      }
    }

    user.status = 'APPROVED';
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

    // Security: Heads can only reject workers in their department
    if (hasRole(req.user.role, 'head')) {
      if (!hasRole(user.role, 'worker')) {
        return res.status(403).json({ message: 'Heads can only reject Workers' });
      }
      if (user.department_id?.toString() !== req.user.department_id?.toString()) {
        return res.status(403).json({ message: 'You can only reject users from your own department' });
      }
    }

    user.status = 'REJECTED';
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

// Get Department-wise Stats (Admin Only)
router.get('/department-stats', auth, authorize('admin'), async (req, res) => {
  try {
    const workerRoles = getRoleValues('worker');

    const stats = await Department.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'department_id',
          as: 'workers'
        }
      },
      {
        $lookup: {
          from: 'complaints',
          localField: '_id',
          foreignField: 'department_id',
          as: 'issues'
        }
      },
      {
        $project: {
          department: "$name",
          totalWorkers: { 
            $size: { 
              $filter: { input: "$workers", as: "w", cond: { $in: ["$$w.role", workerRoles] } } 
            } 
          },
          totalIssues: { $size: "$issues" },
          assigned: { 
            $size: { 
              $filter: { input: "$issues", as: "i", cond: { 
                $in: ["$$i.status", ["assigned_to_dept", "assigned_to_worker"]] 
              } } 
            } 
          },
          inProgress: { 
            $size: { 
              $filter: { input: "$issues", as: "i", cond: { $in: ["$$i.status", ["in_progress", "waiting_for_verification", "rework_required"]] } } 
            } 
          },
          completed: { 
            $size: { 
              $filter: { input: "$issues", as: "i", cond: { $in: ["$$i.status", DEPARTMENT_COMPLETED_STATUSES] } } 
            } 
          },
          incomplete: { 
            $size: { 
              $filter: { input: "$issues", as: "i", cond: { $not: { $in: ["$$i.status", DEPARTMENT_COMPLETED_STATUSES] } } } 
            } 
          },
          proofSubmitted: {
            $size: {
              $filter: { input: "$issues", as: "i", cond: { $not: { $eq: ["$$i.work_proof.completed_at", null] } } }
            }
          }
        }
      }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get Consolidated Dashboard Stats (Admin Only)
router.get('/dashboard-stats', auth, authorize('admin'), async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    
    const issueStats = await Complaint.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const stats = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      verified: 0,
      volunteers: 0,
      pendingVolunteers: 0
    };

    issueStats.forEach(s => {
      if (['pending', 'assigned_to_dept', 'assigned_to_worker'].includes(s._id)) stats.pending += s.count;
      if (['in_progress', 'waiting_for_verification', 'rework_required'].includes(s._id)) stats.in_progress += s.count;
      if (s._id === 'verified') stats.verified = s.count;
      if (s._id === 'completed') stats.completed = s.count;
    });

    stats.volunteers = await User.countDocuments({
      role: { $in: getRoleValues('volunteer') },
      status: { $in: getStatusValues('approved') }
    });
    stats.pendingVolunteers = await User.countDocuments({
      role: { $in: getRoleValues('volunteer') },
      status: { $in: getStatusValues('pending') }
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

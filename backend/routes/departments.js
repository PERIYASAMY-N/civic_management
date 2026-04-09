const express = require('express');
const Department = require('../models/Department');
const User = require('../models/User');

const router = express.Router();

router.get('/active', async (req, res) => {
  try {
    const activeDepartmentUsers = await User.aggregate([
      {
        $match: {
          department_id: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$department_id',
          activeUsers: { $sum: 1 }
        }
      }
    ]);

    if (!activeDepartmentUsers.length) {
      return res.json([]);
    }

    const activeUserMap = new Map(
      activeDepartmentUsers.map((entry) => [String(entry._id), entry.activeUsers])
    );

    const departments = await Department.find({
      _id: { $in: [...activeUserMap.keys()] }
    })
      .sort({ name: 1 })
      .populate('head_id', 'name')
      .lean();

    res.json(
      departments.map((department) => ({
        ...department,
        activeUsers: activeUserMap.get(String(department._id)) || 0
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

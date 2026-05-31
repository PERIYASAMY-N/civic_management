const express = require('express');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const { getRoleValues } = require('../utils/userAccess');

const router = express.Router();

const COMPLETED_STATUSES = ['completed', 'closed'];
const IN_PROGRESS_STATUSES = ['in_progress', 'waiting_for_head', 'waiting_for_verification', 'rework_required', 'verified'];
const PENDING_STATUSES = ['pending', 'assigned_to_dept', 'assigned_to_worker'];

const roundPercentage = (completed, total) => {
  if (!total) return 0;
  return Number(((completed / total) * 100).toFixed(1));
};

const normalizedStatusExpression = (fieldPath) => ({
  $toLower: { $ifNull: [fieldPath, ''] }
});

const statusInExpression = (fieldPath, statuses) => ({
  $in: [normalizedStatusExpression(fieldPath), statuses]
});

const getDepartmentPerformance = async () => {
  const workerRoles = getRoleValues('worker');

  const [departments, workerCounts, complaintStats] = await Promise.all([
    Department.find().sort({ name: 1 }).lean(),
    require('../models/User').aggregate([
      {
        $match: {
          role: { $in: workerRoles },
          department_id: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$department_id',
          totalWorkers: { $sum: 1 }
        }
      }
    ]),
    Complaint.aggregate([
      { $match: { department_id: { $ne: null } } },
      {
        $group: {
          _id: '$department_id',
          totalIssues: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [statusInExpression('$status', COMPLETED_STATUSES), 1, 0]
            }
          },
          inProgress: {
            $sum: {
              $cond: [statusInExpression('$status', IN_PROGRESS_STATUSES), 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [statusInExpression('$status', PENDING_STATUSES), 1, 0]
            }
          }
        }
      }
    ])
  ]);

  const workerCountByDepartment = new Map(
    workerCounts.map((entry) => [String(entry._id), entry.totalWorkers])
  );
  const complaintStatsByDepartment = new Map(
    complaintStats.map((entry) => [String(entry._id), entry])
  );

  return departments
    .map((department) => {
      const issueStats = complaintStatsByDepartment.get(String(department._id)) || {};
      const totalIssues = issueStats.totalIssues || 0;
      const completed = issueStats.completed || 0;
      const inProgress = issueStats.inProgress || 0;
      const pending = issueStats.pending || 0;

      return {
        department: department.name,
        totalWorkers: workerCountByDepartment.get(String(department._id)) || 0,
        totalIssues,
        completed,
        inProgress,
        pending,
        completionRate: roundPercentage(completed, totalIssues)
      };
    })
    .sort((left, right) => {
      if (right.completionRate !== left.completionRate) {
        return right.completionRate - left.completionRate;
      }
      if (right.completed !== left.completed) {
        return right.completed - left.completed;
      }
      if (right.totalIssues !== left.totalIssues) {
        return right.totalIssues - left.totalIssues;
      }
      return left.department.localeCompare(right.department);
    });
};

router.get('/overview', async (req, res) => {
  try {
    const [totalIssues, totalResolved] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({
        $expr: statusInExpression('$status', COMPLETED_STATUSES)
      })
    ]);

    res.json({
      totalIssues,
      totalResolved,
      performance: roundPercentage(totalResolved, totalIssues)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/department-performance', async (req, res) => {
  try {
    const performance = await getDepartmentPerformance();
    res.json(performance);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/top-users', async (req, res) => {
  try {
    const publicRoles = getRoleValues('public');

    const topUsers = await Complaint.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'created_by',
          foreignField: '_id',
          as: 'creator'
        }
      },
      { $unwind: '$creator' },
      { $match: { 'creator.role': { $in: publicRoles } } },
      {
        $group: {
          _id: '$creator._id',
          name: { $first: '$creator.name' },
          totalIssuesReported: { $sum: 1 }
        }
      },
      { $sort: { totalIssuesReported: -1, name: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          totalIssuesReported: 1
        }
      }
    ]);

    res.json(topUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/top-workers', async (req, res) => {
  try {
    const workerRoles = getRoleValues('worker');

    const topWorkers = await Complaint.aggregate([
      {
        $match: {
          $expr: statusInExpression('$status', COMPLETED_STATUSES),
          assigned_worker_id: { $ne: null }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assigned_worker_id',
          foreignField: '_id',
          as: 'worker'
        }
      },
      { $unwind: '$worker' },
      { $match: { 'worker.role': { $in: workerRoles } } },
      {
        $lookup: {
          from: 'departments',
          localField: 'worker.department_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $unwind: {
          path: '$department',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$worker._id',
          name: { $first: '$worker.name' },
          department: { $first: { $ifNull: ['$department.name', 'Unassigned'] } },
          tasksCompleted: { $sum: 1 }
        }
      },
      { $sort: { tasksCompleted: -1, name: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          department: 1,
          tasksCompleted: 1
        }
      }
    ]);

    res.json(topWorkers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

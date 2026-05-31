const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const { auth, authorize } = require('../middleware/auth');
const { getRoleValues, getStatusValues, hasRole } = require('../utils/userAccess');

const COMPLETED_STATUSES = ['completed'];
const CLOSED_STATUSES = ['closed'];
const RESOLVED_STATUSES = ['completed', 'closed'];
const ASSIGNED_STATUSES = ['assigned_to_dept', 'assigned_to_worker'];
const IN_PROGRESS_STATUSES = ['in_progress', 'waiting_for_head', 'waiting_for_verification', 'verified', 'rework_required'];
const PENDING_STATUSES = ['pending', ...ASSIGNED_STATUSES];
const MS_PER_HOUR = 1000 * 60 * 60;

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

const getDepartmentScope = (user) => (
  hasRole(user.role, 'head') && user.department_id
    ? user.department_id
    : null
);

const getComplaintScopeMatch = (user) => {
  const departmentId = getDepartmentScope(user);
  return departmentId ? { department_id: departmentId } : {};
};

const getPeriodStart = (unit, amount) => {
  const date = new Date();

  if (unit === 'days') {
    date.setDate(date.getDate() - amount);
  }

  if (unit === 'months') {
    date.setMonth(date.getMonth() - amount);
  }

  date.setHours(0, 0, 0, 0);
  return date;
};

const getPeriodStats = async (scopeMatch, startDate) => {
  const [stats = {}] = await Complaint.aggregate([
    {
      $match: {
        ...scopeMatch,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalIssues: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [statusInExpression('$status', PENDING_STATUSES), 1, 0]
          }
        },
        inProgress: {
          $sum: {
            $cond: [statusInExpression('$status', IN_PROGRESS_STATUSES), 1, 0]
          }
        },
        completed: {
          $sum: {
            $cond: [statusInExpression('$status', COMPLETED_STATUSES), 1, 0]
          }
        }
      }
    }
  ]);

  const totalIssues = stats.totalIssues || 0;
  const completed = stats.completed || 0;

  return {
    totalIssues,
    pending: stats.pending || 0,
    inProgress: stats.inProgress || 0,
    completed,
    completionRate: roundPercentage(completed, totalIssues)
  };
};

const getDepartmentStats = async (user) => {
  const workerRoles = getRoleValues('worker');
  const departmentId = getDepartmentScope(user);
  const pipeline = [];

  if (departmentId) {
    pipeline.push({ $match: { _id: departmentId } });
  }

  pipeline.push(
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
        pending: {
          $size: {
            $filter: {
              input: "$issues",
              as: "i",
              cond: statusInExpression("$$i.status", PENDING_STATUSES)
            }
          }
        },
        assigned: {
          $size: {
            $filter: {
              input: "$issues",
              as: "i",
              cond: statusInExpression("$$i.status", ASSIGNED_STATUSES)
            }
          }
        },
        inProgress: {
          $size: {
            $filter: {
              input: "$issues",
              as: "i",
              cond: statusInExpression("$$i.status", IN_PROGRESS_STATUSES)
            }
          }
        },
        completed: {
          $size: {
            $filter: {
              input: "$issues",
              as: "i",
              cond: statusInExpression("$$i.status", COMPLETED_STATUSES)
            }
          }
        },
        incomplete: {
          $size: {
            $filter: {
              input: "$issues",
              as: "i",
              cond: { $not: [statusInExpression("$$i.status", COMPLETED_STATUSES)] }
            }
          }
        },
        proofSubmitted: {
          $size: {
            $filter: { input: "$issues", as: "i", cond: { $ne: ["$$i.work_proof.completed_at", null] } }
          }
        },
        averageResolutionHours: {
          $let: {
            vars: {
              completedIssues: {
                $filter: {
                  input: "$issues",
                  as: "i",
                  cond: statusInExpression("$$i.status", COMPLETED_STATUSES)
                }
              }
            },
            in: {
              $cond: [
                { $gt: [{ $size: "$$completedIssues" }, 0] },
                {
                  $round: [
                    {
                      $divide: [
                        {
                          $avg: {
                            $map: {
                              input: "$$completedIssues",
                              as: "i",
                              in: {
                                $subtract: [
                                  { $ifNull: ["$$i.verifiedAt", "$$i.updatedAt"] },
                                  "$$i.createdAt"
                                ]
                              }
                            }
                          }
                        },
                        MS_PER_HOUR
                      ]
                    },
                    1
                  ]
                },
                0
              ]
            }
          }
        }
      }
    }
  );

  const stats = await Department.aggregate(pipeline);

  return stats.map((department) => ({
    ...department,
    pending: department.pending || 0,
    completionRate: roundPercentage(department.completed || 0, department.totalIssues || 0)
  }));
};

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

// Get Department-wise Stats
router.get('/department-stats', auth, authorize('admin', 'head'), async (req, res) => {
  try {
    const stats = await getDepartmentStats(req.user);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/analytics-summary', auth, authorize('admin', 'head'), async (req, res) => {
  try {
    const scopeMatch = getComplaintScopeMatch(req.user);
    const completedStatusExpr = statusInExpression('$status', COMPLETED_STATUSES);
    const trendStart = getPeriodStart('months', 11);
    trendStart.setDate(1);
    const last30DaysStart = getPeriodStart('days', 30);
    const last6MonthsStart = getPeriodStart('months', 6);

    const [
      totalIssues,
      totalResolved,
      rawStatusStats,
      rawMonthlyTrend,
      averageResolution,
      last30Days,
      last6Months,
      departmentStats
    ] = await Promise.all([
      Complaint.countDocuments(scopeMatch),
      Complaint.countDocuments({
        ...scopeMatch,
        $expr: completedStatusExpr
      }),
      Complaint.aggregate([
        { $match: scopeMatch },
        {
          $project: {
            normalizedStatus: normalizedStatusExpression('$status')
          }
        },
        {
          $group: {
            _id: '$normalizedStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      Complaint.aggregate([
        {
          $match: {
            ...scopeMatch,
            $expr: completedStatusExpr
          }
        },
        {
          $addFields: {
            resolvedAt: { $ifNull: ['$verifiedAt', '$updatedAt'] }
          }
        },
        {
          $match: {
            resolvedAt: { $gte: trendStart }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$resolvedAt' } },
            completed: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            completed: 1
          }
        }
      ]),
      Complaint.aggregate([
        {
          $match: {
            ...scopeMatch,
            $expr: completedStatusExpr
          }
        },
        {
          $project: {
            resolutionMs: {
              $subtract: [
                { $ifNull: ['$verifiedAt', '$updatedAt'] },
                '$createdAt'
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            averageMs: { $avg: '$resolutionMs' }
          }
        }
      ]),
      getPeriodStats(scopeMatch, last30DaysStart),
      getPeriodStats(scopeMatch, last6MonthsStart),
      getDepartmentStats(req.user)
    ]);

    const statusDistribution = rawStatusStats.reduce((acc, stat) => {
      const status = stat._id || '';

      if (COMPLETED_STATUSES.includes(status)) {
        acc.completed += stat.count;
      } else if (IN_PROGRESS_STATUSES.includes(status)) {
        acc.inProgress += stat.count;
      } else if (PENDING_STATUSES.includes(status)) {
        acc.pending += stat.count;
      } else {
        acc.pending += stat.count;
      }

      return acc;
    }, { pending: 0, inProgress: 0, completed: 0 });

    const trendByMonth = new Map(rawMonthlyTrend.map((entry) => [entry.date, entry.completed]));
    const monthlyCompletionTrend = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(trendStart);
      date.setMonth(trendStart.getMonth() + index);
      const dateKey = date.toISOString().slice(0, 7);

      return {
        month: dateKey,
        completed: trendByMonth.get(dateKey) || 0
      };
    });
    const departmentRankings = [...departmentStats].sort((left, right) => {
      if ((right.completionRate || 0) !== (left.completionRate || 0)) {
        return (right.completionRate || 0) - (left.completionRate || 0);
      }

      if ((right.completed || 0) !== (left.completed || 0)) {
        return (right.completed || 0) - (left.completed || 0);
      }

      return String(left.department || '').localeCompare(String(right.department || ''));
    });
    const averageResolutionHours = averageResolution[0]?.averageMs
      ? Number((averageResolution[0].averageMs / MS_PER_HOUR).toFixed(1))
      : 0;

    res.json({
      totalIssues,
      totalResolved,
      performance: roundPercentage(totalResolved, totalIssues),
      averageResolutionHours,
      statusDistribution,
      monthlyCompletionTrend,
      dailyCompletionTrend: monthlyCompletionTrend,
      last30Days,
      last6Months,
      departmentRankings,
      topPerformingDepartment: departmentRankings[0] || null,
      lowestPerformingDepartment: departmentRankings[departmentRankings.length - 1] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Consolidated Dashboard Stats (Admin Only)
router.get('/dashboard-stats', auth, authorize('admin'), async (req, res) => {
  try {
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
      const status = String(s._id || '').toLowerCase();
      if (PENDING_STATUSES.includes(status)) stats.pending += s.count;
      if (IN_PROGRESS_STATUSES.includes(status)) stats.in_progress += s.count;
      if (status === 'verified') stats.verified += s.count;
      if (COMPLETED_STATUSES.includes(status)) stats.completed += s.count;
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
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// NEW ANALYTICS ENDPOINTS
router.get('/department-analytics', auth, authorize('head', 'admin'), async (req, res) => {
  try {
    const scopeMatch = getComplaintScopeMatch(req.user);
    if (!scopeMatch.department_id) {
        return res.status(400).json({ success: false, message: 'Department context required' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Core stats
    const pipeline = [
      { $match: scopeMatch },
      {
        $group: {
          _id: null,
          totalIssues: { $sum: 1 },
          pending: { $sum: { $cond: [statusInExpression('$status', PENDING_STATUSES), 1, 0] } },
          inProgress: { $sum: { $cond: [statusInExpression('$status', IN_PROGRESS_STATUSES), 1, 0] } },
          completed: { $sum: { $cond: [statusInExpression('$status', COMPLETED_STATUSES), 1, 0] } },
          closed: { $sum: { $cond: [statusInExpression('$status', CLOSED_STATUSES), 1, 0] } },
          resolved: { $sum: { $cond: [statusInExpression('$status', RESOLVED_STATUSES), 1, 0] } },
          issuesAssignedThisMonth: { 
            $sum: { $cond: [ { $gte: ['$createdAt', startOfMonth] }, 1, 0 ] } 
          },
          issuesCompletedThisMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    statusInExpression('$status', RESOLVED_STATUSES),
                    { $gte: [ { $ifNull: ['$work_proof.completed_at', { $ifNull: ['$verifiedAt', '$updatedAt'] }] }, startOfMonth ] }
                  ]
                }, 1, 0
              ]
            }
          }
        }
      }
    ];

    const statsResult = await Complaint.aggregate(pipeline);
    const stats = statsResult[0] || {
      totalIssues: 0, pending: 0, inProgress: 0, completed: 0, closed: 0, resolved: 0,
      issuesAssignedThisMonth: 0, issuesCompletedThisMonth: 0
    };

    const completionRate = roundPercentage(stats.resolved, stats.totalIssues);
    
    // Average resolution time
    const avgResResult = await Complaint.aggregate([
      { $match: { ...scopeMatch, $expr: statusInExpression('$status', RESOLVED_STATUSES) } },
      {
        $project: {
          resolutionMs: {
            $subtract: [
              { $ifNull: ['$work_proof.completed_at', { $ifNull: ['$verifiedAt', '$updatedAt'] }] },
              '$createdAt'
            ]
          }
        }
      },
      { $group: { _id: null, averageMs: { $avg: '$resolutionMs' } } }
    ]);
    const averageResolutionHours = avgResResult[0]?.averageMs ? Number((avgResResult[0].averageMs / MS_PER_HOUR).toFixed(1)) : 0;

    // Monthly Issue Trend (Last 12 months)
    const trendStart = getPeriodStart('months', 11);
    trendStart.setDate(1);
    const monthlyIssueTrendResult = await Complaint.aggregate([
      { $match: { ...scopeMatch, createdAt: { $gte: trendStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } }
    ]);
    const issueTrendByMonth = new Map(monthlyIssueTrendResult.map((entry) => [entry._id, entry.count]));

    // Monthly Completion Trend
    const monthlyCompletionTrendResult = await Complaint.aggregate([
      { $match: { ...scopeMatch, $expr: statusInExpression('$status', RESOLVED_STATUSES) } },
      {
        $addFields: {
          resolvedAt: { $ifNull: ['$work_proof.completed_at', { $ifNull: ['$verifiedAt', '$updatedAt'] }] }
        }
      },
      { $match: { resolvedAt: { $gte: trendStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$resolvedAt' } }, count: { $sum: 1 } } }
    ]);
    const completionTrendByMonth = new Map(monthlyCompletionTrendResult.map((entry) => [entry._id, entry.count]));

    const monthlyIssueTrend = [];
    const monthlyCompletionTrend = [];
    for(let i=0; i<12; i++) {
      const d = new Date(trendStart);
      d.setMonth(trendStart.getMonth() + i);
      const dateKey = d.toISOString().slice(0, 7);
      monthlyIssueTrend.push({ month: dateKey, count: issueTrendByMonth.get(dateKey) || 0 });
      monthlyCompletionTrend.push({ month: dateKey, count: completionTrendByMonth.get(dateKey) || 0 });
    }

    // Worker Performance Summary
    const workerRoles = getRoleValues('worker');
    const workers = await User.find({ department_id: scopeMatch.department_id, role: { $in: workerRoles } }, 'name');
    const workerStats = await Complaint.aggregate([
      { $match: scopeMatch },
      { $match: { assigned_worker_id: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$assigned_worker_id',
          assigned: { $sum: 1 },
          completed: { $sum: { $cond: [ statusInExpression('$status', RESOLVED_STATUSES), 1, 0 ] } }
        }
      }
    ]);
    
    const workerPerformance = workers.map(worker => {
      const wStat = workerStats.find(ws => ws._id && ws._id.toString() === worker._id.toString());
      return {
        id: worker._id,
        name: worker.name,
        assigned: wStat ? wStat.assigned : 0,
        completed: wStat ? wStat.completed : 0
      };
    });

    res.json({
      success: true,
      totalIssues: stats.totalIssues,
      pending: stats.pending,
      inProgress: stats.inProgress,
      completed: stats.completed,
      closed: stats.closed,
      completionRate,
      averageResolutionHours,
      issuesAssignedThisMonth: stats.issuesAssignedThisMonth,
      issuesCompletedThisMonth: stats.issuesCompletedThisMonth,
      monthlyIssueTrend,
      monthlyCompletionTrend,
      workerPerformance
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/global-analytics', auth, authorize('admin'), async (req, res) => {
  try {
    const scopeMatch = {};
    const pipeline = [
      { $match: scopeMatch },
      {
        $group: {
          _id: null,
          totalIssues: { $sum: 1 },
          pending: { $sum: { $cond: [statusInExpression('$status', PENDING_STATUSES), 1, 0] } },
          inProgress: { $sum: { $cond: [statusInExpression('$status', IN_PROGRESS_STATUSES), 1, 0] } },
          completed: { $sum: { $cond: [statusInExpression('$status', COMPLETED_STATUSES), 1, 0] } },
          closed: { $sum: { $cond: [statusInExpression('$status', CLOSED_STATUSES), 1, 0] } },
          resolved: { $sum: { $cond: [statusInExpression('$status', RESOLVED_STATUSES), 1, 0] } }
        }
      }
    ];

    const statsResult = await Complaint.aggregate(pipeline);
    const stats = statsResult[0] || { totalIssues: 0, pending: 0, inProgress: 0, completed: 0, closed: 0, resolved: 0 };
    const completionRate = roundPercentage(stats.resolved, stats.totalIssues);
    
    // Department Ranking & comparison
    const deptStats = await Department.aggregate([
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
          totalIssues: { $size: "$issues" },
          pending: {
            $size: {
              $filter: { input: "$issues", as: "i", cond: statusInExpression("$$i.status", PENDING_STATUSES) }
            }
          },
          inProgress: {
            $size: {
              $filter: { input: "$issues", as: "i", cond: statusInExpression("$$i.status", IN_PROGRESS_STATUSES) }
            }
          },
          completed: {
            $size: {
              $filter: { input: "$issues", as: "i", cond: statusInExpression("$$i.status", COMPLETED_STATUSES) }
            }
          },
          closed: {
            $size: {
              $filter: { input: "$issues", as: "i", cond: statusInExpression("$$i.status", CLOSED_STATUSES) }
            }
          },
          resolved: {
            $size: {
              $filter: { input: "$issues", as: "i", cond: statusInExpression("$$i.status", RESOLVED_STATUSES) }
            }
          }
        }
      }
    ]);
    
    let departmentRankings = deptStats.map(d => ({
      ...d,
      completionRate: roundPercentage(d.resolved, d.totalIssues)
    })).sort((a,b) => b.completionRate - a.completionRate);

    // Monthly City-wide Trend
    const trendStart = getPeriodStart('months', 11);
    trendStart.setDate(1);
    const monthlyIssueTrendResult = await Complaint.aggregate([
      { $match: { createdAt: { $gte: trendStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } }
    ]);
    const issueTrendByMonth = new Map(monthlyIssueTrendResult.map((entry) => [entry._id, entry.count]));
    const monthlyCityTrend = [];
    for(let i=0; i<12; i++) {
        const d = new Date(trendStart);
        d.setMonth(trendStart.getMonth() + i);
        const dateKey = d.toISOString().slice(0, 7);
        monthlyCityTrend.push({ month: dateKey, count: issueTrendByMonth.get(dateKey) || 0 });
    }

    res.json({
      success: true,
      globalStats: {
        totalIssues: stats.totalIssues,
        pending: stats.pending,
        inProgress: stats.inProgress,
        completed: stats.completed,
        closed: stats.closed,
        completionRate
      },
      departmentRankings,
      topPerformingDepartment: departmentRankings[0] || null,
      lowestPerformingDepartment: departmentRankings[departmentRankings.length - 1] || null,
      monthlyCityTrend
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;


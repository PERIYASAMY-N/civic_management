const express = require('express');
const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const User = require('../models/User');
const { getRoleValues } = require('../utils/userAccess');

const router = express.Router();

const COMPLETED_STATUSES = ['COMPLETED'];
const IN_PROGRESS_STATUSES = ['BEFORE_WORK_SUBMITTED', 'IN_PROGRESS', 'AFTER_WORK_SUBMITTED', 'WAITING_DEPARTMENT_APPROVAL', 'WAITING_ADMIN_APPROVAL'];
const PENDING_STATUSES = ['PENDING', 'ASSIGNED'];

const roundPercentage = (completed, total) => {
  if (!total) return 0;
  return Number(((completed / total) * 100).toFixed(1));
};

const normalizedStatusExpression = (fieldPath) => ({
  $toUpper: { $ifNull: [fieldPath, ''] }
});

const statusInExpression = (fieldPath, statuses) => ({
  $in: [normalizedStatusExpression(fieldPath), statuses]
});

// GET /api/public/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [totalIssues, pendingIssues, inProgressIssues, completedIssues, departmentsCount, registeredCitizens] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ $expr: statusInExpression('$status', PENDING_STATUSES) }),
      Complaint.countDocuments({ $expr: statusInExpression('$status', IN_PROGRESS_STATUSES) }),
      Complaint.countDocuments({ $expr: statusInExpression('$status', COMPLETED_STATUSES) }),
      Department.countDocuments(),
      User.countDocuments({ role: { $in: getRoleValues('public') } })
    ]);

    const deptStats = await Complaint.aggregate([
      { $match: { department_id: { $ne: null } } },
      { $group: { _id: '$department_id', totalResolved: { $sum: { $cond: [statusInExpression('$status', COMPLETED_STATUSES), 1, 0] } } } },
      { $sort: { totalResolved: -1 } },
      { $limit: 1 }
    ]);
    let topDepartmentName = null;
    if (deptStats.length > 0) {
      const td = await Department.findById(deptStats[0]._id);
      if (td) topDepartmentName = td.name;
    }

    const workerStats = await Complaint.aggregate([
      { $match: { assigned_worker_id: { $ne: null }, $expr: statusInExpression('$status', COMPLETED_STATUSES) } },
      { $group: { _id: '$assigned_worker_id', tasksCompleted: { $sum: 1 } } },
      { $sort: { tasksCompleted: -1 } },
      { $limit: 1 }
    ]);
    let topWorkerName = null;
    if (workerStats.length > 0) {
      const tw = await User.findById(workerStats[0]._id);
      if (tw) topWorkerName = tw.name;
    }

    res.json({
      success: true,
      data: {
        totalIssues,
        pendingIssues,
        inProgressIssues,
        completedIssues,
        totalResolved: completedIssues,
        performance: roundPercentage(completedIssues, totalIssues),
        departments: departmentsCount,
        registeredCitizens,
        topDepartment: topDepartmentName,
        topWorker: topWorkerName,
        resolutionRate: roundPercentage(completedIssues, totalIssues)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/public/issues
router.get('/issues', async (req, res) => {
  try {
    const issues = await Complaint.find()
      .populate('department_id', 'name')
      .select('title category status department_id createdAt work_proof.completed_at beforeImage afterImage location address -_id')
      .lean();

    const formattedIssues = issues.map(issue => ({
      title: issue.title,
      category: issue.category,
      status: issue.status,
      department: issue.department_id ? issue.department_id.name : null,
      createdAt: issue.createdAt,
      completedAt: issue.work_proof ? issue.work_proof.completed_at : null,
      beforeImage: issue.beforeImage,
      afterImage: issue.afterImage,
      location: issue.location,
      address: issue.address
    }));

    res.json({ success: true, data: formattedIssues });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/public/map
router.get('/map', async (req, res) => {
  try {
    const issues = await Complaint.find({ lat: { $ne: null }, lng: { $ne: null } })
      .select('title status lat lng location')
      .lean();

    const features = issues.map(issue => {
      let color = 'red';
      const status = (issue.status || '').toLowerCase();
      if (IN_PROGRESS_STATUSES.includes(status)) color = 'orange';
      if (COMPLETED_STATUSES.includes(status)) color = 'green';

      const latitude = issue.location?.lat || issue.lat;
      const longitude = issue.location?.lng || issue.lng;

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: { title: issue.title, status: issue.status, color }
      };
    }).filter(f => f.geometry.coordinates[0] && f.geometry.coordinates[1]);

    res.json({ success: true, data: { type: 'FeatureCollection', features } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/public/analytics
router.get('/analytics', async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 }).lean();
    
    // Departments Stats
    const workerRoles = getRoleValues('worker');
    const workerCounts = await User.aggregate([
      { $match: { role: { $in: workerRoles }, department_id: { $ne: null } } },
      { $group: { _id: '$department_id', totalWorkers: { $sum: 1 } } }
    ]);
    const workerCountByDepartment = new Map(workerCounts.map(entry => [String(entry._id), entry.totalWorkers]));

    const complaintStats = await Complaint.aggregate([
      { $match: { department_id: { $ne: null } } },
      {
        $group: {
          _id: '$department_id',
          totalIssues: { $sum: 1 },
          completed: { $sum: { $cond: [statusInExpression('$status', COMPLETED_STATUSES), 1, 0] } },
          inProgress: { $sum: { $cond: [statusInExpression('$status', IN_PROGRESS_STATUSES), 1, 0] } },
          pending: { $sum: { $cond: [statusInExpression('$status', PENDING_STATUSES), 1, 0] } }
        }
      }
    ]);
    const complaintStatsByDepartment = new Map(complaintStats.map(entry => [String(entry._id), entry]));

    const departmentPerformance = departments.map(dept => {
      const issueStats = complaintStatsByDepartment.get(String(dept._id)) || {};
      const totalIssues = issueStats.totalIssues || 0;
      const completed = issueStats.completed || 0;
      return {
        department: dept.name,
        totalWorkers: workerCountByDepartment.get(String(dept._id)) || 0,
        totalIssues,
        completed,
        inProgress: issueStats.inProgress || 0,
        pending: issueStats.pending || 0,
        completionRate: roundPercentage(completed, totalIssues)
      };
    }).sort((a, b) => b.completionRate - a.completionRate);

    // Top Workers
    const topWorkers = await Complaint.aggregate([
      { $match: { $expr: statusInExpression('$status', COMPLETED_STATUSES), assigned_worker_id: { $ne: null } } },
      { $lookup: { from: 'users', localField: 'assigned_worker_id', foreignField: '_id', as: 'worker' } },
      { $unwind: '$worker' },
      { $match: { 'worker.role': { $in: workerRoles } } },
      { $lookup: { from: 'departments', localField: 'worker.department_id', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$worker._id', name: { $first: '$worker.name' }, department: { $first: { $ifNull: ['$department.name', 'Unassigned'] } }, tasksCompleted: { $sum: 1 } } },
      { $sort: { tasksCompleted: -1, name: 1 } },
      { $limit: 5 },
      { $project: { _id: 0, id: '$_id', name: 1, department: 1, tasksCompleted: 1 } }
    ]);

    // Top Users
    const publicRoles = getRoleValues('public');
    const topUsers = await Complaint.aggregate([
      { $lookup: { from: 'users', localField: 'created_by', foreignField: '_id', as: 'creator' } },
      { $unwind: '$creator' },
      { $match: { 'creator.role': { $in: publicRoles } } },
      { $group: { _id: '$creator._id', name: { $first: '$creator.name' }, totalIssuesReported: { $sum: 1 } } },
      { $sort: { totalIssuesReported: -1, name: 1 } },
      { $limit: 5 },
      { $project: { _id: 0, id: '$_id', name: 1, totalIssuesReported: 1 } }
    ]);

    res.json({ success: true, data: { departmentPerformance, topWorkers, topUsers } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/public/completed
router.get('/completed', async (req, res) => {
  try {
    const completedIssues = await Complaint.find({ $expr: statusInExpression('$status', COMPLETED_STATUSES) })
      .populate('department_id', 'name')
      .populate('assigned_worker_id', 'name')
      .select('beforeImage afterImage workDescription work_proof createdAt department_id assigned_worker_id -_id')
      .sort({ 'work_proof.completed_at': -1, updatedAt: -1 })
      .lean();

    const formattedCompleted = completedIssues.map(issue => ({
      beforeImage: issue.beforeImage || issue.work_proof?.before_image,
      afterImage: issue.afterImage || issue.work_proof?.after_image,
      department: issue.department_id ? issue.department_id.name : null,
      completedDate: issue.work_proof ? issue.work_proof.completed_at : issue.createdAt,
      workerName: issue.assigned_worker_id ? issue.assigned_worker_id.name : null,
      description: issue.workDescription || issue.work_proof?.description || 'Issue resolved successfully.'
    }));

    res.json({ success: true, data: formattedCompleted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;

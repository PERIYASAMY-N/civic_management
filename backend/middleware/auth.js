const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { hasRole, hasStatus, normalizeRole } = require('../utils/userAccess');

const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is approved
    const user = await User.findById(decoded.id).select('status role department_id');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    if (!hasRole(user.role, 'public') && !hasStatus(user.status, 'approved')) {
      return res.status(403).json({ message: `Access denied. Account status: ${user.status}` });
    }

    req.user = {
      id: user._id,
      role: normalizeRole(user.role),
      department_id: user.department_id,
      status: user.status
    };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!hasRole(req.user.role, roles)) {
      return res.status(403).json({ message: 'User role not authorized' });
    }
    next();
  };
};

module.exports = { auth, authorize };

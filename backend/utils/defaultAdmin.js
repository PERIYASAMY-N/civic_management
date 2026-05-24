const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { getRoleValues, hasRole, hasStatus } = require('./userAccess');

const DEFAULT_ADMIN = {
  name: 'System Admin',
  email: 'admin@civic.gov',
  password: 'admin123',
  role: 'admin',
  status: 'approved'
};

const LEGACY_ADMIN_EMAIL = 'admin@civic.com';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const syncAdminFields = async (user) => {
  let changed = false;

  if (user.name !== DEFAULT_ADMIN.name) {
    user.name = DEFAULT_ADMIN.name;
    changed = true;
  }

  if (normalizeEmail(user.email) !== DEFAULT_ADMIN.email) {
    user.email = DEFAULT_ADMIN.email;
    changed = true;
  }

  if (!hasRole(user.role, 'admin')) {
    user.role = DEFAULT_ADMIN.role;
    changed = true;
  }

  if (!hasStatus(user.status, 'approved')) {
    user.status = DEFAULT_ADMIN.status;
    changed = true;
  }

  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    changed = true;
  }

  if (user.failedLoginAttempts !== 0) {
    user.failedLoginAttempts = 0;
    changed = true;
  }

  if (user.lockUntil) {
    user.lockUntil = undefined;
    changed = true;
  }

  const passwordMatches = await bcrypt.compare(DEFAULT_ADMIN.password, user.password).catch(() => false);
  if (!passwordMatches) {
    user.password = DEFAULT_ADMIN.password;
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return changed;
};

const ensureDefaultAdmin = async (logger = console) => {
  const exactEmail = normalizeEmail(DEFAULT_ADMIN.email);
  const legacyEmail = normalizeEmail(LEGACY_ADMIN_EMAIL);

  let adminUser = await User.findOne({ email: exactEmail });
  if (adminUser) {
    const changed = await syncAdminFields(adminUser);
    logger.log(changed ? `Default admin updated: ${DEFAULT_ADMIN.email}` : `Default admin already configured: ${DEFAULT_ADMIN.email}`);
    return adminUser;
  }

  adminUser = await User.findOne({
    $or: [
      { email: legacyEmail },
      { role: { $in: getRoleValues('admin') } }
    ]
  }).sort({ createdAt: 1 });

  if (adminUser) {
    await syncAdminFields(adminUser);
    logger.log(`Default admin migrated to ${DEFAULT_ADMIN.email}`);
    return adminUser;
  }

  adminUser = new User({
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    password: DEFAULT_ADMIN.password,
    role: DEFAULT_ADMIN.role,
    status: DEFAULT_ADMIN.status,
    isEmailVerified: true,
    failedLoginAttempts: 0
  });

  await adminUser.save();
  logger.log(`Default admin created: ${DEFAULT_ADMIN.email}`);
  return adminUser;
};

module.exports = {
  DEFAULT_ADMIN,
  ensureDefaultAdmin
};

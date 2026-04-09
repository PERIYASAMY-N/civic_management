const ROLE_VALUE_MAP = {
  PUBLIC: ['PUBLIC', 'public'],
  ADMIN: ['ADMIN', 'admin'],
  DEPT_HEAD: ['DEPT_HEAD', 'head'],
  WORKER: ['WORKER', 'worker'],
  VOLUNTEER: ['VOLUNTEER', 'volunteer']
};

const STATUS_VALUE_MAP = {
  PENDING: ['PENDING', 'pending'],
  APPROVED: ['APPROVED', 'approved'],
  REJECTED: ['REJECTED', 'rejected']
};

const ROLE_ALIAS_MAP = {
  public: 'PUBLIC',
  admin: 'ADMIN',
  head: 'DEPT_HEAD',
  dept_head: 'DEPT_HEAD',
  worker: 'WORKER',
  volunteer: 'VOLUNTEER'
};

const STATUS_ALIAS_MAP = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED'
};

const normalizeRole = (role) => {
  if (!role) return role;
  const key = String(role).trim().toLowerCase();
  return ROLE_ALIAS_MAP[key] || String(role).trim().toUpperCase();
};

const normalizeStatus = (status) => {
  if (!status) return status;
  const key = String(status).trim().toLowerCase();
  return STATUS_ALIAS_MAP[key] || String(status).trim().toUpperCase();
};

const unique = (values) => [...new Set(values)];

const getRoleValues = (...roles) => unique(
  roles.flat().flatMap((role) => ROLE_VALUE_MAP[normalizeRole(role)] || [role])
);

const getStatusValues = (...statuses) => unique(
  statuses.flat().flatMap((status) => STATUS_VALUE_MAP[normalizeStatus(status)] || [status])
);

const hasRole = (role, ...targets) => {
  const normalizedRole = normalizeRole(role);
  return targets.flat().some((target) => normalizeRole(target) === normalizedRole);
};

const hasStatus = (status, ...targets) => {
  const normalizedStatus = normalizeStatus(status);
  return targets.flat().some((target) => normalizeStatus(target) === normalizedStatus);
};

const normalizeUserForClient = (user) => ({
  ...user,
  role: normalizeRole(user.role),
  status: normalizeStatus(user.status)
});

module.exports = {
  getRoleValues,
  getStatusValues,
  hasRole,
  hasStatus,
  normalizeRole,
  normalizeStatus,
  normalizeUserForClient
};

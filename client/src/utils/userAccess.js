export const normalizeRole = (role) => {
  if (!role) return role;

  switch (String(role).trim().toLowerCase()) {
    case 'public':
      return 'PUBLIC';
    case 'admin':
      return 'ADMIN';
    case 'head':
    case 'dept_head':
      return 'DEPT_HEAD';
    case 'worker':
      return 'WORKER';
    case 'volunteer':
      return 'VOLUNTEER';
    default:
      return String(role).trim().toUpperCase();
  }
};

export const normalizeStatus = (status) => {
  if (!status) return status;

  switch (String(status).trim().toLowerCase()) {
    case 'pending':
      return 'PENDING';
    case 'approved':
      return 'APPROVED';
    case 'rejected':
      return 'REJECTED';
    default:
      return String(status).trim().toUpperCase();
  }
};

export const hasRole = (role, ...targets) => {
  const normalizedRole = normalizeRole(role);
  return targets.flat().some((target) => normalizeRole(target) === normalizedRole);
};

export const isApproved = (status) => normalizeStatus(status) === 'APPROVED';

export const normalizeUser = (user) => {
  if (!user) return user;

  return {
    ...user,
    role: normalizeRole(user.role),
    status: normalizeStatus(user.status)
  };
};

export const getRoleLabel = (role) => {
  switch (normalizeRole(role)) {
    case 'PUBLIC':
      return 'Public User';
    case 'ADMIN':
      return 'Admin';
    case 'DEPT_HEAD':
      return 'Department Head';
    case 'WORKER':
      return 'Worker';
    case 'VOLUNTEER':
      return 'Volunteer';
    default:
      return role;
  }
};

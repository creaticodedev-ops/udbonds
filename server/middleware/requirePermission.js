import { OWNER_PERMISSIONS } from '../models/User.js';
import { resolveOwnerPermissions } from '../utils/ownerPermissions.js';

/**
 * Owner: empty permissions[] = full access (default).
 * Staff: empty permissions[] = deny (must be explicit).
 */
export const requirePermission = (permission) => (req, res, next) => {
  if (!OWNER_PERMISSIONS.includes(permission)) {
    return next();
  }

  const isStaff = req.user?.role === 'staff';
  const perms = resolveOwnerPermissions(req.user?.permissions);

  if (!isStaff && (!Array.isArray(perms) || perms.length === 0)) {
    return next(); // owner full access
  }

  if (isStaff && (!Array.isArray(perms) || perms.length === 0)) {
    return res.status(403).json({
      success: false,
      message: `Missing permission: ${permission}`,
      code: 'PERMISSION_DENIED',
    });
  }

  if (!perms.includes(permission)) {
    return res.status(403).json({
      success: false,
      message: `Missing permission: ${permission}`,
      code: 'PERMISSION_DENIED',
    });
  }

  next();
};

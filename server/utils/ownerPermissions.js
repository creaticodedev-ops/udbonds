import { OWNER_PERMISSIONS } from '../models/User.js';

/**
 * Normalize owner permission lists by filtering invalid entries.
 * Empty permissions[] remains full access (unchanged).
 */
export const resolveOwnerPermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return permissions;
  }

  return Array.from(new Set(permissions.filter((p) => OWNER_PERMISSIONS.includes(p))));
};

/** Persist normalized permissions for owners. */
export const syncOwnerPermissions = async (user) => {
  if (!user || user.role !== 'owner') return user;

  const current = user.permissions;
  if (!Array.isArray(current) || current.length === 0) return user;

  const resolved = resolveOwnerPermissions(current);
  if (resolved.length === current.length) return user;

  user.permissions = resolved;
  await user.save();
  return user;
};

export default { resolveOwnerPermissions, syncOwnerPermissions };

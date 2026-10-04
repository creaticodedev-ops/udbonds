export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access only',
      code: 'SUPERADMIN_REQUIRED',
    });
  }

  if (req.user.accountStatus && req.user.accountStatus !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'This Super Admin account is not active',
      code: 'ACCOUNT_LOCKED',
    });
  }

  next();
};

import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "not authorized" });
    }

    req.user = await User.findById(userId).select("-password");
    if (!req.user) {
      return res.status(401).json({ success: false, message: "not authorized" });
    }

    const tokenVersion = decoded.tv ?? 0;
    if ((req.user.tokenVersion || 0) !== tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
        code: "TOKEN_REVOKED",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "not authorized" });
  }
};

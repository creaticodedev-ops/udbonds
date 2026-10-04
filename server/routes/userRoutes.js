import express from "express";
import {
  getCarBookingRules,
  getCarById,
  getCars,
  getUserData,
  loginUser,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const userRouter = express.Router();

userRouter.post('/login', rateLimit({ windowMs: 15 * 60_000, max: 20, message: 'Too many login attempts' }), loginUser);
userRouter.get('/data', protect, getUserData);
userRouter.get('/cars', getCars);
userRouter.get('/cars/:id/booking-rules', getCarBookingRules);
userRouter.get('/cars/:id', getCarById);

export default userRouter;

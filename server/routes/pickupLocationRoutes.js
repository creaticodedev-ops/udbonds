import express from "express";
import { protect } from "../middleware/auth.js";
import { requireOwner } from "../middleware/ownerAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
    createPickupLocation,
    deletePickupLocation,
    getAllPickupLocations,
    getActivePickupLocations,
    togglePickupLocation,
    updatePickupLocation
} from "../controllers/pickupLocationController.js";

const pickupLocationRouter = express.Router();
const locGate = [protect, requireOwner, requirePermission('locations')];

pickupLocationRouter.get('/', getActivePickupLocations);

pickupLocationRouter.get('/all', ...locGate, getAllPickupLocations);
pickupLocationRouter.post('/create', ...locGate, createPickupLocation);
pickupLocationRouter.post('/update', ...locGate, updatePickupLocation);
pickupLocationRouter.post('/delete', ...locGate, deletePickupLocation);
pickupLocationRouter.post('/toggle', ...locGate, togglePickupLocation);

export default pickupLocationRouter;

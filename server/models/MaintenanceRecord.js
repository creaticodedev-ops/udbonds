import mongoose from "mongoose";
import { agencyIdField } from "../utils/tenantScope.js";
const { ObjectId } = mongoose.Schema.Types;

/**
 * Service / maintenance history + scheduled work for a vehicle.
 */
const maintenanceRecordSchema = new mongoose.Schema({
  agencyId: agencyIdField,
  owner: { type: ObjectId, ref: "User", required: true, index: true },
  car: { type: ObjectId, ref: "Car", required: true, index: true },
  type: {
    type: String,
    enum: [
      "oil_change",
      "tire_replacement",
      "general_service",
      "repair",
      "inspection",
      "insurance",
      "registration",
      "other",
    ],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  status: {
    type: String,
    enum: ["scheduled", "in_progress", "completed", "cancelled"],
    default: "scheduled",
  },
  scheduledDate: { type: Date, default: null },
  completedDate: { type: Date, default: null },
  mileageAtService: { type: Number, default: null },
  cost: { type: Number, default: 0 },
  vendor: { type: String, default: "" },
  invoiceRef: { type: String, default: "" },
  nextDueDate: { type: Date, default: null },
  nextDueMileage: { type: Number, default: null },
  notes: { type: String, default: "" },
  createdBy: { type: ObjectId, ref: "User", default: null },
}, { timestamps: true });

maintenanceRecordSchema.index({ owner: 1, scheduledDate: 1 });
maintenanceRecordSchema.index({ owner: 1, status: 1, type: 1 });
maintenanceRecordSchema.index({ car: 1, createdAt: -1 });

const MaintenanceRecord = mongoose.model("MaintenanceRecord", maintenanceRecordSchema);
export default MaintenanceRecord;

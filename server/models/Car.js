import mongoose from "mongoose";
import { agencyIdField } from "../utils/tenantScope.js";
const {ObjectId} = mongoose.Schema.Types

const carSchema = new mongoose.Schema({
    agencyId: agencyIdField,
    owner: {type: ObjectId, ref: 'User'},
    brand: {type: String, required: true},
    model: {type: String, required: true},
    image: {type: String, default: ''},
    images: {type: [String], default: []},
    year: {type: Number, required: true},
    category: {type: String, required: true},
    seating_capacity: {type: Number, required: true},
    fuel_type: { type: String, required: true },
    transmission: { type: String, required: true },
    pricePerDay: { type: Number, required: true },
    securityDeposit: { type: Number, default: 0 },

    /**
     * Physical asset identity — each unit is unique even if the model is identical.
     * All bookings, maintenance, insurance, and costs attach to this document (_id)
     * and are displayed via fleetId / VIN / plate.
     */
    fleetId: { type: String, trim: true, uppercase: true, default: '' },
    vin: { type: String, trim: true, uppercase: true, default: '' },
    licensePlate: { type: String, trim: true, uppercase: true, default: '' },
    /** Agency branch / depot where this unit is based */
    branch: { type: String, trim: true, default: '' },
    mileage: { type: Number, default: 0 },

    /**
     * Cities where this physical vehicle can be picked up / returned.
     * One vehicle document, many locations — search filters by this list.
     */
    locations: { type: [String], default: [] },
    /** @deprecated Prefer `locations[]`; kept in sync as the primary/first city for legacy code */
    location: { type: String, default: '' },
    description: { type: String, required: true },
    features: { type: [String], default: [] },
    /**
     * Operational availability:
     * available   — ready to rent
     * booked      — currently on an active rental
     * maintenance — out of service / workshop
     */
    status: { type: String, enum: ['available', 'booked', 'maintenance'], default: 'available' },
    isAvaliable: {type: Boolean, default: true},
    // Fleet maintenance & compliance
    nextServiceMileage: { type: Number, default: 0 },
    nextServiceDate: { type: Date, default: null },
    lastServiceDate: { type: Date, default: null },
    insuranceExpiry: { type: Date, default: null },
    registrationExpiry: { type: Date, default: null },
    inspectionExpiry: { type: Date, default: null },
    maintenanceNotes: { type: String, default: '' },
    oilLastChangedAt: { type: Date, default: null },
    oilNextDueAt: { type: Date, default: null },
    oilNextDueMileage: { type: Number, default: 0 },
    tireLastChangedAt: { type: Date, default: null },
    tireNextDueAt: { type: Date, default: null },
    tireNextDueMileage: { type: Number, default: 0 },
    totalMaintenanceCost: { type: Number, default: 0 },
},{timestamps: true})

carSchema.index({ owner: 1 });
carSchema.index({ isAvaliable: 1, location: 1 });
carSchema.index({ isAvaliable: 1, locations: 1 });
carSchema.index({ owner: 1, nextServiceDate: 1 });
carSchema.index({ owner: 1, insuranceExpiry: 1 });
carSchema.index({ owner: 1, status: 1 });
carSchema.index({ owner: 1, category: 1 });
carSchema.index({ owner: 1, branch: 1 });
// Unique asset identifiers per agency (sparse so empty strings don't collide)
carSchema.index(
  { owner: 1, fleetId: 1 },
  { unique: true, partialFilterExpression: { fleetId: { $type: 'string', $gt: '' } } }
);
carSchema.index(
  { owner: 1, vin: 1 },
  { unique: true, partialFilterExpression: { vin: { $type: 'string', $gt: '' } } }
);
carSchema.index(
  { owner: 1, licensePlate: 1 },
  { unique: true, partialFilterExpression: { licensePlate: { $type: 'string', $gt: '' } } }
);

const Car = mongoose.model('Car', carSchema)

export default Car

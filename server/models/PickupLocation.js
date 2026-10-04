import mongoose from "mongoose";
import { agencyIdField } from "../utils/tenantScope.js";

const { ObjectId } = mongoose.Schema.Types;

const pickupLocationSchema = new mongoose.Schema({
    /** Canonical tenant key (P1) */
    agencyId: agencyIdField,
    /** Legacy primary owner user id (P0 compat / upload paths) */
    owner: {
        type: ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    name: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    googleMapsLink: { type: String, default: '' },
    locationType: {
        type: String,
        enum: ['airport', 'hotel', 'office', 'custom'],
        default: 'custom'
    },
    /** Delivery / transfer fee in MAD (DH). 0 = free delivery. */
    deliveryFee: { type: Number, default: 0, min: 0 },
    /** Optional map coordinates (decimal degrees). */
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

pickupLocationSchema.index({ owner: 1, isActive: 1 });

const PickupLocation = mongoose.model('PickupLocation', pickupLocationSchema);

export default PickupLocation;

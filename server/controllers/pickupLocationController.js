import PickupLocation from "../models/PickupLocation.js";
import { safeErrorMessage } from "../utils/helpers.js";
import { requirePublicAgency, resolvePublicAgency } from "../services/publicTenant.js";
import { andTenant, publicAgencyFilter, tenantWriteFields } from "../utils/tenantScope.js";

const defaultLocations = [
    { name: 'Casablanca Airport', city: 'Casablanca', address: 'Mohammed V International Airport, Casablanca', locationType: 'airport', deliveryFee: 0, isActive: true },
    { name: 'Marrakech Airport', city: 'Marrakech', address: 'Marrakech Menara Airport', locationType: 'airport', deliveryFee: 0, isActive: true },
    { name: 'Rabat City Center', city: 'Rabat', address: 'Avenue Mohammed V, Rabat', locationType: 'office', deliveryFee: 0, isActive: true },
    { name: 'Sale Office', city: 'Sale', address: 'Boulevard Mohammed VI, Sale', locationType: 'office', deliveryFee: 0, isActive: true },
];

const ALLOWED_TYPES = new Set(['airport', 'office', 'hotel', 'custom']);

const parseDeliveryFee = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
};

/** Empty / null clears the coordinate; otherwise validates range. */
const parseCoordinate = (value, { min, max }) => {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
        const err = new Error(`Coordinate must be between ${min} and ${max}`);
        err.status = 400;
        throw err;
    }
    return Math.round(n * 1e6) / 1e6;
};

const applyLocationFields = (location, body, { requireCore = false } = {}) => {
    const {
        name,
        city,
        address,
        googleMapsLink,
        locationType,
        deliveryFee,
        latitude,
        longitude,
        isActive,
    } = body;

    if (requireCore || name !== undefined) {
        const trimmed = String(name ?? '').trim();
        if (!trimmed) {
            const err = new Error('Name, city, and address are required');
            err.status = 400;
            throw err;
        }
        location.name = trimmed;
    }
    if (requireCore || city !== undefined) {
        const trimmed = String(city ?? '').trim();
        if (!trimmed) {
            const err = new Error('Name, city, and address are required');
            err.status = 400;
            throw err;
        }
        location.city = trimmed;
    }
    if (requireCore || address !== undefined) {
        const trimmed = String(address ?? '').trim();
        if (!trimmed) {
            const err = new Error('Name, city, and address are required');
            err.status = 400;
            throw err;
        }
        location.address = trimmed;
    }
    if (googleMapsLink !== undefined) {
        location.googleMapsLink = String(googleMapsLink || '').trim();
    }
    if (locationType !== undefined) {
        if (ALLOWED_TYPES.has(locationType)) location.locationType = locationType;
    }
    if (deliveryFee !== undefined) {
        location.deliveryFee = parseDeliveryFee(deliveryFee);
    }
    if (latitude !== undefined) {
        location.latitude = parseCoordinate(latitude, { min: -90, max: 90 });
    }
    if (longitude !== undefined) {
        location.longitude = parseCoordinate(longitude, { min: -180, max: 180 });
    }
    if (isActive !== undefined) {
        location.isActive = Boolean(isActive);
    }
};

/** Seed default locations for one agency/owner when they have none. */
export const ensureOwnerDefaultLocations = async (ownerId, agencyId = null) => {
    if (!ownerId && !agencyId) return;
    const countFilter = agencyId ? { agencyId } : { owner: ownerId };
    const count = await PickupLocation.countDocuments(countFilter);
    if (count > 0) return;
    await PickupLocation.insertMany(
        defaultLocations.map((loc) => ({
            ...loc,
            owner: ownerId,
            agencyId: agencyId || null,
        })),
    );
    console.log(`[pickupLocations] Seeded defaults for agency=${agencyId || 'n/a'} owner=${ownerId}`);
};

/**
 * Backfill ownerless pickup rows to the resolved public agency/owner.
 * Safe no-op when there are no orphans or public agency cannot be resolved.
 */
export const backfillPickupLocationOwners = async () => {
    const orphanFilter = {
        $or: [{ owner: { $exists: false } }, { owner: null }],
    };
    const orphanCount = await PickupLocation.countDocuments(orphanFilter);
    if (orphanCount === 0) return { updated: 0 };

    let agency;
    try {
        agency = await resolvePublicAgency();
    } catch {
        console.warn(
            `[pickupLocations] ${orphanCount} ownerless location(s) found but public agency unresolved — skipping backfill`,
        );
        return { updated: 0, skipped: orphanCount };
    }

    const result = await PickupLocation.updateMany(orphanFilter, {
        $set: {
            owner: agency.legacyOwnerId,
            ...(agency.agencyId ? { agencyId: agency.agencyId } : {}),
        },
    });
    const updated = result.modifiedCount || 0;
    if (updated > 0) {
        console.log(`[pickupLocations] Backfilled ${updated} location(s) → agency=${agency.agencyId}`);
    }
    return { updated, agencyId: agency.agencyId };
};

/** @deprecated use backfillPickupLocationOwners + ensureOwnerDefaultLocations */
export const seedPickupLocations = async () => {
    await backfillPickupLocationOwners();
    try {
        const agency = await resolvePublicAgency();
        await ensureOwnerDefaultLocations(agency.legacyOwnerId, agency.agencyId);
    } catch {
        /* multi-agency / unset env: do not plant global rows */
    }
};

export const getActivePickupLocations = async (req, res) => {
    try {
        const agency = await requirePublicAgency(req, res);
        if (!agency) return;

        await ensureOwnerDefaultLocations(agency.legacyOwnerId, agency.agencyId);
        const locations = await PickupLocation.find({
            ...publicAgencyFilter(agency),
            isActive: true,
        }).sort({ city: 1, name: 1 });
        res.json({ success: true, locations });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to load pickup locations' });
    }
};

export const getAllPickupLocations = async (req, res) => {
    try {
        const ownerId = req.agencyLegacyOwnerId || req.user._id;
        await ensureOwnerDefaultLocations(ownerId, req.agencyId);
        const locations = await PickupLocation.find(andTenant(req)).sort({ createdAt: -1 });
        res.json({ success: true, locations });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to load locations' });
    }
};

export const createPickupLocation = async (req, res) => {
    try {
        const location = new PickupLocation(tenantWriteFields(req));
        applyLocationFields(location, {
            ...req.body,
            locationType: ALLOWED_TYPES.has(req.body.locationType) ? req.body.locationType : 'custom',
            deliveryFee: req.body.deliveryFee ?? 0,
            googleMapsLink: req.body.googleMapsLink ?? '',
            isActive: req.body.isActive !== undefined ? req.body.isActive : true,
            latitude: req.body.latitude ?? null,
            longitude: req.body.longitude ?? null,
        }, { requireCore: true });

        await location.save();
        res.status(201).json({ success: true, message: 'Pickup location added', location });
    } catch (error) {
        console.error(error.message);
        const status = error.status || 500;
        res.status(status).json({
            success: false,
            message: status === 400 ? error.message : safeErrorMessage(error, 'Failed to create location'),
        });
    }
};

export const updatePickupLocation = async (req, res) => {
    try {
        const { locationId } = req.body;

        const location = await PickupLocation.findOne(andTenant(req, { _id: locationId }));
        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }

        applyLocationFields(location, req.body);
        if (!location.agencyId && req.agencyId) location.agencyId = req.agencyId;
        await location.save();
        res.json({ success: true, message: 'Pickup location updated', location });
    } catch (error) {
        console.error(error.message);
        const status = error.status || 500;
        res.status(status).json({
            success: false,
            message: status === 400 ? error.message : safeErrorMessage(error, 'Failed to update location'),
        });
    }
};

export const deletePickupLocation = async (req, res) => {
    try {
        const { locationId } = req.body;
        const location = await PickupLocation.findOneAndDelete(andTenant(req, { _id: locationId }));

        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }

        res.json({ success: true, message: 'Pickup location deleted' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to delete location' });
    }
};

export const togglePickupLocation = async (req, res) => {
    try {
        const { locationId } = req.body;
        const location = await PickupLocation.findOne(andTenant(req, { _id: locationId }));

        if (!location) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }

        location.isActive = !location.isActive;
        if (!location.agencyId && req.agencyId) location.agencyId = req.agencyId;
        await location.save();

        res.json({
            success: true,
            message: `Location ${location.isActive ? 'enabled' : 'disabled'}`,
            location
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to toggle location' });
    }
};

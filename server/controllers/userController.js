import User from "../models/User.js"
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import Car from "../models/Car.js";
import mongoose from 'mongoose';
import { groupCarsForCatalog, withCatalogDisplayOrders } from '../utils/carCatalog.js';
import {
  syncLicenseStatus,
  serializeLicense,
  createTrialDefaults,
} from '../services/licenseService.js';
import { syncOwnerPermissions, resolveOwnerPermissions } from '../utils/ownerPermissions.js';
import { normalizeEmail, findUserByEmail } from '../utils/emailUtils.js';
import { BRAND_NAME } from '../utils/brand.js';
import Agency from '../models/Agency.js';
import { attachDisplayPromotions } from '../services/promotionDisplayService.js';
import { getBookingSettings } from '../services/bookingSettingsService.js';
import { getModelUnavailablePeriods } from '../services/availabilityService.js';
import { parseAgencyDateTime } from '../utils/moroccoTime.js';
import { requirePublicAgency } from '../services/publicTenant.js';
import { publicAgencyFilter } from '../utils/tenantScope.js';

/** Normalize owner id whether it is ObjectId, string, or populated `{ _id }`. */
const ownerKey = (owner) => {
    if (!owner) return '';
    if (typeof owner === 'object' && owner._id) return String(owner._id);
    return String(owner);
};

/** Attach public booking duration rules so the customer UI can guide date selection. */
const attachBookingRules = async (carsInput) => {
    const single = !Array.isArray(carsInput);
    const cars = single ? [carsInput] : carsInput;
    if (!cars.length) return carsInput;

    const ownerIds = [...new Set(cars.map((c) => ownerKey(c?.owner)).filter(Boolean))];
    const settingsByOwner = {};
    await Promise.all(
        ownerIds.map(async (id) => {
            settingsByOwner[id] = await getBookingSettings(id);
        }),
    );

    const mapped = cars.map((car) => {
        const settings = settingsByOwner[ownerKey(car?.owner)] || {};
        return {
            ...car,
            bookingRules: {
                minRentalDays: Number(settings.minRentalDays) || 1,
                maxRentalDays: Number(settings.maxRentalDays) || 90,
                advanceBookingDays: Number(settings.advanceBookingDays) || 365,
                pickupHoursStart: settings.pickupHoursStart || '08:00',
                pickupHoursEnd: settings.pickupHoursEnd || '20:00',
                returnHoursStart: settings.returnHoursStart || '08:00',
                returnHoursEnd: settings.returnHoursEnd || '20:00',
            },
        };
    });
    return single ? mapped[0] : mapped;
};

const generateToken = (user) => {
    const payload = { _id: user._id.toString(), tv: user.tokenVersion || 0 };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const normalizedEmail = normalizeEmail(email);
        const user = await findUserByEmail(User, normalizedEmail);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Admin account not found' });
        }
        if (user.role === 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Use the Super Admin login page',
                code: 'USE_SUPERADMIN_LOGIN',
            });
        }
        if (user.role !== 'owner' && user.role !== 'staff') {
            return res.status(403).json({ success: false, message: 'Admin access only' });
        }
        if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
            let lockedMessage = `This admin account has been suspended or disabled. Contact ${BRAND_NAME}.`;
            if (user.role === 'owner' && user.agencyId) {
              const agency = await Agency.findById(user.agencyId).select('status rejectedAt').lean();
              if (agency?.status === 'rejected' || agency?.rejectedAt) {
                lockedMessage = 'This RSZ CAR agency request was not approved. Contact support if you believe this is a mistake.';
              }
            }
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_LOCKED',
                message: lockedMessage,
            });
        }

        // Pending invite: must use activation link until password is chosen
        if (user.accountStatus === 'pending' && !user.passwordSetAt) {
            return res.status(403).json({
                success: false,
                code: 'ONBOARDING_REQUIRED',
                message:
                  user.role === 'staff'
                    ? 'Complete staff activation using the invitation link from your agency owner.'
                    : 'Complete account activation using the invitation link from your platform admin.',
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Self-serve signup awaiting Super Admin approval — no dashboard, no setup wizard
        if (user.role === 'owner' && user.accountStatus === 'pending' && user.passwordSetAt) {
            const agency = user.agencyId
              ? await Agency.findById(user.agencyId).select('status createdVia').lean()
              : null;
            if (agency?.createdVia === 'self_serve' && agency.status === 'pending') {
                return res.status(403).json({
                    success: false,
                    code: 'APPROVAL_PENDING',
                    message:
                      'Your RSZ CAR agency is awaiting approval. You will receive an email when it is activated.',
                });
            }
            user.lastLoginAt = new Date();
            await user.save();
            const token = generateToken(user);
            return res.json({
                success: true,
                token,
                onboardingRequired: true,
                redirectTo: '/agency-setup',
                license: serializeLicense(user),
            });
        }

        // Staff should never be pending after password set (activation flips to active)
        if (user.role === 'staff' && user.accountStatus === 'pending') {
            return res.status(403).json({
                success: false,
                code: 'ONBOARDING_REQUIRED',
                message: 'Complete staff activation using the invitation link.',
            });
        }

        if (user.role === 'owner') {
            if (!user.trialEndsAt && user.licenseStatus !== 'active') {
                Object.assign(user, createTrialDefaults(user.createdAt || new Date()));
                await user.save();
            } else {
                await syncLicenseStatus(user);
            }
            await syncOwnerPermissions(user);
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = generateToken(user);
        const license =
          user.role === 'owner'
            ? serializeLicense(user)
            : {
                licenseStatus: 'active',
                allowed: true,
                writeAllowed: true,
                trialEndsAt: null,
                daysRemaining: null,
              };

        res.json({
            success: true,
            token,
            onboardingRequired: false,
            license,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
};

export const getUserData = async (req, res) => {
    try {
        const { user } = req;
        if (user.role === 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Use the Super Admin panel',
                code: 'USE_SUPERADMIN_LOGIN',
            });
        }
        if (user.role !== 'owner' && user.role !== 'staff') {
            return res.status(403).json({ success: false, message: 'Admin access only' });
        }
        if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_LOCKED',
                message: 'This admin account has been suspended or disabled.',
            });
        }

        // Pending owners with a password may resume the setup wizard (not the dashboard)
        if (user.role === 'owner' && user.accountStatus === 'pending') {
            if (!user.passwordSetAt) {
                return res.status(403).json({
                    success: false,
                    code: 'ONBOARDING_REQUIRED',
                    message: 'Complete account activation using the invitation link.',
                });
            }
            const agency = user.agencyId
              ? await Agency.findById(user.agencyId).select('status createdVia').lean()
              : null;
            if (agency?.createdVia === 'self_serve' && agency.status === 'pending') {
                return res.status(403).json({
                    success: false,
                    code: 'APPROVAL_PENDING',
                    message:
                      'Your RSZ CAR agency is awaiting approval. You will receive an email when it is activated.',
                });
            }
            const safePending = user.toObject ? user.toObject() : { ...user };
            delete safePending.password;
            delete safePending.inviteTokenHash;
            return res.json({
                success: true,
                onboardingRequired: true,
                user: {
                    ...safePending,
                    permissions: [],
                },
                license: serializeLicense(user),
            });
        }

        if (user.role === 'staff' && user.accountStatus === 'pending') {
            return res.status(403).json({
                success: false,
                code: 'ONBOARDING_REQUIRED',
                message: 'Complete staff activation using the invitation link.',
            });
        }

        if (user.role === 'owner') {
          await syncLicenseStatus(user);
        }

        if (user.role === 'owner' && user.agencyId) {
          try {
            const billing = await import('../services/billingService.js');
            let sub = await billing.getCurrentSubscription(user.agencyId);
            if (!sub) {
              const Agency = (await import('../models/Agency.js')).default;
              const agency = await Agency.findById(user.agencyId).lean();
              if (agency) {
                await billing.migrateAgencyBillingFromOwner(agency);
                sub = await billing.getCurrentSubscription(user.agencyId);
              }
            }
            if (sub) {
              await billing.syncOwnerLicenseFromSubscription(user.agencyId, sub);
              const mapped = billing.mapSubscriptionToUserLicense(sub);
              Object.assign(user, mapped);
            }
          } catch (billingErr) {
            console.warn('[getUserData] billing sync', billingErr.message);
          }
        }

        if (user.role === 'owner') {
          await syncOwnerPermissions(user);
        }

        let license;
        if (user.role === 'owner') {
          license = {
            ...serializeLicense(user),
            writeAllowed: user.licenseStatus === 'active' || user.licenseStatus === 'trial',
          };
          if (user.licenseStatus === 'trial' && user.trialEndsAt && new Date(user.trialEndsAt) < new Date()) {
            license.writeAllowed = false;
            license.allowed = false;
          }
        } else {
          // Staff inherit agency billing at request time via requireOwner
          license = {
            licenseStatus: 'active',
            allowed: true,
            writeAllowed: true,
            trialEndsAt: null,
            daysRemaining: null,
          };
          if (user.agencyId) {
            try {
              const billing = await import('../services/billingService.js');
              const sub = await billing.getCurrentSubscription(user.agencyId);
              if (sub) {
                const ok = billing.subscriptionAllowsWrite(sub);
                license = {
                  licenseStatus: ok ? 'active' : 'expired',
                  allowed: ok,
                  writeAllowed: ok,
                  trialEndsAt: sub.trialEndsAt,
                  subscriptionStatus: sub.status,
                  planCode: sub.planCode,
                  daysRemaining: null,
                };
              }
            } catch {
              /* ignore */
            }
          }
        }

        // Strip password already done by protect; return user + explicit license snapshot
        const safeUser = user.toObject ? user.toObject() : { ...user };
        delete safeUser.password;
        delete safeUser.inviteTokenHash;
        const resolvedPermissions = resolveOwnerPermissions(safeUser.permissions);
        safeUser.permissions = Array.isArray(resolvedPermissions) ? resolvedPermissions : [];

        res.json({
            success: true,
            onboardingRequired: false,
            user: {
                ...safeUser,
                license,
            },
            license,
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch user data' });
    }
};

export const getCars = async (req, res) => {
    try {
        const agency = await requirePublicAgency(req, res);
        if (!agency) return;

        const cars = await Car.find({
            ...publicAgencyFilter(agency),
            isAvaliable: true,
            status: { $ne: 'maintenance' },
        })
            .sort({ createdAt: -1 })
            .lean();
        const catalog = await withCatalogDisplayOrders(groupCarsForCatalog(cars));
        const withPromos = await attachDisplayPromotions(catalog);
        res.json({
            success: true,
            cars: await attachBookingRules(withPromos),
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch cars' });
    }
};

export const getCarById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid car ID' });
        }

        const agency = await requirePublicAgency(req, res);
        if (!agency) return;

        const car = await Car.findOne({
            _id: id,
            isAvaliable: true,
            ...publicAgencyFilter(agency),
        }).lean();
        if (!car) {
            return res.status(404).json({ success: false, message: 'Car not found' });
        }

        const withPromo = await attachDisplayPromotions(car);
        res.json({ success: true, car: await attachBookingRules(withPromo) });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch car' });
    }
};

const publicBookingRules = (settings) => ({
    minRentalDays: Number(settings.minRentalDays) || 1,
    maxRentalDays: Number(settings.maxRentalDays) || 90,
    advanceBookingDays: Number(settings.advanceBookingDays) || 365,
    pickupHoursStart: settings.pickupHoursStart || '08:00',
    pickupHoursEnd: settings.pickupHoursEnd || '20:00',
    returnHoursStart: settings.returnHoursStart || '08:00',
    returnHoursEnd: settings.returnHoursEnd || '20:00',
});

/**
 * Lightweight public endpoint: live booking rules + unavailable date periods
 * for a vehicle model. No customer / booking PII is exposed.
 */
export const getCarBookingRules = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid car ID' });
        }

        const agency = await requirePublicAgency(req, res);
        if (!agency) return;

        const car = await Car.findOne({
            _id: id,
            isAvaliable: true,
            ...publicAgencyFilter(agency),
        })
            .select('owner agencyId brand model')
            .lean();
        if (!car?.owner) {
            return res.status(404).json({ success: false, message: 'Car not found' });
        }

        const settings = await getBookingSettings(car.owner);
        const rules = publicBookingRules(settings);

        const now = new Date();
        const fromParam = req.query?.from ? parseAgencyDateTime(String(req.query.from)) : now;
        const defaultTo = new Date(now.getTime() + (rules.advanceBookingDays || 365) * 86400000);
        const toParam = req.query?.to ? parseAgencyDateTime(String(req.query.to)) : defaultTo;
        const fromDate = Number.isNaN(fromParam.getTime()) ? now : fromParam;
        const toDate = Number.isNaN(toParam.getTime()) ? defaultTo : toParam;

        const { unavailablePeriods, unitCount } = await getModelUnavailablePeriods({
            ownerId: car.owner,
            brand: car.brand,
            model: car.model,
            fromDate,
            toDate,
            preferredCarId: car._id,
        });

        res.json({
            success: true,
            bookingRules: rules,
            unavailablePeriods,
            unitCount,
        });
    } catch (error) {
        console.error('[getCarBookingRules]', error.message);
        res.status(500).json({ success: false, message: 'Failed to load booking rules' });
    }
};

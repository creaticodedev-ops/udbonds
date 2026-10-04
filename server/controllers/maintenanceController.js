import Car from '../models/Car.js';
import Booking from '../models/Booking.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import { logAudit, createNotification } from '../utils/adminOps.js';
import mongoose from 'mongoose';
import { escapeRegex } from '../utils/helpers.js';
import { generateFleetId } from '../utils/fleetAssets.js';

const SERVICE_TYPES = [
  'oil_change',
  'tire_replacement',
  'general_service',
  'repair',
  'inspection',
  'insurance',
  'registration',
  'other',
];

const STATUS_LABEL = {
  available: 'Available',
  booked: 'Rented',
  maintenance: 'In Maintenance',
};

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const carLabel = (car) => {
  const unit = car.fleetId ? `[${car.fleetId}] ` : '';
  const plate = car.licensePlate ? ` · ${car.licensePlate}` : '';
  return `${unit}${car.brand} ${car.model}${plate}`;
};

const pushAlert = (alerts, { type, severity, car, message, date }) => {
  alerts.push({
    type,
    severity,
    carId: car._id,
    vehicle: carLabel(car),
    message,
    date: date || null,
  });
};

const buildAlertsForCar = (car, now, in30) => {
  const alerts = [];
  const checkDate = (type, date, label) => {
    if (!date) return;
    const d = new Date(date);
    if (d <= in30) {
      pushAlert(alerts, {
        type,
        severity: d < now ? 'critical' : 'warning',
        car,
        message: `${label} ${d < now ? 'expired' : 'due'} ${d.toLocaleDateString()}`,
        date: d,
      });
    }
  };

  checkDate('service_date', car.nextServiceDate, 'Service');
  checkDate('insurance', car.insuranceExpiry, 'Insurance');
  checkDate('registration', car.registrationExpiry, 'Registration');
  checkDate('inspection', car.inspectionExpiry, 'Technical inspection');
  checkDate('oil_change', car.oilNextDueAt, 'Oil change');
  checkDate('tire_replacement', car.tireNextDueAt, 'Tire replacement');

  if (car.nextServiceMileage && car.mileage && car.mileage >= car.nextServiceMileage) {
    pushAlert(alerts, {
      type: 'service_mileage',
      severity: 'critical',
      car,
      message: `Service overdue by mileage (${car.mileage} / ${car.nextServiceMileage} km)`,
    });
  }
  if (car.oilNextDueMileage && car.mileage && car.mileage >= car.oilNextDueMileage) {
    pushAlert(alerts, {
      type: 'oil_mileage',
      severity: 'critical',
      car,
      message: `Oil change overdue by mileage (${car.mileage} / ${car.oilNextDueMileage} km)`,
    });
  }
  if (car.tireNextDueMileage && car.mileage && car.mileage >= car.tireNextDueMileage) {
    pushAlert(alerts, {
      type: 'tire_mileage',
      severity: 'warning',
      car,
      message: `Tire replacement due by mileage (${car.mileage} / ${car.tireNextDueMileage} km)`,
    });
  }

  return alerts;
};

const refreshMaintenanceCost = async (carId) => {
  const agg = await MaintenanceRecord.aggregate([
    { $match: { car: new mongoose.Types.ObjectId(carId), status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$cost' } } },
  ]);
  const total = agg[0]?.total || 0;
  await Car.findByIdAndUpdate(carId, { totalMaintenanceCost: total });
  return total;
};

const syncCarFromRecord = async (car, record) => {
  if (record.status !== 'completed') return;

  if (record.mileageAtService != null && record.mileageAtService > (car.mileage || 0)) {
    car.mileage = record.mileageAtService;
  }

  if (record.type === 'oil_change') {
    car.oilLastChangedAt = record.completedDate || new Date();
    if (record.nextDueDate) car.oilNextDueAt = record.nextDueDate;
    if (record.nextDueMileage) car.oilNextDueMileage = record.nextDueMileage;
  }
  if (record.type === 'tire_replacement') {
    car.tireLastChangedAt = record.completedDate || new Date();
    if (record.nextDueDate) car.tireNextDueAt = record.nextDueDate;
    if (record.nextDueMileage) car.tireNextDueMileage = record.nextDueMileage;
  }
  if (record.type === 'general_service' || record.type === 'repair') {
    car.lastServiceDate = record.completedDate || new Date();
    if (record.nextDueDate) car.nextServiceDate = record.nextDueDate;
    if (record.nextDueMileage) car.nextServiceMileage = record.nextDueMileage;
  }
  if (record.type === 'inspection' && record.nextDueDate) {
    car.inspectionExpiry = record.nextDueDate;
  }
  if (record.type === 'insurance' && record.nextDueDate) {
    car.insuranceExpiry = record.nextDueDate;
  }
  if (record.type === 'registration' && record.nextDueDate) {
    car.registrationExpiry = record.nextDueDate;
  }

  await car.save();
  await refreshMaintenanceCost(car._id);
};

/** Fleet overview + alerts + occupancy */
export const getFleetMaintenance = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // Backfill missing fleet IDs so every physical unit is identifiable
    const missingIds = await Car.find({
      owner: ownerId,
      $or: [{ fleetId: '' }, { fleetId: null }, { fleetId: { $exists: false } }],
    });
    for (const c of missingIds) {
      let fleetId = generateFleetId();
      while (await Car.exists({ owner: ownerId, fleetId })) {
        fleetId = generateFleetId();
      }
      c.fleetId = fleetId;
      if (!c.branch && c.location) c.branch = c.location;
      await c.save();
    }

    const {
      search = '',
      fleetId = '',
      vin = '',
      plate = '',
      status = '',
      branch = '',
    } = req.query;

    const filter = { owner: ownerId };
    if (status) filter.status = status;
    if (branch) filter.branch = new RegExp(escapeRegex(branch), 'i');
    if (fleetId) filter.fleetId = new RegExp(escapeRegex(fleetId), 'i');
    if (vin) filter.vin = new RegExp(escapeRegex(vin), 'i');
    if (plate) filter.licensePlate = new RegExp(escapeRegex(plate), 'i');
    if (search.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { fleetId: new RegExp(q, 'i') },
        { vin: new RegExp(q, 'i') },
        { licensePlate: new RegExp(q, 'i') },
        { brand: new RegExp(q, 'i') },
        { model: new RegExp(q, 'i') },
        { branch: new RegExp(q, 'i') },
      ];
    }

    const cars = await Car.find(filter).sort({ fleetId: 1, brand: 1 }).lean();
    const branches = await Car.distinct('branch', { owner: ownerId, branch: { $nin: ['', null] } });
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);

    // Mark rented if currently on an active booking
    const activeBookings = await Booking.find({
      owner: ownerId,
      status: { $in: ['ready_for_pickup', 'active'] },
      pickupDate: { $lte: now },
      returnDate: { $gte: now },
    }).select('car').lean();
    const rentedIds = new Set(activeBookings.map((b) => String(b.car)));

    const enriched = cars.map((car) => {
      let displayStatus = car.status || 'available';
      if (displayStatus === 'maintenance') {
        // keep
      } else if (rentedIds.has(String(car._id))) {
        displayStatus = 'booked';
      }
      return {
        ...car,
        displayStatus,
        displayStatusLabel: STATUS_LABEL[displayStatus] || displayStatus,
      };
    });

    const alerts = [];
    for (const car of enriched) {
      alerts.push(...buildAlertsForCar(car, now, in30));
    }
    alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));

    const summary = {
      total: enriched.length,
      available: enriched.filter((c) => c.displayStatus === 'available').length,
      rented: enriched.filter((c) => c.displayStatus === 'booked').length,
      maintenance: enriched.filter((c) => c.displayStatus === 'maintenance').length,
      criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
      warningAlerts: alerts.filter((a) => a.severity === 'warning').length,
      totalMaintenanceCost: enriched.reduce((s, c) => s + (c.totalMaintenanceCost || 0), 0),
    };

    const upcoming = await MaintenanceRecord.find({
      owner: ownerId,
      status: { $in: ['scheduled', 'in_progress'] },
      scheduledDate: { $gte: now, $lte: in30 },
    })
      .populate('car', 'brand model licensePlate fleetId vin branch')
      .sort({ scheduledDate: 1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      cars: enriched,
      alerts,
      summary,
      upcoming,
      branches,
      serviceTypes: SERVICE_TYPES,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load maintenance data' });
  }
};

export const updateCarMaintenance = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      carId,
      mileage,
      nextServiceMileage,
      nextServiceDate,
      lastServiceDate,
      insuranceExpiry,
      registrationExpiry,
      inspectionExpiry,
      maintenanceNotes,
      status,
      licensePlate,
      oilLastChangedAt,
      oilNextDueAt,
      oilNextDueMileage,
      tireLastChangedAt,
      tireNextDueAt,
      tireNextDueMileage,
    } = req.body;

    const car = await Car.findById(carId);
    if (!car || car.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    if (mileage !== undefined) car.mileage = Number(mileage) || 0;
    if (nextServiceMileage !== undefined) car.nextServiceMileage = Number(nextServiceMileage) || 0;
    if (nextServiceDate !== undefined) car.nextServiceDate = toDate(nextServiceDate);
    if (lastServiceDate !== undefined) car.lastServiceDate = toDate(lastServiceDate);
    if (insuranceExpiry !== undefined) car.insuranceExpiry = toDate(insuranceExpiry);
    if (registrationExpiry !== undefined) car.registrationExpiry = toDate(registrationExpiry);
    if (inspectionExpiry !== undefined) car.inspectionExpiry = toDate(inspectionExpiry);
    if (maintenanceNotes !== undefined) car.maintenanceNotes = maintenanceNotes;
    if (licensePlate !== undefined) car.licensePlate = licensePlate;
    if (oilLastChangedAt !== undefined) car.oilLastChangedAt = toDate(oilLastChangedAt);
    if (oilNextDueAt !== undefined) car.oilNextDueAt = toDate(oilNextDueAt);
    if (oilNextDueMileage !== undefined) car.oilNextDueMileage = Number(oilNextDueMileage) || 0;
    if (tireLastChangedAt !== undefined) car.tireLastChangedAt = toDate(tireLastChangedAt);
    if (tireNextDueAt !== undefined) car.tireNextDueAt = toDate(tireNextDueAt);
    if (tireNextDueMileage !== undefined) car.tireNextDueMileage = Number(tireNextDueMileage) || 0;

    if (status && ['available', 'booked', 'maintenance'].includes(status)) {
      car.status = status;
      if (status === 'maintenance') {
        car.isAvaliable = false;
      } else if (status === 'available') {
        car.isAvaliable = true;
      }
    }

    await car.save();
    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'car.maintenance',
      entityType: 'Car',
      entityId: car._id,
      details: `Updated maintenance profile for ${car.brand} ${car.model}`,
    });

    res.json({ success: true, message: 'Maintenance updated', car });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update maintenance' });
  }
};

export const listMaintenanceRecords = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { carId, status, type, page = 1, limit = 30 } = req.query;
    const filter = { owner: ownerId };
    if (carId && mongoose.isValidObjectId(carId)) filter.car = carId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 30));

    const [records, total] = await Promise.all([
      MaintenanceRecord.find(filter)
        .populate('car', 'brand model licensePlate fleetId vin branch')
        .sort({ scheduledDate: -1, createdAt: -1 })
        .skip((pageNum - 1) * lim)
        .limit(lim)
        .lean(),
      MaintenanceRecord.countDocuments(filter),
    ]);

    res.json({
      success: true,
      records,
      pagination: { total, page: pageNum, limit: lim, totalPages: Math.max(1, Math.ceil(total / lim)) },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load service history' });
  }
};

export const createMaintenanceRecord = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const {
      carId,
      type,
      title,
      description,
      status = 'scheduled',
      scheduledDate,
      completedDate,
      mileageAtService,
      cost,
      vendor,
      invoiceRef,
      nextDueDate,
      nextDueMileage,
      notes,
      setCarInMaintenance,
    } = req.body;

    if (!mongoose.isValidObjectId(carId) || !SERVICE_TYPES.includes(type) || !title?.trim()) {
      return res.status(400).json({ success: false, message: 'Car, type, and title are required' });
    }

    const car = await Car.findById(carId);
    if (!car || car.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const record = await MaintenanceRecord.create({
      owner: ownerId,
      car: carId,
      type,
      title: title.trim(),
      description: description || '',
      status: ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(status) ? status : 'scheduled',
      scheduledDate: toDate(scheduledDate),
      completedDate: toDate(completedDate) || (status === 'completed' ? new Date() : null),
      mileageAtService: mileageAtService != null ? Number(mileageAtService) : null,
      cost: Number(cost) || 0,
      vendor: vendor || '',
      invoiceRef: invoiceRef || '',
      nextDueDate: toDate(nextDueDate),
      nextDueMileage: nextDueMileage != null ? Number(nextDueMileage) : null,
      notes: notes || '',
      createdBy: ownerId,
    });

    if (setCarInMaintenance || status === 'in_progress') {
      car.status = 'maintenance';
      car.isAvaliable = false;
      await car.save();
    }

    if (record.status === 'completed') {
      await syncCarFromRecord(car, record);
      if (car.status === 'maintenance') {
        car.status = 'available';
        car.isAvaliable = true;
        await car.save();
      }
    }

    await logAudit({
      owner: ownerId,
      actor: ownerId,
      action: 'maintenance.create',
      entityType: 'MaintenanceRecord',
      entityId: record._id,
      details: `${type}: ${title} for ${car.brand} ${car.model}`,
    });

    if (record.scheduledDate) {
      await createNotification({
        owner: ownerId,
        type: 'maintenance',
        title: 'Maintenance scheduled',
        message: `${carLabel(car)} — ${title}`,
        link: '/owner/maintenance',
        meta: { recordId: record._id.toString(), carId: String(carId) },
      });
    }

    const populated = await MaintenanceRecord.findById(record._id).populate('car', 'brand model licensePlate');
    res.status(201).json({ success: true, message: 'Maintenance record created', record: populated });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to create maintenance record' });
  }
};

export const updateMaintenanceRecord = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { recordId, ...fields } = req.body;
    if (!mongoose.isValidObjectId(recordId)) {
      return res.status(400).json({ success: false, message: 'Invalid record' });
    }

    const record = await MaintenanceRecord.findById(recordId);
    if (!record || record.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const prevStatus = record.status;
    if (fields.type && SERVICE_TYPES.includes(fields.type)) record.type = fields.type;
    if (fields.title !== undefined) record.title = String(fields.title).trim();
    if (fields.description !== undefined) record.description = fields.description;
    if (fields.status && ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(fields.status)) {
      record.status = fields.status;
    }
    if (fields.scheduledDate !== undefined) record.scheduledDate = toDate(fields.scheduledDate);
    if (fields.completedDate !== undefined) record.completedDate = toDate(fields.completedDate);
    if (fields.mileageAtService !== undefined) {
      record.mileageAtService = fields.mileageAtService != null ? Number(fields.mileageAtService) : null;
    }
    if (fields.cost !== undefined) record.cost = Number(fields.cost) || 0;
    if (fields.vendor !== undefined) record.vendor = fields.vendor;
    if (fields.invoiceRef !== undefined) record.invoiceRef = fields.invoiceRef;
    if (fields.nextDueDate !== undefined) record.nextDueDate = toDate(fields.nextDueDate);
    if (fields.nextDueMileage !== undefined) {
      record.nextDueMileage = fields.nextDueMileage != null ? Number(fields.nextDueMileage) : null;
    }
    if (fields.notes !== undefined) record.notes = fields.notes;

    if (record.status === 'completed' && !record.completedDate) {
      record.completedDate = new Date();
    }

    await record.save();

    const car = await Car.findById(record.car);
    if (car) {
      if (record.status === 'in_progress') {
        car.status = 'maintenance';
        car.isAvaliable = false;
        await car.save();
      }
      if (record.status === 'completed' && prevStatus !== 'completed') {
        await syncCarFromRecord(car, record);
        car.status = 'available';
        car.isAvaliable = true;
        await car.save();
      }
      if (record.status === 'cancelled' && car.status === 'maintenance') {
        car.status = 'available';
        car.isAvaliable = true;
        await car.save();
      }
      if (fields.cost !== undefined || record.status === 'completed') {
        await refreshMaintenanceCost(car._id);
      }
    }

    const populated = await MaintenanceRecord.findById(record._id).populate('car', 'brand model licensePlate');
    res.json({ success: true, message: 'Record updated', record: populated });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to update record' });
  }
};

export const deleteMaintenanceRecord = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { recordId } = req.body;
    const record = await MaintenanceRecord.findById(recordId);
    if (!record || record.owner?.toString() !== ownerId.toString()) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    const carId = record.car;
    await record.deleteOne();
    await refreshMaintenanceCost(carId);
    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to delete record' });
  }
};

export const getMaintenanceCalendar = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    const records = await MaintenanceRecord.find({
      owner: ownerId,
      status: { $ne: 'cancelled' },
      $or: [
        { scheduledDate: { $gte: start, $lte: end } },
        { completedDate: { $gte: start, $lte: end } },
        { nextDueDate: { $gte: start, $lte: end } },
      ],
    })
      .populate('car', 'brand model licensePlate fleetId vin branch')
      .lean();

    // Also include compliance due dates from cars
    const cars = await Car.find({ owner: ownerId }).lean();
    const complianceEvents = [];
    for (const car of cars) {
      const add = (date, type, label) => {
        if (!date) return;
        const d = new Date(date);
        if (d >= start && d <= end) {
          complianceEvents.push({
            _id: `${car._id}-${type}`,
            kind: 'compliance',
            type,
            title: `${label} — ${carLabel(car)}`,
            scheduledDate: d,
            car,
            status: d < new Date() ? 'overdue' : 'upcoming',
          });
        }
      };
      add(car.nextServiceDate, 'general_service', 'Service due');
      add(car.oilNextDueAt, 'oil_change', 'Oil change');
      add(car.tireNextDueAt, 'tire_replacement', 'Tires');
      add(car.insuranceExpiry, 'insurance', 'Insurance');
      add(car.registrationExpiry, 'registration', 'Registration');
      add(car.inspectionExpiry, 'inspection', 'Inspection');
    }

    res.json({
      success: true,
      events: [
        ...records.map((r) => ({ ...r, kind: 'record' })),
        ...complianceEvents,
      ],
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to load maintenance calendar' });
  }
};

export const getMaintenanceReport = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const from = toDate(req.query.from) || new Date(new Date().getFullYear(), 0, 1);
    const to = toDate(req.query.to) || new Date();

    const records = await MaintenanceRecord.find({
      owner: ownerId,
      status: 'completed',
      completedDate: { $gte: from, $lte: to },
    })
      .populate('car', 'brand model licensePlate fleetId vin branch')
      .sort({ completedDate: -1 })
      .lean();

    const byType = {};
    let totalCost = 0;
    for (const r of records) {
      totalCost += r.cost || 0;
      byType[r.type] = byType[r.type] || { count: 0, cost: 0 };
      byType[r.type].count += 1;
      byType[r.type].cost += r.cost || 0;
    }

    const byVehicle = {};
    for (const r of records) {
      const key = r.car?._id?.toString() || 'unknown';
      byVehicle[key] = byVehicle[key] || {
        vehicle: r.car ? carLabel(r.car) : 'Unknown',
        count: 0,
        cost: 0,
      };
      byVehicle[key].count += 1;
      byVehicle[key].cost += r.cost || 0;
    }

    res.json({
      success: true,
      report: {
        from,
        to,
        totalCost,
        recordCount: records.length,
        byType,
        byVehicle: Object.values(byVehicle),
        records,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: 'Failed to build maintenance report' });
  }
};

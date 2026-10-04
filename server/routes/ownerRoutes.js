import express from "express";
import { protect } from "../middleware/auth.js";
import { requireOwner, requireAgencyOwnerRole } from "../middleware/ownerAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import upload, { handleMulterError } from "../middleware/multer.js";
import {
  addCar,
  deleteCar,
  getAdminOverview,
  getCustomers,
  getDashboardData,
  getOwnerCarById,
  getOwnerCars,
  getVehicleStats,
  toggleCarAvailability,
  updateCar,
  updateUserImage,
} from "../controllers/ownerController.js";
import {
  addCustomerNote,
  exportReport,
  getAuditLogs,
  getCrmCustomerDetail,
  getCrmCustomers,
  getNotifications,
  getOpsDashboard,
  getRevenueAnalytics,
  globalSearch,
  markNotificationRead,
  rateCustomer,
  updateCustomerStatus,
} from "../controllers/adminOpsController.js";
import {
  getFleetMaintenance,
  updateCarMaintenance,
  listMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceCalendar,
  getMaintenanceReport,
} from "../controllers/maintenanceController.js";
import {
  getCatalogOrder,
  updateCatalogOrder,
} from "../controllers/catalogOrderController.js";
import {
  getAgencySettings,
  updateAgencySettings,
} from "../controllers/agencySettingsController.js";
import { getOwnerAgency, updateOwnerAgencyBranding, getOwnerAgencyDomains, updateOwnerAgencyDomain, verifyOwnerAgencyDomain } from "../controllers/ownerAgencyController.js";
import {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  setPromotionActive,
  deletePromotion,
  previewPromotion,
} from "../controllers/promotionController.js";
import {
  getOwnerBilling,
  cancelOwnerBilling,
  checkoutOwnerBilling,
  listPublicPlans,
} from "../controllers/billingController.js";
import {
  getOwnerStaff,
  inviteOwnerStaff,
  updateOwnerStaff,
  removeOwnerStaff,
  listStaffRoles,
} from "../controllers/staffController.js";

const ownerRouter = express.Router();
const gate = (perm) => [protect, requireOwner, requirePermission(perm)];
const ownerOnly = [protect, requireOwner, requireAgencyOwnerRole];

ownerRouter.post("/add-car", ...gate('fleet'), upload.single("image"), handleMulterError, addCar);
ownerRouter.get("/cars", ...gate('fleet'), getOwnerCars);
ownerRouter.get("/cars/:id", ...gate('fleet'), getOwnerCarById);
ownerRouter.get("/cars/:id/stats", ...gate('fleet'), getVehicleStats);
ownerRouter.get("/vehicles/:id", ...gate('fleet'), getOwnerCarById);
ownerRouter.get("/vehicles/:id/stats", ...gate('fleet'), getVehicleStats);
ownerRouter.post("/update-car", ...gate('fleet'), upload.single("image"), handleMulterError, updateCar);
ownerRouter.post("/toggle-car", ...gate('fleet'), toggleCarAvailability);
ownerRouter.post("/delete-car", ...gate('fleet'), deleteCar);
ownerRouter.get("/catalog-order", ...gate('fleet'), getCatalogOrder);
ownerRouter.put("/catalog-order", ...gate('fleet'), updateCatalogOrder);

ownerRouter.get('/dashboard', ...gate('dashboard'), getDashboardData);
ownerRouter.get('/ops-dashboard', ...gate('dashboard'), getOpsDashboard);
ownerRouter.get('/analytics', ...gate('analytics'), getRevenueAnalytics);
ownerRouter.get('/overview', ...gate('dashboard'), getAdminOverview);
ownerRouter.get('/customers', ...gate('customers'), getCustomers);
ownerRouter.get('/crm/customers', ...gate('customers'), getCrmCustomers);
ownerRouter.get('/crm/customers/:email', ...gate('customers'), getCrmCustomerDetail);
ownerRouter.post('/crm/rate', ...gate('customers'), rateCustomer);
ownerRouter.post('/crm/note', ...gate('customers'), addCustomerNote);
ownerRouter.post('/crm/status', ...gate('customers'), updateCustomerStatus);
ownerRouter.get('/maintenance', ...gate('maintenance'), getFleetMaintenance);
ownerRouter.post('/maintenance/update', ...gate('maintenance'), updateCarMaintenance);
ownerRouter.get('/maintenance/records', ...gate('maintenance'), listMaintenanceRecords);
ownerRouter.post('/maintenance/records', ...gate('maintenance'), createMaintenanceRecord);
ownerRouter.patch('/maintenance/records', ...gate('maintenance'), updateMaintenanceRecord);
ownerRouter.post('/maintenance/records/delete', ...gate('maintenance'), deleteMaintenanceRecord);
ownerRouter.get('/maintenance/calendar', ...gate('maintenance'), getMaintenanceCalendar);
ownerRouter.get('/maintenance/report', ...gate('maintenance'), getMaintenanceReport);
ownerRouter.get('/notifications', protect, requireOwner, getNotifications);
ownerRouter.post('/notifications/read', protect, requireOwner, markNotificationRead);
ownerRouter.get('/audit-logs', ...gate('audit'), getAuditLogs);
ownerRouter.get('/search', protect, requireOwner, globalSearch);
ownerRouter.get('/reports/export', ...gate('reports'), exportReport);
ownerRouter.post('/update-image', protect, requireOwner, upload.single("image"), handleMulterError, updateUserImage);

ownerRouter.get('/agency', protect, requireOwner, getOwnerAgency);
ownerRouter.put('/agency/branding', ...ownerOnly, updateOwnerAgencyBranding);
ownerRouter.get('/agency/domains', protect, requireOwner, getOwnerAgencyDomains);
ownerRouter.put('/agency/domains', ...ownerOnly, updateOwnerAgencyDomain);
ownerRouter.post('/agency/domains/verify', ...ownerOnly, verifyOwnerAgencyDomain);
ownerRouter.get('/settings', protect, requireOwner, getAgencySettings);
ownerRouter.put('/settings', ...ownerOnly, updateAgencySettings);
ownerRouter.get('/settings/whatsapp', protect, requireOwner, getAgencySettings);
ownerRouter.put('/settings/whatsapp', ...ownerOnly, updateAgencySettings);

ownerRouter.get('/billing', ...ownerOnly, getOwnerBilling);
ownerRouter.get('/billing/plans', ...ownerOnly, listPublicPlans);
ownerRouter.post('/billing/cancel', ...ownerOnly, cancelOwnerBilling);
ownerRouter.post('/billing/checkout', ...ownerOnly, checkoutOwnerBilling);

ownerRouter.get('/staff/roles', ...ownerOnly, listStaffRoles);
ownerRouter.get('/staff', ...ownerOnly, getOwnerStaff);
ownerRouter.post('/staff', ...ownerOnly, inviteOwnerStaff);
ownerRouter.patch('/staff/:id', ...ownerOnly, updateOwnerStaff);
ownerRouter.delete('/staff/:id', ...ownerOnly, removeOwnerStaff);

ownerRouter.get('/promotions', protect, requireOwner, listPromotions);
ownerRouter.post('/promotions/preview', protect, requireOwner, previewPromotion);
ownerRouter.post('/promotions', protect, requireOwner, createPromotion);
ownerRouter.get('/promotions/:id', protect, requireOwner, getPromotion);
ownerRouter.put('/promotions/:id', protect, requireOwner, updatePromotion);
ownerRouter.patch('/promotions/:id/active', protect, requireOwner, setPromotionActive);
ownerRouter.delete('/promotions/:id', protect, requireOwner, deletePromotion);

export default ownerRouter;

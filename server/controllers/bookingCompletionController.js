import Booking from "../models/Booking.js";
import {
  findBookingByCompletionToken,
  initiateBookingCompletion,
  ensureBookingCompletionLink,
  markCompletionPayment,
  refreshCompletionFlags,
  saveSignatureAndMaybeFinalize,
  tryFinalizeBookingCompletion,
} from "../services/bookingCompletionService.js";
import { storeDocumentImage } from "../services/documentStore.js";
import {
  computePayableAmount,
  createStripeCheckoutSession,
  getDepositPercent,
  getPaymentMode,
  retrieveStripeSession,
} from "../services/paymentService.js";
import { cleanupUploadedFile } from "../middleware/multer.js";
import { appendSignedQuery } from "../middleware/uploadAccess.js";
import {
  applyCompletionDetailsToBooking,
  validateCompletionDetails,
} from "../utils/applyCompletionDetails.js";

const signIfLocalUpload = (url) => {
  if (!url || typeof url !== "string") return url || "";
  if (
    url.includes("/uploads/documents")
    || url.includes("/uploads/contracts")
    || url.includes("/uploads/templates")
  ) {
    return appendSignedQuery(url);
  }
  return url;
};

const safePublicError = (error, fallback) => {
  if (error?.code === "TOKEN_EXPIRED" || error?.code === "VALIDATION") {
    return error.message || fallback;
  }
  return fallback;
};

const publicBookingView = (booking) => {
  const c = booking.completion || {};
  const flags = {
    documentsComplete: Boolean(c.documentsComplete),
    paymentComplete: Boolean(c.paymentComplete),
    signatureComplete: Boolean(c.signatureComplete),
  };
  return {
    reservationId: booking.reservationId,
    status: booking.status,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    customerAddress: booking.customerAddress || "",
    placeOfBirth: booking.placeOfBirth || "",
    identityDocumentNumber: booking.identityDocumentNumber || "",
    identityIssuedOn: booking.identityIssuedOn || "",
    driverLicenseIssuedOn: booking.driverLicenseIssuedOn || "",
    pickupDate: booking.pickupDate,
    returnDate: booking.returnDate,
    pickupLocation: booking.pickupLocation,
    returnLocation: booking.returnLocation,
    price: booking.price,
    priceBreakdown: booking.priceBreakdown,
    paymentStatus: booking.paymentStatus,
    dateOfBirth: booking.dateOfBirth || "",
    nationality: booking.nationality || "",
    driverLicenseNumber: booking.driverLicenseNumber || "",
    driverLicenseExpiry: booking.driverLicenseExpiry || "",
    passportNumber: booking.passportNumber || "",
    secondDriver: booking.secondDriver || {
      enabled: false,
      fullName: "",
      dateOfBirth: "",
      nationality: "",
      driverLicenseNumber: "",
      driverLicenseExpiry: "",
      passportNumber: "",
      phone: "",
    },
    car: booking.car
      ? {
          brand: booking.car.brand,
          model: booking.car.model,
          year: booking.car.year,
          image: booking.car.image,
          category: booking.car.category,
        }
      : null,
    completion: {
      drivingLicenseUrl: signIfLocalUpload(c.drivingLicenseUrl || ""),
      identityType: c.identityType || "",
      identityDocumentUrl: signIfLocalUpload(c.identityDocumentUrl || ""),
      signatureUrl: c.signatureUrl ? "on_file" : "",
      secondDriverSignatureUrl: c.secondDriverSignatureUrl ? "on_file" : "",
      paymentType: c.paymentType || "",
      amountPaid: c.amountPaid || 0,
      amountDue: c.amountDue || 0,
      contractPdfUrl: signIfLocalUpload(c.contractPdfUrl || ""),
      invoicePdfUrl: signIfLocalUpload(c.invoicePdfUrl || ""),
      completedAt: c.completedAt || null,
      documentsComplete: flags.documentsComplete,
      paymentComplete: flags.paymentComplete,
      signatureComplete: flags.signatureComplete,
      depositPercent: getDepositPercent(),
      depositAmount: computePayableAmount(booking.price, "deposit"),
      fullAmount: computePayableAmount(booking.price, "full"),
      paymentMode: getPaymentMode(),
      expiresAt: c.tokenExpiresAt,
    },
  };
};

export const getCompletionBooking = async (req, res) => {
  try {
    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }
    refreshCompletionFlags(booking);
    await booking.save();
    res.json({ success: true, booking: publicBookingView(booking) });
  } catch (error) {
    const status = error.code === "TOKEN_EXPIRED" ? 410 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const uploadCompletionDocument = async (req, res) => {
  let file = req.file;
  try {
    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }
    if (booking.status === "ready_for_pickup") {
      return res.status(400).json({ success: false, message: "This reservation is already complete" });
    }

    const docType = req.body.docType; // driving_license | identity
    const identityType = req.body.identityType; // national_id | passport

    if (!file) {
      return res.status(400).json({ success: false, message: "Please upload an image file" });
    }
    if (!["driving_license", "identity"].includes(docType)) {
      return res.status(400).json({ success: false, message: "Invalid document type" });
    }

    const url = await storeDocumentImage(file, `/booking-docs/${booking.reservationId}`, {
      ownerId: booking.owner,
    });
    file = null;

    booking.completion = booking.completion || {};
    if (docType === "driving_license") {
      booking.completion.drivingLicenseUrl = url;
    } else {
      if (!["national_id", "passport"].includes(identityType)) {
        return res.status(400).json({ success: false, message: "Select National ID or Passport" });
      }
      booking.completion.identityType = identityType;
      booking.completion.identityDocumentUrl = url;
    }

    refreshCompletionFlags(booking);
    const { syncCompletionDocumentsToArchive } = await import('../services/customerDocuments.js');
    syncCompletionDocumentsToArchive(booking);
    await booking.save();
    await tryFinalizeBookingCompletion(booking._id);
    const fresh = await Booking.findById(booking._id).populate("car");

    res.json({
      success: true,
      message: "Document uploaded",
      booking: publicBookingView(fresh),
    });
  } catch (error) {
    console.error(error.message);
    const status = error.code === "TOKEN_EXPIRED" ? 410 : 500;
    res.status(status).json({
      success: false,
      message: safePublicError(error, "Upload failed"),
    });
  } finally {
    cleanupUploadedFile(file);
  }
};

export const saveCompletionDetails = async (req, res) => {
  try {
    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }
    if (booking.status === "ready_for_pickup") {
      return res.status(400).json({ success: false, message: "This reservation is already complete" });
    }

    applyCompletionDetailsToBooking(booking, req.body, { scope: 'customer' });
    refreshCompletionFlags(booking);
    await booking.save();
    const fresh = await Booking.findById(booking._id).populate('car');

    res.json({
      success: true,
      message: 'Contract details saved',
      booking: publicBookingView(fresh),
    });
  } catch (error) {
    console.error(error.message);
    const status = error.code === 'TOKEN_EXPIRED' ? 410 : error.code === 'VALIDATION' ? 400 : 500;
    res.status(status).json({
      success: false,
      message: safePublicError(error, 'Failed to save contract details'),
    });
  }
};

export const createCompletionPayment = async (req, res) => {
  try {
    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }
    if (booking.status === "ready_for_pickup" || booking.completion?.completedAt) {
      return res.status(400).json({
        success: false,
        message: "This reservation is already complete",
      });
    }
    if (booking.completion?.paymentComplete) {
      return res.json({ success: true, alreadyPaid: true, booking: publicBookingView(booking) });
    }

    const paymentType = req.body.paymentType === "deposit" ? "deposit" : "full";
    const amount = computePayableAmount(booking.price, paymentType);
    const mode = getPaymentMode();
    const clientBase = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
    const token = req.params.token;

    booking.completion = booking.completion || {};
    booking.completion.paymentType = paymentType;
    booking.completion.amountDue = amount;
    await booking.save();

    if (mode === "stripe") {
      const session = await createStripeCheckoutSession({
        booking,
        paymentType,
        amount,
        successUrl: `${clientBase}/complete-booking/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${clientBase}/complete-booking/${token}?cancelled=1`,
      });
      booking.completion.stripeSessionId = session.id;
      await booking.save();
      return res.json({
        success: true,
        mode: "stripe",
        checkoutUrl: session.url,
        amount,
        paymentType,
      });
    }

    if (mode === "disabled") {
      return res.status(503).json({
        success: false,
        message: "Online payments are not configured. Contact the agency.",
      });
    }

    // Demo / sandbox payment — local/staging only (blocked in production without ALLOW_DEMO_PAYMENT)
    return res.json({
      success: true,
      mode: "demo",
      amount,
      paymentType,
      message: "Demo payment ready — confirm to simulate a successful charge",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Payment init failed" });
  }
};

export const confirmDemoPayment = async (req, res) => {
  try {
    const mode = getPaymentMode();
    if (mode === "stripe" || mode === "disabled") {
      return res.status(400).json({
        success: false,
        message: "Demo payment is disabled in this environment",
      });
    }
    if (String(process.env.ALLOW_DEMO_PAYMENT || "").toLowerCase() !== "true" && process.env.NODE_ENV === "production") {
      return res.status(400).json({ success: false, message: "Demo payment disabled" });
    }

    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }

    const paymentType = req.body.paymentType === "deposit" ? "deposit" : "full";
    const amount = computePayableAmount(booking.price, paymentType);
    const result = await markCompletionPayment(booking, { paymentType, amount });

    res.json({
      success: true,
      message: "Payment recorded",
      finalized: result.finalized,
      booking: publicBookingView(result.booking),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Payment failed" });
  }
};

export const confirmStripePayment = async (req, res) => {
  try {
    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }

    const sessionId = req.body.sessionId || req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Missing Stripe session" });
    }

    const session = await retrieveStripeSession(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ success: false, message: "Payment not completed yet" });
    }

    const metaBookingId = session.metadata?.bookingId || session.client_reference_id;
    if (!metaBookingId || metaBookingId !== booking._id.toString()) {
      return res.status(400).json({ success: false, message: "Session mismatch" });
    }

    const expectedAmount = computePayableAmount(
      booking.price,
      session.metadata?.paymentType === "deposit" ? "deposit" : "full"
    );
    const paidAmount = (session.amount_total || 0) / 100;
    // Allow 1 minor-unit tolerance for currency rounding
    if (Math.abs(paidAmount - expectedAmount) > 0.02) {
      return res.status(400).json({ success: false, message: "Paid amount does not match booking" });
    }

    const paymentType = session.metadata?.paymentType === "deposit" ? "deposit" : "full";
    const amount = paidAmount;
    const result = await markCompletionPayment(booking, {
      paymentType,
      amount,
      stripeSessionId: sessionId,
    });

    res.json({
      success: true,
      message: "Payment confirmed",
      finalized: result.finalized,
      booking: publicBookingView(result.booking),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || "Stripe confirmation failed" });
  }
};

export const submitCompletionSignature = async (req, res) => {
  try {
    const booking = await findBookingByCompletionToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Invalid or expired completion link" });
    }
    if (booking.status === "ready_for_pickup" || booking.completion?.completedAt) {
      return res.status(400).json({
        success: false,
        message: "This reservation is already complete and can no longer be changed",
      });
    }

    const { signatureDataUrl, secondDriverSignatureDataUrl, agreed, ...detailsPayload } = req.body;
    if (!agreed) {
      return res.status(400).json({ success: false, message: "You must agree to the rental terms" });
    }
    if (!signatureDataUrl || !String(signatureDataUrl).startsWith("data:image")) {
      return res.status(400).json({ success: false, message: "Please provide your signature" });
    }

    // Persist any last-minute form fields sent with the signature step
    const hasDetailFields = [
      'customerName',
      'customerEmail',
      'customerPhone',
      'dateOfBirth',
      'nationality',
      'customerAddress',
      'placeOfBirth',
      'identityDocumentNumber',
      'identityIssuedOn',
      'driverLicenseNumber',
      'driverLicenseExpiry',
      'driverLicenseIssuedOn',
      'passportNumber',
      'secondDriver',
    ].some((k) => detailsPayload[k] !== undefined);

    if (hasDetailFields) {
      applyCompletionDetailsToBooking(booking, detailsPayload, { scope: 'customer' });
    }
    validateCompletionDetails(booking);
    await booking.save();

    // Require docs before signature
    refreshCompletionFlags(booking);
    if (!booking.completion.documentsComplete) {
      return res.status(400).json({ success: false, message: "Upload required documents first" });
    }

    if (booking.secondDriver?.enabled) {
      if (!secondDriverSignatureDataUrl || !String(secondDriverSignatureDataUrl).startsWith("data:image")) {
        return res.status(400).json({ success: false, message: "Please provide the second driver signature" });
      }
    }

    const result = await saveSignatureAndMaybeFinalize(booking, {
      signatureDataUrl,
      secondDriverSignatureDataUrl,
    });
    res.json({
      success: true,
      message: result.finalized
        ? "Signed — your reservation is ready for pickup"
        : result.awaitingPayment
          ? "Signature saved — complete payment to finish"
          : "Signature saved",
      finalized: result.finalized,
      awaitingPayment: Boolean(result.awaitingPayment),
      booking: publicBookingView(result.booking),
    });
  } catch (error) {
    console.error(error.message);
    const status = error.code === 'VALIDATION' ? 400 : 500;
    res.status(status).json({
      success: false,
      message: safePublicError(error, "Signature failed. Please try again or contact the agency."),
    });
  }
};

/** Owner: ensure a valid completion link exists (no WhatsApp / Meta API). */
export const ensureCompletionLink = async (req, res) => {
  try {
    const { bookingId, refresh } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId is required" });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.owner?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const result = await ensureBookingCompletionLink(bookingId, { refresh: Boolean(refresh) });

    let whatsappConfirmationUrl = null;
    let whatsappConfirmationDial = null;
    try {
      const { resolveWhatsAppDials } = await import('../services/agencySettingsService.js');
      const { buildCompletionToAgencyWhatsAppUrl } = await import('../services/whatsappNotify.js');
      const dials = await resolveWhatsAppDials(booking.owner);
      whatsappConfirmationDial = dials.confirmationDial;
      const populated = await Booking.findById(bookingId).populate('car', 'brand model licensePlate').lean();
      const car = populated?.car;
      const vehicle = car
        ? `${car.brand} ${car.model}${car.licensePlate ? ` (${car.licensePlate})` : ''}`
        : '—';
      whatsappConfirmationUrl = buildCompletionToAgencyWhatsAppUrl({
        reservationId: populated?.reservationId || booking.reservationId,
        customerName: populated?.customerName || booking.customerName,
        customerPhone: populated?.customerPhone || booking.customerPhone,
        vehicle,
        pickupLocation: populated?.pickupLocation || booking.pickupLocation,
        returnLocation: populated?.returnLocation || booking.returnLocation,
        pickupDate: populated?.pickupDate || booking.pickupDate,
        returnDate: populated?.returnDate || booking.returnDate,
        price: populated?.price ?? booking.price,
        currency: process.env.CURRENCY || 'MAD',
        completionUrl: result.completionUrl,
        dial: whatsappConfirmationDial,
      });
    } catch (waError) {
      console.error('[ensureCompletionLink] WhatsApp URL', waError.message);
    }

    res.status(200).json({
      success: true,
      completionUrl: result.completionUrl,
      shareableCompletionUrl: result.completionUrl,
      created: result.created,
      status: result.booking.status,
      ...(whatsappConfirmationUrl ? { whatsappConfirmationUrl } : {}),
      ...(whatsappConfirmationDial ? { whatsappConfirmationDial } : {}),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to ensure completion link" });
  }
};

/** Owner: resend secure completion link */
export const resendCompletionLink = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.owner?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const result = await initiateBookingCompletion(bookingId, { resend: true });
    const emailOk = Boolean(result.emailResult?.success);
    res.status(200).json({
      success: true,
      emailSent: emailOk,
      message: emailOk
        ? `Completion email accepted by SMTP for ${result.emailResult.to}`
        : `Completion link refreshed. Email NOT delivered: ${result.emailResult?.reason || "unknown error"}`,
      completionUrl: result.completionUrl,
      email: result.emailResult,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to send link" });
  }
};

export const emailDiagnostics = async (req, res) => {
  try {
    const { verifyEmailTransport, getSmtpConfigSummary } = await import("../services/emailService.js");
    const result = await verifyEmailTransport();
    res.json({
      success: result.success,
      diagnostics: result,
      summary: getSmtpConfigSummary(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendTestEmail = async (req, res) => {
  try {
    const { sendEmail, getSmtpConfigSummary } = await import("../services/emailService.js");
    const to = (req.body?.to || req.user?.email || "").trim();
    if (!to) {
      return res.status(400).json({ success: false, message: "Provide { to: 'email@example.com' }" });
    }
    const result = await sendEmail({
      to,
      subject: "HDN Car — SMTP test",
      html: `<p>This is a test email from HDN Car.</p><p>If you received this, SMTP delivery is working.</p><p>${new Date().toISOString()}</p>`,
    });
    res.status(result.success ? 200 : 502).json({
      success: result.success,
      message: result.success
        ? `Test email accepted by SMTP for ${result.to}`
        : `Test email FAILED: ${result.reason}`,
      email: result,
      smtp: getSmtpConfigSummary(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminInitiateCompletion = initiateBookingCompletion;

export default {
  getCompletionBooking,
  uploadCompletionDocument,
  createCompletionPayment,
  confirmDemoPayment,
  confirmStripePayment,
  submitCompletionSignature,
  resendCompletionLink,
  ensureCompletionLink,
  emailDiagnostics,
  sendTestEmail,
};

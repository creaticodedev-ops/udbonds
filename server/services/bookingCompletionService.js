import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import {
  buildCompletionUrl,
  generateCompletionToken,
  hashToken,
  isTokenExpired,
} from "./completionToken.js";
import { sendCompletionInviteEmail, sendFinalConfirmationEmail } from "./emailService.js";
import { publicUploadUrl } from "./pdfDocuments.js";
import { generateContractPdf } from "./templatePdfExport.js";
import { ensureDefaultTemplates } from "../controllers/exportTemplateController.js";
import { getDefaultContractTemplate } from "../utils/resolveExportTemplate.js";
import { upsertContractFromCompletion } from "./documentInstanceService.js";
import { logAudit } from "../utils/adminOps.js";
import { storeDataUrlImage } from "./documentStore.js";

const formatDt = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-GB", { hour12: false });
};

export const generateCompletionLink = async (bookingId, { resend = false } = {}) => {
  const booking = await Booking.findById(bookingId).populate('car');
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled') throw new Error('Cancelled reservations cannot be completed');

  booking.completion = booking.completion || {};
  const existingUrl = String(booking.completion.shareableCompletionUrl || '').trim();
  const hasStoredHash = Boolean(booking.completion.tokenHash);
  const tokenStillValid =
    hasStoredHash && !isTokenExpired(booking.completion.tokenExpiresAt);

  if (!resend && existingUrl && tokenStillValid) {
    return {
      booking,
      completionUrl: existingUrl,
      reused: true,
    };
  }

  const { token, tokenHash, expiresAt } = generateCompletionToken();
  booking.completion.tokenHash = tokenHash;
  booking.completion.tokenExpiresAt = expiresAt;

  if (booking.status === 'pending') {
    booking.status = 'confirmed';
  }

  const completionUrl = buildCompletionUrl(token);
  booking.completion.shareableCompletionUrl = completionUrl;
  await booking.save();

  return {
    booking,
    completionUrl,
    reused: false,
  };
};

/**
 * Return a valid completion URL, creating or refreshing the token when missing or expired.
 */
export const ensureBookingCompletionLink = async (bookingId, { refresh = false } = {}) => {
  const result = await generateCompletionLink(bookingId, { resend: refresh });
  return {
    booking: result.booking,
    completionUrl: result.completionUrl,
    created: !result.reused,
  };
};

export const initiateBookingCompletion = async (bookingId, { resend = false } = {}) => {
  const { booking, completionUrl } = await generateCompletionLink(bookingId, { resend });

  const vehicle = booking.car ? `${booking.car.brand} ${booking.car.model}` : 'Vehicle';
  const currency = process.env.CURRENCY || 'MAD';

  let emailResult = {
    success: false,
    skipped: true,
    reason: 'not attempted',
    to: booking.customerEmail,
  };

  try {
    const { resolveBrandForContext } = await import('./agencyBrand.js');
    const brand = await resolveBrandForContext({ booking, owner: booking.owner });
    emailResult = await sendCompletionInviteEmail({
      to: booking.customerEmail,
      customerName: booking.customerName,
      reservationId: booking.reservationId,
      completionUrl,
      vehicle,
      pickupDate: formatDt(booking.pickupDate),
      returnDate: formatDt(booking.returnDate),
      total: booking.price,
      currency,
      brand,
    });
  } catch (emailErr) {
    console.error('[email] Completion invite threw:', emailErr.message);
    emailResult = {
      success: false,
      skipped: false,
      reason: emailErr.message || 'Email send failed',
      to: booking.customerEmail,
    };
  }

  booking.completion.lastEmail = {
    type: 'completion_invite',
    to: emailResult.to || booking.customerEmail,
    success: Boolean(emailResult.success),
    skipped: Boolean(emailResult.skipped),
    reason: emailResult.reason || '',
    messageId: emailResult.messageId || '',
    at: new Date(),
  };
  if (emailResult.success) {
    booking.completion.linkSentAt = new Date();
  }
  await booking.save();

  if (!emailResult.success && !emailResult.skipped) {
    console.error(
      '[email] Completion invite NOT delivered:',
      emailResult.reason || emailResult.error,
      { to: booking.customerEmail, reservationId: booking.reservationId },
    );
  }

  try {
    await logAudit({
      owner: booking.owner,
      action: resend ? 'booking.completion_link_resent' : 'booking.completion_link_sent',
      entityType: 'Booking',
      entityId: booking._id,
      details: emailResult.success
        ? `Completion email accepted by SMTP for ${booking.reservationId} → ${booking.customerEmail}`
        : `Completion link ensured for ${booking.reservationId} (email: ${emailResult.reason || 'skipped'})`,
    });
  } catch { /* ignore */ }

  return {
    booking,
    completionUrl,
    emailResult,
  };
};

export const buildCompletionMessageBody = ({ booking, completionUrl, vehicle, pickupDate, returnDate, currency }) => [
  `Hello ${booking.customerName || 'Customer'},`,
  '',
  `Your reservation ${booking.reservationId || ''} has been confirmed.`,
  `Vehicle: ${vehicle}`,
  `Pickup: ${pickupDate}`,
  `Return: ${returnDate}`,
  `Total: ${currency}${booking.price}`,
  '',
  `Complete your booking securely here: ${completionUrl}`,
].join('\n');

export const findBookingByCompletionToken = async (rawToken) => {
  if (!rawToken || String(rawToken).length < 20) return null;
  const tokenHash = hashToken(rawToken);
  const booking = await Booking.findOne({ "completion.tokenHash": tokenHash }).populate("car");
  if (!booking) return null;
  if (isTokenExpired(booking.completion?.tokenExpiresAt)) {
    const err = new Error("This completion link has expired. Please contact the agency.");
    err.code = "TOKEN_EXPIRED";
    throw err;
  }
  if (["cancelled"].includes(booking.status)) {
    const err = new Error("This reservation is no longer available.");
    err.code = "CANCELLED";
    throw err;
  }
  return booking;
};

export const refreshCompletionFlags = (booking) => {
  const c = booking.completion || {};
  c.documentsComplete = Boolean(
    c.drivingLicenseUrl && c.identityDocumentUrl && (c.identityType === "national_id" || c.identityType === "passport")
  );
  c.paymentComplete = Boolean(c.paymentCompletedAt && (c.amountPaid > 0 || booking.paymentStatus === "paid"));
  const needsSecondDriverSig = Boolean(booking.secondDriver?.enabled);
  const secondDriverSigOk =
    !needsSecondDriverSig ||
    Boolean(c.secondDriverSignatureUrl && c.secondDriverSignatureSignedAt);
  c.signatureComplete = Boolean(
    c.signatureUrl && c.signatureSignedAt && secondDriverSigOk
  );
  booking.completion = c;
  return c;
};

/**
 * When docs + payment + signature are done → Ready for Pickup + PDFs + final email.
 */
export const tryFinalizeBookingCompletion = async (bookingId) => {
  let booking = await Booking.findById(bookingId).populate('car').populate('owner');
  if (!booking) return null;

  const flags = refreshCompletionFlags(booking);
  await booking.save();

  if (!flags.documentsComplete || !flags.signatureComplete) {
    return { finalized: false, booking, flags };
  }

  // Align with admin ready_for_pickup gate: require payment when online payment is enabled.
  const { getPaymentMode } = await import('./paymentService.js');
  const paymentMode = getPaymentMode();
  if (paymentMode !== 'disabled' && !flags.paymentComplete) {
    return { finalized: false, booking, flags, awaitingPayment: true };
  }

  if (booking.status === "ready_for_pickup" && booking.completion.completedAt) {
    return { finalized: true, booking, flags, alreadyDone: true };
  }

  let contractPath;
  let contractPdfUrl;

  console.log('[FINALIZE] Booking completion object:', {
    signatureUrl: booking.completion?.signatureUrl,
    signatureSignedAt: booking.completion?.signatureSignedAt,
    signatureComplete: booking.completion?.signatureComplete,
  });

  // Always use the Admin-selected default contract template (SSOT).
  await ensureDefaultTemplates(booking.owner);
  booking = await Booking.findById(bookingId).populate('car').populate('owner');
  const template = await getDefaultContractTemplate(booking.owner);

  if (!template) {
    throw new Error('No contract template found. Set a default contract template in Admin → Export Templates.');
  }

  const contractNumber = booking.reservationId || `CTR-${booking._id.toString().slice(-8).toUpperCase()}`;
  let contractResult;
  try {
    contractResult = await generateContractPdf({
      template,
      booking: booking.toObject ? booking.toObject() : booking,
      contractNumber,
      owner: booking.owner,
    });
  } catch (pdfError) {
    console.error('[FINALIZE] Contract PDF failed:', pdfError);
    const err = new Error(pdfError.message || 'Contract PDF generation failed');
    err.cause = pdfError;
    throw err;
  }
  contractPath = contractResult.filePath;
  contractPdfUrl = contractResult.pdfUrl;

  try {
    const ownerId = booking.owner?._id || booking.owner;
    await upsertContractFromCompletion({
      owner: ownerId,
      booking,
      template,
      contractNumber,
      filePath: contractPath,
      pdfUrl: contractPdfUrl || publicUploadUrl(contractPath),
      renderedHtml: contractResult.renderedHtml || '',
      variables: contractResult.variables || {},
      user: null,
    });
  } catch (persistErr) {
    console.error('[FINALIZE] Failed to persist Contract record:', persistErr.message);
  }

  booking.completion.contractPdfUrl = contractPdfUrl || publicUploadUrl(contractPath);
  booking.completion.invoicePdfUrl = '';
  booking.completion.completedAt = new Date();
  booking.status = "ready_for_pickup";

  const paid = Boolean(booking.completion.paymentCompletedAt && booking.completion.amountPaid > 0);
  if (paid) {
    booking.paymentStatus = "paid";
    await booking.save();

    await Payment.findOneAndUpdate(
      { booking: booking._id },
      {
        status: "paid",
        amount: booking.completion.amountPaid,
        gateway: booking.completion.stripeSessionId ? "stripe" : (process.env.PAYMENT_MODE || "demo"),
        method: booking.completion.paymentType || "online",
        reference: booking.reservationId,
      },
      { upsert: true }
    );
  } else {
    await booking.save();
  }

  const vehicle = booking.car ? `${booking.car.brand} ${booking.car.model}` : "Vehicle";
  const currency = process.env.CURRENCY || "MAD";
  const detailsHtml = `
    <ul>
      <li>Pickup: ${booking.pickupLocation || "—"} · ${formatDt(booking.pickupDate)}</li>
      <li>Return: ${booking.returnLocation || "—"} · ${formatDt(booking.returnDate)}</li>
      <li>Total: ${currency}${booking.price}</li>
      <li>Paid: ${currency}${booking.completion.amountPaid} (${booking.completion.paymentType})</li>
    </ul>
  `;

  const finalEmailResult = await sendFinalConfirmationEmail({
    to: booking.customerEmail,
    customerName: booking.customerName,
    reservationId: booking.reservationId,
    vehicle,
    detailsHtml,
    contractPath: contractResult?.filePath,
    brand: await (await import('./agencyBrand.js')).resolveBrandForContext({
      booking,
      owner: booking.owner,
    }),
  });

  booking.completion.lastEmail = {
    type: "final_confirmation",
    to: finalEmailResult.to || booking.customerEmail,
    success: Boolean(finalEmailResult.success),
    skipped: Boolean(finalEmailResult.skipped),
    reason: finalEmailResult.reason || "",
    messageId: finalEmailResult.messageId || "",
    at: new Date(),
  };
  await booking.save();

  if (!finalEmailResult.success) {
    console.error(
      "[email] Final confirmation NOT delivered:",
      finalEmailResult.reason,
      { to: booking.customerEmail, reservationId: booking.reservationId }
    );
  }

  try {
    await logAudit({
      owner: booking.owner,
      action: "booking.ready_for_pickup",
      entityType: "Booking",
      entityId: booking._id,
      details: finalEmailResult.success
        ? `${booking.reservationId} ready for pickup — final email accepted by SMTP`
        : `${booking.reservationId} ready for pickup — final EMAIL FAILED: ${finalEmailResult.reason || "unknown"}`,
    });
  } catch { /* ignore */ }

  return { finalized: true, booking, flags, emailResult: finalEmailResult };
};

export const markCompletionPayment = async (booking, { paymentType, amount, stripeSessionId = "" }) => {
  booking.completion = booking.completion || {};
  booking.completion.paymentType = paymentType;
  booking.completion.amountDue = amount;
  booking.completion.amountPaid = amount;
  booking.completion.paymentCompletedAt = new Date();
  booking.completion.stripeSessionId = stripeSessionId || booking.completion.stripeSessionId || "";
  booking.paymentStatus = "paid";
  refreshCompletionFlags(booking);
  await booking.save();
  return tryFinalizeBookingCompletion(booking._id);
};

export const saveSignatureAndMaybeFinalize = async (
  booking,
  { signatureDataUrl, secondDriverSignatureDataUrl } = {}
) => {
  console.log('[SIGNATURE] Storing signature for booking:', booking.reservationId);
  const url = await storeDataUrlImage(signatureDataUrl, `signature-${booking.reservationId}.png`, {
    ownerId: booking.owner,
  });
  console.log('[SIGNATURE] Stored signature URL:', url);
  booking.completion = booking.completion || {};
  booking.completion.signatureUrl = url;
  booking.completion.signatureSignedAt = new Date();

  const needsSecond = Boolean(booking.secondDriver?.enabled);
  if (needsSecond) {
    if (!secondDriverSignatureDataUrl || !String(secondDriverSignatureDataUrl).startsWith('data:image')) {
      const err = new Error('Second driver signature is required');
      err.code = 'VALIDATION';
      throw err;
    }
    const secondUrl = await storeDataUrlImage(
      secondDriverSignatureDataUrl,
      `signature-2nd-${booking.reservationId}.png`,
      { ownerId: booking.owner },
    );
    booking.completion.secondDriverSignatureUrl = secondUrl;
    booking.completion.secondDriverSignatureSignedAt = new Date();
  } else {
    booking.completion.secondDriverSignatureUrl = '';
    booking.completion.secondDriverSignatureSignedAt = null;
  }

  refreshCompletionFlags(booking);
  const saved = await booking.save();
  console.log('[SIGNATURE] Booking saved with signatureUrl:', saved.completion?.signatureUrl);
  return tryFinalizeBookingCompletion(booking._id);
};

export default {
  initiateBookingCompletion,
  generateCompletionLink,
  ensureBookingCompletionLink,
  findBookingByCompletionToken,
  refreshCompletionFlags,
  tryFinalizeBookingCompletion,
  markCompletionPayment,
  saveSignatureAndMaybeFinalize,
};

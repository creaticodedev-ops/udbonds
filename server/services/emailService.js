import nodemailer from "nodemailer";
import { PLATFORM_NAME } from "../utils/brand.js";

let transporter = null;
let verifiedOk = false;
let lastVerifyError = null;

const stripQuotes = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

/** Gmail app passwords are often copied with spaces — strip them. */
const normalizePass = (value) => stripQuotes(value).replace(/\s+/g, "");

const log = (level, message, meta) => {
  const prefix = "[email]";
  if (meta !== undefined) {
    console[level](prefix, message, meta);
  } else {
    console[level](prefix, message);
  }
};

export const getSmtpConfigSummary = () => {
  const host = stripQuotes(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = stripQuotes(process.env.SMTP_USER);
  const passSet = Boolean(normalizePass(process.env.SMTP_PASS));
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  return {
    configured: Boolean(host && user && passSet),
    host: host || null,
    port,
    secure,
    user: user || null,
    from: stripQuotes(process.env.SMTP_FROM) || user || null,
    verified: verifiedOk,
    lastVerifyError,
  };
};

/**
 * Build From header.
 * @param {{ displayName?: string, name?: string, replyTo?: string, email?: string }} [brand]
 * Envelope stays SMTP mailbox; display name / reply-to come from agency when provided.
 */
export const resolveFromAddress = (brand = {}) => {
  const displayName =
    String(brand.displayName || brand.name || "").trim() || PLATFORM_NAME;
  const user = stripQuotes(process.env.SMTP_USER);
  const rawFrom = stripQuotes(process.env.SMTP_FROM);

  let name = displayName;
  let email = user;

  if (rawFrom) {
    const angled = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
    if (angled) {
      if (!brand.displayName && !brand.name) {
        name = angled[1].trim().replace(/^["']|["']$/g, "") || displayName;
      }
      email = angled[2].trim();
    } else if (rawFrom.includes("@")) {
      email = rawFrom;
    }
  }

  // Prevent common typo: user@gmail.com.com
  if (email?.endsWith(".com.com")) {
    log("warn", `Correcting invalid From domain: ${email}`);
    email = email.replace(/\.com\.com$/, ".com");
  }

  // Gmail / Google Workspace: From must be the auth user unless SMTP_ALLOW_CUSTOM_FROM=true
  const allowCustom = String(process.env.SMTP_ALLOW_CUSTOM_FROM || "").toLowerCase() === "true";
  if (!allowCustom && user && email && email.toLowerCase() !== user.toLowerCase()) {
    log(
      "warn",
      `SMTP_FROM (${email}) differs from SMTP_USER (${user}). Using SMTP_USER as From to avoid provider rejection.`
    );
    email = user;
  }

  if (!email) {
    email = "noreply@localhost";
  }

  const replyTo = String(brand.replyTo || brand.email || "").trim() || undefined;
  return { name, email, replyTo, formatted: `"${name}" <${email}>` };
};

export const getTransporter = async ({ forceNew = false } = {}) => {
  if (transporter && !forceNew) return transporter;

  const host = stripQuotes(process.env.SMTP_HOST);
  const user = stripQuotes(process.env.SMTP_USER);
  const pass = normalizePass(process.env.SMTP_PASS);
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  if (!host || !user || !pass) {
    log("warn", "SMTP not configured (need SMTP_HOST, SMTP_USER, SMTP_PASS)");
    return null;
  }

  const options = {
    host,
    port,
    secure,
    auth: { user, pass },
    // Helpful for port 587 STARTTLS
    requireTLS: !secure && port === 587,
    tls: {
      // Keep true in production; allow override for local/dev relays
      rejectUnauthorized: String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    logger: String(process.env.SMTP_DEBUG || "").toLowerCase() === "true",
    debug: String(process.env.SMTP_DEBUG || "").toLowerCase() === "true",
  };

  transporter = nodemailer.createTransport(options);
  verifiedOk = false;
  lastVerifyError = null;

  try {
    await transporter.verify();
    verifiedOk = true;
    log("log", `SMTP transporter verified → ${host}:${port} as ${user}`);
  } catch (error) {
    lastVerifyError = error.message;
    verifiedOk = false;
    log("error", `SMTP verify FAILED → ${host}:${port}`, error.message);
    // Keep transporter — some servers reject verify() but still accept sendMail.
    // Callers must inspect sendMail accepted/rejected carefully.
  }

  return transporter;
};

/**
 * Send email with real delivery checks.
 * success=true only when the SMTP server accepted the recipient.
 */
export const sendEmail = async ({ to, subject, html, text, attachments = [], brand = null } = {}) => {
  const recipient = String(to || "").trim().toLowerCase();
  if (!recipient || !recipient.includes("@")) {
    log("error", "Refusing send: invalid recipient", { to });
    return { success: false, skipped: false, reason: "Invalid recipient email", to };
  }

  const tx = await getTransporter();
  if (!tx) {
    return {
      success: false,
      skipped: true,
      reason: "SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env)",
      to: recipient,
    };
  }

  const from = resolveFromAddress(brand || {});
  const mail = {
    from: from.formatted,
    to: recipient,
    subject,
    html,
    text: text || String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    attachments,
    ...(from.replyTo ? { replyTo: from.replyTo } : {}),
    // Envelope helps some providers
    envelope: {
      from: from.email,
      to: recipient,
    },
  };

  log("log", "Sending mail…", {
    to: recipient,
    from: from.formatted,
    subject,
    attachmentCount: attachments?.length || 0,
    smtpVerified: verifiedOk,
  });

  try {
    const info = await tx.sendMail(mail);

    const accepted = (info.accepted || []).map(String);
    const rejected = (info.rejected || []).map(String);
    const pending = (info.pending || []).map(String);
    const recipientAccepted =
      accepted.some((a) => a.toLowerCase().includes(recipient)) ||
      (accepted.length > 0 && rejected.length === 0);

    log("log", "sendMail response", {
      messageId: info.messageId,
      response: info.response,
      accepted,
      rejected,
      pending,
      envelope: info.envelope,
    });

    if (!recipientAccepted || rejected.length > 0) {
      const reason =
        rejected.length > 0
          ? `SMTP rejected recipient(s): ${rejected.join(", ")}`
          : "SMTP did not accept the recipient address";
      log("error", reason, { to: recipient, response: info.response });
      return {
        success: false,
        skipped: false,
        reason,
        to: recipient,
        messageId: info.messageId,
        response: info.response,
        accepted,
        rejected,
      };
    }

    log("log", `Email ACCEPTED by SMTP for ${recipient} (messageId=${info.messageId})`);
    return {
      success: true,
      skipped: false,
      to: recipient,
      messageId: info.messageId,
      response: info.response,
      accepted,
      rejected,
      from: from.formatted,
    };
  } catch (error) {
    log("error", "sendMail threw", {
      to: recipient,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return {
      success: false,
      skipped: false,
      reason: error.message,
      code: error.code,
      to: recipient,
    };
  }
};

export const sendCompletionInviteEmail = async ({
  to,
  customerName,
  reservationId,
  completionUrl,
  vehicle,
  pickupDate,
  returnDate,
  total,
  currency = "MAD",
  brand = null,
}) => {
  const agency = String(brand?.name || brand?.displayName || "").trim() || "Your reservation";
  const accent = String(brand?.primaryBrandColor || "").trim() || "#333333";
  const subject = `${agency} — Complete your reservation ${reservationId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#161210">
      <h1 style="font-size:22px;color:${accent}">${agency}</h1>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Your reservation <strong>${reservationId}</strong> has been confirmed.</p>
      <p>Please complete the following to finalize your booking:</p>
      <ul>
        <li>Upload your driving license</li>
        <li>Upload a national ID or passport</li>
        <li>Pay the deposit or full amount online</li>
        <li>Sign the rental agreement digitally</li>
      </ul>
      <p><strong>Vehicle:</strong> ${vehicle || "—"}<br/>
      <strong>Pickup:</strong> ${pickupDate || "—"}<br/>
      <strong>Return:</strong> ${returnDate || "—"}<br/>
      <strong>Total:</strong> ${currency}${total ?? "—"}</p>
      <p style="margin:28px 0">
        <a href="${completionUrl}" style="background:${accent};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">
          Complete your booking securely
        </a>
      </p>
      <p style="font-size:12px;color:#6B6560">This secure link expires in a few days. If you did not make this reservation, ignore this email.</p>
      <p style="font-size:11px;color:#999">If the button does not work, copy this link:<br/>${completionUrl}</p>
    </div>
  `;
  return sendEmail({
    to,
    subject,
    html,
    brand: brand
      ? { name: agency, email: brand.email, replyTo: brand.email }
      : null,
  });
};

export const sendFinalConfirmationEmail = async ({
  to,
  customerName,
  reservationId,
  vehicle,
  detailsHtml,
  contractPath,
  invoicePath,
  brand = null,
}) => {
  const agency = String(brand?.name || brand?.displayName || "").trim() || "Your reservation";
  const accent = String(brand?.primaryBrandColor || "").trim() || "#333333";
  const subject = `${agency} — Ready for pickup · ${reservationId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#161210">
      <h1 style="font-size:22px;color:${accent}">${agency}</h1>
      <p>Hello ${customerName || "Customer"},</p>
      <p>Thank you. Your reservation <strong>${reservationId}</strong> is now <strong>Ready for Pickup</strong>.</p>
      <p><strong>Vehicle:</strong> ${vehicle || "—"}</p>
      ${detailsHtml || ""}
      <p>Your signed rental contract is attached.</p>
      <p style="font-size:12px;color:#6B6560">Please bring your original documents when collecting the vehicle.</p>
    </div>
  `;

  const attachments = [];
  if (contractPath) {
    attachments.push({ filename: `contract-${reservationId}.pdf`, path: contractPath });
  }

  return sendEmail({
    to,
    subject,
    html,
    attachments,
    brand: brand
      ? { name: agency, email: brand.email, replyTo: brand.email }
      : null,
  });
};

/** Admin diagnostics — verify SMTP without sending. */
export const verifyEmailTransport = async () => {
  transporter = null;
  verifiedOk = false;
  lastVerifyError = null;
  const tx = await getTransporter({ forceNew: true });
  const summary = getSmtpConfigSummary();
  if (!tx) {
    return { success: false, ...summary, reason: "SMTP not configured" };
  }
  return {
    success: verifiedOk,
    ...summary,
    reason: verifiedOk ? "SMTP connection verified" : lastVerifyError || "Verify failed",
  };
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const platformEmailShell = ({ title, bodyHtml, ctaLabel, ctaHref, footerNote }) => {
  const accent = "#A51624";
  const cta = ctaHref
    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">${escapeHtml(ctaLabel || "Open")}</a></p>`
    : "";
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1614;background:#f7f4f0;padding:24px">
      <div style="background:#fff;border:1px solid #e8e1d8;border-radius:12px;padding:32px 28px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${accent};font-weight:700">RSZ CAR</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1a1614">${escapeHtml(title)}</h1>
        ${bodyHtml}
        ${cta}
        ${footerNote ? `<p style="margin:24px 0 0;font-size:12px;color:#6b6560">${footerNote}</p>` : ""}
      </div>
      <p style="margin:16px 8px 0;font-size:11px;color:#8a837c">RSZ CAR — car rental management software</p>
    </div>
  `;
};

/**
 * Platform approval mail — RSZ CAR branded. Never includes passwords.
 */
export const sendAgencyApprovedEmail = async ({
  to,
  agencyName,
  contactName,
  dashboardUrl,
  supportEmail = "",
} = {}) => {
  const name = escapeHtml(contactName || "there");
  const agency = escapeHtml(agencyName || "your agency");
  const support = String(supportEmail || "").trim();
  const supportHtml = support
    ? `If you need help, contact us at <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.`
    : "If you need help, reply to this email.";
  const html = platformEmailShell({
    title: "Your RSZ CAR agency has been approved",
    bodyHtml: `
      <p>Hello ${name},</p>
      <p>Your RSZ CAR agency <strong>${agency}</strong> has been successfully created and approved.</p>
      <p>You can now sign in with the email and password you registered with, then open your owner workspace.</p>
    `,
    ctaLabel: "Access your dashboard",
    ctaHref: dashboardUrl,
    footerNote: supportHtml,
  });
  return sendEmail({
    to,
    subject: "Your RSZ CAR agency has been approved",
    html,
    brand: { displayName: "RSZ CAR", replyTo: support },
  });
};

export const sendAgencyRejectedEmail = async ({
  to,
  agencyName,
  contactName,
  reason = "",
  supportEmail = "",
} = {}) => {
  const name = escapeHtml(contactName || "there");
  const agency = escapeHtml(agencyName || "your agency");
  const support = String(supportEmail || "").trim();
  const reasonHtml = String(reason || "").trim()
    ? `<p>Reason: ${escapeHtml(reason.trim())}</p>`
    : "";
  const supportHtml = support
    ? `Questions: <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.`
    : "";
  const html = platformEmailShell({
    title: "RSZ CAR agency request update",
    bodyHtml: `
      <p>Hello ${name},</p>
      <p>The registration request for <strong>${agency}</strong> was not approved, so the workspace was not activated.</p>
      ${reasonHtml}
    `,
    footerNote: supportHtml,
  });
  return sendEmail({
    to,
    subject: "RSZ CAR agency request update",
    html,
    brand: { displayName: "RSZ CAR", replyTo: support },
  });
};

export default sendEmail;

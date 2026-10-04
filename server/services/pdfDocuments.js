import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { resolveBrandForContext } from "./agencyBrand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "documents");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const money = (n, currency = "MAD") => `${currency} ${Number(n || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-GB", { hour12: false });
};

const writePdfToFile = (filePath, buildFn) =>
  new Promise((resolve, reject) => {
    ensureDir(path.dirname(filePath));
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    const finalize = async () => {
      try {
        await buildFn(doc);
        doc.end();
      } catch (err) {
        reject(err);
        return;
      }
    };
    finalize();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });

const getSignatureBuffer = async (signaturePath, signatureUrl) => {
  if (signaturePath && fs.existsSync(signaturePath)) {
    return fs.readFileSync(signaturePath);
  }

  if (!signatureUrl) return null;
  if (signatureUrl.startsWith('data:image')) {
    const matches = signatureUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!matches) return null;
    return Buffer.from(matches[2], 'base64');
  }

  if (/^https?:\/\//.test(signatureUrl)) {
    try {
      const res = await fetch(signatureUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  const localPath = path.join(__dirname, '..', signatureUrl.replace(/^\//, ''));
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  return null;
};

/**
 * Generate rental contract PDF. Returns absolute file path.
 */
export const generateRentalContractPdf = async (booking, { signaturePath, signatureUrl } = {}) => {
  const reservationId = booking.reservationId || booking._id.toString();
  const dir = path.join(UPLOAD_ROOT, reservationId);
  const token = Math.random().toString(36).slice(2, 10);
  const filePath = path.join(dir, `contract-${token}.pdf`);
  const car = booking.car || {};
  const brand = await resolveBrandForContext({ booking, owner: booking.owner });
  const currency = brand.currency || process.env.CURRENCY || "MAD";
  const agency = brand.contractBranding?.companyName || brand.name || "—";
  const accent = brand.primaryBrandColor || "#333333";

  await writePdfToFile(filePath, async (doc) => {
    doc.fillColor(accent).fontSize(22).text(agency, { align: "left" });
    doc.moveDown(0.3);
    doc.fillColor("#161210").fontSize(16).text("Vehicle Rental Agreement", { align: "left" });
    doc.moveDown();
    doc.fontSize(10).fillColor("#6B6560").text(`Reservation ${reservationId}`);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`);
    doc.moveDown();

    doc.fillColor("#161210").fontSize(12).text("Parties", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    doc.text(`Lessor: ${agency}`);
    doc.text(`Lessee: ${booking.customerName || "—"}`);
    doc.text(`Email: ${booking.customerEmail || "—"}`);
    doc.text(`Phone: ${booking.customerPhone || "—"}`);
    doc.moveDown();

    doc.fontSize(12).text("Vehicle & period", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    doc.text(`Vehicle: ${car.brand || ""} ${car.model || ""} (${car.year || ""})`);
    doc.text(`Pickup: ${booking.pickupLocation || "—"} · ${formatDate(booking.pickupDate)}`);
    doc.text(`Return: ${booking.returnLocation || "—"} · ${formatDate(booking.returnDate)}`);
    doc.moveDown();

    doc.fontSize(12).text("Financial summary", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    const b = booking.priceBreakdown || {};
    doc.text(`Rental: ${money(b.rentalPrice ?? booking.price, currency)}`);
    doc.text(`Pickup delivery fee: ${money(b.pickupDeliveryFee, currency)}`);
    doc.text(`Drop-off delivery fee: ${money(b.dropoffDeliveryFee, currency)}`);
    if (b.discountTotal) doc.text(`Discounts: -${money(b.discountTotal, currency)}`);
    doc.text(`Total: ${money(booking.price, currency)}`);
    doc.text(`Payment type: ${booking.completion?.paymentType || "—"}`);
    doc.text(`Amount paid: ${money(booking.completion?.amountPaid || 0, currency)}`);
    doc.moveDown();

    doc.fontSize(12).text("Terms", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor("#333");
    doc.text(
      "The lessee confirms that the uploaded driving license and identity document are valid. " +
      "The vehicle must be returned in the same condition, subject to fair wear and tear. " +
      "The lessee accepts liability for traffic fines, damage beyond normal use, and late returns as per agency policy. " +
      "This electronic signature has the same effect as a handwritten signature for this rental agreement.",
      { align: "justify" }
    );
    doc.moveDown(1.5);

    doc.fillColor("#161210").fontSize(11).text("Digital signature");
    doc.moveDown(0.5);

    const signatureBuffer = await getSignatureBuffer(signaturePath, signatureUrl || booking.completion?.signatureUrl);
    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, { fit: [220, 80] });
      } catch {
        doc.fontSize(10).text("[Signature on file]");
      }
    } else {
      doc.fontSize(10).text("[Signature on file]");
    }

    doc.moveDown();
    doc.fontSize(9).fillColor("#6B6560")
      .text(`Signed electronically on ${formatDate(booking.completion?.signatureSignedAt || new Date())}`);
    doc.text(`Signer: ${booking.customerName || "—"}`);
  });

  return filePath;
};

/**
 * Generate invoice PDF. Returns absolute file path.
 */
export const generateInvoicePdf = async (booking, { includeCompanyStamp = true } = {}) => {
  const reservationId = booking.reservationId || booking._id.toString();
  const dir = path.join(UPLOAD_ROOT, reservationId);
  const token = Math.random().toString(36).slice(2, 10);
  const filePath = path.join(dir, `invoice-${token}.pdf`);
  const car = booking.car || {};
  const brand = await resolveBrandForContext({ booking, owner: booking.owner });
  const currency = brand.currency || process.env.CURRENCY || "MAD";
  const agency = brand.contractBranding?.companyName || brand.name || "—";
  const accent = brand.primaryBrandColor || "#333333";
  const b = booking.priceBreakdown || {};
  const invoiceNo = `INV-${reservationId.replace(/^RES-/, "")}`;

  await writePdfToFile(filePath, (doc) => {
    doc.fillColor(accent).fontSize(22).text(agency);
    doc.moveDown(0.2);
    doc.fillColor("#161210").fontSize(16).text("Invoice");
    doc.moveDown();
    doc.fontSize(10).fillColor("#6B6560");
    doc.text(`Invoice No: ${invoiceNo}`);
    doc.text(`Reservation: ${reservationId}`);
    doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`);
    doc.moveDown();

    doc.fillColor("#161210").fontSize(11).text("Bill to");
    doc.fontSize(10);
    doc.text(booking.customerName || "—");
    doc.text(booking.customerEmail || "");
    doc.text(booking.customerPhone || "");
    doc.moveDown();

    doc.fontSize(11).text("Description");
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Car rental — ${car.brand || ""} ${car.model || ""}`);
    doc.text(`Period: ${formatDate(booking.pickupDate)} → ${formatDate(booking.returnDate)}`);
    doc.moveDown();

    const rows = [
      ["Rental", money(b.rentalPrice ?? booking.price, currency)],
      ["Pickup delivery", money(b.pickupDeliveryFee, currency)],
      ["Drop-off delivery", money(b.dropoffDeliveryFee, currency)],
    ];
    if (b.discountTotal) rows.push(["Discounts", `-${money(b.discountTotal, currency)}`]);

    rows.forEach(([label, value]) => {
      doc.text(`${label}`, { continued: true });
      doc.text(value, { align: "right" });
    });

    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${money(booking.price, currency)}`, { align: "right" });
    doc.fontSize(10).text(
      `Paid (${booking.completion?.paymentType || "payment"}): ${money(booking.completion?.amountPaid || booking.price, currency)}`,
      { align: "right" }
    );
    if (includeCompanyStamp) {
      doc.moveDown(1);
      doc.fontSize(10).fillColor("#6B6560").text("Stamp and signature: included");
    }
    doc.moveDown(1);
    doc.fontSize(9).fillColor("#6B6560").text(agency !== "—" ? `Thank you for choosing ${agency}.` : "Thank you.");
  });

  return filePath;
};

export const publicUploadUrl = (absolutePath) => {
  if (!absolutePath) return "";
  const rel = path.relative(path.join(__dirname, ".."), absolutePath).replace(/\\/g, "/");
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");
  return `${base}/${rel}`;
};

export default {
  generateRentalContractPdf,
  generateInvoicePdf,
  publicUploadUrl,
};

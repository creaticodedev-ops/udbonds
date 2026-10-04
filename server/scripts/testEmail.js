/**
 * SMTP delivery test script.
 * Usage (from /server):
 *   node scripts/testEmail.js you@example.com
 */
import "dotenv/config";
import { sendEmail, verifyEmailTransport, getSmtpConfigSummary } from "../services/emailService.js";

const to = process.argv[2] || process.env.SMTP_USER;

console.log("=== SMTP config ===");
console.log(getSmtpConfigSummary());

console.log("\n=== Verifying transporter ===");
const verify = await verifyEmailTransport();
console.log(verify);

if (!to) {
  console.error("\nProvide a recipient: node scripts/testEmail.js email@example.com");
  process.exit(1);
}

console.log(`\n=== Sending test email to ${to} ===`);
const result = await sendEmail({
  to,
  subject: "HDN Car — SMTP test",
  html: `<p>SMTP test at ${new Date().toISOString()}</p><p>If you see this, delivery works.</p>`,
});
console.log(result);

process.exit(result.success ? 0 : 1);

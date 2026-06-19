import nodemailer from "nodemailer";
import logger from "./logger.js";
import { createHash } from "crypto";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SYSTEM_EMAIL,
    pass: process.env.SYSTEM_EMAIL_PASSWORD,
  },
});

export function hashResetToken(rawToken) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function sendPasswordResetEmail({ toEmail, rawToken, restaurantName }) {
  try {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset${restaurantName ? ` for ${restaurantName}` : ""}.</p>
      <p>Click the link below to reset your password. It expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, ignore this email.</p>
    `;
    await transporter.sendMail({
      from: `"KangPOS" <${process.env.SYSTEM_EMAIL}>`,
      to: toEmail,
      subject: "Password Reset",
      html,
    });
  } catch (err) {
    logger.error({ err }, "Password reset email failed");
  }
}

export async function sendDiscrepancyEmail(data) {
  try {
    const {
      userName,
      difference,
      countedCash,
      expectedCash,
      reason,
    } = data;

    const html = `
      <h2>Cash Discrepancy Alert</h2>
      <p><strong>Closed By:</strong> ${userName}</p>
      <p><strong>Counted Cash:</strong> ${countedCash}</p>
      <p><strong>Expected Cash:</strong> ${expectedCash}</p>
      <p><strong>Difference:</strong> ${difference}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `;

    await transporter.sendMail({
      from: `"KangPOS Alert" <${process.env.SYSTEM_EMAIL}>`,
      to: process.env.OWNER_ALERT_EMAIL,
      subject: "⚠ Cash Discrepancy Detected",
      html,
    });
  } catch (err) {
    logger.error({ err }, "Email send failed");
  }
}
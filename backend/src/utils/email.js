import nodemailer from "nodemailer";
import logger from "./logger.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SYSTEM_EMAIL,
    pass: process.env.SYSTEM_EMAIL_PASSWORD,
  },
});

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
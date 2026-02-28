import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SYSTEM_EMAIL,
    pass: process.env.SYSTEM_EMAIL_PASSWORD,
  },
});

export async function sendDiscrepancyEmail({
  userName,
  difference,
  countedCash,
  expectedCash,
  reason,
}) {
  const subject = "⚠ Cash Discrepancy Detected - KangPOS";

  const html = `
    <h2>Cash Discrepancy Alert</h2>
    <p><strong>Closed By:</strong> ${userName}</p>
    <p><strong>Counted Cash:</strong> ₹${countedCash}</p>
    <p><strong>Expected Cash:</strong> ₹${expectedCash}</p>
    <p><strong>Difference:</strong> ₹${difference}</p>
    <p><strong>Reason Provided:</strong> ${reason}</p>
    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    <hr/>
    <p>This is an automated financial alert from KangPOS.</p>
  `;

  await transporter.sendMail({
    from: `"KangPOS Alert" <${process.env.SYSTEM_EMAIL}>`,
    to: process.env.OWNER_ALERT_EMAIL,
    subject,
    html,
  });
}
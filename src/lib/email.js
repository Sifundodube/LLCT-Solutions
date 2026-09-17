const nodemailer = require('nodemailer');

const ADMIN_EMAIL = 'llct.solutions@outlook.com';

function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

async function sendAdminNotification(subject, text) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP_USER or SMTP_PASSWORD is not configured; notification skipped.');
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: ADMIN_EMAIL,
    subject,
    text,
  });
}

module.exports = { sendAdminNotification };
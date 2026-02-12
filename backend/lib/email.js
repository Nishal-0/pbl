const nodemailer = require("nodemailer");

let transporter = null;

const buildTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_SERVICE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    return null;
  }

  if (SMTP_SERVICE) {
    transporter = nodemailer.createTransport({
      service: SMTP_SERVICE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    return transporter;
  }

  if (!SMTP_HOST) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const activeTransporter = buildTransporter();

  if (!activeTransporter) {
    console.warn("Email skipped: SMTP config missing.");
    return;
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await activeTransporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;

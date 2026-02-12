const nodemailer = require("nodemailer");

// Use a Gmail account or your own SMTP server
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "yourapp.testing@gmail.com", // Replace with your email
    pass: "your-app-password",        // Use an App Password if using Gmail
  },
});

// Function to send emails
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    await transporter.sendMail({
      from: '"Support Portal" <yourapp.testing@gmail.com>',
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error("Email sending failed:", err);
  }
};

module.exports = sendEmail;

import nodemailer from "nodemailer";

const isEmailEnabled = process.env.SEND_NOTIFICATION_EMAILS === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  try {
    if (!isEmailEnabled) {
      return false;
    }

    if (!to) {
      return false;
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("Mail sending error:", error);
    return false;
  }
};

export const sendEmailVerificationOtp = async ({ to, name, otp }) => {
  return sendMail({
    to,
    subject: "Email Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e5e7eb;">
          <h2 style="margin-top:0; color:#111827;">Email Verification OTP</h2>

          <p style="font-size:15px; color:#374151; line-height:1.6;">
            Hello ${name || "User"},
          </p>

          <p style="font-size:15px; color:#374151; line-height:1.6;">
            Your email verification OTP is:
          </p>

          <div style="font-size:28px; font-weight:700; letter-spacing:4px; color:#111827; background:#f3f4f6; padding:16px; border-radius:10px; text-align:center;">
            ${otp}
          </div>

          <p style="font-size:14px; color:#6b7280; margin-top:20px;">
            This OTP is valid for 10 minutes. Share this OTP only with your Super Admin for account verification.
          </p>
        </div>
      </div>
    `,
  });
};

export const sendNotificationEmail = async ({
  to,
  subject,
  title,
  message,
  priority,
}) => {
  return sendMail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e5e7eb;">
          <h2 style="margin-top:0; color:#111827;">
            ${title}
          </h2>

          <p style="font-size:15px; color:#374151; line-height:1.6;">
            ${message}
          </p>

          <p style="margin-top:20px; font-size:14px; color:#111827;">
            <strong>Priority:</strong> ${priority}
          </p>

          <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

          <p style="font-size:13px; color:#6b7280;">
            This notification was sent from the Role Based Authentication System.
          </p>
        </div>
      </div>
    `,
  });
};

export const sendCalendarEmail = async ({
  to,
  subject,
  title,
  description,
  eventDate,
  audience,
  status,
}) => {
  return sendMail({
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; padding:24px; border:1px solid #e5e7eb;">
          <h2 style="margin-top:0; color:#111827;">
            ${title}
          </h2>

          <p style="font-size:15px; color:#374151; line-height:1.6;">
            ${description || "Calendar event has been scheduled."}
          </p>

          <p style="font-size:14px; color:#111827;">
            <strong>Date:</strong> ${eventDate}
          </p>

          <p style="font-size:14px; color:#111827;">
            <strong>Audience:</strong> ${audience}
          </p>

          <p style="font-size:14px; color:#111827;">
            <strong>Status:</strong> ${status}
          </p>

          <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />

          <p style="font-size:13px; color:#6b7280;">
            This calendar alert was sent from the Role Based Authentication System.
          </p>
        </div>
      </div>
    `,
  });
};
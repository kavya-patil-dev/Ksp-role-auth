import twilio from "twilio";

const smsEnabled = process.env.SEND_NOTIFICATION_SMS === "true";
const whatsappEnabled = process.env.SEND_NOTIFICATION_WHATSAPP === "true";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const smsFrom = process.env.TWILIO_SMS_FROM;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || "+91";

const isValidTwilioSid =
  typeof accountSid === "string" && accountSid.trim().startsWith("AC");

const isTwilioConfigured =
  isValidTwilioSid &&
  typeof authToken === "string" &&
  authToken.trim().length > 0;

const client = isTwilioConfigured
  ? twilio(accountSid.trim(), authToken.trim())
  : null;

export const normalizeMobileNumber = (mobile) => {
  if (!mobile) {
    return "";
  }

  const cleanedValue = String(mobile).trim();

  if (!cleanedValue) {
    return "";
  }

  if (cleanedValue.startsWith("+")) {
    return cleanedValue.replace(/[^\d+]/g, "");
  }

  const digitsOnly = cleanedValue.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  if (digitsOnly.length === 10) {
    return `${defaultCountryCode}${digitsOnly}`;
  }

  return `+${digitsOnly}`;
};

export const sendSmsMessage = async ({ to, body }) => {
  try {
    if (!smsEnabled) {
      return false;
    }

    if (!client || !smsFrom) {
      console.warn(
        "SMS skipped: Twilio SMS configuration missing or invalid."
      );
      return false;
    }

    const normalizedTo = normalizeMobileNumber(to);

    if (!normalizedTo) {
      return false;
    }

    await client.messages.create({
      from: smsFrom,
      to: normalizedTo,
      body,
    });

    return true;
  } catch (error) {
    console.error("SMS sending error:", error);
    return false;
  }
};

export const sendWhatsAppMessage = async ({ to, body }) => {
  try {
    if (!whatsappEnabled) {
      return false;
    }

    if (!client || !whatsappFrom) {
      console.warn(
        "WhatsApp skipped: Twilio WhatsApp configuration missing or invalid."
      );
      return false;
    }

    const normalizedTo = normalizeMobileNumber(to);

    if (!normalizedTo) {
      return false;
    }

    await client.messages.create({
      from: whatsappFrom,
      to: `whatsapp:${normalizedTo}`,
      body,
    });

    return true;
  } catch (error) {
    console.error("WhatsApp sending error:", error);
    return false;
  }
};

export const sendMobileOtpMessage = async ({ mobile, otp, channel = "BOTH" }) => {
  const selectedChannel = String(channel || "BOTH").toUpperCase();

  const body = `Your Role Based Auth System mobile verification OTP is ${otp}. This OTP is valid for 10 minutes.`;

  const result = {
    sms: false,
    whatsapp: false,
  };

  if (selectedChannel === "SMS" || selectedChannel === "BOTH") {
    result.sms = await sendSmsMessage({
      to: mobile,
      body,
    });
  }

  if (selectedChannel === "WHATSAPP" || selectedChannel === "BOTH") {
    result.whatsapp = await sendWhatsAppMessage({
      to: mobile,
      body,
    });
  }

  return result;
};

export const getVerifiedMobileFromUser = (user) => {
  if (user?.mobileVerified && user?.mobile) {
    return user.mobile;
  }

  const verification = user?.mobileVerifications?.find(
    (item) => item.status === "VERIFIED" || item.mobileVerified === true
  );

  return verification?.mobile || "";
};
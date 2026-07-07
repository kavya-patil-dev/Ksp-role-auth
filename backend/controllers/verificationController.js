import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import { sendEmailVerificationOtp } from "../utils/mailService.js";
import { notifySingleUser } from "../utils/dashboardNotificationService.js";
import {
  normalizeMobileNumber,
  sendMobileOtpMessage,
} from "../utils/mobileMessageService.js";

const ASSIGNABLE_ROLES = ["ADMIN", "EMPLOYEE", "USER"];

const OTP_VALID_MINUTES = Number(process.env.VERIFICATION_OTP_VALID_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.VERIFICATION_OTP_MAX_ATTEMPTS || 5);

const statusToDisplay = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const normalizeRoleName = (roleName) => {
  const value = typeof roleName === "string" ? roleName.trim().toUpperCase() : "";
  return ASSIGNABLE_ROLES.includes(value) ? value : "";
};

const getLatestVerification = (user) => {
  const verifications = user.mobileVerifications || [];

  if (!verifications.length) {
    return null;
  }

  return verifications[0];
};

const getVerificationStatusText = (user, verification) => {
  const isSuperAdmin = user.role?.name === "SUPER_ADMIN" || user.isProtectedAccount;

  if (isSuperAdmin) {
    return "Verified";
  }

  if (user.emailVerified && user.mobileVerified && user.isRoleApproved) {
    return "Verified";
  }

  if (verification?.status === "REJECTED") {
    return "Rejected";
  }

  return "Pending";
};

const formatVerificationUser = (user) => {
  const verification = getLatestVerification(user);

  return {
    id: verification?.id || user.id,
    verificationId: verification?.id || null,
    userId: user.id,

    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role?.name || null,
    requestedRole: user.requestedRole || "USER",

    isEmailVerified: Boolean(user.emailVerified),
    isMobileVerified: Boolean(user.mobileVerified),
    isRoleApproved: Boolean(user.isRoleApproved),
    isFullyVerified:
      Boolean(user.emailVerified) &&
      Boolean(user.mobileVerified) &&
      Boolean(user.isRoleApproved),

    status: getVerificationStatusText(user, verification),
    verificationStatus: getVerificationStatusText(user, verification),
    roleApprovalStatus: user.isRoleApproved ? "Approved" : "Pending",

    emailOtpSentAt: verification?.emailOtpSentAt || null,
    mobileOtpSentAt: verification?.mobileOtpSentAt || null,
    verifiedAt: verification?.verifiedAt || null,

    remarks: verification?.remarks || "",
    createdAt: user.createdAt,
    updatedAt: verification?.updatedAt || user.updatedAt,
  };
};

const findUserForVerification = async (userId) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      role: true,
      mobileVerifications: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
      },
    },
  });
};

const createOrUpdateVerificationWithOtps = async ({ user, emailOtp, mobileOtp }) => {
  const emailOtpHash = await bcrypt.hash(emailOtp, 10);
  const mobileOtpHash = await bcrypt.hash(mobileOtp, 10);

  const expiresAt = new Date(Date.now() + OTP_VALID_MINUTES * 60 * 1000);

  const existingVerification = getLatestVerification(user);

  if (existingVerification) {
    return prisma.mobileVerification.update({
      where: {
        id: existingVerification.id,
      },
      data: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        status: "PENDING",
        remarks:
          "OTP sent. Waiting for Super Admin to enter email and mobile OTPs.",
        emailOtpHash,
        emailOtpExpiresAt: expiresAt,
        emailOtpAttempts: 0,
        emailOtpSentAt: new Date(),
        emailVerified: false,
        mobileOtpHash,
        mobileOtpExpiresAt: expiresAt,
        mobileOtpAttempts: 0,
        mobileOtpSentAt: new Date(),
        mobileVerified: false,
        verifiedAt: null,
      },
    });
  }

  return prisma.mobileVerification.create({
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      status: "PENDING",
      remarks:
        "OTP sent. Waiting for Super Admin to enter email and mobile OTPs.",
      emailOtpHash,
      emailOtpExpiresAt: expiresAt,
      emailOtpAttempts: 0,
      emailOtpSentAt: new Date(),
      emailVerified: false,
      mobileOtpHash,
      mobileOtpExpiresAt: expiresAt,
      mobileOtpAttempts: 0,
      mobileOtpSentAt: new Date(),
      mobileVerified: false,
      verifiedAt: null,
    },
  });
};

export const getVerifications = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          name: {
            not: "SUPER_ADMIN",
          },
        },
      },
      include: {
        role: true,
        mobileVerifications: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      verifications: users.map(formatVerificationUser),
    });
  } catch (error) {
    console.error("Get verifications error:", error);
    return res.status(500).json({
      message: "Failed to fetch verifications",
    });
  }
};

export const createVerification = async (req, res) => {
  try {
    const { userId, channel = "BOTH" } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "User is required",
      });
    }

    const user = await findUserForVerification(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role?.name === "SUPER_ADMIN") {
      return res.status(400).json({
        message: "Super Admin verification is not required",
      });
    }

    if (!user.email || !user.mobile) {
      return res.status(400).json({
        message: "User email and mobile number are required before sending OTPs",
      });
    }

    const emailOtp = generateOtp();
    const mobileOtp = generateOtp();

    const verification = await createOrUpdateVerificationWithOtps({
      user,
      emailOtp,
      mobileOtp,
    });

    const emailResult = await sendEmailVerificationOtp({
      to: user.email,
      name: user.name,
      otp: emailOtp,
    });

    const mobileResult = await sendMobileOtpMessage({
      mobile: user.mobile,
      otp: mobileOtp,
      channel,
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: false,
        mobileVerified: false,
        emailVerifiedAt: null,
        mobileVerifiedAt: null,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Email OTP and mobile OTP sent. Ask the user for both OTPs and enter them to verify.",
      emailResult,
      mobileResult,
      verification,
    });
  } catch (error) {
    console.error("Create verification error:", error);
    return res.status(500).json({
      message: "Failed to send verification OTPs",
    });
  }
};

export const sendVerificationOtps = async (req, res) => {
  req.body.userId = req.params.userId;
  return createVerification(req, res);
};

export const verifyUserOtps = async (req, res) => {
  try {
    const { userId } = req.params;
    const { emailOtp, mobileOtp } = req.body;

    const enteredEmailOtp = typeof emailOtp === "string" ? emailOtp.trim() : "";
    const enteredMobileOtp = typeof mobileOtp === "string" ? mobileOtp.trim() : "";

    if (!enteredEmailOtp || !enteredMobileOtp) {
      return res.status(400).json({
        message: "Email OTP and mobile OTP are required",
      });
    }

    const user = await findUserForVerification(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const verification = getLatestVerification(user);

    if (!verification) {
      return res.status(404).json({
        message: "Verification request not found. Please send OTPs first.",
      });
    }

    if (
      !verification.emailOtpHash ||
      !verification.mobileOtpHash ||
      !verification.emailOtpExpiresAt ||
      !verification.mobileOtpExpiresAt
    ) {
      return res.status(400).json({
        message: "OTPs were not generated. Please send OTPs again.",
      });
    }

    if (
      new Date(verification.emailOtpExpiresAt).getTime() < Date.now() ||
      new Date(verification.mobileOtpExpiresAt).getTime() < Date.now()
    ) {
      return res.status(400).json({
        message: "OTP expired. Please send OTPs again.",
      });
    }

    if (
      verification.emailOtpAttempts >= OTP_MAX_ATTEMPTS ||
      verification.mobileOtpAttempts >= OTP_MAX_ATTEMPTS
    ) {
      return res.status(429).json({
        message: "Too many wrong attempts. Please send OTPs again.",
      });
    }

    const isEmailOtpValid = await bcrypt.compare(
      enteredEmailOtp,
      verification.emailOtpHash
    );

    const isMobileOtpValid = await bcrypt.compare(
      enteredMobileOtp,
      verification.mobileOtpHash
    );

    if (!isEmailOtpValid || !isMobileOtpValid) {
      await prisma.mobileVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          emailOtpAttempts: {
            increment: isEmailOtpValid ? 0 : 1,
          },
          mobileOtpAttempts: {
            increment: isMobileOtpValid ? 0 : 1,
          },
        },
      });

      return res.status(400).json({
        message: "Invalid email OTP or mobile OTP",
      });
    }

    const updatedVerification = await prisma.mobileVerification.update({
      where: {
        id: verification.id,
      },
      data: {
        status: "VERIFIED",
        remarks:
          "Email and mobile verified successfully through Super Admin OTP confirmation.",
        emailVerified: true,
        mobileVerified: true,
        emailOtpHash: null,
        emailOtpExpiresAt: null,
        emailOtpAttempts: 0,
        mobileOtpHash: null,
        mobileOtpExpiresAt: null,
        mobileOtpAttempts: 0,
        verifiedAt: new Date(),
      },
    });

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        mobileVerified: true,
        mobileVerifiedAt: new Date(),
      },
      include: {
        role: true,
        mobileVerifications: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Email and mobile verified successfully. Now approve the user's role.",
      verification: updatedVerification,
      user: formatVerificationUser(updatedUser),
    });
  } catch (error) {
    console.error("Verify user OTPs error:", error);
    return res.status(500).json({
      message: "Failed to verify OTPs",
    });
  }
};

export const approveUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName, remarks = "" } = req.body;

    const approvedRoleName = normalizeRoleName(roleName);

    if (!approvedRoleName) {
      return res.status(400).json({
        message: "Please select Admin, Employee or User role",
      });
    }

    const user = await findUserForVerification(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role?.name === "SUPER_ADMIN" || user.isProtectedAccount) {
      return res.status(400).json({
        message: "Super Admin role approval is not required",
      });
    }

    const role = await prisma.role.findUnique({
      where: {
        name: approvedRoleName,
      },
    });

    if (!role) {
      return res.status(400).json({
        message: "Selected role not found. Please run npm run seed.",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        roleId: role.id,
        requestedRole: approvedRoleName,
        isRoleApproved: true,
        roleApprovedAt: new Date(),
        roleApprovedById: req.user.id,
      },
      include: {
        role: true,
        mobileVerifications: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
        },
      },
    });

    const latestVerification = getLatestVerification(updatedUser);

    if (latestVerification) {
      await prisma.mobileVerification.update({
        where: {
          id: latestVerification.id,
        },
        data: {
          remarks:
            remarks?.trim() ||
            `Role approved as ${approvedRoleName} by Super Admin.`,
        },
      });
    }

    await notifySingleUser({
      userId: updatedUser.id,
      title: "Role approved",
      message: `Your dashboard role has been approved as ${approvedRoleName}. Refresh the dashboard to load the latest access.`,
      priority: "HIGH",
      createdById: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: `Role approved as ${approvedRoleName}`,
      user: formatVerificationUser(updatedUser),
    });
  } catch (error) {
    console.error("Approve user role error:", error);
    return res.status(500).json({
      message: "Failed to approve role",
    });
  }
};

export const updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status, remarks = "" } = req.body;

    if (status === "Verified" || status === "VERIFIED") {
      return res.status(400).json({
        message:
          "Direct manual verification is not allowed. Send OTPs and verify both OTPs.",
      });
    }

    const normalizedStatus =
      status === "Rejected" || status === "REJECTED"
        ? "REJECTED"
        : status === "Pending" || status === "PENDING"
        ? "PENDING"
        : null;

    if (!normalizedStatus) {
      return res.status(400).json({
        message: "Only Pending or Rejected status can be set manually",
      });
    }

    const verification = await prisma.mobileVerification.update({
      where: {
        id: verificationId,
      },
      data: {
        status: normalizedStatus,
        remarks: remarks?.trim() || undefined,
      },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (verification.userId && normalizedStatus === "REJECTED") {
      await prisma.user.update({
        where: {
          id: verification.userId,
        },
        data: {
          emailVerified: false,
          mobileVerified: false,
          isRoleApproved: false,
        },
      });

      await notifySingleUser({
        userId: verification.userId,
        title: "Verification rejected",
        message:
          remarks?.trim() ||
          "Your email, mobile or role approval request was rejected by Super Admin.",
        priority: "URGENT",
        createdById: req.user.id,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification status updated",
      verification,
    });
  } catch (error) {
    console.error("Update verification error:", error);
    return res.status(500).json({
      message: "Failed to update verification",
    });
  }
};

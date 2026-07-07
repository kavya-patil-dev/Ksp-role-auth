import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { notifyRoleUsers } from "../utils/dashboardNotificationService.js";
import { normalizeMobileNumber } from "../utils/mobileMessageService.js";

const ASSIGNABLE_ROLES = ["ADMIN", "EMPLOYEE", "USER"];

const normalizeEmail = (email) => {
  return typeof email === "string" ? email.toLowerCase().trim() : "";
};

const normalizeText = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeRoleName = (roleName) => {
  const value = typeof roleName === "string" ? roleName.trim().toUpperCase() : "USER";
  return ASSIGNABLE_ROLES.includes(value) ? value : "USER";
};

const buildEffectivePermissions = (user) => {
  const rolePermissionKeys =
    user.role?.permissions?.map((rolePermission) => {
      return rolePermission.permission.key;
    }) || [];

  const allowOverrides =
    user.permissionOverrides
      ?.filter((override) => override.effect === "ALLOW")
      .map((override) => override.permission.key) || [];

  const denyOverrides =
    user.permissionOverrides
      ?.filter((override) => override.effect === "DENY")
      .map((override) => override.permission.key) || [];

  const permissionSet = new Set([...rolePermissionKeys, ...allowOverrides]);

  denyOverrides.forEach((permissionKey) => {
    permissionSet.delete(permissionKey);
  });

  return Array.from(permissionSet);
};

const statusToDisplay = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const getLatestVerification = (user) => {
  const verifications = user.mobileVerifications || [];

  if (!verifications.length) {
    return null;
  }

  return verifications[0];
};

const formatUser = (user) => {
  const roleName = user.role?.name || null;
  const isSuperAdmin = roleName === "SUPER_ADMIN" || user.isProtectedAccount === true;
  const latestVerification = getLatestVerification(user);

  const isEmailVerified = isSuperAdmin || Boolean(user.emailVerified);
  const isMobileVerified = isSuperAdmin || Boolean(user.mobileVerified);
  const isRoleApproved = isSuperAdmin || Boolean(user.isRoleApproved);

  const isFullyVerified =
    isSuperAdmin || (isEmailVerified && isMobileVerified && isRoleApproved);

  const verificationIssues = [];

  if (!isSuperAdmin && !isEmailVerified) {
    verificationIssues.push("Email not verified");
  }

  if (!isSuperAdmin && !isMobileVerified) {
    verificationIssues.push("Mobile not verified");
  }

  if (!isSuperAdmin && !isRoleApproved) {
    verificationIssues.push("Role approval pending");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    isActive: user.status === "ACTIVE",

    role: roleName,
    roleId: user.roleId,
    requestedRole: user.requestedRole || "USER",

    isProtectedAccount: user.isProtectedAccount,

    isEmailVerified,
    isMobileVerified,
    isRoleApproved,
    isFullyVerified,

    verifiedMobile: isMobileVerified ? user.mobile : null,
    verificationStatus: isFullyVerified ? "Verified" : "Non-verified",
    roleApprovalStatus: isRoleApproved ? "Approved" : "Pending",
    verificationIssues,

    permissions: buildEffectivePermissions(user),

    mobileVerification: latestVerification
      ? {
          id: latestVerification.id,
          email: latestVerification.email,
          mobile: latestVerification.mobile,
          status:
            statusToDisplay[latestVerification.status] ||
            latestVerification.status,
          emailVerified: latestVerification.emailVerified,
          mobileVerified: latestVerification.mobileVerified,
          remarks: latestVerification.remarks,
          updatedAt: latestVerification.updatedAt,
        }
      : null,

    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const userInclude = {
  role: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
  permissionOverrides: {
    include: {
      permission: true,
    },
  },
  mobileVerifications: {
    orderBy: {
      updatedAt: "desc",
    },
    take: 1,
  },
};

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env file");
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role?.name,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const findUserByIdentifier = async (identifier) => {
  const value = normalizeText(identifier);

  if (!value) {
    return null;
  }

  if (value.includes("@")) {
    return prisma.user.findUnique({
      where: {
        email: normalizeEmail(value),
      },
      include: userInclude,
    });
  }

  const normalizedMobile = normalizeMobileNumber(value);

  if (!normalizedMobile) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      mobile: normalizedMobile,
    },
    include: userInclude,
  });
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, requestedRole } = req.body;

    const trimmedName = normalizeText(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedMobile = normalizeMobileNumber(mobile);
    const trimmedPassword = normalizeText(password);
    const requestedRoleName = normalizeRoleName(requestedRole);

    if (!trimmedName || !normalizedEmail || !normalizedMobile || !trimmedPassword) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile number and password are required",
      });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email: normalizedEmail,
          },
          {
            mobile: normalizedMobile,
          },
        ],
      },
    });

    if (existingUser?.email === normalizedEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    if (existingUser?.mobile === normalizedMobile) {
      return res.status(409).json({
        success: false,
        message: "Mobile number already registered",
      });
    }

    const defaultUserRole = await prisma.role.findUnique({
      where: {
        name: "USER",
      },
    });

    if (!defaultUserRole) {
      return res.status(500).json({
        success: false,
        message: "USER role not found. Please run npm run seed.",
      });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        mobile: normalizedMobile,
        password: hashedPassword,
        status: "ACTIVE",

        // New registrations stay USER until Super Admin approves requested role.
        roleId: defaultUserRole.id,
        requestedRole: requestedRoleName,

        isRoleApproved: false,
        emailVerified: false,
        mobileVerified: false,
        isProtectedAccount: false,

        mobileVerifications: {
          create: {
            name: trimmedName,
            email: normalizedEmail,
            mobile: normalizedMobile,
            status: "PENDING",
            remarks:
              "Registered. Waiting for Super Admin to send OTPs and approve role.",
          },
        },
      },
      include: userInclude,
    });

    await notifyRoleUsers({
      roleName: "SUPER_ADMIN",
      title: "New verification request",
      message: `${user.name} registered with requested role ${user.requestedRole}. Review this user in Users or Verification.`,
      priority: "HIGH",
      createdById: user.id,
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Your account is pending email/mobile verification and role approval by Super Admin.",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.email || req.body.mobile;
    const trimmedPassword = normalizeText(req.body.password);

    if (!identifier || !trimmedPassword) {
      return res.status(400).json({
        success: false,
        message: "Email/mobile and password are required",
      });
    }

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/mobile or password",
      });
    }

    const isPasswordMatched = await bcrypt.compare(
      trimmedPassword,
      user.password
    );

    if (!isPasswordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/mobile or password",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact admin.",
      });
    }

    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: "No role assigned to this account.",
      });
    }

    if (user.role.name === "WORKER") {
      return res.status(403).json({
        success: false,
        message: "Worker accounts do not have dashboard access.",
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      include: userInclude,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact admin.",
      });
    }

    if (user.role?.name === "WORKER") {
      return res.status(403).json({
        success: false,
        message: "Worker accounts do not have dashboard access.",
      });
    }

    return res.status(200).json({
      success: true,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Get me error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

export const getProfile = getMe;
export const login = loginUser;
export const register = registerUser;

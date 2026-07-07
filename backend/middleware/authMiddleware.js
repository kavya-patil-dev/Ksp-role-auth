import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1];
};

const getUserIdFromToken = (decodedToken) => {
  return decodedToken.id || decodedToken.userId || decodedToken.sub;
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

const attachUserToRequest = (req, user) => {
  const effectivePermissions = buildEffectivePermissions(user);

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    role: user.role?.name,
    roleId: user.roleId,
    requestedRole: user.requestedRole,
    isRoleApproved: user.isRoleApproved,
    emailVerified: user.emailVerified,
    mobileVerified: user.mobileVerified,
    isProtectedAccount: user.isProtectedAccount,
    permissions: effectivePermissions,
  };
};

export const protect = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token is missing.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is missing in backend environment.",
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = getUserIdFromToken(decodedToken);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
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
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
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

    attachUserToRequest(req, user);

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    console.error("Auth middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this role area.",
      });
    }

    return next();
  };
};

export const authorizeRoles = (...allowedRoles) => {
  return requireRole(...allowedRoles);
};

export const hasPermission = (user, permissionKey) => {
  if (!user) {
    return false;
  }

  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  return user.permissions?.includes(permissionKey);
};

export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!hasPermission(req.user, permissionKey)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required permission: ${permissionKey}`,
      });
    }

    return next();
  };
};

export const requireAnyPermission = (...permissionKeys) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const allowed = permissionKeys.some((permissionKey) => {
      return hasPermission(req.user, permissionKey);
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required any of: ${permissionKeys.join(
          ", "
        )}`,
      });
    }

    return next();
  };
};

export const requireAllPermissions = (...permissionKeys) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const allowed = permissionKeys.every((permissionKey) => {
      return hasPermission(req.user, permissionKey);
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required all of: ${permissionKeys.join(
          ", "
        )}`,
      });
    }

    return next();
  };
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only Super Admin can perform this action.",
    });
  }

  return next();
};

export const requireAdminOrSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!["SUPER_ADMIN", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only Admin or Super Admin can perform this action.",
    });
  }

  return next();
};

export const requireEmployee = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      success: false,
      message: "Only Employee can perform this action.",
    });
  }

  return next();
};

export const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "USER") {
    return res.status(403).json({
      success: false,
      message: "Only User can perform this action.",
    });
  }

  return next();
};

export const isProtectedSelfChange = (loggedInUser, targetUserId) => {
  return (
    loggedInUser?.role === "SUPER_ADMIN" &&
    loggedInUser?.isProtectedAccount === true &&
    loggedInUser?.id === targetUserId
  );
};

export default protect;
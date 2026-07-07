import { hasPermission } from "./authMiddleware.js";

const normalizeList = (items) => {
  if (Array.isArray(items[0])) {
    return items[0];
  }

  return items;
};

export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!hasPermission(req.user, permissionKey)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permissionKey}`,
      });
    }

    return next();
  };
};

export const requireAnyPermission = (...permissionKeysInput) => {
  const permissionKeys = normalizeList(permissionKeysInput);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const allowed = permissionKeys.some((permissionKey) => {
      return hasPermission(req.user, permissionKey);
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required any of: ${permissionKeys.join(", ")}`,
      });
    }

    return next();
  };
};

export const requireAllPermissions = (...permissionKeysInput) => {
  const permissionKeys = normalizeList(permissionKeysInput);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const allowed = permissionKeys.every((permissionKey) => {
      return hasPermission(req.user, permissionKey);
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required all of: ${permissionKeys.join(", ")}`,
      });
    }

    return next();
  };
};

export const requireRole = (...rolesInput) => {
  const roles = normalizeList(rolesInput);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Allowed roles: ${roles.join(", ")}`,
      });
    }

    return next();
  };
};

export const requireAnyRole = (...rolesInput) => {
  const roles = normalizeList(rolesInput);

  return requireRole(...roles);
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
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
      message: "Unauthorized",
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
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

const ASSIGNABLE_USER_ROLES = ["ADMIN", "EMPLOYEE", "USER"];
const LOCKED_ROLE_NAMES = ["SUPER_ADMIN", "WORKER"];

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
};

const roleInclude = {
  permissions: {
    include: {
      permission: true,
    },
  },
};

const normalizeEmail = (email) => {
  return typeof email === "string" ? email.toLowerCase().trim() : "";
};

const normalizeText = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const getRolePermissionKeys = (user) => {
  return (
    user.role?.permissions?.map((rolePermission) => {
      return rolePermission.permission.key;
    }) || []
  );
};

const getAllowOverrideKeys = (user) => {
  return (
    user.permissionOverrides
      ?.filter((override) => override.effect === "ALLOW")
      .map((override) => override.permission.key) || []
  );
};

const getDenyOverrideKeys = (user) => {
  return (
    user.permissionOverrides
      ?.filter((override) => override.effect === "DENY")
      .map((override) => override.permission.key) || []
  );
};

const getEffectivePermissionKeys = (user) => {
  const permissionSet = new Set([
    ...getRolePermissionKeys(user),
    ...getAllowOverrideKeys(user),
  ]);

  getDenyOverrideKeys(user).forEach((permissionKey) => {
    permissionSet.delete(permissionKey);
  });

  return Array.from(permissionSet);
};

const formatUser = (user) => {
  const status = user.status || "INACTIVE";

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status,
    isActive: status === "ACTIVE",
    role: user.role?.name || null,
    roleId: user.roleId,
    requestedRole: user.requestedRole || "USER",
    isRoleApproved: Boolean(user.isRoleApproved),
    isEmailVerified: Boolean(user.emailVerified),
    isMobileVerified: Boolean(user.mobileVerified),
    isFullyVerified:
      Boolean(user.emailVerified) &&
      Boolean(user.mobileVerified) &&
      Boolean(user.isRoleApproved),
    isProtectedAccount: user.isProtectedAccount,
    rolePermissions: getRolePermissionKeys(user),
    allowOverrides: getAllowOverrideKeys(user),
    denyOverrides: getDenyOverrideKeys(user),
    permissions: getEffectivePermissionKeys(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const formatRole = (role) => {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions:
      role.permissions?.map((rolePermission) => {
        return rolePermission.permission.key;
      }) || [],
    canAssignToUser: ASSIGNABLE_USER_ROLES.includes(role.name),
    canEditPermissions: !LOCKED_ROLE_NAMES.includes(role.name),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
};

const formatPermission = (permission) => {
  return {
    id: permission.id,
    key: permission.key,
    label: permission.label,
    module: permission.module,
    description: permission.description,
  };
};

const createAuditLog = async ({
  actorId,
  targetUserId = null,
  action,
  module,
  entityType,
  entityId = null,
  title,
  description,
  oldData = null,
  newData = null,
}) => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetUserId,
        action,
        module,
        entityType,
        entityId,
        title,
        description,
        oldData,
        newData,
      },
    });
  } catch (error) {
    console.error("Audit log creation failed:", error);
  }
};

const isProtectedSuperAdmin = (user) => {
  return user?.role?.name === "SUPER_ADMIN" || user?.isProtectedAccount === true;
};

const ensureTargetUserCanBeModified = (req, res, targetUser, actionText) => {
  if (!targetUser) {
    res.status(404).json({
      success: false,
      message: "User not found",
    });
    return false;
  }

  if (req.user.id === targetUser.id && actionText !== "update details") {
    res.status(403).json({
      success: false,
      message: "You cannot perform this action on your own account.",
    });
    return false;
  }

  if (isProtectedSuperAdmin(targetUser)) {
    res.status(403).json({
      success: false,
      message:
        "Protected Super Admin account cannot be changed from dashboard. Backend team must update it directly.",
    });
    return false;
  }

  return true;
};

export const getAdminRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: roleInclude,
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      roles: roles.map(formatRole),
    });
  } catch (error) {
    console.error("Get admin roles error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
    });
  }
};

export const getAdminPermissions = async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        {
          module: "asc",
        },
        {
          key: "asc",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      permissions: permissions.map(formatPermission),
    });
  } catch (error) {
    console.error("Get admin permissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch permissions",
    });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const { search = "", role = "", status = "" } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
          },
        },
      ];
    }

    if (role) {
      where.role = {
        name: role,
      };
    }

    if (status) {
      where.status = status;
    }

    const users = await prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      users: users.map(formatUser),
    });
  } catch (error) {
    console.error("Get admin users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const { name, email, password, roleName = "USER" } = req.body;

    const trimmedName = normalizeText(name);
    const normalizedEmail = normalizeEmail(email);
    const trimmedPassword = normalizeText(password);

    if (!trimmedName || !normalizedEmail || !trimmedPassword) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (roleName === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "You cannot create another Super Admin from dashboard.",
      });
    }

    if (roleName === "WORKER") {
      return res.status(400).json({
        success: false,
        message:
          "Worker is not a dashboard login account. Add workers from Worker Management.",
      });
    }

    if (!ASSIGNABLE_USER_ROLES.includes(roleName)) {
      return res.status(400).json({
        success: false,
        message: "You can create only Admin, Employee, or User accounts.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const role = await prisma.role.findUnique({
      where: {
        name: roleName,
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found. Run npm run seed first.",
      });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        status: "ACTIVE",
        roleId: role.id,
        isProtectedAccount: false,
      },
      include: userInclude,
    });

    await createAuditLog({
      actorId: req.user.id,
      targetUserId: user.id,
      action: "CREATE",
      module: "Users",
      entityType: "User",
      entityId: user.id,
      title: "User account created",
      description: `${req.user.name} created ${roleName} account for ${trimmedName} (${normalizedEmail}).`,
      newData: {
        name: trimmedName,
        email: normalizedEmail,
        roleName,
        status: "ACTIVE",
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Create admin user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

export const updateAdminUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, password } = req.body;

    const trimmedName = normalizeText(name);
    const normalizedEmail = normalizeEmail(email);
    const newPassword = normalizeText(password);

    if (!trimmedName || !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        role: true,
      },
    });

    if (!ensureTargetUserCanBeModified(req, res, targetUser, "update details")) {
      return;
    }

    const emailOwner = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (emailOwner && emailOwner.id !== userId) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const updateData = {
      name: trimmedName,
      email: normalizedEmail,
    };

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: updateData,
      include: userInclude,
    });

    await createAuditLog({
      actorId: req.user.id,
      targetUserId: user.id,
      action: "UPDATE",
      module: "Users",
      entityType: "User",
      entityId: user.id,
      title: "User details updated",
      description: `${req.user.name} updated user details for ${user.name} (${user.email}).`,
      oldData: {
        name: targetUser.name,
        email: targetUser.email,
      },
      newData: {
        name: user.name,
        email: user.email,
        passwordChanged: Boolean(newPassword),
      },
    });

    return res.status(200).json({
      success: true,
      message: "User details updated successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Update admin user details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user details",
    });
  }
};

export const updateAdminUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, status } = req.body;

    let newStatus = null;

    if (typeof isActive === "boolean") {
      newStatus = isActive ? "ACTIVE" : "INACTIVE";
    }

    if (typeof status === "string") {
      const normalizedStatus = status.toUpperCase();

      if (["ACTIVE", "INACTIVE"].includes(normalizedStatus)) {
        newStatus = normalizedStatus;
      }
    }

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "Send isActive as true/false or status as ACTIVE/INACTIVE.",
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        role: true,
      },
    });

    if (!ensureTargetUserCanBeModified(req, res, targetUser, "change status")) {
      return;
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: newStatus,
      },
      include: userInclude,
    });

    await createAuditLog({
      actorId: req.user.id,
      targetUserId: user.id,
      action: "STATUS_CHANGE",
      module: "Users",
      entityType: "User",
      entityId: user.id,
      title: "User status changed",
      description: `${req.user.name} changed ${user.name}'s status to ${newStatus}.`,
      oldData: {
        status: targetUser.status,
      },
      newData: {
        status: newStatus,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        newStatus === "ACTIVE"
          ? "User activated successfully"
          : "User deactivated successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Update admin user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
};

export const updateAdminUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: "roleName is required",
      });
    }

    if (roleName === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Super Admin role cannot be assigned from dashboard.",
      });
    }

    if (roleName === "WORKER") {
      return res.status(400).json({
        success: false,
        message:
          "Worker is not a dashboard login role. Add workers from Worker Management.",
      });
    }

    if (!ASSIGNABLE_USER_ROLES.includes(roleName)) {
      return res.status(400).json({
        success: false,
        message: "You can assign only Admin, Employee, or User role.",
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        role: true,
      },
    });

    if (!ensureTargetUserCanBeModified(req, res, targetUser, "change role")) {
      return;
    }

    const role = await prisma.role.findUnique({
      where: {
        name: roleName,
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found. Run npm run seed first.",
      });
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        roleId: role.id,
      },
      include: userInclude,
    });

    await createAuditLog({
      actorId: req.user.id,
      targetUserId: user.id,
      action: "ROLE_CHANGE",
      module: "Users",
      entityType: "User",
      entityId: user.id,
      title: "User role changed",
      description: `${req.user.name} changed ${user.name}'s role from ${targetUser.role?.name} to ${roleName}.`,
      oldData: {
        roleName: targetUser.role?.name,
      },
      newData: {
        roleName,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Update admin user role error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update role",
    });
  }
};

export const deleteAdminUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        role: true,
      },
    });

    if (!ensureTargetUserCanBeModified(req, res, targetUser, "delete")) {
      return;
    }

    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    await createAuditLog({
      actorId: req.user.id,
      targetUserId: null,
      action: "DELETE",
      module: "Users",
      entityType: "User",
      entityId: userId,
      title: "User account deleted",
      description: `${req.user.name} deleted user account ${targetUser.name} (${targetUser.email}).`,
      oldData: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        roleName: targetUser.role?.name,
        status: targetUser.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

export const updateAdminRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions = [] } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "permissions must be an array",
      });
    }

    const role = await prisma.role.findUnique({
      where: {
        id: roleId,
      },
      include: roleInclude,
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    if (LOCKED_ROLE_NAMES.includes(role.name)) {
      return res.status(403).json({
        success: false,
        message: `${role.name} permissions cannot be changed from dashboard.`,
      });
    }

    const uniquePermissionKeys = Array.from(new Set(permissions));

    const permissionRows = await prisma.permission.findMany({
      where: {
        key: {
          in: uniquePermissionKeys,
        },
      },
    });

    if (permissionRows.length !== uniquePermissionKeys.length) {
      return res.status(400).json({
        success: false,
        message: "One or more permissions are invalid.",
      });
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: {
          roleId,
        },
      }),
      prisma.rolePermission.createMany({
        data: permissionRows.map((permission) => {
          return {
            roleId,
            permissionId: permission.id,
          };
        }),
        skipDuplicates: true,
      }),
    ]);

    const updatedRole = await prisma.role.findUnique({
      where: {
        id: roleId,
      },
      include: roleInclude,
    });

    await createAuditLog({
      actorId: req.user.id,
      action: "PERMISSION_CHANGE",
      module: "Roles",
      entityType: "Role",
      entityId: roleId,
      title: "Role permissions updated",
      description: `${req.user.name} updated permissions for ${role.name} role.`,
      oldData: {
        permissions: formatRole(role).permissions,
      },
      newData: {
        permissions: uniquePermissionKeys,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Role permissions updated successfully",
      role: formatRole(updatedRole),
    });
  } catch (error) {
    console.error("Update admin role permissions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update role permissions",
    });
  }
};

export const getAdminUserPermissionOverrides = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: userInclude,
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (targetUser.role?.name !== "ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Permission override is allowed only for Admin users.",
      });
    }

    const permissions = await prisma.permission.findMany({
      orderBy: [
        {
          module: "asc",
        },
        {
          key: "asc",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      user: formatUser(targetUser),
      permissions: permissions.map(formatPermission),
      overrides:
        targetUser.permissionOverrides?.map((override) => {
          return {
            id: override.id,
            permissionId: override.permissionId,
            permissionKey: override.permission.key,
            effect: override.effect,
            assignedAt: override.assignedAt,
            assignedById: override.assignedById,
          };
        }) || [],
    });
  } catch (error) {
    console.error("Get admin user permission overrides error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user permission overrides",
    });
  }
};

export const updateAdminUserPermissionOverrides = async (req, res) => {
  try {
    const { userId } = req.params;
    const { allow = [], deny = [], overrides = null } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: userInclude,
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (targetUser.role?.name !== "ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Permission override is allowed only for Admin users.",
      });
    }

    let allowKeys = [];
    let denyKeys = [];

    if (Array.isArray(overrides)) {
      for (const override of overrides) {
        if (override.effect === "ALLOW") {
          allowKeys.push(override.permissionKey);
        }

        if (override.effect === "DENY") {
          denyKeys.push(override.permissionKey);
        }
      }
    } else {
      if (!Array.isArray(allow) || !Array.isArray(deny)) {
        return res.status(400).json({
          success: false,
          message: "allow and deny must be arrays.",
        });
      }

      allowKeys = allow;
      denyKeys = deny;
    }

    const uniqueDenyKeys = Array.from(new Set(denyKeys));
    const uniqueAllowKeys = Array.from(
      new Set(
        allowKeys.filter((permissionKey) => {
          return !uniqueDenyKeys.includes(permissionKey);
        })
      )
    );

    const allKeys = Array.from(new Set([...uniqueAllowKeys, ...uniqueDenyKeys]));

    const permissionRows = await prisma.permission.findMany({
      where: {
        key: {
          in: allKeys,
        },
      },
    });

    if (permissionRows.length !== allKeys.length) {
      return res.status(400).json({
        success: false,
        message: "One or more permission keys are invalid.",
      });
    }

    const permissionByKey = new Map(
      permissionRows.map((permission) => {
        return [permission.key, permission];
      })
    );

    const createRows = [
      ...uniqueAllowKeys.map((permissionKey) => {
        return {
          userId,
          permissionId: permissionByKey.get(permissionKey).id,
          effect: "ALLOW",
          assignedById: req.user.id,
        };
      }),
      ...uniqueDenyKeys.map((permissionKey) => {
        return {
          userId,
          permissionId: permissionByKey.get(permissionKey).id,
          effect: "DENY",
          assignedById: req.user.id,
        };
      }),
    ];

    const oldOverrides =
      targetUser.permissionOverrides?.map((override) => {
        return {
          permissionKey: override.permission.key,
          effect: override.effect,
        };
      }) || [];

    await prisma.$transaction([
      prisma.userPermissionOverride.deleteMany({
        where: {
          userId,
        },
      }),
      prisma.userPermissionOverride.createMany({
        data: createRows,
        skipDuplicates: true,
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: userInclude,
    });

    await createAuditLog({
      actorId: req.user.id,
      targetUserId: userId,
      action: "PERMISSION_CHANGE",
      module: "Admin Access",
      entityType: "User",
      entityId: userId,
      title: "Admin access changed",
      description: `${req.user.name} updated extra access for Admin ${targetUser.name}.`,
      oldData: {
        overrides: oldOverrides,
      },
      newData: {
        allow: uniqueAllowKeys,
        deny: uniqueDenyKeys,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Admin permission overrides updated successfully",
      user: formatUser(updatedUser),
    });
  } catch (error) {
    console.error("Update admin user permission overrides error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update admin permission overrides",
    });
  }
};

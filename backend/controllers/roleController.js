import prisma from "../config/prisma.js";

const roleInclude = {
  role: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
};

const formatRole = (role) => ({
  id: role.id,
  name: role.name,
  permissions: role.permissions?.map((rp) => rp.permission.key) || [],
});

const formatUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role?.name || null,
  permissions: user.role?.permissions?.map((rp) => rp.permission.key) || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      roles: roles.map(formatRole),
    });
  } catch (error) {
    console.error("Get roles error:", error);
    return res.status(500).json({ message: "Failed to fetch roles" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: roleInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      users: users.map(formatUser),
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const assignRoleToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;

    if (!roleName) {
      return res.status(400).json({ message: "roleName is required" });
    }

    const assignableRoles = ["ADMIN", "EMPLOYEE", "USER"];

    if (!assignableRoles.includes(roleName)) {
      return res.status(400).json({
        message: "You can assign only ADMIN, EMPLOYEE, or USER role",
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.role?.name === "SUPER_ADMIN") {
      return res.status(403).json({
        message: "SUPER_ADMIN role cannot be changed from dashboard",
      });
    }

    if (req.user.id === userId && req.user.role === "SUPER_ADMIN") {
      return res.status(403).json({
        message: "You cannot change your own SUPER_ADMIN role",
      });
    }

    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      include: roleInclude,
    });

    return res.status(200).json({
      message: "Role assigned successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Assign role error:", error);
    return res.status(500).json({ message: "Failed to assign role" });
  }
};
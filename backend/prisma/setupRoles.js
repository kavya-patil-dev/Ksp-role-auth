import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = [
  {
    name: "SUPER_ADMIN",
    description: "Full system control with protected Super Admin account rules.",
  },
  {
    name: "ADMIN",
    description: "Admin role with worker management access after approval.",
  },
  {
    name: "EMPLOYEE",
    description: "Employee dashboard access after approval.",
  },
  {
    name: "USER",
    description: "Limited website viewer dashboard access after approval.",
  },
  {
    name: "WORKER",
    description:
      "Non-skilled worker role. Dashboard access is blocked by backend middleware.",
  },
];

const PERMISSIONS = [
  { key: "users.view", label: "View Users", module: "Users", description: "Can view users list." },
  { key: "users.manage", label: "Manage Users", module: "Users", description: "Can create, update, deactivate and manage users except protected Super Admin rules." },

  { key: "roles.view", label: "View Roles", module: "Roles", description: "Can view roles and assigned permissions." },
  { key: "roles.manage", label: "Manage Roles", module: "Roles", description: "Can manage role permissions." },
  { key: "adminAccess.manage", label: "Manage Admin Access", module: "Admin Access", description: "Can give or remove specific dashboard access for Admin users." },

  { key: "workers.view", label: "View Workers", module: "Workers", description: "Can view non-skilled worker records." },
  { key: "workers.manage", label: "Manage Workers", module: "Workers", description: "Can add, update, delete and change status of worker records." },

  { key: "calendar.view", label: "View Calendar", module: "Calendar", description: "Can view calendar events." },
  { key: "calendar.manage", label: "Manage Calendar", module: "Calendar", description: "Can create, update and delete calendar events." },

  { key: "notifications.view", label: "View Notifications", module: "Notifications", description: "Can view notifications assigned to own role." },
  { key: "notifications.manage", label: "Manage Notifications", module: "Notifications", description: "Can create and update notifications." },

  { key: "verifications.view", label: "View Verifications", module: "Verifications", description: "Can view email, mobile and role approval records." },
  { key: "verifications.manage", label: "Manage Verifications", module: "Verifications", description: "Can send OTPs, verify OTPs and approve roles." },

  { key: "auditLogs.view", label: "View Audit Logs", module: "Audit Logs", description: "Can view admin activity logs." },

  { key: "employeeRequests.view", label: "View Employee Requests", module: "Employee Requests", description: "Can view employee requests." },
  { key: "employeeRequests.manage", label: "Manage Employee Requests", module: "Employee Requests", description: "Can approve, reject, resolve and reply to employee requests." },
  { key: "employeeRequests.create", label: "Create Employee Requests", module: "Employee Requests", description: "Can submit own employee requests." },

  { key: "employeeDirectory.view", label: "View Employee Directory", module: "Employee Directory", description: "Can view employee directory with limited details." },

  { key: "website.view", label: "View Website Dashboard", module: "Website", description: "Can view limited website user dashboard." },
];

const ROLE_PERMISSION_KEYS = {
  SUPER_ADMIN: PERMISSIONS.map((permission) => permission.key),
  ADMIN: [
    "workers.view",
    "workers.manage",
    "calendar.view",
    "notifications.view",
    "employeeRequests.view",
    "employeeRequests.manage",
    "employeeDirectory.view",
  ],
  EMPLOYEE: [
    "calendar.view",
    "notifications.view",
    "employeeRequests.create",
    "employeeDirectory.view",
  ],
  USER: ["website.view", "calendar.view", "notifications.view"],
  WORKER: [],
};

async function seedRoles() {
  const roleMap = {};

  for (const role of ROLES) {
    const savedRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: {
        name: role.name,
        description: role.description,
      },
    });

    roleMap[role.name] = savedRole;
  }

  return roleMap;
}

async function seedPermissions() {
  const permissionMap = {};

  for (const permission of PERMISSIONS) {
    const savedPermission = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        label: permission.label,
        module: permission.module,
        description: permission.description,
      },
      create: {
        key: permission.key,
        label: permission.label,
        module: permission.module,
        description: permission.description,
      },
    });

    permissionMap[permission.key] = savedPermission;
  }

  return permissionMap;
}

async function seedRolePermissions(roleMap, permissionMap) {
  for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_KEYS)) {
    const role = roleMap[roleName];

    if (!role) continue;

    for (const permissionKey of permissionKeys) {
      const permission = permissionMap[permissionKey];

      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedSuperAdmin(roleMap) {
  const superAdminRole = roleMap.SUPER_ADMIN;

  if (!superAdminRole) {
    throw new Error("SUPER_ADMIN role not found.");
  }

  const superAdminName = process.env.SUPER_ADMIN_NAME || "Super Admin";
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be added in backend .env file."
    );
  }

  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  const superAdminData = {
    name: superAdminName,
    email: superAdminEmail,
    password: hashedPassword,
    roleId: superAdminRole.id,
    requestedRole: "SUPER_ADMIN",
    status: "ACTIVE",
    isRoleApproved: true,
    roleApprovedAt: new Date(),
    emailVerified: true,
    emailVerifiedAt: new Date(),
    mobileVerified: true,
    mobileVerifiedAt: new Date(),
    isProtectedAccount: true,
  };

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: superAdminData,
    });

    console.log("Protected Super Admin account updated.");
    return;
  }

  await prisma.user.create({
    data: superAdminData,
  });

  console.log("Protected Super Admin account created.");
}

async function main() {
  console.log("Seeding roles, permissions and protected Super Admin...");

  const roleMap = await seedRoles();
  const permissionMap = await seedPermissions();

  await seedRolePermissions(roleMap, permissionMap);
  await seedSuperAdmin(roleMap);

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
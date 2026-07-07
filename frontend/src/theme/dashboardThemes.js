export const dashboardThemes = {
  SUPER_ADMIN: {
    name: "Super Admin Dashboard",
    primary: "#7f1d1d",
    secondary: "#dc2626",
    soft: "#fef2f2",
    gradient: "linear-gradient(135deg, #7f1d1d, #dc2626)",
  },
  ADMIN: {
    name: "Admin Dashboard",
    primary: "#1d4ed8",
    secondary: "#2563eb",
    soft: "#eff6ff",
    gradient: "linear-gradient(135deg, #1d4ed8, #2563eb)",
  },
  EMPLOYEE: {
    name: "Employee Dashboard",
    primary: "#047857",
    secondary: "#059669",
    soft: "#ecfdf5",
    gradient: "linear-gradient(135deg, #047857, #059669)",
  },
  USER: {
    name: "User Dashboard",
    primary: "#6d28d9",
    secondary: "#7c3aed",
    soft: "#f5f3ff",
    gradient: "linear-gradient(135deg, #6d28d9, #7c3aed)",
  },
  WORKER: {
    name: "Worker Record",
    primary: "#374151",
    secondary: "#6b7280",
    soft: "#f3f4f6",
    gradient: "linear-gradient(135deg, #374151, #6b7280)",
  },
};

export const roleLabels = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  USER: "User",
  WORKER: "Worker",
};

export const getDashboardTheme = (role) =>
  dashboardThemes[role] || dashboardThemes.USER;

export const getRoleLabel = (role) => roleLabels[role] || role || "No Role";

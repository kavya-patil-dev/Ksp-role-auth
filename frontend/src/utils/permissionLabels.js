export const permissionLabels = {
  "users.view": "View Users",
  "users.manage": "Manage Users",
  "roles.view": "View Roles",
  "roles.manage": "Manage Roles",
  "adminAccess.manage": "Manage Admin Access",
  "employeeDirectory.view": "View Employee Directory",
  "employeeRequests.view": "View Employee Requests",
  "employeeRequests.manage": "Manage Employee Requests",
  "employeeRequests.create": "Employee Self Service",
  "workers.view": "View Workers",
  "workers.manage": "Manage Workers",
  "calendar.view": "View Calendar",
  "calendar.manage": "Manage Calendar",
  "notifications.view": "View Notifications",
  "notifications.manage": "Manage Notifications",
  "verifications.view": "View Verifications",
  "verifications.manage": "Manage Verifications",
  "auditLogs.view": "View Admin Change Logs",
  "website.view": "Website Dashboard",
};

export const getPermissionLabel = (permission) => {
  return permissionLabels[permission] || permission;
};

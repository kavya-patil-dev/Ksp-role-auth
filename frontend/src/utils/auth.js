export const getToken = () => localStorage.getItem("token");

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const saveAuth = ({ token, user }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const hasRole = (user, roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(user?.role);
};

export const hasPermission = (user, permissions) => {
  const requiredPermissions = Array.isArray(permissions)
    ? permissions
    : [permissions];

  return requiredPermissions.some((permission) =>
    user?.permissions?.includes(permission)
  );
};
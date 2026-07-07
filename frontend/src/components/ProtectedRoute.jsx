import { Navigate, useLocation } from "react-router-dom";
import { getStoredUser, getToken, hasPermission, hasRole } from "../utils/auth";

function ProtectedRoute({ children, roles, permissions }) {
  const location = useLocation();
  const token = getToken();
  const user = getStoredUser();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !hasRole(user, roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permissions && !hasPermission(user, permissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;

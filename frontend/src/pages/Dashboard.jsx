import { useEffect, useState } from "react";
import { Alert, Button, Result, Spin, message } from "antd";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { logoutUser } from "../utils/auth";
import SuperAdminDashboard from "./dashboards/SuperAdminDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import EmployeeDashboard from "./dashboards/EmployeeDashboard";
import UserDashboard from "./dashboards/UserDashboard";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await API.get("/auth/me");
        setUser(res.data.user);
      } catch (error) {
        const messageText = error.response?.data?.message || "Unable to load dashboard";
        setAccessError(messageText);
        if (error.response?.status === 401) {
          logoutUser();
          navigate("/login", { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleLogout = () => {
    logoutUser();
    message.success("Logged out");
    navigate("/login", { replace: true });
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Spin size="large" /></div>;
  }

  if (accessError) {
    return (
      <Result
        status="403"
        title="Dashboard access blocked"
        subTitle={accessError}
        extra={<Button type="primary" onClick={handleLogout}>Go to Login</Button>}
      />
    );
  }

  if (!user) {
    return <Alert type="error" message="User profile not found" />;
  }

  if (user.role === "SUPER_ADMIN") return <SuperAdminDashboard user={user} />;
  if (user.role === "ADMIN") return <AdminDashboard user={user} />;
  if (user.role === "EMPLOYEE") return <EmployeeDashboard user={user} />;
  if (user.role === "USER") return <UserDashboard user={user} />;

  return (
    <Result
      status="403"
      title="No dashboard available"
      subTitle="Worker accounts are non-skilled worker records and do not have dashboard access."
      extra={<Button type="primary" onClick={handleLogout}>Go to Login</Button>}
    />
  );
}

export default Dashboard;
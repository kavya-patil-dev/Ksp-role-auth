import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Card, Descriptions, Space, Tag, message } from "antd";
import { BellOutlined, UserOutlined } from "@ant-design/icons";
import API from "../../services/api";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import NotificationsList, {
  UnreadNotificationsPopup,
} from "../../components/dashboard/NotificationsList";
import { playNotificationSound } from "../../utils/notificationSound";

function UserDashboard({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadPopupOpen, setUnreadPopupOpen] = useState(false);
  const [hasShownUnreadPopup, setHasShownUnreadPopup] = useState(false);

  const previousUnreadIdsRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  const loadNotifications = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      const res = await API.get("/notifications/my");
      const latestNotifications = res.data.notifications || [];

      const unreadIds = new Set(
        latestNotifications
          .filter((item) => !item.isRead)
          .map((item) => item.id)
      );

      const hasNewUnread = [...unreadIds].some(
        (id) => !previousUnreadIdsRef.current.has(id)
      );

      setNotifications(latestNotifications);

      if (!firstLoadRef.current && hasNewUnread) {
        playNotificationSound();
        setUnreadPopupOpen(true);
      }

      previousUnreadIdsRef.current = unreadIds;
      firstLoadRef.current = false;
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to load user notifications"
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadNotifications({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  useEffect(() => {
    if (!hasShownUnreadPopup && unreadCount > 0) {
      setUnreadPopupOpen(true);
      setHasShownUnreadPopup(true);
    }
  }, [hasShownUnreadPopup, unreadCount]);

  const markNotificationRead = async (notificationId) => {
    try {
      await API.patch(`/notifications/${notificationId}/read`);
      await loadNotifications();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to mark notification read"
      );
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await API.patch("/notifications/read-all");
      setUnreadPopupOpen(false);
      await loadNotifications();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to mark notifications read"
      );
    }
  };

  const overview = (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="User dashboard"
        description="User is a third-party website viewer. Detailed user dashboard modules can be added later."
      />

      <Card title="My Profile" style={{ borderRadius: 18 }}>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Name">
            {user.name || "User"}
          </Descriptions.Item>

          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>

          <Descriptions.Item label="Role">
            <Tag>User</Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Status">
            {user.isActive ? (
              <Tag color="green">Active</Tag>
            ) : (
              <Tag color="red">Inactive</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );

  const sections = [
    {
      key: "overview",
      label: "Overview",
      icon: <UserOutlined />,
      content: overview,
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: <BellOutlined />,
      badgeCount: unreadCount,
      content: (
        <NotificationsList
          notifications={notifications}
          loading={loading}
          title="User Notifications"
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
        />
      ),
    },
  ];

  return (
    <>
      <DashboardLayout
        user={user}
        sections={sections}
        defaultSection="overview"
        title="User Dashboard"
        subtitle="Website viewer dashboard with limited access."
      />

      <UnreadNotificationsPopup
        open={unreadPopupOpen}
        notifications={notifications}
        title="Unread User Notifications"
        onClose={() => setUnreadPopupOpen(false)}
      />
    </>
  );
}

export default UserDashboard;
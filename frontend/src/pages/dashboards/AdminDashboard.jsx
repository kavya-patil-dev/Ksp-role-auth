/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Card, Col, Row, Space, Statistic, Tag, message } from "antd";
import {
  BellOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import API from "../../services/api";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import NotificationsList, {
  UnreadNotificationsPopup,
} from "../../components/dashboard/NotificationsList";
import WorkerManagement from "../../components/dashboard/WorkerManagement";
import { playNotificationSound } from "../../utils/notificationSound";

function AdminDashboard({ user }) {
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
        error.response?.data?.message || "Failed to load notifications"
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

  const permissionTags = useMemo(
    () =>
      (user.permissions || []).map((permission) => (
        <Tag key={permission}>{permission}</Tag>
      )),
    [user.permissions]
  );

  const overview = (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Admin dashboard rule"
        description="Admin can manage worker records. Every worker create, update, and delete action is logged and notified to Super Admin with full details."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Role"
              value="Admin"
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Worker Access"
              value="Manage"
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Unread Notifications"
              value={unreadCount}
              prefix={<BellOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Access given by Super Admin" style={{ borderRadius: 18 }}>
        {permissionTags.length ? permissionTags : "No permissions assigned"}
      </Card>
    </Space>
  );

  const sections = [
    {
      key: "overview",
      label: "Overview",
      icon: <SafetyCertificateOutlined />,
      content: overview,
    },
    {
      key: "workers",
      label: "Workers",
      icon: <ToolOutlined />,
      content: (
        <WorkerManagement
          title="Manage Workers"
          note="Worker changes made here will be visible to Super Admin through notifications and audit logs."
        />
      ),
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
          title="Admin Notifications"
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
        />
      ),
    },
    {
      key: "logs",
      label: "Change Rule",
      icon: <FileSearchOutlined />,
      content: (
        <Alert
          type="success"
          showIcon
          message="Super Admin visibility enabled"
          description="Your worker changes are automatically stored in Admin Audit Logs and sent as Super Admin notifications."
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
        title="Admin Dashboard"
        subtitle="Operations dashboard for worker management and assigned admin access."
      />

      <UnreadNotificationsPopup
        open={unreadPopupOpen}
        notifications={notifications}
        title="Unread Admin Notifications"
        onClose={() => setUnreadPopupOpen(false)}
      />
    </>
  );
}

export default AdminDashboard;
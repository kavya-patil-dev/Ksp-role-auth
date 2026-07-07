/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from "antd";
import {
  BellOutlined,
  IdcardOutlined,
  MessageOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import API from "../../services/api";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import NotificationsList, {
  UnreadNotificationsPopup,
} from "../../components/dashboard/NotificationsList";
import { playNotificationSound } from "../../utils/notificationSound";

const requestTypes = [
  "Attendance",
  "Leave",
  "Feedback",
  "Contact Service",
  "Difficulty",
].map((value) => ({ label: value, value }));

function EmployeeDashboard({ user }) {
  const [directory, setDirectory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadPopupOpen, setUnreadPopupOpen] = useState(false);
  const [hasShownUnreadPopup, setHasShownUnreadPopup] = useState(false);
  const [form] = Form.useForm();

  const previousUnreadIdsRef = useRef(new Set());
  const firstLoadRef = useRef(true);

  const handleNotificationSound = (latestNotifications) => {
    const unreadIds = new Set(
      latestNotifications
        .filter((item) => !item.isRead)
        .map((item) => item.id)
    );

    const hasNewUnread = [...unreadIds].some(
      (id) => !previousUnreadIdsRef.current.has(id)
    );

    if (!firstLoadRef.current && hasNewUnread) {
      playNotificationSound();
      setUnreadPopupOpen(true);
    }

    previousUnreadIdsRef.current = unreadIds;
    firstLoadRef.current = false;
  };

  const loadEmployeeData = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      const [directoryRes, requestsRes, notificationRes] = await Promise.all([
        API.get("/employee/directory"),
        API.get("/employee/requests"),
        API.get("/notifications/my"),
      ]);

      const latestNotifications = notificationRes.data.notifications || [];

      setDirectory(directoryRes.data.employees || []);
      setRequests(requestsRes.data.requests || []);
      setNotifications(latestNotifications);

      handleNotificationSound(latestNotifications);
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to load employee dashboard"
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadOnlyNotifications = async () => {
    try {
      const notificationRes = await API.get("/notifications/my");
      const latestNotifications = notificationRes.data.notifications || [];

      setNotifications(latestNotifications);
      handleNotificationSound(latestNotifications);
    } catch (error) {
      console.warn("Failed to refresh employee notifications:", error);
    }
  };

  useEffect(() => {
    loadEmployeeData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOnlyNotifications();
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
      await loadOnlyNotifications();
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
      await loadOnlyNotifications();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to mark notifications read"
      );
    }
  };

  const submitRequest = async (values) => {
    try {
      await API.post("/employee/requests", values);
      message.success("Request submitted successfully");
      form.resetFields();
      await loadEmployeeData();
    } catch (error) {
      message.error(error.response?.data?.message || "Failed to submit request");
    }
  };

  const overview = (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Employee dashboard rule"
        description="Employee can submit attendance, leave, feedback, contact service, and difficulty requests. Employee can see other employees by name only."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="My Requests"
              value={requests.length}
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Visible Employees"
              value={directory.length}
              prefix={<TeamOutlined />}
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
    </Space>
  );

  const selfService = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card title="Submit Request" style={{ borderRadius: 18 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={submitRequest}
            initialValues={{ type: "Attendance" }}
          >
            <Form.Item
              name="type"
              label="Request Type"
              rules={[{ required: true }]}
            >
              <Select options={requestTypes} />
            </Form.Item>

            <Form.Item name="subject" label="Subject">
              <Input placeholder="Optional subject" />
            </Form.Item>

            <Form.Item
              name="message"
              label="Message"
              rules={[{ required: true, message: "Message is required" }]}
            >
              <Input.TextArea rows={5} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block>
              Submit
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15}>
        <Card title="My Requests" style={{ borderRadius: 18 }}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={requests}
            columns={[
              { title: "Type", dataIndex: "type" },
              {
                title: "Subject",
                dataIndex: "subject",
                render: (value) => value || "-",
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (value) => <Tag>{value}</Tag>,
              },
              {
                title: "Created",
                dataIndex: "createdAt",
                render: (value) => new Date(value).toLocaleString(),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );

  const employeeDirectory = (
    <Card title="Other Employees" style={{ borderRadius: 18 }}>
      <Alert
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
        message="Only names are shown here. Email, mobile number, and private details are hidden."
      />

      <List
        loading={loading}
        dataSource={directory.filter((item) => item.id !== user.id)}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta avatar={<IdcardOutlined />} title={item.name} />
          </List.Item>
        )}
      />
    </Card>
  );

  const sections = [
    {
      key: "overview",
      label: "Overview",
      icon: <IdcardOutlined />,
      content: overview,
    },
    {
      key: "self-service",
      label: "Self Service",
      icon: <MessageOutlined />,
      content: selfService,
    },
    {
      key: "directory",
      label: "Employees",
      icon: <TeamOutlined />,
      content: employeeDirectory,
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
          title="Employee Notifications"
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
        title="Employee Dashboard"
        subtitle="Attendance, leave, feedback, contact service, and difficulty requests."
      />

      <UnreadNotificationsPopup
        open={unreadPopupOpen}
        notifications={notifications}
        title="Unread Employee Notifications"
        onClose={() => setUnreadPopupOpen(false)}
      />
    </>
  );
}

export default EmployeeDashboard;
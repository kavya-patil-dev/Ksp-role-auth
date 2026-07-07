/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
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
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import API from "../../services/api";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import WorkerManagement from "../../components/dashboard/WorkerManagement";
import { getPermissionLabel } from "../../utils/permissionLabels";
import { getRoleLabel } from "../../theme/dashboardThemes";

const roleOptions = [
  { label: "Admin", value: "ADMIN" },
  { label: "Employee", value: "EMPLOYEE" },
  { label: "User", value: "USER" },
];

const notificationAudiences = ["All", "Admin", "Employee", "User"].map(
  (value) => ({ label: value, value })
);

const calendarAudiences = [
  "All",
  "Super Admin",
  "Admin",
  "Employee",
  "User",
].map((value) => ({ label: value, value }));

const priorities = ["Normal", "Important", "Urgent"].map((value) => ({
  label: value,
  value,
}));

const calendarStatuses = ["Scheduled", "Cancelled", "Completed"].map(
  (value) => ({ label: value, value })
);

const formatDateTimeLocal = (date) => {
  if (!date) return "";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "";

  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
};

const formatDisplayDateTime = (date) => {
  if (!date) return "-";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "-";

  return value.toLocaleString();
};

const statusColor = (status) => {
  if (status === "Verified" || status === "Approved") return "green";
  if (status === "Rejected") return "red";
  return "orange";
};

const isPendingVerificationRecord = (item) =>
  !item.isFullyVerified && item.status !== "Rejected";

function SuperAdminDashboard({ user }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [loading, setLoading] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [verifyOtpModalOpen, setVerifyOtpModalOpen] = useState(false);
  const [roleApprovalModalOpen, setRoleApprovalModalOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);

  const [notificationDetailsOpen, setNotificationDetailsOpen] = useState(false);
  const [notificationDetailsLoading, setNotificationDetailsLoading] =
    useState(false);
  const [selectedNotificationDetails, setSelectedNotificationDetails] =
    useState(null);

  const [userForm] = Form.useForm();
  const [calendarForm] = Form.useForm();
  const [notificationForm] = Form.useForm();
  const [verifyOtpForm] = Form.useForm();
  const [roleApprovalForm] = Form.useForm();

  const loadAll = async ({ silent = false } = {}) => {
    const applyResult = (result, setter, key) => {
      if (result.status === "fulfilled") {
        setter(result.value.data[key] || []);
      }
    };

    try {
      if (!silent) {
        setLoading(true);
      }

      const [
        usersRes,
        rolesRes,
        permissionsRes,
        eventsRes,
        notificationsRes,
        verificationsRes,
        auditRes,
      ] = await Promise.allSettled([
        API.get("/admin/users"),
        API.get("/admin/roles"),
        API.get("/admin/permissions"),
        API.get("/admin/calendar"),
        API.get("/admin/notifications"),
        API.get("/admin/verifications"),
        API.get("/admin/audit-logs"),
      ]);

      applyResult(usersRes, setUsers, "users");
      applyResult(rolesRes, setRoles, "roles");
      applyResult(permissionsRes, setPermissions, "permissions");
      applyResult(eventsRes, setEvents, "events");
      applyResult(notificationsRes, setNotifications, "notifications");
      applyResult(verificationsRes, setVerifications, "verifications");
      applyResult(auditRes, setAuditLogs, "logs");

      const failedResult = [
        usersRes,
        rolesRes,
        permissionsRes,
        eventsRes,
        notificationsRes,
        verificationsRes,
        auditRes,
      ].find((result) => result.status === "rejected");

      if (failedResult && !silent) {
        message.error(
          failedResult.reason?.response?.data?.message ||
            "Some Super Admin data could not be loaded"
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadAll({ silent: true });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const pendingVerification = verifications.filter(isPendingVerificationRecord)
      .length;

    return {
      users: users.length,
      admins: users.filter((item) => item.role === "ADMIN").length,
      employees: users.filter((item) => item.role === "EMPLOYEE").length,
      pendingVerification,
    };
  }, [users, verifications]);

  const openUserModal = (record = null) => {
    setEditingUser(record);

    userForm.setFieldsValue(
      record
        ? {
            name: record.name,
            email: record.email,
            password: "",
            roleName: record.role,
          }
        : {
            name: "",
            email: "",
            password: "",
            roleName: "USER",
          }
    );

    setUserModalOpen(true);
  };

  const saveUser = async () => {
    try {
      const values = await userForm.validateFields();

      if (editingUser) {
        await API.put(`/admin/users/${editingUser.id}`, values);

        if (values.roleName && values.roleName !== editingUser.role) {
          await API.put(`/admin/users/${editingUser.id}/role`, {
            roleName: values.roleName,
          });
        }

        message.success("User updated successfully");
      } else {
        await API.post("/admin/users", values);
        message.success("User created successfully");
      }

      setUserModalOpen(false);
      setEditingUser(null);
      userForm.resetFields();

      await loadAll();
    } catch (error) {
      if (error.errorFields) return;

      message.error(error.response?.data?.message || "Failed to save user");
    }
  };

  const updateUserStatus = async (record, isActive) => {
    try {
      await API.patch(`/admin/users/${record.id}/status`, { isActive });

      message.success(isActive ? "User activated" : "User deactivated");

      await loadAll();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to update user status"
      );
    }
  };

  const deleteUser = async (record) => {
    try {
      await API.delete(`/admin/users/${record.id}`);

      message.success("User deleted successfully");

      await loadAll();
    } catch (error) {
      message.error(error.response?.data?.message || "Failed to delete user");
    }
  };

  const updateRolePermissions = async (role, selectedPermissions) => {
    try {
      await API.put(`/admin/roles/${role.id}/permissions`, {
        permissions: selectedPermissions,
      });

      message.success(`${getRoleLabel(role.name)} access updated`);

      await loadAll();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to update permissions"
      );
    }
  };

  const openCalendarModal = (record = null) => {
    setEditingEvent(record);

    calendarForm.setFieldsValue(
      record
        ? { ...record, date: formatDateTimeLocal(record.date) }
        : {
            title: "",
            type: "",
            audience: "All",
            date: "",
            status: "Scheduled",
          }
    );

    setCalendarModalOpen(true);
  };

  const saveCalendarEvent = async () => {
    try {
      const values = await calendarForm.validateFields();

      if (editingEvent) {
        await API.put(`/admin/calendar/${editingEvent.id}`, values);
        message.success("Calendar event updated");
      } else {
        await API.post("/admin/calendar", values);
        message.success("Calendar event created");
      }

      setCalendarModalOpen(false);
      setEditingEvent(null);
      calendarForm.resetFields();

      await loadAll();
    } catch (error) {
      if (error.errorFields) return;

      message.error(
        error.response?.data?.message || "Failed to save calendar event"
      );
    }
  };

  const deleteCalendarEvent = async (record) => {
    try {
      await API.delete(`/admin/calendar/${record.id}`);

      message.success("Calendar event deleted");

      await loadAll();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to delete calendar event"
      );
    }
  };

  const createNotification = async (values) => {
    try {
      await API.post("/admin/notifications", values);

      notificationForm.resetFields();

      message.success("Notification sent");

      await loadAll();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to send notification"
      );
    }
  };

  const openNotificationDetails = async (record) => {
    try {
      setNotificationDetailsOpen(true);
      setNotificationDetailsLoading(true);
      setSelectedNotificationDetails(null);

      const res = await API.get(`/admin/notifications/${record.id}`);

      setSelectedNotificationDetails(res.data.notification || null);
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to load notification details"
      );
      setNotificationDetailsOpen(false);
    } finally {
      setNotificationDetailsLoading(false);
    }
  };

  const closeNotificationDetails = () => {
    setNotificationDetailsOpen(false);
    setSelectedNotificationDetails(null);
  };

  const sendVerificationOtps = async (record) => {
    try {
      await API.post(`/admin/verifications/${record.userId}/send-otps`, {
        channel: "BOTH",
      });

      message.success("Email OTP and mobile OTP sent successfully");

      await loadAll();
    } catch (error) {
      message.error(error.response?.data?.message || "Failed to send OTPs");
    }
  };

  const openVerifyOtpModal = (record) => {
    setSelectedVerification(record);
    verifyOtpForm.resetFields();
    setVerifyOtpModalOpen(true);
  };

  const submitVerifyOtps = async () => {
    try {
      const values = await verifyOtpForm.validateFields();

      await API.post(
        `/admin/verifications/${selectedVerification.userId}/verify-otps`,
        values
      );

      message.success("Email and mobile verified successfully");

      setVerifyOtpModalOpen(false);
      setSelectedVerification(null);
      verifyOtpForm.resetFields();

      await loadAll();
    } catch (error) {
      if (error.errorFields) return;

      message.error(error.response?.data?.message || "Failed to verify OTPs");
    }
  };

  const openRoleApprovalModal = (record) => {
    setSelectedVerification(record);

    roleApprovalForm.setFieldsValue({
      roleName: record.requestedRole || "USER",
      remarks: "",
    });

    setRoleApprovalModalOpen(true);
  };

  const submitRoleApproval = async () => {
    try {
      const values = await roleApprovalForm.validateFields();

      await API.post(
        `/admin/verifications/${selectedVerification.userId}/approve-role`,
        values
      );

      message.success("Role approved successfully");

      setRoleApprovalModalOpen(false);
      setSelectedVerification(null);
      roleApprovalForm.resetFields();

      await loadAll();
    } catch (error) {
      if (error.errorFields) return;

      message.error(error.response?.data?.message || "Failed to approve role");
    }
  };

  const rejectVerification = async (record) => {
    try {
      if (!record.verificationId && !record.id) {
        message.error("Verification record not found");
        return;
      }

      await API.patch(
        `/admin/verifications/${record.verificationId || record.id}/status`,
        {
          status: "Rejected",
          remarks: "Rejected by Super Admin",
        }
      );

      message.success("Verification rejected");

      await loadAll();
    } catch (error) {
      message.error(
        error.response?.data?.message || "Failed to reject verification"
      );
    }
  };

  const renderOverview = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="success"
        showIcon
        message="Super Admin access rule"
        description="Super Admin can manage users, role access, workers, calendar, notifications, OTP verification and role approval. Super Admin account is a protected superior account."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.users}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Admins"
              value={stats.admins}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Employees"
              value={stats.employees}
              prefix={<IdcardOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Pending Verification"
              value={stats.pendingVerification}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );

  const renderUsers = () => (
    <Card
      title="User Management"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openUserModal()}
        >
          Add User
        </Button>
      }
      style={{ borderRadius: 18 }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Super Admin cannot create another Super Admin. Registered users can request Admin, Employee or User role, and Super Admin approves it from Verification section."
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={[
          {
            title: "Name",
            dataIndex: "name",
          },
          {
            title: "Email",
            dataIndex: "email",
          },
          {
            title: "Role",
            dataIndex: "role",
            render: (role) => <Tag>{getRoleLabel(role)}</Tag>,
          },
          {
            title: "Requested Role",
            dataIndex: "requestedRole",
            render: (role) => <Tag color="blue">{getRoleLabel(role)}</Tag>,
          },
          {
            title: "Verification",
            render: (_, record) => (
              <Space wrap>
                <Tag color={record.isEmailVerified ? "green" : "orange"}>
                  Email {record.isEmailVerified ? "Verified" : "Pending"}
                </Tag>
                <Tag color={record.isMobileVerified ? "green" : "orange"}>
                  Mobile {record.isMobileVerified ? "Verified" : "Pending"}
                </Tag>
                <Tag color={record.isRoleApproved ? "green" : "orange"}>
                  Role {record.isRoleApproved ? "Approved" : "Pending"}
                </Tag>
              </Space>
            ),
          },
          {
            title: "Status",
            dataIndex: "isActive",
            render: (active) => (
              <Tag color={active ? "green" : "red"}>
                {active ? "Active" : "Inactive"}
              </Tag>
            ),
          },
          {
            title: "Actions",
            render: (_, record) => {
              const protectedSuperAdmin = record.role === "SUPER_ADMIN";

              return (
                <Space wrap>
                  <Button
                    disabled={protectedSuperAdmin}
                    icon={<EditOutlined />}
                    onClick={() => openUserModal(record)}
                  >
                    Edit
                  </Button>

                  <Button
                    disabled={protectedSuperAdmin || record.id === user.id}
                    onClick={() => updateUserStatus(record, !record.isActive)}
                  >
                    {record.isActive ? "Deactivate" : "Activate"}
                  </Button>

                  <Popconfirm
                    title="Delete this user?"
                    onConfirm={() => deleteUser(record)}
                  >
                    <Button
                      danger
                      disabled={protectedSuperAdmin || record.id === user.id}
                      icon={<DeleteOutlined />}
                    >
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
        pagination={{ pageSize: 8 }}
      />
    </Card>
  );

  const renderRoles = () => (
    <Card title="Role Access Control" style={{ borderRadius: 18 }}>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Super Admin and Worker permissions are locked. Admin permissions can be changed by Super Admin."
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={roles}
        columns={[
          {
            title: "Role",
            dataIndex: "name",
            render: (name) => <Tag>{getRoleLabel(name)}</Tag>,
          },
          {
            title: "Permissions",
            render: (_, role) => (
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                disabled={!role.canEditPermissions}
                value={role.permissions || []}
                options={permissions.map((permission) => ({
                  label: getPermissionLabel(permission.key),
                  value: permission.key,
                }))}
                onChange={(values) => updateRolePermissions(role, values)}
              />
            ),
          },
        ]}
        pagination={false}
      />
    </Card>
  );

  const renderCalendar = () => (
    <Card
      title="Calendar Events"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCalendarModal()}
        >
          Add Event
        </Button>
      }
      style={{ borderRadius: 18 }}
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={events}
        columns={[
          {
            title: "Title",
            dataIndex: "title",
          },
          {
            title: "Type",
            dataIndex: "type",
          },
          {
            title: "Audience",
            dataIndex: "audience",
          },
          {
            title: "Date",
            dataIndex: "date",
            render: (value) => formatDisplayDateTime(value),
          },
          {
            title: "Status",
            dataIndex: "status",
            render: (status) => <Tag>{status}</Tag>,
          },
          {
            title: "Actions",
            render: (_, record) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => openCalendarModal(record)}
                >
                  Edit
                </Button>

                <Popconfirm
                  title="Delete this event?"
                  onConfirm={() => deleteCalendarEvent(record)}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        pagination={{ pageSize: 8 }}
      />
    </Card>
  );

  const renderNotifications = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card title="Send Notification" style={{ borderRadius: 18 }}>
          <Form
            form={notificationForm}
            layout="vertical"
            onFinish={createNotification}
            initialValues={{ audience: "All", priority: "Normal" }}
          >
            <Form.Item
              name="title"
              label="Title"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="message"
              label="Message"
              rules={[{ required: true }]}
            >
              <Input.TextArea rows={4} />
            </Form.Item>

            <Form.Item name="audience" label="Audience">
              <Select options={notificationAudiences} />
            </Form.Item>

            <Form.Item name="priority" label="Priority">
              <Select options={priorities} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block>
              Send Notification
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={15}>
        <Card title="All Notifications" style={{ borderRadius: 18 }}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={notifications}
            columns={[
              {
                title: "Title",
                dataIndex: "title",
              },
              {
                title: "Audience",
                dataIndex: "audience",
              },
              {
                title: "Priority",
                dataIndex: "priority",
                render: (value) => <Tag>{value}</Tag>,
              },
              {
                title: "Sent",
                dataIndex: "sentAt",
                render: (value) => formatDisplayDateTime(value),
              },
              {
                title: "Action",
                render: (_, record) => (
                  <Space wrap>
                    <Button
                      icon={<FileSearchOutlined />}
                      onClick={() => openNotificationDetails(record)}
                    >
                      Details
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );

  const renderVerificationActions = (record) => {
    const isRejected = record.status === "Rejected";
    const isOtpVerified = record.isEmailVerified && record.isMobileVerified;
    const hasOtpBeenSent = Boolean(record.emailOtpSentAt || record.mobileOtpSentAt);

    if (record.isFullyVerified) {
      return (
        <Popconfirm
          title="Reject this verified account?"
          onConfirm={() => rejectVerification(record)}
        >
          <Button danger>Reject</Button>
        </Popconfirm>
      );
    }

    if (isRejected) {
      return (
        <Button onClick={() => sendVerificationOtps(record)}>
          Restart verification
        </Button>
      );
    }

    return (
      <Space wrap>
        {!isOtpVerified && (
          <Button onClick={() => sendVerificationOtps(record)}>
            {hasOtpBeenSent ? "Resend OTPs" : "Send OTPs"}
          </Button>
        )}

        {!isOtpVerified && hasOtpBeenSent && (
          <Button type="primary" onClick={() => openVerifyOtpModal(record)}>
            Enter OTPs
          </Button>
        )}

        {isOtpVerified && !record.isRoleApproved && (
          <Button type="primary" onClick={() => openRoleApprovalModal(record)}>
            Approve Role
          </Button>
        )}

        <Popconfirm
          title="Reject this verification?"
          onConfirm={() => rejectVerification(record)}
        >
          <Button danger>Reject</Button>
        </Popconfirm>
      </Space>
    );
  };

  const renderVerification = () => (
    <Card title="Email, Mobile and Role Verification" style={{ borderRadius: 18 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Verification requests"
        description="Review each registered user vertically. Send OTPs, verify both OTPs, then approve the requested role."
      />

      <List
        className="nx-verification-list"
        loading={loading}
        dataSource={verifications}
        locale={{ emptyText: "No verification requests" }}
        pagination={{ pageSize: 6 }}
        renderItem={(record) => (
          <List.Item>
            <Card className="nx-verification-item" size="small">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} lg={7}>
                  <Space direction="vertical" size={2}>
                    <strong>{record.name}</strong>
                    <span>{record.email}</span>
                    <span>{record.mobile || "-"}</span>
                  </Space>
                </Col>

                <Col xs={24} sm={12} lg={5}>
                  <Space direction="vertical" size={6}>
                    <span>Current: <Tag>{getRoleLabel(record.role)}</Tag></span>
                    <span>
                      Requested:{" "}
                      <Tag color="blue">{getRoleLabel(record.requestedRole)}</Tag>
                    </span>
                  </Space>
                </Col>

                <Col xs={24} sm={12} lg={7}>
                  <Space wrap>
                    <Tag color={record.isEmailVerified ? "green" : "orange"}>
                      Email {record.isEmailVerified ? "Verified" : "Pending"}
                    </Tag>
                    <Tag color={record.isMobileVerified ? "green" : "orange"}>
                      Mobile {record.isMobileVerified ? "Verified" : "Pending"}
                    </Tag>
                    <Tag color={record.isRoleApproved ? "green" : "orange"}>
                      Role {record.isRoleApproved ? "Approved" : "Pending"}
                    </Tag>
                    <Tag color={statusColor(record.status)}>
                      {record.status || "Pending"}
                    </Tag>
                  </Space>
                </Col>

                <Col xs={24} lg={5}>
                  <div className="nx-verification-actions">
                    {renderVerificationActions(record)}
                  </div>
                </Col>
              </Row>
            </Card>
          </List.Item>
        )}
      />
    </Card>
  );

  const renderAuditLogs = () => (
    <Card title="Admin Change Logs" style={{ borderRadius: 18 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="When Admin changes worker records, Super Admin gets both audit log and notification."
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={auditLogs}
        columns={[
          {
            title: "Action",
            dataIndex: "action",
            render: (value) => <Tag>{value}</Tag>,
          },
          {
            title: "Changed By",
            dataIndex: "actor",
            render: (actor) =>
              actor ? `${actor.name || "Admin"} (${actor.email})` : "-",
          },
          {
            title: "Description",
            dataIndex: "description",
          },
          {
            title: "Date",
            dataIndex: "createdAt",
            render: (value) => formatDisplayDateTime(value),
          },
        ]}
      />
    </Card>
  );

  const renderSettings = () => (
    <Card title="Settings" style={{ borderRadius: 18 }}>
      <Alert
        type="warning"
        showIcon
        message="Protected Super Admin settings"
        description="Super Admin email/password change is intentionally not available in the dashboard. Backend team must change it through environment/database flow."
      />
    </Card>
  );

  const sections = [
    {
      key: "overview",
      label: "Overview",
      icon: <SafetyCertificateOutlined />,
      content: renderOverview(),
    },
    {
      key: "users",
      label: "Users",
      icon: <UserOutlined />,
      badgeCount: stats.pendingVerification,
      content: renderUsers(),
    },
    {
      key: "roles",
      label: "Role Access",
      icon: <SettingOutlined />,
      content: renderRoles(),
    },
    {
      key: "workers",
      label: "Workers",
      icon: <ToolOutlined />,
      content: (
        <WorkerManagement
          title="Worker Records"
          note="Workers are non-skilled records. They do not get dashboard login access."
        />
      ),
    },
    {
      key: "audit",
      label: "Admin Logs",
      icon: <FileSearchOutlined />,
      content: renderAuditLogs(),
    },
    {
      key: "verification",
      label: "Verification",
      icon: <IdcardOutlined />,
      badgeCount: stats.pendingVerification,
      content: renderVerification(),
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: <CalendarOutlined />,
      content: renderCalendar(),
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: <BellOutlined />,
      content: renderNotifications(),
    },
    {
      key: "settings",
      label: "Settings",
      icon: <SettingOutlined />,
      content: renderSettings(),
    },
  ];

  return (
    <>
      <DashboardLayout
        user={user}
        sections={sections}
        defaultSection="overview"
        title="Super Admin Dashboard"
        subtitle="Full system control with protected Super Admin account rules."
      />

      <Modal
        title={editingUser ? "Edit User" : "Add User"}
        open={userModalOpen}
        okText={editingUser ? "Save User" : "Create User"}
        onOk={saveUser}
        onCancel={() => setUserModalOpen(false)}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? "New Password (optional)" : "Password"}
            rules={editingUser ? [] : [{ required: true, min: 6 }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name="roleName"
            label="Role"
            rules={[{ required: true }]}
          >
            <Select
              options={roleOptions}
              disabled={editingUser?.role === "SUPER_ADMIN"}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingEvent ? "Edit Calendar Event" : "Add Calendar Event"}
        open={calendarModalOpen}
        okText={editingEvent ? "Save Event" : "Create Event"}
        onOk={saveCalendarEvent}
        onCancel={() => setCalendarModalOpen(false)}
      >
        <Form form={calendarForm} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true }]}
          >
            <Input placeholder="Meeting, Holiday, Reminder" />
          </Form.Item>

          <Form.Item
            name="audience"
            label="Audience"
            rules={[{ required: true }]}
          >
            <Select options={calendarAudiences} />
          </Form.Item>

          <Form.Item
            name="date"
            label="Date and Time"
            rules={[{ required: true }]}
          >
            <Input type="datetime-local" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true }]}
          >
            <Select options={calendarStatuses} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Enter Email and Mobile OTPs"
        open={verifyOtpModalOpen}
        okText="Verify OTPs"
        onOk={submitVerifyOtps}
        onCancel={() => {
          setVerifyOtpModalOpen(false);
          setSelectedVerification(null);
          verifyOtpForm.resetFields();
        }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Ask the user for both OTPs"
          description="Email OTP is received in Gmail. Mobile OTP is received through SMS or WhatsApp."
        />

        <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="User">
            {selectedVerification?.name || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {selectedVerification?.email || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Mobile">
            {selectedVerification?.mobile || "-"}
          </Descriptions.Item>
        </Descriptions>

        <Form form={verifyOtpForm} layout="vertical">
          <Form.Item
            name="emailOtp"
            label="Email OTP"
            rules={[
              { required: true, message: "Email OTP is required" },
              { len: 6, message: "OTP must be 6 digits" },
            ]}
          >
            <Input maxLength={6} placeholder="Enter 6 digit email OTP" />
          </Form.Item>

          <Form.Item
            name="mobileOtp"
            label="Mobile OTP"
            rules={[
              { required: true, message: "Mobile OTP is required" },
              { len: 6, message: "OTP must be 6 digits" },
            ]}
          >
            <Input maxLength={6} placeholder="Enter 6 digit mobile OTP" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Approve or Assign Role"
        open={roleApprovalModalOpen}
        okText="Approve Role"
        onOk={submitRoleApproval}
        onCancel={() => {
          setRoleApprovalModalOpen(false);
          setSelectedVerification(null);
          roleApprovalForm.resetFields();
        }}
      >
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Approve dashboard role"
          description="You can approve the requested role or choose another role before approval."
        />

        <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="User">
            {selectedVerification?.name || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Requested Role">
            {getRoleLabel(selectedVerification?.requestedRole)}
          </Descriptions.Item>
        </Descriptions>

        <Form form={roleApprovalForm} layout="vertical">
          <Form.Item
            name="roleName"
            label="Approved Role"
            rules={[{ required: true, message: "Please select role" }]}
          >
            <Select options={roleOptions} />
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea
              rows={3}
              placeholder="Optional remarks for approval"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Notification Delivery Details"
        open={notificationDetailsOpen}
        onCancel={closeNotificationDetails}
        footer={<Button onClick={closeNotificationDetails}>Close</Button>}
        width={940}
      >
        {selectedNotificationDetails ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Title">
                {selectedNotificationDetails.title}
              </Descriptions.Item>

              <Descriptions.Item label="Message">
                {selectedNotificationDetails.message}
              </Descriptions.Item>

              <Descriptions.Item label="Audience">
                {selectedNotificationDetails.audience}
              </Descriptions.Item>

              <Descriptions.Item label="Priority">
                <Tag>{selectedNotificationDetails.priority}</Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Sent Time">
                {formatDisplayDateTime(selectedNotificationDetails.sentAt)}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="Reached"
                    value={selectedNotificationDetails.reachedCount || 0}
                  />
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="Read"
                    value={selectedNotificationDetails.readCount || 0}
                  />
                </Card>
              </Col>

              <Col xs={24} md={8}>
                <Card>
                  <Statistic
                    title="Not Read"
                    value={selectedNotificationDetails.unreadCount || 0}
                  />
                </Card>
              </Col>
            </Row>

            <Table
              rowKey="id"
              size="small"
              loading={notificationDetailsLoading}
              dataSource={(selectedNotificationDetails.recipients || []).filter(
                (item) => item.role !== "SUPER_ADMIN"
              )}
              columns={[
                {
                  title: "Recipient",
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <strong>{record.name}</strong>
                      <span>{record.email || "-"}</span>
                      <span>{record.mobile || ""}</span>
                    </Space>
                  ),
                },
                {
                  title: "Role",
                  dataIndex: "role",
                  render: (role) => (
                    <Tag>{role ? getRoleLabel(role) : "-"}</Tag>
                  ),
                },
                {
                  title: "Mobile Verified",
                  dataIndex: "isMobileVerified",
                  render: (value) => (
                    <Tag color={value ? "green" : "orange"}>
                      {value ? "Verified" : "Not verified"}
                    </Tag>
                  ),
                },
                {
                  title: "Reached",
                  dataIndex: "reachedAt",
                  render: (value) => (
                    <Space direction="vertical" size={0}>
                      <Tag color="blue">Reached</Tag>
                      <span>{formatDisplayDateTime(value)}</span>
                    </Space>
                  ),
                },
                {
                  title: "Read Status",
                  render: (_, record) => (
                    <Tag color={record.isRead ? "green" : "orange"}>
                      {record.isRead ? "Read" : "Not read"}
                    </Tag>
                  ),
                },
                {
                  title: "Read Time",
                  dataIndex: "readAt",
                  render: (value) => formatDisplayDateTime(value),
                },
              ]}
              pagination={{ pageSize: 6 }}
            />
          </Space>
        ) : (
          <Card
            loading={notificationDetailsLoading}
            style={{ minHeight: 180 }}
          />
        )}
      </Modal>
    </>
  );
}

export default SuperAdminDashboard;

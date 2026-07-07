import {
  Badge,
  Button,
  Card,
  ConfigProvider,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Segmented,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  BellOutlined,
  CheckOutlined,
  InboxOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";

const { Text } = Typography;

const priorityColor = {
  Low: "default",
  Normal: "blue",
  Important: "orange",
  Urgent: "red",
};

const notificationPopupTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorBgBase: "#ffffff",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorText: "#101828",
    colorTextSecondary: "#667085",
    colorBorder: "#eaecf0",
    colorSplit: "#eaecf0",
  },
  components: {
    Modal: {
      contentBg: "#ffffff",
      headerBg: "#ffffff",
      footerBg: "#ffffff",
      titleColor: "#101828",
    },
    Card: {
      colorBgContainer: "#ffffff",
      colorBorderSecondary: "#eaecf0",
    },
    Descriptions: {
      labelBg: "#f8fafc",
      colorText: "#101828",
      colorTextSecondary: "#667085",
    },
    List: {
      colorBgContainer: "#ffffff",
    },
  },
};

const formatDateTime = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
};

function NotificationsList({
  notifications = [],
  loading = false,
  title = "Notifications",
  onMarkRead,
  onMarkAllRead,
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNotification, setSelectedNotification] = useState(null);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const filteredNotifications = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !item.isRead) ||
        (filter === "read" && item.isRead);

      const matchesSearch =
        !searchValue ||
        item.title?.toLowerCase().includes(searchValue) ||
        item.message?.toLowerCase().includes(searchValue) ||
        item.priority?.toLowerCase().includes(searchValue) ||
        item.audience?.toLowerCase().includes(searchValue);

      return matchesFilter && matchesSearch;
    });
  }, [filter, notifications, search]);

  return (
    <Card
      title={title}
      loading={loading}
      extra={
        <Space wrap>
          <Tag color={unreadCount ? "red" : "default"}>
            {unreadCount} unread
          </Tag>
          <Button
            size="small"
            icon={<CheckOutlined />}
            disabled={!unreadCount || !onMarkAllRead}
            onClick={onMarkAllRead}
          >
            Mark all read
          </Button>
        </Space>
      }
      style={{ borderRadius: 18 }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Unread", value: "unread" },
              { label: "Read", value: "read" },
            ]}
          />

          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search notifications"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 260 }}
          />
        </Space>

        {filteredNotifications.length === 0 ? (
          <Empty description="No notifications yet" />
        ) : (
          <List
            dataSource={filteredNotifications}
            renderItem={(item) => (
              <List.Item
                onClick={() => setSelectedNotification(item)}
                actions={[
                  !item.isRead && onMarkRead ? (
                    <Button
                      key="read"
                      size="small"
                      type="link"
                      onClick={(event) => {
                        event.stopPropagation();
                        onMarkRead(item.id);
                      }}
                    >
                      Mark read
                    </Button>
                  ) : null,
                ].filter(Boolean)}
                style={{
                  borderRadius: 12,
                  paddingInline: 12,
                  background: item.isRead
                    ? "transparent"
                    : "rgba(220, 38, 38, 0.06)",
                  cursor: "pointer",
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot={!item.isRead} color="red">
                      <InboxOutlined style={{ fontSize: 20 }} />
                    </Badge>
                  }
                  title={
                    <Space size={8} wrap>
                      <Text strong={!item.isRead}>{item.title}</Text>
                      <Tag color={priorityColor[item.priority] || "default"}>
                        {item.priority}
                      </Tag>
                      {!item.isRead && <Tag color="red">Unread</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <Text>{item.message}</Text>
                      <br />
                      <Text type="secondary">
                        Audience: {item.audience}
                        {item.sentAt ? ` | ${formatDateTime(item.sentAt)}` : ""}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Space>

      <ConfigProvider theme={notificationPopupTheme}>
        <Modal
          className="nx-notification-modal"
          rootClassName="nx-notification-force-light"
          wrapClassName="nx-notification-modal-wrap"
          title={selectedNotification?.title || "Notification details"}
          open={Boolean(selectedNotification)}
          onCancel={() => setSelectedNotification(null)}
          width={720}
          footer={[
            <Button key="close" onClick={() => setSelectedNotification(null)}>
              Close
            </Button>,
            selectedNotification &&
            !selectedNotification.isRead &&
            onMarkRead ? (
              <Button
                key="read"
                type="primary"
                icon={<CheckOutlined />}
                onClick={async () => {
                  await onMarkRead(selectedNotification.id);
                  setSelectedNotification((current) =>
                    current
                      ? {
                          ...current,
                          isRead: true,
                          readAt: new Date().toISOString(),
                        }
                      : current
                  );
                }}
              >
                Mark read
              </Button>
            ) : null,
          ].filter(Boolean)}
        >
          {selectedNotification && (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Space wrap>
                <Tag color={priorityColor[selectedNotification.priority] || "default"}>
                  {selectedNotification.priority}
                </Tag>
                <Tag color={selectedNotification.isRead ? "green" : "red"}>
                  {selectedNotification.isRead ? "Read" : "Unread"}
                </Tag>
              </Space>

              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Audience">
                  {selectedNotification.audience}
                </Descriptions.Item>
                <Descriptions.Item label="Received">
                  {formatDateTime(
                    selectedNotification.sentAt || selectedNotification.createdAt
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Read Time">
                  {selectedNotification.readAt
                    ? formatDateTime(selectedNotification.readAt)
                    : "Not read yet"}
                </Descriptions.Item>
              </Descriptions>

              <Card size="small" style={{ borderRadius: 12 }}>
                <Text>{selectedNotification.message}</Text>
              </Card>
            </Space>
          )}
        </Modal>
      </ConfigProvider>
    </Card>
  );
}

export function UnreadNotificationsPopup({
  open,
  notifications = [],
  title = "New notifications",
  onClose,
}) {
  const [selectedNotification, setSelectedNotification] = useState(null);
  const unreadNotifications = notifications.filter((item) => !item.isRead);

  const handleClose = () => {
    setSelectedNotification(null);
    onClose?.();
  };

  return (
    <ConfigProvider theme={notificationPopupTheme}>
      <Modal
        className="nx-notification-modal nx-unread-notification-modal"
        rootClassName="nx-notification-force-light"
        wrapClassName="nx-notification-modal-wrap"
        title={null}
        open={open && unreadNotifications.length > 0}
        onCancel={handleClose}
        footer={
          <Space>
            {selectedNotification && (
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setSelectedNotification(null)}
              >
                Back
              </Button>
            )}
            <Button type="primary" onClick={handleClose}>
              Got it
            </Button>
          </Space>
        }
        width={560}
      >
        {selectedNotification ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div className="nx-notification-pop">
              <div className="nx-notification-pop-icon">
                <BellOutlined />
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {selectedNotification.title}
                </Typography.Title>
                <Text type="secondary">Full notification details</Text>
              </div>
            </div>

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Priority">
                <Tag color={priorityColor[selectedNotification.priority] || "default"}>
                  {selectedNotification.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Audience">
                {selectedNotification.audience}
              </Descriptions.Item>
              <Descriptions.Item label="Received">
                {formatDateTime(
                  selectedNotification.sentAt || selectedNotification.createdAt
                )}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" style={{ borderRadius: 12 }}>
              <Text>{selectedNotification.message}</Text>
            </Card>
          </Space>
        ) : (
          <>
            <div className="nx-notification-pop">
              <div className="nx-notification-pop-icon">
                <BellOutlined />
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {title}
                </Typography.Title>
                <Text type="secondary">
                  {unreadNotifications.length} new notification
                  {unreadNotifications.length === 1 ? "" : "s"} waiting in your inbox.
                </Text>
              </div>
            </div>

            <List
              className="nx-notification-pop-list"
              style={{ marginTop: 16, maxHeight: 360, overflowY: "auto" }}
              dataSource={unreadNotifications.slice(0, 5)}
              renderItem={(item) => (
                <List.Item
                  onClick={() => setSelectedNotification(item)}
                  style={{ cursor: "pointer" }}
                >
                  <List.Item.Meta
                    title={
                      <Space size={8} wrap>
                        <Text strong>{item.title}</Text>
                        <Tag color={priorityColor[item.priority] || "default"}>
                          {item.priority}
                        </Tag>
                      </Space>
                    }
                    description={item.message}
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </ConfigProvider>
  );
}

export default NotificationsList;
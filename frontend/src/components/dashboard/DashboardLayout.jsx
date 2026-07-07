/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Layout,
  Menu,
  Space,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  DesktopOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  LeftOutlined,
  LogoutOutlined,
  MoonOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { getDashboardTheme, getRoleLabel } from "../../theme/dashboardThemes";
import {
  getAntThemeTokens,
  getSystemThemeMode,
  getThemeByMode,
  getThemePreference,
  resolveThemeMode,
  setThemeMode,
} from "../../theme/colors";
import { logoutUser } from "../../utils/auth";
import { useNavigate } from "react-router-dom";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

function DashboardLayout({
  user,
  sections,
  defaultSection,
  title,
  subtitle,
  children,
}) {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(
    defaultSection || sections[0]?.key
  );
  const [themePreference, setThemePreference] = useState(getThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemThemeMode);

  const roleTheme = getDashboardTheme(user?.role);

  const resolvedTheme =
    themePreference === "system"
      ? systemTheme
      : resolveThemeMode(themePreference);

  const isDarkTheme = resolvedTheme === "dark";
  const currentColors = getThemeByMode(resolvedTheme).colors;

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isFullyVerified = Boolean(user?.isFullyVerified);
  const isEmailVerified = Boolean(user?.isEmailVerified);
  const isMobileVerified = Boolean(user?.isMobileVerified);
  const isRoleApproved = Boolean(user?.isRoleApproved);

  const requestedRole = user?.requestedRole || "USER";

  const verificationTag = isSuperAdmin ? (
    <Tag color="purple" icon={<SafetyCertificateOutlined />}>
      Superior Account
    </Tag>
  ) : isFullyVerified ? (
    <Tag color="green" icon={<CheckCircleOutlined />}>
      Verified
    </Tag>
  ) : (
    <Tag color="orange" icon={<ExclamationCircleOutlined />}>
      Non-verified
    </Tag>
  );

  const verificationLine = isSuperAdmin
    ? "Superior dashboard account. Verification status is not required for Super Admin."
    : isFullyVerified
    ? `Account verified. Email, mobile number and role approval are completed. Mobile alerts are enabled for ${
        user?.verifiedMobile || user?.mobile || "registered mobile"
      }.`
    : "Account is not fully verified. Super Admin must verify email OTP, mobile OTP and approve the requested role.";

  const verificationStatusTags = isSuperAdmin ? (
    <Tag color="purple">Default Superior Access</Tag>
  ) : (
    <Space wrap>
      <Tag color={isEmailVerified ? "green" : "orange"}>
        Email {isEmailVerified ? "Verified" : "Pending"}
      </Tag>

      <Tag color={isMobileVerified ? "green" : "orange"}>
        Mobile {isMobileVerified ? "Verified" : "Pending"}
      </Tag>

      <Tag color={isRoleApproved ? "green" : "orange"}>
        Role {isRoleApproved ? "Approved" : "Pending"}
      </Tag>

      {!isRoleApproved && (
        <Tag color="blue">Requested: {getRoleLabel(requestedRole)}</Tag>
      )}
    </Space>
  );

  const themeChoices = {
    light: {
      label: "Light",
      description: "Clean daytime workspace",
      icon: <SunOutlined />,
    },
    dark: {
      label: "Dark",
      description: "Focused night workspace",
      icon: <MoonOutlined />,
    },
    system: {
      label: "System",
      description: "Follow device setting",
      icon: <DesktopOutlined />,
    },
  };

  useEffect(() => {
    if (!sections.some((section) => section.key === activeSection)) {
      setActiveSection(defaultSection || sections[0]?.key);
    }
  }, [activeSection, defaultSection, sections]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", handleSystemThemeChange);

    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    setThemeMode(themePreference);
  }, [themePreference, systemTheme]);

  const menuItems = useMemo(
    () =>
      sections.map((section) => {
        const badgeCount = section.badgeCount || 0;

        const icon = badgeCount ? (
          <Badge dot color="red" offset={[2, 0]}>
            <span>{section.icon}</span>
          </Badge>
        ) : (
          section.icon
        );

        const label = badgeCount ? (
          <span className="nx-menu-label-with-badge">
            <span>{section.label}</span>
            <Badge count={badgeCount} size="small" overflowCount={99} />
          </span>
        ) : (
          section.label
        );

        return {
          key: section.key,
          icon,
          label,
        };
      }),
    [sections]
  );

  const activeContent =
    children || sections.find((section) => section.key === activeSection)?.content;

  const currentThemeOption = themeChoices[themePreference] || themeChoices.system;

  const themeMenuItems = Object.entries(themeChoices).map(([key, option]) => ({
    key,
    label: (
      <div className="nx-theme-menu-item">
        <span className={`nx-theme-menu-icon nx-theme-${key}`}>
          {option.icon}
        </span>

        <span>
          <strong>{option.label}</strong>
          <small>{option.description}</small>
        </span>

        {themePreference === key && <CheckOutlined className="nx-theme-check" />}
      </div>
    ),
  }));

  const handleLogout = () => {
    logoutUser();
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkTheme
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: {
          ...getAntThemeTokens(isDarkTheme),
          colorPrimary: roleTheme.primary,
          borderRadius: 14,
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        },
      }}
    >
      <Layout
        style={{
          minHeight: "100vh",
          background: isDarkTheme ? currentColors.background : roleTheme.soft,
        }}
      >
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={270}
          style={{
            background: "#111827",
            paddingTop: 16,
          }}
        >
          <div
            style={{
              padding: collapsed ? "14px 6px" : "16px 18px",
              color: "white",
              minHeight: collapsed ? 76 : 96,
              display: "flex",
              alignItems: "center",
              gap: collapsed ? 6 : 10,
            }}
          >
            <div
              style={{
                width: collapsed ? 36 : 42,
                height: collapsed ? 36 : 42,
                borderRadius: 12,
                background: roleTheme.gradient,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                flex: "0 0 auto",
              }}
            >
              N
            </div>

            <Button
              type="text"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
              onClick={() => setCollapsed((value) => !value)}
              style={{
                width: collapsed ? 24 : 28,
                height: collapsed ? 24 : 28,
                minWidth: collapsed ? 24 : 28,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.16)",
                color: "rgba(255,255,255,0.72)",
                background: "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            />

            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <Title level={4} style={{ color: "white", margin: 0 }}>
                  Nexenstial
                </Title>

                <Text style={{ color: "#d1d5db" }}>{roleTheme.name}</Text>
              </div>
            )}
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeSection]}
            items={menuItems}
            onClick={({ key }) => setActiveSection(key)}
            style={{
              background: "#111827",
              borderInlineEnd: 0,
            }}
          />
        </Sider>

        <Layout
          style={{
            background: isDarkTheme ? currentColors.background : roleTheme.soft,
          }}
        >
          <Header
            style={{
              minHeight: 96,
              height: "auto",
              lineHeight: "normal",
              padding: "18px 24px",
              background: currentColors.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${currentColors.border}`,
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 260, flex: "1 1 420px" }}>
              <Title
                level={4}
                style={{
                  margin: "0 0 8px",
                  lineHeight: 1.2,
                  color: currentColors.text,
                }}
              >
                {title}
              </Title>

              <Text
                type="secondary"
                style={{
                  display: "block",
                  lineHeight: 1.45,
                }}
              >
                {subtitle}
              </Text>
            </div>

            <Space wrap style={{ justifyContent: "flex-end" }}>
              <Dropdown
                menu={{
                  items: themeMenuItems,
                  onClick: ({ key }) => setThemePreference(key),
                }}
                trigger={["click"]}
                placement="bottomRight"
                overlayClassName="nx-theme-dropdown"
              >
                <button type="button" className="nx-theme-button">
                  <span
                    className={`nx-theme-orb nx-theme-orb-${themePreference}`}
                  >
                    {currentThemeOption.icon}
                  </span>

                  <span className="nx-theme-text">
                    {currentThemeOption.label}
                  </span>

                  <DownOutlined className="nx-theme-down" />
                </button>
              </Dropdown>

              <Avatar
                style={{
                  background: roleTheme.primary,
                }}
                icon={<UserOutlined />}
              />

              <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                <Text strong>{user?.name || "User"}</Text>
                <br />

                <Text type="secondary">{getRoleLabel(user?.role)}</Text>
                <br />

                {verificationTag}
              </div>

              <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
                Logout
              </Button>
            </Space>
          </Header>

          <Content
            style={{
              padding: 24,
              background: isDarkTheme ? currentColors.background : roleTheme.soft,
            }}
          >
            <div
              style={{
                background: roleTheme.gradient,
                color: "white",
                borderRadius: 24,
                padding: 28,
                marginBottom: 24,
                boxShadow: "0 20px 50px rgba(15, 23, 42, 0.16)",
              }}
            >
              <Space wrap style={{ marginBottom: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.8)" }}>
                  {getRoleLabel(user?.role)}
                </Text>

                {verificationTag}
              </Space>

              <Title level={2} style={{ color: "white", margin: "4px 0" }}>
                {title}
              </Title>

              <Text
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 16,
                  display: "block",
                }}
              >
                {subtitle}
              </Text>

              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 14,
                  display: "block",
                  marginTop: 10,
                }}
              >
                {verificationLine}
              </Text>

              <div style={{ marginTop: 12 }}>{verificationStatusTags}</div>

              {!isSuperAdmin && !isFullyVerified && (
                <Space
                  wrap
                  style={{
                    marginTop: 12,
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  <ClockCircleOutlined />

                  <Text style={{ color: "rgba(255,255,255,0.9)" }}>
                    Waiting for Super Admin verification and role approval.
                  </Text>
                </Space>
              )}
            </div>

            {activeContent}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default DashboardLayout;

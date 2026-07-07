import { useState } from "react";
import { Button, Card, Form, Input, message } from "antd";
import {
  DatabaseOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { saveAuth } from "../utils/auth";
import "../App.css";

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);

      const res = await API.post("/auth/login", {
        identifier: values.identifier,
        password: values.password,
      });

      saveAuth({
        token: res.data.token,
        user: res.data.user,
      });

      message.success(`Welcome ${res.data.user?.name || "back"}`);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      message.error(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-left">
        <div className="brand-badge">Nexenstial Project</div>

        <h1>Role Based Access Portal</h1>

        <p>
          Sign in using your email address or mobile number. Super Admin manages
          account verification and role approval.
        </p>

        <div className="feature-list">
          <div className="feature-item">
            <div className="feature-dot">
              <SafetyCertificateOutlined />
            </div>
            JWT authentication with protected API routes
          </div>

          <div className="feature-item">
            <div className="feature-dot">
              <TeamOutlined />
            </div>
            Email/mobile verification and role approval
          </div>

          <div className="feature-item">
            <div className="feature-dot">
              <DatabaseOutlined />
            </div>
            Express, Prisma, MySQL, and React integration
          </div>
        </div>
      </section>

      <section className="auth-right">
        <Card className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">N</div>
            <h2>Sign In</h2>
            <span>Access your role based workspace</span>
          </div>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Email or Mobile Number"
              name="identifier"
              rules={[
                {
                  required: true,
                  message: "Please enter your email or mobile number",
                },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Enter email or mobile number"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: "Please enter your password" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Enter your password"
                size="large"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="auth-button"
            >
              Sign In
            </Button>

            <div className="auth-link-text">
              Do not have an account? <Link to="/register">Create account</Link>
            </div>
          </Form>
        </Card>
      </section>
    </div>
  );
}

export default Login;
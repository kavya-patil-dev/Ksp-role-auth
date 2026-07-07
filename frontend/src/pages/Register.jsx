import { useState } from "react";
import { Button, Card, Form, Input, Select, message } from "antd";
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { saveAuth } from "../utils/auth";
import "../App.css";

const requestedRoleOptions = [
  { label: "Admin", value: "ADMIN" },
  { label: "Employee", value: "EMPLOYEE" },
  { label: "User", value: "USER" },
];

function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    try {
      setLoading(true);

      const res = await API.post("/auth/register", {
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
        requestedRole: values.requestedRole,
      });

      saveAuth({
        token: res.data.token,
        user: res.data.user,
      });

      message.success(
        res.data.message ||
          "Account created. Verification and role approval are pending."
      );

      navigate("/dashboard", { replace: true });
    } catch (error) {
      message.error(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-left">
        <div className="brand-badge">Nexenstial Project</div>

        <h1>Create Your Access Account</h1>

        <p>
          Register with your email, mobile number, and requested dashboard role.
          Super Admin will verify your email, verify your mobile number, and
          approve your role.
        </p>

        <div className="feature-list">
          <div className="feature-item">
            <div className="feature-dot">
              <SafetyCertificateOutlined />
            </div>
            Email and mobile OTP verification by Super Admin
          </div>

          <div className="feature-item">
            <div className="feature-dot">
              <TeamOutlined />
            </div>
            Requested role is approved by Super Admin
          </div>

          <div className="feature-item">
            <div className="feature-dot">
              <DatabaseOutlined />
            </div>
            User data is saved through Prisma and MySQL
          </div>
        </div>
      </section>

      <section className="auth-right">
        <Card className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">N</div>
            <h2>Create Account</h2>
            <span>Register to access your dashboard</span>
          </div>

          <Form
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ requestedRole: "USER" }}
          >
            <Form.Item
              label="Full Name"
              name="name"
              rules={[
                { required: true, message: "Please enter your full name" },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Enter your full name"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Email Address"
              name="email"
              rules={[
                { required: true, message: "Please enter your email address" },
                { type: "email", message: "Please enter a valid email" },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="Enter your email address"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Mobile Number"
              name="mobile"
              rules={[
                { required: true, message: "Please enter your mobile number" },
              ]}
            >
              <Input
                prefix={<PhoneOutlined />}
                placeholder="+91XXXXXXXXXX or 10 digit mobile number"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Requested Role"
              name="requestedRole"
              rules={[{ required: true, message: "Please select your role" }]}
            >
              <Select size="large" options={requestedRoleOptions} />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: "Please enter your password" },
                { min: 6, message: "Password must be at least 6 characters" },
              ]}
              hasFeedback
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Create password"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Confirm Password"
              name="confirmPassword"
              dependencies={["password"]}
              hasFeedback
              rules={[
                { required: true, message: "Please confirm your password" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<CheckCircleOutlined />}
                placeholder="Confirm password"
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
              Create Account
            </Button>

            <div className="auth-link-text">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </Form>
        </Card>
      </section>
    </div>
  );
}

export default Register;
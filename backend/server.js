import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userNotificationRoutes from "./routes/userNotificationRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import workerRoutes from "./routes/workerRoutes.js";
import adminAuditRoutes from "./routes/adminAuditRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nexenstial backend API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/admin/roles", roleRoutes);
app.use("/api/admin/calendar", calendarRoutes);
app.use("/api/admin/notifications", notificationRoutes);
app.use("/api/notifications", userNotificationRoutes);
app.use("/api/admin/verifications", verificationRoutes);
app.use("/api/admin/audit-logs", adminAuditRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/admin", adminUserRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
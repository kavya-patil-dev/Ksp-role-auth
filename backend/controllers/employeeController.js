import prisma from "../config/prisma.js";

const requestTypeToDb = {
  Attendance: "ATTENDANCE",
  Leave: "LEAVE",
  Feedback: "FEEDBACK",
  "Contact Service": "CONTACT_SERVICE",
  Difficulty: "DIFFICULTY",
  ATTENDANCE: "ATTENDANCE",
  LEAVE: "LEAVE",
  FEEDBACK: "FEEDBACK",
  CONTACT_SERVICE: "CONTACT_SERVICE",
  DIFFICULTY: "DIFFICULTY",
};

const requestTypeToDisplay = {
  ATTENDANCE: "Attendance",
  LEAVE: "Leave",
  FEEDBACK: "Feedback",
  CONTACT_SERVICE: "Contact Service",
  DIFFICULTY: "Difficulty",
};

const requestStatusToDisplay = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

const formatEmployeeRequest = (request) => ({
  id: request.id,
  type: requestTypeToDisplay[request.type] || request.type,
  subject: request.subject,
  message: request.message,
  status: requestStatusToDisplay[request.status] || request.status,
  adminReply: request.adminReply,
  fromDate: request.fromDate,
  toDate: request.toDate,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const getEmployeeDirectory = async (req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          name: "EMPLOYEE",
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.name || "Employee",
      })),
    });
  } catch (error) {
    console.error("Get employee directory error:", error);
    return res.status(500).json({ message: "Failed to fetch employees" });
  }
};

export const getMyEmployeeRequests = async (req, res) => {
  try {
    const requests = await prisma.employeeRequest.findMany({
      where: {
        employeeId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      requests: requests.map(formatEmployeeRequest),
    });
  } catch (error) {
    console.error("Get employee requests error:", error);
    return res.status(500).json({ message: "Failed to fetch employee requests" });
  }
};

export const createEmployeeRequest = async (req, res) => {
  try {
    const { type, subject = "", message = "" } = req.body;
    const normalizedType = requestTypeToDb[type];
    const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!normalizedType) {
      return res.status(400).json({ message: "Please select a valid request type" });
    }

    if (!trimmedMessage) {
      return res.status(400).json({ message: "Request message is required" });
    }

    const request = await prisma.employeeRequest.create({
      data: {
        employeeId: req.user.id,
        type: normalizedType,
        subject: trimmedSubject || requestTypeToDisplay[normalizedType],
        message: trimmedMessage,
      },
    });

    return res.status(201).json({
      message: "Request submitted successfully",
      request: formatEmployeeRequest(request),
    });
  } catch (error) {
    console.error("Create employee request error:", error);
    return res.status(500).json({ message: "Failed to submit employee request" });
  }
};

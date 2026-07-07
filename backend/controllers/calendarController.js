import prisma from "../config/prisma.js";
import { sendCalendarEmail } from "../utils/mailService.js";
import {
  getVerifiedMobileFromUser,
  sendSmsMessage,
  sendWhatsAppMessage,
} from "../utils/mobileMessageService.js";

const audienceToDb = {
  All: "ALL",
  "Super Admin": "SUPER_ADMIN",
  Admin: "ADMIN",
  Employee: "EMPLOYEE",
  User: "USER",
  ALL: "ALL",
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  EMPLOYEE: "EMPLOYEE",
  USER: "USER",
};

const audienceToDisplay = {
  ALL: "All",
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  USER: "User",
};

const statusToDb = {
  Scheduled: "SCHEDULED",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const statusToDisplay = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const getAudienceRoles = (audience) => {
  if (audience === "ALL") {
    return ["ADMIN", "EMPLOYEE", "USER"];
  }

  return [audience];
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const formatEvent = (event) => ({
  id: event.id,
  title: event.title,
  type: event.description || "Event",
  description: event.description,
  audience: audienceToDisplay[event.audience] || event.audience,
  date: event.eventDate,
  eventDate: event.eventDate,
  status: statusToDisplay[event.status] || event.status,
  location: event.location,
  startTime: event.startTime,
  endTime: event.endTime,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

const cleanCalendarPayload = (body) => {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";

  const description =
    typeof body.description === "string" ? body.description.trim() : type;

  const audienceInput =
    typeof body.audience === "string" ? body.audience.trim() : "All";

  const statusInput =
    typeof body.status === "string" ? body.status.trim() : "Scheduled";

  const parsedDate = new Date(body.date || body.eventDate);
  const audience = audienceToDb[audienceInput];
  const status = statusToDb[statusInput];

  return {
    title,
    description,
    audience,
    status,
    parsedDate,
  };
};

const validateCalendarPayload = ({ title, audience, status, parsedDate }) => {
  if (!title || !audience) {
    return "Title, type, audience, and date are required";
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return "Please enter a valid date";
  }

  if (!status) {
    return "Status must be Scheduled, Cancelled, or Completed";
  }

  return null;
};

const getCalendarRecipients = async (event) => {
  const roleNames = getAudienceRoles(event.audience);

  if (!roleNames.length) {
    return [];
  }

  const where = {
    status: "ACTIVE",
    role: {
      name: {
        in: roleNames,
      },
    },
  };

  if (event.createdById) {
    where.id = {
      not: event.createdById,
    };
  }

  return prisma.user.findMany({
    where,
    include: {
      role: true,
      mobileVerifications: {
        where: {
          status: "VERIFIED",
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
      },
    },
  });
};

const sendCalendarChannelsToRecipients = async (event, eventAction = "created") => {
  try {
    const recipients = await getCalendarRecipients(event);

    if (!recipients.length) {
      return;
    }

    const displayAudience = audienceToDisplay[event.audience] || event.audience;
    const displayStatus = statusToDisplay[event.status] || event.status;
    const displayDate = formatDateTime(event.eventDate);

    await Promise.allSettled(
      recipients.map(async (user) => {
        const verifiedMobile = getVerifiedMobileFromUser(user);

        await sendCalendarEmail({
          to: user.email,
          subject: `Calendar Event ${eventAction}: ${event.title}`,
          title: event.title,
          description: event.description,
          eventDate: displayDate,
          audience: displayAudience,
          status: displayStatus,
        });

        if (verifiedMobile) {
          const mobileMessage = `Calendar Event ${eventAction}: ${event.title}\nDate: ${displayDate}\nStatus: ${displayStatus}\n${event.description || ""}`;

          await sendSmsMessage({
            to: verifiedMobile,
            body: mobileMessage,
          });

          await sendWhatsAppMessage({
            to: verifiedMobile,
            body: mobileMessage,
          });
        }
      })
    );
  } catch (error) {
    console.error("Send calendar channels error:", error);
  }
};

export const getCalendarEvents = async (req, res) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: {
        eventDate: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      events: events.map(formatEvent),
    });
  } catch (error) {
    console.error("Get calendar events error:", error);
    return res.status(500).json({
      message: "Failed to fetch calendar events",
    });
  }
};

export const createCalendarEvent = async (req, res) => {
  try {
    const payload = cleanCalendarPayload(req.body);
    const validationMessage = validateCalendarPayload(payload);

    if (validationMessage) {
      return res.status(400).json({
        message: validationMessage,
      });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        audience: payload.audience,
        eventDate: payload.parsedDate,
        status: payload.status,
        createdById: req.user.id,
      },
    });

    await sendCalendarChannelsToRecipients(event, "created");

    return res.status(201).json({
      success: true,
      message: "Calendar event created successfully",
      event: formatEvent(event),
    });
  } catch (error) {
    console.error("Create calendar event error:", error);
    return res.status(500).json({
      message: "Failed to create calendar event",
    });
  }
};

export const updateCalendarEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const payload = cleanCalendarPayload(req.body);
    const validationMessage = validateCalendarPayload(payload);

    if (validationMessage) {
      return res.status(400).json({
        message: validationMessage,
      });
    }

    const existingEvent = await prisma.calendarEvent.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!existingEvent) {
      return res.status(404).json({
        message: "Calendar event not found",
      });
    }

    const event = await prisma.calendarEvent.update({
      where: {
        id: eventId,
      },
      data: {
        title: payload.title,
        description: payload.description || null,
        audience: payload.audience,
        eventDate: payload.parsedDate,
        status: payload.status,
      },
    });

    await sendCalendarChannelsToRecipients(event, "updated");

    return res.status(200).json({
      success: true,
      message: "Calendar event updated successfully",
      event: formatEvent(event),
    });
  } catch (error) {
    console.error("Update calendar event error:", error);
    return res.status(500).json({
      message: "Failed to update calendar event",
    });
  }
};

export const deleteCalendarEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    await prisma.calendarEvent.delete({
      where: {
        id: eventId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Calendar event deleted successfully",
    });
  } catch (error) {
    console.error("Delete calendar event error:", error);
    return res.status(500).json({
      message: "Failed to delete calendar event",
    });
  }
};
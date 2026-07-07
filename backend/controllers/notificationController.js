import prisma from "../config/prisma.js";
import { sendNotificationEmail } from "../utils/mailService.js";
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

const priorityToDb = {
  Low: "LOW",
  Normal: "NORMAL",
  Important: "HIGH",
  High: "HIGH",
  Urgent: "URGENT",
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

const priorityToDisplay = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "Important",
  URGENT: "Urgent",
};

const getAudienceRoles = (audience) => {
  if (audience === "ALL") {
    return ["ADMIN", "EMPLOYEE", "USER"];
  }

  return [audience];
};

const formatNotification = (notification, userNotification = null) => ({
  id: notification.id,
  userNotificationId: userNotification?.id || null,
  title: notification.title,
  message: notification.message,
  audience: audienceToDisplay[notification.audience] || notification.audience,
  priority: priorityToDisplay[notification.priority] || notification.priority,
  isRead: userNotification?.isRead ?? false,
  readAt: userNotification?.readAt || null,
  sentAt: notification.createdAt,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const cleanNotificationPayload = (body) => {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const audienceInput =
    typeof body.audience === "string" ? body.audience.trim() : "All";

  const priorityInput =
    typeof body.priority === "string" ? body.priority.trim() : "Normal";

  const audience = audienceToDb[audienceInput];
  const priority = priorityToDb[priorityInput];

  return {
    title,
    message,
    audience,
    priority,
  };
};

const createRecipientRows = async (notification) => {
  const roleNames = getAudienceRoles(notification.audience);

  if (!roleNames.length) {
    return;
  }

  const where = {
    status: "ACTIVE",
    role: {
      name: {
        in: roleNames,
      },
    },
  };

  if (notification.createdById) {
    where.id = {
      not: notification.createdById,
    };
  }

  const recipients = await prisma.user.findMany({
    where,
    select: {
      id: true,
    },
  });

  if (!recipients.length) {
    return;
  }

  await prisma.userNotification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      notificationId: notification.id,
    })),
    skipDuplicates: true,
  });
};

const ensureRecipientRowsForUser = async (user) => {
  const roleAudience = audienceToDb[user.role];

  const audienceFilters = [
    ...(roleAudience !== "SUPER_ADMIN" ? [{ audience: "ALL" }] : []),
    ...(roleAudience ? [{ audience: roleAudience }] : []),
  ];

  if (!audienceFilters.length) {
    return;
  }

  const where = {
    OR: audienceFilters,
    recipients: {
      none: {},
    },
  };

  if (user.id) {
    where.createdById = {
      not: user.id,
    };
  }

  const notifications = await prisma.notification.findMany({
    where,
    select: {
      id: true,
    },
  });

  if (!notifications.length) {
    return;
  }

  const existingRows = await prisma.userNotification.findMany({
    where: {
      userId: user.id,
      notificationId: {
        in: notifications.map((notification) => notification.id),
      },
    },
    select: {
      notificationId: true,
    },
  });

  const existingIds = new Set(existingRows.map((row) => row.notificationId));

  const missingRows = notifications
    .filter((notification) => !existingIds.has(notification.id))
    .map((notification) => ({
      userId: user.id,
      notificationId: notification.id,
    }));

  if (!missingRows.length) {
    return;
  }

  await prisma.userNotification.createMany({
    data: missingRows,
    skipDuplicates: true,
  });
};

const sendNotificationChannelsToRecipients = async (notification) => {
  try {
    const recipientRows = await prisma.userNotification.findMany({
      where: {
        notificationId: notification.id,
        user: {
          status: "ACTIVE",
          role: {
            name: {
              not: "SUPER_ADMIN",
            },
          },
        },
      },
      include: {
        user: {
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
        },
      },
    });

    if (!recipientRows.length) {
      return;
    }

    const priority =
      priorityToDisplay[notification.priority] || notification.priority;

    await Promise.allSettled(
      recipientRows.map(async (row) => {
        const verifiedMobile = getVerifiedMobileFromUser(row.user);

        await sendNotificationEmail({
          to: row.user.email,
          subject: `New Notification: ${notification.title}`,
          title: notification.title,
          message: notification.message,
          priority,
        });

        if (verifiedMobile) {
          const mobileMessage = `New Notification: ${notification.title}\nPriority: ${priority}\n${notification.message}`;

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
    console.error("Send notification channels error:", error);
  }
};

export const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      notifications: notifications.map(formatNotification),
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      message: "Failed to fetch notifications",
    });
  }
};

export const getNotificationDetails = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await createRecipientRows(notification);

    const recipientRows = await prisma.userNotification.findMany({
      where: {
        notificationId,
        user: {
          role: {
            name: {
              not: "SUPER_ADMIN",
            },
          },
        },
      },
      include: {
        user: {
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
        },
      },
      orderBy: [
        {
          isRead: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    const readCount = recipientRows.filter((row) => row.isRead).length;
    const reachedCount = recipientRows.length;

    return res.status(200).json({
      success: true,
      notification: {
        ...formatNotification(notification),
        reachedCount,
        readCount,
        unreadCount: reachedCount - readCount,
        recipients: recipientRows.map((row) => ({
          id: row.id,
          userId: row.userId,
          name: row.user?.name || "User",
          email: row.user?.email || "",
          role: row.user?.role?.name || null,
          mobile: getVerifiedMobileFromUser(row.user) || null,
          isMobileVerified: Boolean(getVerifiedMobileFromUser(row.user)),
          isRead: row.isRead,
          readAt: row.readAt,
          reachedAt: row.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get notification details error:", error);
    return res.status(500).json({
      message: "Failed to fetch notification details",
    });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    await ensureRecipientRowsForUser(req.user);

    const notificationFilter = {
      createdById: {
        not: req.user.id,
      },
    };

    if (req.user.role === "SUPER_ADMIN") {
      notificationFilter.audience = "SUPER_ADMIN";
    }

    const rows = await prisma.userNotification.findMany({
      where: {
        userId: req.user.id,
        notification: notificationFilter,
      },
      include: {
        notification: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const unreadCount = await prisma.userNotification.count({
      where: {
        userId: req.user.id,
        isRead: false,
        notification: notificationFilter,
      },
    });

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications: rows.map((row) =>
        formatNotification(row.notification, row)
      ),
    });
  } catch (error) {
    console.error("Get my notifications error:", error);
    return res.status(500).json({
      message: "Failed to fetch notifications",
    });
  }
};

export const createNotification = async (req, res) => {
  try {
    const payload = cleanNotificationPayload(req.body);

    if (!payload.title || !payload.message) {
      return res.status(400).json({
        message: "Title and message are required",
      });
    }

    if (!payload.audience) {
      return res.status(400).json({
        message: "Please select a valid audience",
      });
    }

    if (!payload.priority) {
      return res.status(400).json({
        message: "Please select a valid priority",
      });
    }

    if (payload.audience === "SUPER_ADMIN") {
      return res.status(400).json({
        message: "Super Admin cannot be selected as notification recipient",
      });
    }

    const notification = await prisma.notification.create({
      data: {
        ...payload,
        createdById: req.user.id,
      },
    });

    await createRecipientRows(notification);
    await sendNotificationChannelsToRecipients(notification);

    return res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      notification: formatNotification(notification),
    });
  } catch (error) {
    console.error("Create notification error:", error);
    return res.status(500).json({
      message: "Failed to send notification",
    });
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const payload = cleanNotificationPayload(req.body);

    if (!payload.title || !payload.message) {
      return res.status(400).json({
        message: "Title and message are required",
      });
    }

    if (!payload.audience) {
      return res.status(400).json({
        message: "Please select a valid audience",
      });
    }

    if (!payload.priority) {
      return res.status(400).json({
        message: "Please select a valid priority",
      });
    }

    if (payload.audience === "SUPER_ADMIN") {
      return res.status(400).json({
        message: "Super Admin cannot be selected as notification recipient",
      });
    }

    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: payload,
    });

    await createRecipientRows(notification);

    return res.status(200).json({
      success: true,
      message: "Notification updated successfully",
      notification: formatNotification(notification),
    });
  } catch (error) {
    console.error("Update notification error:", error);
    return res.status(500).json({
      message: "Failed to update notification",
    });
  }
};

export const deleteNotification = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Deleting sent notifications is not allowed",
  });
};

export const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await ensureRecipientRowsForUser(req.user);

    const where = {
      userId: req.user.id,
      notificationId,
      notification: {
        createdById: {
          not: req.user.id,
        },
      },
    };

    if (req.user.role === "SUPER_ADMIN") {
      where.notification.audience = "SUPER_ADMIN";
    }

    const result = await prisma.userNotification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({
      message: "Failed to mark notification read",
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await ensureRecipientRowsForUser(req.user);

    const where = {
      userId: req.user.id,
      isRead: false,
      notification: {
        createdById: {
          not: req.user.id,
        },
      },
    };

    if (req.user.role === "SUPER_ADMIN") {
      where.notification.audience = "SUPER_ADMIN";
    }

    const result = await prisma.userNotification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({
      message: "Failed to mark notifications read",
    });
  }
};

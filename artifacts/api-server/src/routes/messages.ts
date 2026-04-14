import { Router } from "express";
import { db, messagesTable, usersTable, requestsTable, listingsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const sendMessageSchema = z.object({
  receiverId: z.number().int().positive(),
  listingId: z.number().int().positive().optional(),
  body: z.string().min(1).max(2000),
});

interface MessageRow {
  id: number;
  senderId: number;
  receiverId: number;
  listingId: number | null;
  body: string;
  read: boolean;
  createdAt: Date;
}

function serializeMessage(msg: MessageRow) {
  return {
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    listingId: msg.listingId ?? null,
    body: msg.body,
    read: msg.read,
    createdAt: msg.createdAt.toISOString(),
  };
}

router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const msgs = await db
      .select({
        id: messagesTable.id,
        senderId: messagesTable.senderId,
        receiverId: messagesTable.receiverId,
        listingId: messagesTable.listingId,
        body: messagesTable.body,
        read: messagesTable.read,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        or(
          eq(messagesTable.senderId, userId),
          eq(messagesTable.receiverId, userId)
        )
      )
      .orderBy(desc(messagesTable.createdAt));

    const conversationMap = new Map<number, MessageRow>();
    for (const msg of msgs) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, msg);
      }
    }

    const conversations = await Promise.all(
      Array.from(conversationMap.entries()).map(async ([otherId, lastMsg]) => {
        const [otherUser] = await db
          .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, otherId))
          .limit(1);

        const unreadCount = msgs.filter(
          m => m.senderId === otherId && m.receiverId === userId && !m.read
        ).length;

        return {
          otherId,
          otherEmail: otherUser?.email ?? null,
          otherName: otherUser?.name ?? null,
          lastMessage: lastMsg.body,
          lastMessageAt: lastMsg.createdAt.toISOString(),
          unreadCount,
        };
      })
    );

    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Get conversations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/thread/:otherId", requireAuth, async (req: AuthRequest, res) => {
  const otherId = parseInt(req.params.otherId);
  if (isNaN(otherId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        id: messagesTable.id,
        senderId: messagesTable.senderId,
        receiverId: messagesTable.receiverId,
        listingId: messagesTable.listingId,
        body: messagesTable.body,
        read: messagesTable.read,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.senderId, userId), eq(messagesTable.receiverId, otherId)),
          and(eq(messagesTable.senderId, otherId), eq(messagesTable.receiverId, userId))
        )
      )
      .orderBy(messagesTable.createdAt);

    await db
      .update(messagesTable)
      .set({ read: true })
      .where(
        and(
          eq(messagesTable.senderId, otherId),
          eq(messagesTable.receiverId, userId),
          eq(messagesTable.read, false)
        )
      );

    res.json(rows.map(serializeMessage));
  } catch (err) {
    req.log.error({ err }, "Get thread error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const result = sendMessageSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation error", message: result.error.message });
    return;
  }

  const { receiverId, listingId, body } = result.data;

  if (receiverId === req.user!.id) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }

  try {
    const [receiver] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, receiverId))
      .limit(1);

    if (!receiver) {
      res.status(404).json({ error: "Receiver not found" });
      return;
    }

    const [existingConversation] = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.senderId, req.user!.id), eq(messagesTable.receiverId, receiverId)),
          and(eq(messagesTable.senderId, receiverId), eq(messagesTable.receiverId, req.user!.id)),
        ),
      )
      .limit(1);

    const senderRole = req.user!.role;
    const receiverRole = receiver.role;
    const isOwnerSeekerPair =
      (senderRole === "seeker" && receiverRole === "owner") ||
      (senderRole === "owner" && receiverRole === "seeker");

    if (!existingConversation && isOwnerSeekerPair) {
      const seekerId = senderRole === "seeker" ? req.user!.id : receiverId;
      const ownerId = senderRole === "owner" ? req.user!.id : receiverId;
      const acceptedRequestConditions = [
        eq(requestsTable.seekerId, seekerId),
        eq(listingsTable.ownerId, ownerId),
        eq(requestsTable.status, "accepted"),
      ];

      if (listingId) {
        acceptedRequestConditions.push(eq(requestsTable.listingId, listingId));
      }

      const acceptedRequests = await db
        .select({ id: requestsTable.id })
        .from(requestsTable)
        .innerJoin(listingsTable, eq(requestsTable.listingId, listingsTable.id))
        .where(and(...acceptedRequestConditions))
        .limit(1);

      if (acceptedRequests.length === 0) {
        res.status(403).json({
          error: "Request approval required",
          message: "Messaging opens only after the owner accepts a request.",
          code: "REQUEST_ACCEPTANCE_REQUIRED",
        });
        return;
      }
    }

    const [msg] = await db
      .insert(messagesTable)
      .values({
        senderId: req.user!.id,
        receiverId,
        listingId: listingId ?? null,
        body,
      })
      .returning();

    res.status(201).json(serializeMessage(msg));
  } catch (err) {
    req.log.error({ err }, "Send message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

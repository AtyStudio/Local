import { Router } from "express";
import { db, listingsTable, reportsTable, usersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const reportBodySchema = z.object({
  reason: z.enum(["scam", "fake_listing", "fake_profile", "spam", "harassment", "unsafe", "other"]),
  details: z.string().trim().max(1000).optional(),
});

function serializeReport(report: typeof reportsTable.$inferSelect) {
  return {
    id: report.id,
    targetType: report.targetType,
    listingId: report.listingId ?? null,
    reportedUserId: report.reportedUserId ?? null,
    reason: report.reason,
    details: report.details ?? null,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  };
}

router.post("/listings/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const listingId = Number.parseInt(req.params.listingId, 10);
  if (Number.isNaN(listingId)) {
    res.status(400).json({ error: "Invalid listing ID" });
    return;
  }

  const parsed = reportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  try {
    const [listing] = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(eq(listingsTable.id, listingId))
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const existing = await db
      .select({ id: reportsTable.id })
      .from(reportsTable)
      .where(
        and(
          eq(reportsTable.reporterId, req.user!.id),
          eq(reportsTable.targetType, "listing"),
          eq(reportsTable.listingId, listingId),
          eq(reportsTable.reason, parsed.data.reason),
          eq(reportsTable.status, "open"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Report already submitted", message: "You already sent this report and it is still open." });
      return;
    }

    const [report] = await db
      .insert(reportsTable)
      .values({
        reporterId: req.user!.id,
        targetType: "listing",
        listingId,
        reason: parsed.data.reason,
        details: parsed.data.details?.trim() || null,
      })
      .returning();

    res.status(201).json(serializeReport(report));
  } catch (err) {
    req.log.error({ err }, "Create listing report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId", requireAuth, async (req: AuthRequest, res) => {
  const reportedUserId = Number.parseInt(req.params.userId, 10);
  if (Number.isNaN(reportedUserId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (reportedUserId === req.user!.id) {
    res.status(400).json({ error: "You cannot report yourself" });
    return;
  }

  const parsed = reportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", message: parsed.error.message });
    return;
  }

  try {
    const [reportedUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, reportedUserId))
      .limit(1);

    if (!reportedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const existing = await db
      .select({ id: reportsTable.id })
      .from(reportsTable)
      .where(
        and(
          eq(reportsTable.reporterId, req.user!.id),
          eq(reportsTable.targetType, "user"),
          eq(reportsTable.reportedUserId, reportedUserId),
          eq(reportsTable.reason, parsed.data.reason),
          eq(reportsTable.status, "open"),
          isNull(reportsTable.listingId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Report already submitted", message: "You already sent this report and it is still open." });
      return;
    }

    const [report] = await db
      .insert(reportsTable)
      .values({
        reporterId: req.user!.id,
        targetType: "user",
        reportedUserId,
        reason: parsed.data.reason,
        details: parsed.data.details?.trim() || null,
      })
      .returning();

    res.status(201).json(serializeReport(report));
  } catch (err) {
    req.log.error({ err }, "Create user report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

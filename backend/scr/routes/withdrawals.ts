import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { writeAudit, notifyUser } from "../lib/audit";
import { getAccount } from "../services/alpaca";

export const withdrawalsRouter = Router();
withdrawalsRouter.use(requireAuth);

const createSchema = z.object({
  amountUsd: z.number().positive(),
  method: z.enum(["bank_ach", "crypto"]),
  destination: z.string().min(4),
});

withdrawalsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Sanity check against the real, live account balance before ever
  // creating the request — we never let a user request more than the
  // broker currently reports as available cash.
  try {
    const account = await getAccount();
    if (parsed.data.amountUsd > account.cash) {
      return res.status(400).json({ error: "Amount exceeds available cash balance" });
    }
  } catch (err: any) {
    return res.status(502).json({ error: "Could not verify balance with broker", detail: err.message });
  }

  const withdrawal = await prisma.withdrawalRequest.create({
    data: {
      userId: req.user!.id,
      amountUsd: parsed.data.amountUsd,
      method: parsed.data.method,
      destination: parsed.data.destination,
    },
  });
  await writeAudit({
    actorId: req.user!.id,
    subjectId: req.user!.id,
    action: "WITHDRAWAL_REQUESTED",
    metadata: { withdrawalId: withdrawal.id, amountUsd: parsed.data.amountUsd },
  });
  await notifyUser(req.user!.id, "Withdrawal submitted", `Your withdrawal request for $${parsed.data.amountUsd} was received and is pending approval.`);
  return res.status(201).json({ withdrawal });
});

withdrawalsRouter.get("/mine", async (req: AuthedRequest, res) => {
  const withdrawals = await prisma.withdrawalRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ withdrawals });
});

withdrawalsRouter.get("/", requireRole("ADMIN", "SUPER_ADMIN", "SUPPORT"), async (req, res) => {
  const withdrawals = await prisma.withdrawalRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  return res.json({ withdrawals });
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "PROCESSING", "COMPLETED", "REJECTED"]),
  reason: z.string().min(3),
});

withdrawalsRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id: req.params.id } });
  if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });

  const updated = await prisma.withdrawalRequest.update({
    where: { id: withdrawal.id },
    data: { status: parsed.data.status, reviewedBy: req.user!.id },
  });

  await writeAudit({
    actorId: req.user!.id,
    subjectId: withdrawal.userId,
    action: `WITHDRAWAL_${parsed.data.status}`,
    reason: parsed.data.reason,
    metadata: { withdrawalId: withdrawal.id, amountUsd: withdrawal.amountUsd.toString() },
  });
  await notifyUser(
    withdrawal.userId,
    "Withdrawal status updated",
    `Your withdrawal of $${withdrawal.amountUsd} is now ${parsed.data.status.toLowerCase().replace("_", " ")}.`
  );

  return res.json({ withdrawal: updated });
});
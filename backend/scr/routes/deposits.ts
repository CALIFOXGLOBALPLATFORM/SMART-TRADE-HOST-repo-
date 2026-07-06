import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { writeAudit, notifyUser } from "../lib/audit";

export const depositsRouter = Router();
depositsRouter.use(requireAuth);

const createSchema = z.object({
  amountUsd: z.number().positive(),
  method: z.enum(["bank_ach", "crypto"]),
});

// A deposit request never touches the user's tradeable balance by itself.
// It only becomes real money once funds actually arrive — in production
// that's a webhook from the ACH processor or crypto payment provider
// confirming settlement, which then triggers a real transfer into the
// user's Alpaca sub-account. Until then it just sits as a tracked request.
depositsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const deposit = await prisma.depositRequest.create({
    data: { userId: req.user!.id, amountUsd: parsed.data.amountUsd, method: parsed.data.method },
  });
  await writeAudit({
    actorId: req.user!.id,
    subjectId: req.user!.id,
    action: "DEPOSIT_REQUESTED",
    metadata: { depositId: deposit.id, amountUsd: parsed.data.amountUsd, method: parsed.data.method },
  });
  await notifyUser(req.user!.id, "Deposit submitted", `Your deposit request for $${parsed.data.amountUsd} was received.`);
  return res.status(201).json({ deposit });
});

depositsRouter.get("/mine", async (req: AuthedRequest, res) => {
  const deposits = await prisma.depositRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ deposits });
});

// --- Admin review ---

depositsRouter.get("/", requireRole("ADMIN", "SUPER_ADMIN", "SUPPORT"), async (req, res) => {
  const deposits = await prisma.depositRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  return res.json({ deposits });
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "COMPLETED", "REJECTED"]),
  reason: z.string().min(3),
});

depositsRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const deposit = await prisma.depositRequest.findUnique({ where: { id: req.params.id } });
  if (!deposit) return res.status(404).json({ error: "Deposit not found" });

  const updated = await prisma.depositRequest.update({
    where: { id: deposit.id },
    data: { status: parsed.data.status },
  });

  await writeAudit({
    actorId: req.user!.id,
    subjectId: deposit.userId,
    action: `DEPOSIT_${parsed.data.status}`,
    reason: parsed.data.reason,
    metadata: { depositId: deposit.id, amountUsd: deposit.amountUsd.toString() },
  });
  await notifyUser(
    deposit.userId,
    "Deposit status updated",
    `Your deposit of $${deposit.amountUsd} is now ${parsed.data.status.toLowerCase().replace("_", " ")}.`
  );

  return res.json({ deposit: updated });
});
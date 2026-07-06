import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { writeAudit, notifyUser } from "../lib/audit";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN", "SUPER_ADMIN", "SUPPORT"));

adminRouter.get("/users", async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      kycStatus: true,
      emailVerified: true,
      createdAt: true,
      alpacaAccountId: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ users });
});

const kycSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  reason: z.string().min(3),
});

adminRouter.patch("/users/:id/kyc", requireRole("ADMIN", "SUPER_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = kycSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { kycStatus: parsed.data.status },
  });

  await writeAudit({
    actorId: req.user!.id,
    subjectId: user.id,
    action: `KYC_${parsed.data.status}`,
    reason: parsed.data.reason,
  });
  await notifyUser(user.id, "KYC status updated", `Your identity verification status is now: ${parsed.data.status.toLowerCase().replace("_", " ")}.`);

  return res.json({ user: updated });
});

adminRouter.get("/audit-log", async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { email: true } },
      subject: { select: { email: true } },
    },
  });
  return res.json({ logs });
});

// NOTE: There is intentionally no endpoint here to set a user's balance,
// profit, or portfolio value. That data only ever comes from the broker
// (see services/alpaca.ts). If a future requirement needs manual
// corrections (e.g. a broker-side reversal), model it as its own audited
// transaction type that calls the broker API to actually move cash —
// never as a direct write to a stored balance field.
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req: AuthedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return res.json({ notifications });
});

notificationsRouter.patch("/:id/read", async (req: AuthedRequest, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.user!.id) {
    return res.status(404).json({ error: "Not found" });
  }
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  return res.json({ notification: updated });
});
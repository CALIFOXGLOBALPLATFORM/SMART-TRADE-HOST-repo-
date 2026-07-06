import { prisma } from "./prisma";

export async function writeAudit(params: {
  actorId?: string | null;
  subjectId?: string | null;
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? undefined,
      subjectId: params.subjectId ?? undefined,
      action: params.action,
      reason: params.reason,
      metadata: params.metadata as any,
    },
  });
}

export async function notifyUser(userId: string, title: string, body: string) {
  // In production this also enqueues a branded HTML email via a mail
  // service (Postmark/SES/etc). Kept in-app only here to keep the demo
  // runnable without external mail credentials.
  return prisma.notification.create({
    data: { userId, title, body },
  });
}
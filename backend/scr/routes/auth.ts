import { Router } from "express";
import argon2 from "argon2";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/jwt";
import { writeAudit, notifyUser } from "../lib/audit";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await argon2.hash(password);
  const emailVerifyToken = crypto.randomBytes(32).toString("hex");

  const user = await prisma.user.create({
    data: { email, passwordHash, emailVerifyToken },
  });

  await writeAudit({ actorId: user.id, subjectId: user.id, action: "USER_REGISTERED" });
  await notifyUser(user.id, "Welcome to Smart Trade Host", "Please verify your email to get started.");

  // In production: send the verify-email template with emailVerifyToken via a mail provider.
  return res.status(201).json({ id: user.id, email: user.email, verifyToken: emailVerifyToken });
});

authRouter.post("/verify-email", async (req, res) => {
  const { token } = req.body;
  const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
  if (!user) return res.status(400).json({ error: "Invalid or expired verification token" });

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null },
  });
  await writeAudit({ actorId: user.id, subjectId: user.id, action: "EMAIL_VERIFIED" });
  return res.json({ success: true });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

  await writeAudit({ actorId: user.id, subjectId: user.id, action: "LOGIN" });
  await notifyUser(user.id, "New login", "A new login to your account was just recorded.");

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role, kycStatus: user.kycStatus },
  });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token" });
  try {
    const payload = verifyToken(token);
    const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

authRouter.post("/logout", async (req, res) => {
  res.clearCookie("refreshToken");
  return res.json({ success: true });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return 200 regardless of whether the user exists, to avoid
  // leaking which emails are registered.
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await writeAudit({ actorId: user.id, subjectId: user.id, action: "PASSWORD_RESET_REQUESTED" });
    // In production: send reset-password email template with resetToken.
  }
  return res.json({ success: true });
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
  });
  if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });

  const passwordHash = await argon2.hash(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpires: null },
  });
  await writeAudit({ actorId: user.id, subjectId: user.id, action: "PASSWORD_RESET_COMPLETED" });
  await notifyUser(user.id, "Password changed", "Your password was just changed. If this wasn't you, contact support immediately.");
  return res.json({ success: true });
});
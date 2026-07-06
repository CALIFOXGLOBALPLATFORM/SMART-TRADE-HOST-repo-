import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@smarttradehost.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Super admin already exists.");
    return;
  }
  const passwordHash = await argon2.hash("ChangeMe123!");
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      emailVerified: true,
      kycStatus: "APPROVED",
    },
  });
  console.log(`Seeded super admin: ${email} / ChangeMe123! (change this immediately)`);
}

main().finally(() => prisma.$disconnect());
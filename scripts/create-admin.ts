// Run with: npx tsx scripts/create-admin.ts
// Creates the first admin manually

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@delivery.com";
  const password = "admin123456";
  const pseudo = "SuperAdmin";
  const telephone = "+21600000000";

  const existing = await prisma.superUser.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin already exists with email:", email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const superUser = await prisma.superUser.create({
    data: {
      email,
      pseudo,
      telephone,
      superPassword: hashedPassword,
      role: "ADMIN",
      admin: { create: {} },
    },
    include: { admin: true },
  });

  console.log("Admin created successfully!");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("SuperUser ID:", superUser.id);
  console.log("Admin ID:", superUser.admin!.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

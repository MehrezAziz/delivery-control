import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const superUsers = await prisma.superUser.findMany({
    select: { id: true, pseudo: true, email: true, role: true },
  });
  console.log("SuperUsers in DB:", JSON.stringify(superUsers, null, 2));
  
  const logCount = await prisma.actionLog.count();
  console.log("Action logs count:", logCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// Ensure .env is loaded before Prisma (PM2 / `next start` may not inject all vars into API routes).
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

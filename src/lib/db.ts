import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  databaseUrl?: string;
  prismaConstructor?: typeof PrismaClient;
};

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured. Follow README.md to connect Neon.");
  if (globalForPrisma.prisma && globalForPrisma.databaseUrl === connectionString && globalForPrisma.prismaConstructor === PrismaClient) {
    return globalForPrisma.prisma;
  }
  // Next.js preserves globals during development reloads, including .env edits.
  // Replace a client that was constructed with an earlier connection string.
  const previousClient = globalForPrisma.prisma;
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) });
  globalForPrisma.prisma = client;
  globalForPrisma.databaseUrl = connectionString;
  globalForPrisma.prismaConstructor = PrismaClient;
  if (previousClient) void previousClient.$disconnect().catch(() => {});
  return client;
}

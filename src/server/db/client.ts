import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __prismaClient?: PrismaClient;
};

const sqliteUrl = process.env.DATABASE_URL;
if (!sqliteUrl) {
  throw new Error("Falta DATABASE_URL en variables de entorno.");
}

const adapter = new PrismaBetterSqlite3({
  url: sqliteUrl,
});

export const prisma =
  globalForPrisma.__prismaClient ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaClient = prisma;
}

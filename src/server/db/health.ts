import { prisma } from "@/server/db/client";

export async function checkDatabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido en DB.";
    return { ok: false, error: message };
  }
}

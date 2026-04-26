import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/server/db/health";

export async function GET() {
  const db = await checkDatabaseHealth();

  return NextResponse.json({
    ok: true,
    service: "senflow",
    timestamp: new Date().toISOString(),
    db,
  });
}

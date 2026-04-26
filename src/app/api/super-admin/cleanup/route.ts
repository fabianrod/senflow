import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db/client";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
    }

    await prisma.$transaction([
      prisma.$executeRawUnsafe("DELETE FROM campaign_contacts"),
      prisma.$executeRawUnsafe("DELETE FROM chat_messages"),
      prisma.$executeRawUnsafe("DELETE FROM chats"),
      prisma.$executeRawUnsafe("DELETE FROM collection_contacts"),
      prisma.$executeRawUnsafe("DELETE FROM campaigns"),
      prisma.$executeRawUnsafe("DELETE FROM collections"),
      prisma.$executeRawUnsafe("DELETE FROM contacts"),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo limpiar la base de datos." },
      { status: 500 },
    );
  }
}

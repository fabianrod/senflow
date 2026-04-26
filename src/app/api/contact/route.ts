import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { contactsService } from "@/server/services";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const data = await contactsService.listUserContacts(
    user.id,
    Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100,
  );

  return NextResponse.json({ ok: true, data });
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { campaignManager } from "@/server/campaign/campaign-manager";
import { campaignRuntime } from "@/server/sender/campaign-runtime";

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const restored = await campaignRuntime.recover(user.id);
  if (!restored) {
    return NextResponse.json(
      { ok: false, error: "No existe snapshot recuperable." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: campaignManager.getState(),
  });
}

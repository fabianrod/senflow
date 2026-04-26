import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsService } from "@/server/services";

type CreateAccountBody = {
  id?: string;
  name?: string;
};

function normalizeId(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const data = await accountsService.listUserAccounts(user.id);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CreateAccountBody;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Debes enviar el nombre de la cuenta." },
      { status: 400 },
    );
  }

  const id = body.id ? normalizeId(body.id) : normalizeId(name);
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID de cuenta invalido." }, { status: 400 });
  }

  try {
    const account = await accountsService.ensureAccountForUser({
      id,
      userId: user.id,
      name,
    });
    return NextResponse.json({ ok: true, data: account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo crear la cuenta." },
      { status: 400 },
    );
  }
}

import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { authService } from "@/server/services";
import { createSessionToken, getSessionCookieConfig } from "@/server/auth/session";

type RegisterBody = {
  email?: string;
  password?: string;
  name?: string;
};

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON invalido." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password?.trim();
  const name = body.name?.trim();

  if (!email || !password || !name) {
    return NextResponse.json(
      { ok: false, error: "Debes enviar name, email y password." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "La contrasena debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await authService.registerUser({
      email,
      passwordHash,
      name,
    });
    const token = await createSessionToken({ userId: user.id, email: user.email });
    const cookie = getSessionCookieConfig();

    const response = NextResponse.json({ ok: true, data: { user } }, { status: 201 });
    response.cookies.set(cookie.name, token, cookie.options);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el usuario.";
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}

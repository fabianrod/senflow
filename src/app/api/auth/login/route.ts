import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { createSessionToken, getSessionCookieConfig } from "@/server/auth/session";
import { authService } from "@/server/services";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON invalido." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Debes enviar email y password." },
      { status: 400 },
    );
  }

  const user = await authService.getUserForLogin(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Credenciales invalidas." }, { status: 401 });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return NextResponse.json({ ok: false, error: "Credenciales invalidas." }, { status: 401 });
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });
  const cookie = getSessionCookieConfig();
  const response = NextResponse.json({
    ok: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
  });
  response.cookies.set(cookie.name, token, cookie.options);
  return response;
}

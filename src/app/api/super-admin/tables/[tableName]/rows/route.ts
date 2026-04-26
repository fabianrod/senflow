import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db/client";

type RouteContext = {
  params: Promise<{
    tableName: string;
  }>;
};

type TableExistsRow = {
  found: number | string | bigint;
};

function isSafeIdentifier(identifier: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function parsePagination(url: URL) {
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  };
}

async function ensureTableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<TableExistsRow[]>(
    `SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = '${tableName}' LIMIT 1`,
  );
  if (rows.length === 0) {
    return false;
  }
  return Number(rows[0]?.found ?? 0) === 1;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
    }

    const { tableName } = await context.params;
    if (!isSafeIdentifier(tableName)) {
      return NextResponse.json({ ok: false, error: "Nombre de tabla inválido." }, { status: 400 });
    }

    const exists = await ensureTableExists(tableName);
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Tabla no encontrada." }, { status: 404 });
    }

    const { limit, offset } = parsePagination(new URL(request.url));
    const sql = `SELECT * FROM ${quoteIdentifier(tableName)} LIMIT ? OFFSET ?`;
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, limit, offset);

    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error inesperado al leer registros." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
    }

    const { tableName } = await context.params;
    if (!isSafeIdentifier(tableName)) {
      return NextResponse.json({ ok: false, error: "Nombre de tabla inválido." }, { status: 400 });
    }

    const exists = await ensureTableExists(tableName);
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Tabla no encontrada." }, { status: 404 });
    }

    const body = (await request.json()) as {
      match?: Record<string, unknown>;
      changes?: Record<string, unknown>;
    };

    const match = body.match ?? {};
    const changes = body.changes ?? {};
    const changeEntries = Object.entries(changes).filter(([column]) => isSafeIdentifier(column));
    const matchEntries = Object.entries(match).filter(([column]) => isSafeIdentifier(column));

    if (changeEntries.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay cambios para guardar." }, { status: 400 });
    }
    if (matchEntries.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay filtro de registro para actualizar." }, { status: 400 });
    }

    const setClauses: string[] = [];
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    for (const [column, value] of changeEntries) {
      setClauses.push(`${quoteIdentifier(column)} = ?`);
      params.push(value);
    }

    for (const [column, value] of matchEntries) {
      if (value === null) {
        whereClauses.push(`${quoteIdentifier(column)} IS NULL`);
        continue;
      }
      whereClauses.push(`${quoteIdentifier(column)} = ?`);
      params.push(value);
    }

    const sql = `UPDATE ${quoteIdentifier(tableName)} SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`;
    const updatedRows = await prisma.$executeRawUnsafe(sql, ...params);

    if (updatedRows === 0) {
      return NextResponse.json(
        { ok: false, error: "No se encontró un registro que coincida con ese filtro." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: { updatedRows } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error inesperado al guardar el registro." },
      { status: 500 },
    );
  }
}

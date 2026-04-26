import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db/client";

type TableInfoRow = {
  name: string;
};

type ColumnInfoRow = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type DatabaseListRow = {
  file: string;
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
    }

    const tables = await prisma.$queryRawUnsafe<TableInfoRow[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
    );

    const data = await Promise.all(
      tables.map(async (table) => {
        const columns = await prisma.$queryRawUnsafe<ColumnInfoRow[]>(
          `PRAGMA table_info(${quoteIdentifier(table.name)})`,
        );

        return {
          name: table.name,
          columns: columns.map((column) => ({
            name: column.name,
            type: column.type,
            notNull: Boolean(column.notnull),
            defaultValue: column.dflt_value,
            isPrimaryKey: column.pk > 0,
          })),
        };
      }),
    );

    const dbList = await prisma.$queryRawUnsafe<DatabaseListRow[]>("PRAGMA database_list");
    const databasePath = dbList.find((entry) => Boolean(entry.file?.trim()))?.file ?? null;

    return NextResponse.json({ ok: true, data, databasePath });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error inesperado al leer tablas." },
      { status: 500 },
    );
  }
}

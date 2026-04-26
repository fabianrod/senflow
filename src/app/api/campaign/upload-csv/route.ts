import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { processCsvContent } from "@/server/csv/csv-processor";
import { collectionsService, contactsService } from "@/server/services";

const DEFAULT_COUNTRY_CODE = "57";
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const collectionId = String(formData.get("collectionId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Debes enviar un archivo CSV en el campo 'file'.",
      },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      {
        ok: false,
        error: "El archivo debe tener extension .csv.",
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "El archivo supera el tamano maximo permitido de 2MB.",
      },
      { status: 400 },
    );
  }

  const csvContent = await file.text();

  try {
    const result = processCsvContent(csvContent, {
      defaultCountryCode: DEFAULT_COUNTRY_CODE,
    });
    const importedContactIds = await contactsService.importUserContacts({
      userId: user.id,
      contacts: result.contacts,
      sourceFileName: file.name,
    });
    if (collectionId) {
      await collectionsService.assignContacts(user.id, collectionId, importedContactIds);
    }
    return NextResponse.json({
      ok: true,
      data: {
        summary: result.summary,
        preview: result.contacts.slice(0, 20),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el CSV.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}

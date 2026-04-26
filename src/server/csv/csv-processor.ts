import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ContactRecord, CsvImportSummary } from "@/server/common/types";

interface CsvRowInput {
  name?: string;
  phone?: string;
}

export interface CsvProcessConfig {
  defaultCountryCode: string;
}

export interface CsvProcessResult {
  contacts: ContactRecord[];
  summary: CsvImportSummary;
}

function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "").trim();
}

function normalizePhone(rawPhone: string, defaultCountryCode: string): string | undefined {
  const sanitized = sanitizePhone(rawPhone);
  if (!sanitized) {
    return undefined;
  }

  if (sanitized.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(sanitized);
    if (!parsed?.isValid()) {
      return undefined;
    }
    return parsed.number;
  }

  const withCountry = `+${defaultCountryCode}${sanitized}`;
  const parsed = parsePhoneNumberFromString(withCountry);
  if (!parsed?.isValid()) {
    return undefined;
  }
  return parsed.number;
}

export function processCsvContent(
  csvContent: string,
  config: CsvProcessConfig,
): CsvProcessResult {
  const parsed = Papa.parse<CsvRowInput>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV invalido: ${parsed.errors[0]?.message ?? "Error de parseo"}`);
  }

  const seenNumbers = new Set<string>();
  const contacts: ContactRecord[] = [];
  let invalidRows = 0;
  let duplicateRows = 0;

  parsed.data.forEach((row, index) => {
    const name = row.name?.trim() ?? "";
    const phoneRaw = row.phone?.trim() ?? "";
    const rowIndex = index + 2;

    if (!name) {
      invalidRows += 1;
      contacts.push({
        id: randomUUID(),
        rowIndex,
        name,
        phoneRaw,
        status: "invalid",
        error: "El campo name es obligatorio.",
        attempts: 0,
      });
      return;
    }

    if (!phoneRaw) {
      invalidRows += 1;
      contacts.push({
        id: randomUUID(),
        rowIndex,
        name,
        phoneRaw,
        status: "invalid",
        error: "El campo phone es obligatorio.",
        attempts: 0,
      });
      return;
    }

    const phoneNormalized = normalizePhone(phoneRaw, config.defaultCountryCode);
    if (!phoneNormalized) {
      invalidRows += 1;
      contacts.push({
        id: randomUUID(),
        rowIndex,
        name,
        phoneRaw,
        status: "invalid",
        error: "Numero invalido luego de normalizacion.",
        attempts: 0,
      });
      return;
    }

    if (seenNumbers.has(phoneNormalized)) {
      duplicateRows += 1;
      contacts.push({
        id: randomUUID(),
        rowIndex,
        name,
        phoneRaw,
        phoneNormalized,
        status: "duplicate",
        error: "Numero duplicado en el CSV.",
        attempts: 0,
      });
      return;
    }

    seenNumbers.add(phoneNormalized);
    contacts.push({
      id: randomUUID(),
      rowIndex,
      name,
      phoneRaw,
      phoneNormalized,
      status: "pending",
      attempts: 0,
    });
  });

  const summary: CsvImportSummary = {
    totalRows: contacts.length,
    validRows: contacts.filter((contact) => contact.status === "pending").length,
    invalidRows,
    duplicateRows,
  };

  return { contacts, summary };
}

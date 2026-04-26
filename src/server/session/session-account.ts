import { accountsService } from "@/server/services";

function sanitizeAccountId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

export async function ensureSessionAccountForUser(userId: string, accountIdRaw: string) {
  const accountId = sanitizeAccountId(accountIdRaw);
  if (!accountId) {
    throw new Error("accountId invalido.");
  }

  return accountsService.ensureAccountForUser({
    id: accountId,
    userId,
    name: `Cuenta ${accountId}`,
  });
}

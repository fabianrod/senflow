import { Account } from "@prisma/client";
import { SessionStatus } from "@/server/common/types";
import { accountsRepo } from "@/server/repositories/accounts-repo";

export type CreateAccountForUserInput = {
  id?: string;
  userId: string;
  name: string;
};

export const accountsService = {
  async createAccountForUser(input: CreateAccountForUserInput): Promise<Account> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("El nombre de la cuenta es obligatorio.");
    }

    return accountsRepo.createForUser({
      id: input.id,
      userId: input.userId,
      name,
      status: "disconnected",
    });
  },

  async listUserAccounts(userId: string): Promise<Account[]> {
    return accountsRepo.listByUserId(userId);
  },

  async renameAccountForUser(accountId: string, userId: string, name: string): Promise<Account> {
    const account = await accountsRepo.findByIdForUser(accountId, userId);
    if (!account) {
      throw new Error("Cuenta no encontrada.");
    }
    return accountsRepo.rename(accountId, name);
  },

  async updateAccountStatus(
    accountId: string,
    status: SessionStatus,
    options?: {
      phoneNumber?: string | null;
      lastError?: string | null;
      lastConnectedAt?: Date | null;
    },
  ): Promise<Account> {
    return accountsRepo.updateStatus(accountId, status, options);
  },

  async ensureAccountForUser(input: CreateAccountForUserInput): Promise<Account> {
    if (!input.id) {
      return this.createAccountForUser(input);
    }
    const existing = await accountsRepo.findByIdForUser(input.id, input.userId);
    if (existing) {
      return existing;
    }
    return this.createAccountForUser(input);
  },

  async deleteAccountForUser(accountId: string, userId: string): Promise<void> {
    const account = (await accountsRepo.listByUserId(userId)).find((item) => item.id === accountId);
    if (!account) {
      throw new Error("Cuenta no encontrada.");
    }
    await accountsRepo.deleteById(accountId);
  },
};

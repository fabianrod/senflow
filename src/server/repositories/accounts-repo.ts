import { Account, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { SessionStatus } from "@/server/common/types";

export type CreateAccountInput = {
  id?: string;
  name: string;
  userId: string;
  status?: SessionStatus;
};

export const accountsRepo = {
  async createForUser(input: CreateAccountInput): Promise<Account> {
    return prisma.account.create({
      data: {
        id: input.id,
        name: input.name,
        status: input.status ?? "disconnected",
        users: {
          create: {
            userId: input.userId,
          },
        },
      },
    });
  },

  async listByUserId(userId: string): Promise<Account[]> {
    return prisma.account.findMany({
      where: {
        users: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async findByIdForUser(accountId: string, userId: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: {
        id: accountId,
        users: {
          some: {
            userId,
          },
        },
      },
    });
  },

  async updateStatus(
    accountId: string,
    status: SessionStatus,
    options?: {
      phoneNumber?: string | null;
      lastError?: string | null;
      lastConnectedAt?: Date | null;
    },
  ): Promise<Account> {
    const data: Prisma.AccountUpdateInput = {
      status,
    };

    if (options && "phoneNumber" in options) {
      data.phoneNumber = options.phoneNumber;
    }
    if (options && "lastError" in options) {
      data.lastError = options.lastError;
    }
    if (options && "lastConnectedAt" in options) {
      data.lastConnectedAt = options.lastConnectedAt;
    }

    return prisma.account.update({
      where: { id: accountId },
      data,
    });
  },

  async rename(accountId: string, name: string): Promise<Account> {
    return prisma.account.update({
      where: { id: accountId },
      data: { name: name.trim() },
    });
  },

  async deleteById(accountId: string): Promise<void> {
    await prisma.account.delete({
      where: { id: accountId },
    });
  },
};

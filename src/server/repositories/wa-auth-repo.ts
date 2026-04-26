import { prisma } from "@/server/db/client";

type UpsertKeyInput = {
  keyType: string;
  keyId: string;
  valueJson: string;
};

export const waAuthRepo = {
  async getCredsJson(accountId: string): Promise<string | null> {
    const session = await prisma.waAuthSession.findUnique({
      where: { accountId },
      select: { credsJson: true },
    });
    return session?.credsJson ?? null;
  },

  async upsertCredsJson(accountId: string, credsJson: string): Promise<void> {
    await prisma.waAuthSession.upsert({
      where: { accountId },
      update: {
        credsJson,
      },
      create: {
        accountId,
        credsJson,
      },
    });
  },

  async getKeysByIds(accountId: string, keyType: string, keyIds: string[]): Promise<Map<string, string>> {
    if (keyIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await prisma.waAuthKey.findMany({
      where: {
        accountId,
        keyType,
        keyId: {
          in: keyIds,
        },
      },
      select: {
        keyId: true,
        valueJson: true,
      },
    });

    return new Map(rows.map((row) => [row.keyId, row.valueJson]));
  },

  async setKeys(accountId: string, entries: UpsertKeyInput[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    await prisma.$transaction(
      entries.map((entry) =>
        prisma.waAuthKey.upsert({
          where: {
            accountId_keyType_keyId: {
              accountId,
              keyType: entry.keyType,
              keyId: entry.keyId,
            },
          },
          update: {
            valueJson: entry.valueJson,
          },
          create: {
            accountId,
            keyType: entry.keyType,
            keyId: entry.keyId,
            valueJson: entry.valueJson,
          },
        }),
      ),
    );
  },

  async deleteKeys(accountId: string, keyType: string, keyIds: string[]): Promise<void> {
    if (keyIds.length === 0) {
      return;
    }

    await prisma.waAuthKey.deleteMany({
      where: {
        accountId,
        keyType,
        keyId: {
          in: keyIds,
        },
      },
    });
  },

  async clearAccountAuth(accountId: string): Promise<void> {
    await prisma.$transaction([
      prisma.waAuthKey.deleteMany({
        where: { accountId },
      }),
      prisma.waAuthSession.deleteMany({
        where: { accountId },
      }),
    ]);
  },
};

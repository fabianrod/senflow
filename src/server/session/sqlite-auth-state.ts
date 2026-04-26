import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataSet,
  SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { waAuthRepo } from "@/server/repositories/wa-auth-repo";

type AuthStoreAdapter = {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
};

class AccountMutex {
  private queueByAccount = new Map<string, Promise<void>>();

  async runExclusive<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queueByAccount.get(accountId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const next = previous.then(() => current);
    this.queueByAccount.set(accountId, next);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.queueByAccount.get(accountId) === next) {
        this.queueByAccount.delete(accountId);
      }
    }
  }
}

const accountMutex = new AccountMutex();

function serializeWithBufferJson(value: unknown): string {
  return JSON.stringify(value, BufferJSON.replacer);
}

function deserializeWithBufferJson<T>(value: string): T {
  return JSON.parse(value, BufferJSON.reviver) as T;
}

export async function useSqliteAuthState(accountId: string): Promise<AuthStoreAdapter> {
  const credsJson = await waAuthRepo.getCredsJson(accountId);
  const creds = credsJson
    ? deserializeWithBufferJson<AuthenticationCreds>(credsJson)
    : (initAuthCreds() as AuthenticationCreds);

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const found = await waAuthRepo.getKeysByIds(accountId, type, ids);
          const data: { [id: string]: SignalDataTypeMap[T] } = {};

          for (const id of ids) {
            const raw = found.get(id);
            if (!raw) {
              continue;
            }

            const parsed = deserializeWithBufferJson<SignalDataTypeMap[T]>(raw);
            data[id] =
              type === "app-state-sync-key"
                ? (proto.Message.AppStateSyncKeyData.fromObject(parsed as object) as unknown as SignalDataTypeMap[T])
                : parsed;
          }

          return data;
        },
        set: async (data: SignalDataSet): Promise<void> => {
          await accountMutex.runExclusive(accountId, async () => {
            for (const keyType of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
              const byId = data[keyType];
              if (!byId) {
                continue;
              }

              const entriesToUpsert: Array<{ keyType: string; keyId: string; valueJson: string }> = [];
              const idsToDelete: string[] = [];

              for (const keyId of Object.keys(byId)) {
                const value = byId[keyId];
                if (value === null) {
                  idsToDelete.push(keyId);
                  continue;
                }

                entriesToUpsert.push({
                  keyType,
                  keyId,
                  valueJson: serializeWithBufferJson(value),
                });
              }

              if (entriesToUpsert.length > 0) {
                await waAuthRepo.setKeys(accountId, entriesToUpsert);
              }
              if (idsToDelete.length > 0) {
                await waAuthRepo.deleteKeys(accountId, keyType, idsToDelete);
              }
            }
          });
        },
      },
    },
    saveCreds: async (): Promise<void> => {
      await accountMutex.runExclusive(accountId, async () => {
        await waAuthRepo.upsertCredsJson(accountId, serializeWithBufferJson(creds));
      });
    },
  };
}

-- CreateTable
CREATE TABLE "wa_auth_sessions" (
    "account_id" TEXT NOT NULL PRIMARY KEY,
    "creds_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "wa_auth_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wa_auth_keys" (
    "account_id" TEXT NOT NULL,
    "key_type" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "value_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("account_id", "key_type", "key_id"),
    CONSTRAINT "wa_auth_keys_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "wa_auth_keys_account_id_key_type_idx" ON "wa_auth_keys"("account_id", "key_type");

-- CreateIndex
CREATE INDEX "wa_auth_keys_updated_at_idx" ON "wa_auth_keys"("updated_at");

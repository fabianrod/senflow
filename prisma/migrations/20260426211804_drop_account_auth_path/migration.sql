/*
  Warnings:

  - You are about to drop the column `auth_path` on the `accounts` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone_number" TEXT,
    "status" TEXT NOT NULL,
    "last_error" TEXT,
    "last_connected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_accounts" ("created_at", "id", "last_connected_at", "last_error", "name", "phone_number", "status", "updated_at") SELECT "created_at", "id", "last_connected_at", "last_error", "name", "phone_number", "status", "updated_at" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE INDEX "accounts_status_idx" ON "accounts"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

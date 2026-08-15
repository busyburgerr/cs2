-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoinflipGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "payout" INTEGER NOT NULL,
    "multiplier" REAL NOT NULL,
    "winChance" REAL NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "roll" INTEGER NOT NULL,
    "totalTickets" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinflipGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CoinflipGame" ("amount", "clientSeed", "createdAt", "id", "multiplier", "nonce", "payout", "result", "roll", "serverHash", "serverSeed", "side", "totalTickets", "userId", "win", "winChance") SELECT "amount", "clientSeed", "createdAt", "id", "multiplier", "nonce", "payout", "result", "roll", "serverHash", "serverSeed", "side", "totalTickets", "userId", "win", "winChance" FROM "CoinflipGame";
DROP TABLE "CoinflipGame";
ALTER TABLE "new_CoinflipGame" RENAME TO "CoinflipGame";
CREATE INDEX "CoinflipGame_userId_createdAt_idx" ON "CoinflipGame"("userId", "createdAt");
CREATE INDEX "CoinflipGame_createdAt_idx" ON "CoinflipGame"("createdAt");
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "openingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_INVENTORY',
    "soldPrice" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "Opening" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("createdAt", "id", "itemId", "openingId", "soldPrice", "status", "userId") SELECT "createdAt", "id", "itemId", "openingId", "soldPrice", "status", "userId" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE UNIQUE INDEX "InventoryItem_openingId_key" ON "InventoryItem"("openingId");
CREATE INDEX "InventoryItem_userId_status_idx" ON "InventoryItem"("userId", "status");
CREATE TABLE "new_Opening" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "roll" INTEGER NOT NULL,
    "totalTickets" INTEGER NOT NULL DEFAULT 100000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Opening_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opening_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Opening" ("caseId", "clientSeed", "cost", "createdAt", "id", "itemId", "nonce", "roll", "serverHash", "serverSeed", "totalTickets", "userId", "value") SELECT "caseId", "clientSeed", "cost", "createdAt", "id", "itemId", "nonce", "roll", "serverHash", "serverSeed", "totalTickets", "userId", "value" FROM "Opening";
DROP TABLE "Opening";
ALTER TABLE "new_Opening" RENAME TO "Opening";
CREATE INDEX "Opening_userId_idx" ON "Opening"("userId");
CREATE INDEX "Opening_caseId_idx" ON "Opening"("caseId");
CREATE INDEX "Opening_createdAt_idx" ON "Opening"("createdAt");
CREATE TABLE "new_RouletteBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouletteBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "RouletteRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouletteBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RouletteBet" ("amount", "color", "createdAt", "id", "payout", "roundId", "userId") SELECT "amount", "color", "createdAt", "id", "payout", "roundId", "userId" FROM "RouletteBet";
DROP TABLE "RouletteBet";
ALTER TABLE "new_RouletteBet" RENAME TO "RouletteBet";
CREATE INDEX "RouletteBet_roundId_idx" ON "RouletteBet"("roundId");
CREATE INDEX "RouletteBet_userId_idx" ON "RouletteBet"("userId");
CREATE UNIQUE INDEX "RouletteBet_roundId_userId_color_key" ON "RouletteBet"("roundId", "userId", "color");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "balanceAfter", "createdAt", "id", "meta", "type", "userId") SELECT "amount", "balanceAfter", "createdAt", "id", "meta", "type", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "demoBalance" INTEGER NOT NULL DEFAULT 0,
    "demoForceItemId" TEXT,
    "demoForceCoinflip" TEXT
);
INSERT INTO "new_User" ("balance", "banned", "clientSeed", "createdAt", "email", "id", "nonce", "passwordHash", "role", "serverSeed", "serverSeedHash", "username") SELECT "balance", "banned", "clientSeed", "createdAt", "email", "id", "nonce", "passwordHash", "role", "serverSeed", "serverSeedHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

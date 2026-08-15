-- CreateTable
CREATE TABLE "RouletteRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverHash" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "totalSlots" INTEGER NOT NULL,
    "redSlots" INTEGER NOT NULL,
    "blackSlots" INTEGER NOT NULL,
    "greenSlots" INTEGER NOT NULL,
    "roll" INTEGER,
    "slot" INTEGER,
    "color" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bettingEndsAt" DATETIME NOT NULL,
    "settledAt" DATETIME
);

-- CreateTable
CREATE TABLE "RouletteBet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouletteBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "RouletteRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RouletteBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoinflipGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateIndex
CREATE UNIQUE INDEX "RouletteRound_number_key" ON "RouletteRound"("number");

-- CreateIndex
CREATE INDEX "RouletteRound_phase_idx" ON "RouletteRound"("phase");

-- CreateIndex
CREATE INDEX "RouletteRound_startedAt_idx" ON "RouletteRound"("startedAt");

-- CreateIndex
CREATE INDEX "RouletteBet_roundId_idx" ON "RouletteBet"("roundId");

-- CreateIndex
CREATE INDEX "RouletteBet_userId_idx" ON "RouletteBet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RouletteBet_roundId_userId_color_key" ON "RouletteBet"("roundId", "userId", "color");

-- CreateIndex
CREATE INDEX "CoinflipGame_userId_createdAt_idx" ON "CoinflipGame"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinflipGame_createdAt_idx" ON "CoinflipGame"("createdAt");

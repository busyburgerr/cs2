-- Множители фиксируются на момент создания раунда, чтобы смена настроек
-- в админке не меняла выплату по уже сделанным ставкам.
ALTER TABLE "RouletteRound" ADD COLUMN "payoutColor" REAL NOT NULL DEFAULT 2;
ALTER TABLE "RouletteRound" ADD COLUMN "payoutGreen" REAL NOT NULL DEFAULT 14;

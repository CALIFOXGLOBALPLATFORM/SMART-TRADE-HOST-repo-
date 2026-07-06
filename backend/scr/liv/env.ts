import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_EXPIRES_IN: z.string().default("30d"),
  PORT: z.string().default("4000"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  // Alpaca Trading API — https://docs.alpaca.markets
  // Paper trading by default so the whole app runs with fake money against
  // real, live market data and a real broker API surface. Switching
  // ALPACA_ENV to "live" plus real keys is the only change needed to trade
  // real assets, once you have an approved Alpaca (or Broker API) account.
  ALPACA_ENV: z.enum(["paper", "live"]).default("paper"),
  ALPACA_API_KEY: z.string().optional(),
  ALPACA_API_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);

export const ALPACA_BASE_URL =
  env.ALPACA_ENV === "live"
    ? "https://api.alpaca.markets"
    : "https://paper-api.alpaca.markets";
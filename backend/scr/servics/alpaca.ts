import axios from "axios";
import { ALPACA_BASE_URL, env } from "../lib/env";

/**
 * This is the single place portfolio truth comes from.
 *
 * IMPORTANT DESIGN RULE: nothing in this codebase writes a user-facing
 * "balance" or "profit" number into the database. Cash, positions, and
 * profit/loss are always fetched live from the broker (Alpaca) and computed
 * from real market prices. Admins can approve/reject deposit and withdrawal
 * *requests*, which move real cash in and out of the user's real brokerage
 * sub-account — they cannot directly edit what a user's account is worth.
 *
 * Note on multi-tenancy: this demo uses Alpaca's standard Trading API
 * (paper environment) against a single connected account for simplicity.
 * A real multi-user platform holding client assets needs Alpaca's *Broker
 * API* (or an equivalent), which provisions a distinct, individually
 * regulated brokerage sub-account per end user, and requires Alpaca's
 * business approval + your own money-transmitter/broker-dealer compliance
 * work. Swapping this service to call the Broker API instead of the
 * Trading API is a contained change — the rest of the app (routes, DB
 * schema's alpacaAccountId field) is already shaped for it.
 */

const client = axios.create({
  baseURL: ALPACA_BASE_URL,
  headers: {
    "APCA-API-KEY-ID": env.ALPACA_API_KEY ?? "",
    "APCA-API-SECRET-KEY": env.ALPACA_API_SECRET ?? "",
  },
});

export interface BrokerAccount {
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  currency: string;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
}

export async function getAccount(): Promise<BrokerAccount> {
  const { data } = await client.get("/v2/account");
  return {
    cash: parseFloat(data.cash),
    portfolioValue: parseFloat(data.portfolio_value),
    buyingPower: parseFloat(data.buying_power),
    currency: data.currency,
  };
}

export async function getPositions(): Promise<BrokerPosition[]> {
  const { data } = await client.get("/v2/positions");
  return data.map((p: any) => ({
    symbol: p.symbol,
    qty: parseFloat(p.qty),
    avgEntryPrice: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    marketValue: parseFloat(p.market_value),
    unrealizedPl: parseFloat(p.unrealized_pl),
    unrealizedPlPct: parseFloat(p.unrealized_plpc) * 100,
  }));
}

export async function placeOrder(params: {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type?: "market" | "limit";
  timeInForce?: "day" | "gtc";
  limitPrice?: number;
}) {
  const { data } = await client.post("/v2/orders", {
    symbol: params.symbol,
    qty: params.qty,
    side: params.side,
    type: params.type ?? "market",
    time_in_force: params.timeInForce ?? "day",
    ...(params.limitPrice ? { limit_price: params.limitPrice } : {}),
  });
  return data;
}

export async function getOrders(status: "open" | "closed" | "all" = "all") {
  const { data } = await client.get("/v2/orders", { params: { status, limit: 100 } });
  return data;
}
import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getAccount, getPositions, placeOrder, getOrders } from "../services/alpaca";
import { writeAudit, notifyUser } from "../lib/audit";

export const portfolioRouter = Router();
portfolioRouter.use(requireAuth);

// GET /portfolio — cash, total value, and buying power, fetched live.
// This value is NEVER read from a database column. It's always whatever
// Alpaca currently reports for the account.
portfolioRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const [account, positions] = await Promise.all([getAccount(), getPositions()]);
    return res.json({ account, positions });
  } catch (err: any) {
    return res.status(502).json({ error: "Could not reach broker", detail: err.message });
  }
});

portfolioRouter.get("/orders", async (req: AuthedRequest, res) => {
  try {
    const orders = await getOrders("all");
    return res.json({ orders });
  } catch (err: any) {
    return res.status(502).json({ error: "Could not reach broker", detail: err.message });
  }
});

const orderSchema = z.object({
  symbol: z.string().min(1),
  qty: z.number().positive(),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]).optional(),
  limitPrice: z.number().positive().optional(),
});

portfolioRouter.post("/orders", async (req: AuthedRequest, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const order = await placeOrder(parsed.data);
    await writeAudit({
      actorId: req.user!.id,
      subjectId: req.user!.id,
      action: "ORDER_PLACED",
      metadata: { symbol: parsed.data.symbol, qty: parsed.data.qty, side: parsed.data.side, orderId: order.id },
    });
    await notifyUser(
      req.user!.id,
      "Order placed",
      `${parsed.data.side.toUpperCase()} ${parsed.data.qty} ${parsed.data.symbol} submitted.`
    );
    return res.status(201).json({ order });
  } catch (err: any) {
    return res.status(502).json({ error: "Order failed", detail: err.response?.data ?? err.message });
  }
});
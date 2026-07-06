import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { portfolioRouter } from "./routes/portfolio";
import { depositsRouter } from "./routes/deposits";
import { withdrawalsRouter } from "./routes/withdrawals";
import { adminRouter } from "./routes/admin";
import { notificationsRouter } from "./routes/notifications";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/auth", authLimiter, authRouter);

app.use("/api/portfolio", portfolioRouter);
app.use("/api/deposits", depositsRouter);
app.use("/api/withdrawals", withdrawalsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/notifications", notificationsRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(Number(env.PORT), () => {
  console.log(`Smart Trade Host API listening on :${env.PORT} (Alpaca env: ${env.ALPACA_ENV})`);
});
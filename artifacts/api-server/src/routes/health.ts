import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  if (!db) {
    return res.status(503).json({ status: "degraded", database: "not_configured", databaseProvider: "mysql" });
  }

  try {
    await db.execute(sql`select 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    return res.json({ ...data, database: "connected", databaseProvider: "mysql" });
  } catch {
    return res.status(503).json({ status: "degraded", database: "unavailable", databaseProvider: "mysql" });
  }
});

export default router;

import {
  bigint,
  char,
  datetime,
  index,
  json,
  mysqlTable,
  primaryKey,
  smallint,
  varchar,
} from "drizzle-orm/mysql-core";

export const appData = mysqlTable("app_data", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  data: json("data").notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
});

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tokenHash] }),
    index("idx_auth_sessions_user").on(table.userId),
    index("idx_auth_sessions_expiry").on(table.expiresAt),
  ],
);

export const authChallenges = mysqlTable(
  "auth_challenges",
  {
    email: varchar("email", { length: 320 }).notNull(),
    purpose: varchar("purpose", { length: 64 }).notNull(),
    codeHash: char("code_hash", { length: 64 }).notNull(),
    attempts: smallint("attempts").notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.email, table.purpose] })],
);

export type AppData = typeof appData.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type AuthChallenge = typeof authChallenges.$inferSelect;

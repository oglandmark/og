import {
  bigint,
  char,
  datetime,
  index,
  json,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  decimal,
  boolean,
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

export const propertySearchIndex = mysqlTable(
  "property_search_index",
  {
    propertyId: bigint("property_id", { mode: "number" }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    status: varchar("status", { length: 80 }).notNull(),
    listingStatus: varchar("listing_status", { length: 80 }),
    approvalStatus: varchar("approval_status", { length: 80 }),
    purpose: varchar("purpose", { length: 80 }),
    city: varchar("city", { length: 160 }),
    society: varchar("society", { length: 200 }),
    sellerId: bigint("seller_id", { mode: "number" }),
    agentId: bigint("agent_id", { mode: "number" }),
    price: decimal("price", { precision: 20, scale: 2 }),
    areaSqft: decimal("area_sqft", { precision: 20, scale: 2 }),
    bedrooms: decimal("bedrooms", { precision: 10, scale: 2 }),
    bathrooms: decimal("bathrooms", { precision: 10, scale: 2 }),
    featured: boolean("featured").notNull(),
    priority: boolean("priority").notNull(),
    scoreOverall: decimal("score_overall", { precision: 5, scale: 2 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    constructionAge: varchar("construction_age", { length: 80 }),
    furnishing: varchar("furnishing", { length: 80 }),
    availability: varchar("availability", { length: 120 }),
    tags: json("tags"),
    searchText: text("search_text").notNull(),
    propertyJson: json("property_json").notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.propertyId] }),
    index("idx_property_search_status").on(table.approvalStatus, table.listingStatus, table.createdAt),
    index("idx_property_search_city").on(table.city, table.type, table.status),
    index("idx_property_search_price").on(table.price),
    index("idx_property_search_area").on(table.areaSqft),
    index("idx_property_search_seller").on(table.sellerId),
    index("idx_property_search_agent").on(table.agentId),
    index("idx_property_search_geo").on(table.latitude, table.longitude),
  ],
);

export type AppData = typeof appData.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type AuthChallenge = typeof authChallenges.$inferSelect;
export type PropertySearchIndex = typeof propertySearchIndex.$inferSelect;

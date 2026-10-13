import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const mysqlUrl = databaseUrl && /^(mysql|mariadb):\/\//i.test(databaseUrl)
  ? databaseUrl
  : null;

export const pool = mysqlUrl
  ? mysql.createPool(mysqlUrl)
  : null;

export const db = pool ? drizzle(pool, { mode: "default", schema }) : null;

export * from "./schema";

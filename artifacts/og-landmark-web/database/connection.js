const mysql = require('mysql2/promise');
const { Pool: PostgresPool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || '';
const isPostgresUrl = /^(postgres|postgresql):\/\//i.test(databaseUrl);
const isMysqlUrl = /^(mysql|mariadb):\/\//i.test(databaseUrl);
const provider = isPostgresUrl ? 'postgres' : isMysqlUrl ? 'mysql' : null;
const configured = Boolean(provider);
const localPreview = Boolean(process.env.REPLIT_ENVIRONMENT)
  || (!configured && process.env.NODE_ENV === 'development');

let rawPool = null;
if (configured && !localPreview) {
  if (provider === 'mysql') {
    rawPool = mysql.createPool(databaseUrl);
  } else {
    const isSupabase = /supabase\.(co|com)/i.test(databaseUrl)
      || /sslmode=require/i.test(databaseUrl);
    rawPool = new PostgresPool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(isSupabase ? { ssl: { rejectUnauthorized: true } } : {}),
    });
  }
}

function questionMarksToPostgres(sql) {
  let result = '';
  let index = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      result += char;
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      result += char;
      if (char === '*' && next === '/') {
        result += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      result += char;
      if (char === '\\' && i + 1 < sql.length) {
        result += sql[i + 1];
        i += 1;
      } else if (char === quote) {
        if (next === quote) {
          result += next;
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === '-' && next === '-') {
      result += `${char}${next}`;
      i += 1;
      lineComment = true;
    } else if (char === '/' && next === '*') {
      result += `${char}${next}`;
      i += 1;
      blockComment = true;
    } else if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      result += char;
    } else if (char === '?') {
      index += 1;
      result += `$${index}`;
    } else {
      result += char;
    }
  }

  return result;
}

async function queryRows(sql, values = []) {
  if (!rawPool) throw new Error('Database connection is not configured.');
  if (provider === 'mysql') {
    const [rows] = await rawPool.query(sql, values);
    return rows;
  }
  const result = await rawPool.query(questionMarksToPostgres(sql), values);
  return result.rows;
}

async function taggedQuery(strings, ...values) {
  const statement = strings.reduce(
    (sql, chunk, index) => `${sql}${index ? '?' : ''}${chunk}`,
    '',
  );
  return queryRows(statement, values);
}

// Preserve the tuple shape the existing MySQL call sites expect while routing
// PostgreSQL statements through the same parameterized query helper.
const pool = rawPool
  ? {
      query: async (sql, values = []) => [await queryRows(sql, values), null],
      execute: async (sql, values = []) => [await queryRows(sql, values), null],
    }
  : null;

async function closePool() {
  if (!rawPool) return;
  if (provider === 'mysql') await rawPool.end();
  else await rawPool.end();
}

module.exports = {
  provider,
  configured,
  localPreview,
  pool,
  rawPool,
  queryRows,
  taggedQuery: rawPool ? taggedQuery : null,
  questionMarksToPostgres,
  closePool,
};
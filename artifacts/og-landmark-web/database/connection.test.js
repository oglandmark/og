const assert = require('node:assert/strict');
const test = require('node:test');
const { questionMarksToPostgres } = require('./connection');

test('converts positional placeholders in order', () => {
  assert.equal(
    questionMarksToPostgres('SELECT * FROM users WHERE email = ? AND role = ?'),
    'SELECT * FROM users WHERE email = $1 AND role = $2',
  );
});

test('does not convert question marks inside SQL strings or comments', () => {
  assert.equal(
    questionMarksToPostgres("SELECT '?' AS marker, value FROM t WHERE id = ? -- ?\n"),
    "SELECT '?' AS marker, value FROM t WHERE id = $1 -- ?\n",
  );
});

test('handles escaped and doubled quote characters', () => {
  assert.equal(
    questionMarksToPostgres("SELECT 'it''s ?' AS text, \"quoted?\" FROM t WHERE id = ?"),
    "SELECT 'it''s ?' AS text, \"quoted?\" FROM t WHERE id = $1",
  );
});
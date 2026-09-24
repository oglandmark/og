const crypto = require('crypto');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter(key => value[key] !== undefined)
        .sort()
        .map(key => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

module.exports = { stableStringify, sha256Json };
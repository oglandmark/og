const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const mobileSourcePath = path.resolve(root, '..', 'og-landmark-mobile', 'lib/properties.ts');
const catalogPath = path.join(root, 'public/admin/demo-properties.json');
const checkCommand = 'pnpm --filter @workspace/og-landmark-web sync:admin-demos';

function readBundledDemos(sourcePath = mobileSourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const declaration = source.indexOf('const bundledDemoProperties: Property[] = [');
  if (declaration === -1) {
    throw new Error(`Could not find bundledDemoProperties in ${sourcePath}`);
  }

  const start = source.indexOf('[', declaration);
  const close = source.indexOf('\n];', start);
  if (start === -1 || close === -1) {
    throw new Error(`Could not read the bundled demo array in ${sourcePath}`);
  }

  const literal = source.slice(start, close + 2).replace(
    /require\((['"])(.*?)\1\)(?:\s+as\s+unknown\s+as\s+number)?/g,
    (_match, _quote, assetPath) => JSON.stringify(assetPath),
  );
  const demos = vm.runInNewContext(literal, Object.create(null), { timeout: 1000 });
  if (!Array.isArray(demos) || demos.length === 0) {
    throw new Error(`Bundled demo array in ${sourcePath} is empty or invalid`);
  }

  const ids = new Set();
  for (const property of demos) {
    if (!Number.isInteger(property.id) || ids.has(property.id)) {
      throw new Error(`Bundled demos in ${sourcePath} must have unique integer IDs`);
    }
    ids.add(property.id);
  }
  return JSON.parse(JSON.stringify(demos));
}

function buildAdminCatalog(sourcePath = mobileSourcePath) {
  return readBundledDemos(sourcePath).map((property) => ({
    id: property.id,
    title: property.title,
    type: property.type,
    status: property.status,
    price: property.price,
    area: property.area,
    areaUnit: property.areaUnit,
    city: property.city,
    address: property.address,
    agent: property.agent,
    phone: property.agentPhone || '',
    featured: Boolean(property.featured),
  }));
}

function describeDifferences(actual, expected) {
  if (!Array.isArray(actual)) return 'catalog is not a JSON array';
  const actualById = new Map(actual.map((item) => [item?.id, item]));
  const expectedById = new Map(expected.map((item) => [item.id, item]));
  const missing = expected.filter((item) => !actualById.has(item.id)).map((item) => item.id);
  const extra = actual.filter((item) => !expectedById.has(item?.id)).map((item) => item?.id);
  const changed = expected
    .filter((item) => actualById.has(item.id)
      && JSON.stringify(actualById.get(item.id)) !== JSON.stringify(item))
    .map((item) => item.id);
  const details = [];
  if (missing.length) details.push(`missing IDs: ${missing.join(', ')}`);
  if (extra.length) details.push(`unexpected IDs: ${extra.join(', ')}`);
  if (changed.length) details.push(`changed records: ${changed.join(', ')}`);
  return details.join('; ') || 'catalog formatting or record order differs';
}

function assertCatalogMatches(actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      `Admin demo catalog is out of sync with mobile bundled demo records (${describeDifferences(actual, expected)}). `
      + `Run: ${checkCommand}`,
    );
  }
}

function syncCatalog(outputPath = catalogPath) {
  const catalog = buildAdminCatalog();
  fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Synchronized ${catalog.length} mobile demo listings to ${path.relative(process.cwd(), outputPath)}.`);
}

function checkCatalog(outputPath = catalogPath) {
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read admin demo catalog at ${outputPath}: ${error.message}`);
  }

  const expected = buildAdminCatalog();
  assertCatalogMatches(catalog, expected);
  console.log(`Admin demo catalog is in sync (${expected.length} listings).`);
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      syncCatalog();
    } else if (args.length === 1 && args[0] === '--check') {
      checkCatalog();
    } else {
      throw new Error('Usage: node scripts/sync-admin-demo-properties.js [--check]');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  assertCatalogMatches,
  buildAdminCatalog,
  checkCatalog,
  readBundledDemos,
};

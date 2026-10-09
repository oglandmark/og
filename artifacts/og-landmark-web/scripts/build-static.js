const fs = require('node:fs');
const path = require('node:path');
const patchDashboardAuth = require('./patch-dashboard-auth');
const patchPublicContacts = require('./patch-public-contacts');

const artifactDir = path.resolve(__dirname, '..');
const publicDir = path.join(artifactDir, 'public');
const distDir = path.join(artifactDir, 'dist');
const outputDir = path.join(distDir, 'public');

if (!fs.statSync(publicDir).isDirectory()) {
  throw new Error(`Expected static website directory at ${publicDir}`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(publicDir, outputDir, {
  recursive: true,
  preserveTimestamps: true,
});

const websiteBundle = path.join(outputDir, 'assets', 'index-CXxrK7KP.js');
if (fs.existsSync(websiteBundle)) {
  const contactPatchedBundle = patchPublicContacts(fs.readFileSync(websiteBundle, 'utf8'))
    .replaceAll('info@oglandmark.com', 'support@oglandmark.com');
  const patchedBundle = patchDashboardAuth(contactPatchedBundle);
  fs.writeFileSync(websiteBundle, patchedBundle);
}

console.log(`Copied the static website to ${outputDir}`);
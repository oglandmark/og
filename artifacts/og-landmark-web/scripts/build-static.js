const fs = require('node:fs');
const path = require('node:path');

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

console.log(`Copied the static website to ${outputDir}`);
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /\/\/ ─── NEW ADMIN SECTIONS LOGIC ───[\s\S]*?(?=const BUNDLE_AGENTS)/;
const match = content.match(regex);

if (match) {
  let jsContent = match[0];
  console.log('Found JS region');
} else {
  console.log('Could not find JS region');
}

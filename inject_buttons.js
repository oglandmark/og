const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

// For Users:
const oldUserEdit = 'onclick="openEditUserModal(${u.id})">✏ Edit</button>';
const newUserEdit = oldUserEdit + '\\n      <button class="btn btn-outline btn-sm" onclick="openUserHistory(${u.id})">History</button>';
content = content.replace(oldUserEdit, newUserEdit);

// For Agents:
const oldAgentEdit = 'onclick="openAgentModal(${a.id})">✏ Edit</button>';
const newAgentEdit = oldAgentEdit + '\\n        <button class="btn btn-outline btn-sm" onclick="openAgentLeads(${a.id})">Leads/Visits</button>';
content = content.replace(oldAgentEdit, newAgentEdit);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Button injections applied.');

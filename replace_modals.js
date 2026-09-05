const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /function openUserHistory[\s\S]*?function openAgentLeads[^{]*\{[\s\S]*?\}\s*\}?/m;
const match = content.match(regex);

if (match) {
  const replacement = `
async function openUserHistory(userId) {
  document.getElementById('user-history-modal').classList.add('open');
  const sBody = document.getElementById('user-saved-searches-body');
  const aBody = document.getElementById('user-activity-body');
  sBody.innerHTML = '<tr><td colspan="3" class="empty">Loading...</td></tr>';
  aBody.innerHTML = '<tr><td colspan="3" class="empty">No activity endpoint available (// TODO)</td></tr>';
  
  try {
    const searches = await api('GET', '/api/saved-searches');
    const userSearches = searches.filter(s => String(s.userId) === String(userId));
    if (!userSearches.length) {
      sBody.innerHTML = '<tr><td colspan="3" class="empty">No saved searches for this user</td></tr>';
    } else {
      sBody.innerHTML = userSearches.map(s => \`
        <tr>
          <td>\${s.query || s.criteria || 'Custom Search'}</td>
          <td>\${s.alertsEnabled ? 'Enabled' : 'Disabled'}</td>
          <td>\${new Date(s.createdAt).toLocaleDateString()}</td>
        </tr>
      \`).join('');
    }
  } catch(e) {
    sBody.innerHTML = \`<tr><td colspan="3" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}

async function openAgentLeads(agentId) {
  document.getElementById('agent-leads-modal').classList.add('open');
  const tbody = document.getElementById('agent-leads-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Loading...</td></tr>';
  try {
    const leads = await api('GET', '/api/agent-leads');
    const agentLeads = leads.filter(l => String(l.agentId) === String(agentId));
    if (!agentLeads.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No leads found for this agent</td></tr>';
    } else {
      tbody.innerHTML = agentLeads.map(l => \`
        <tr>
          <td>\${l.clientName || 'Unknown'}</td>
          <td>\${l.propertyTitle || '—'}</td>
          <td>\${l.type || 'Inquiry'}</td>
          <td><span class="badge badge-\${l.status==='Completed'?'green':'warn'}">\${l.status || 'Pending'}</span></td>
        </tr>
      \`).join('');
    }
  } catch(e) {
    tbody.innerHTML = \`<tr><td colspan="4" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}
`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('User history & agent leads replaced with real fetch.');
} else {
  console.log('Regex did not match.');
}

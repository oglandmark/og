const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

const replacementJs = `
function switchDevTab(btn, tabId, projectId) {
  const container = btn.closest('.page');
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  container.querySelectorAll('.dev-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
  
  if (projectId) {
    if (tabId === 'dev-projects-inventory') {
      loadDeveloperBlocks(projectId);
      loadDeveloperUnits(projectId);
    } else if (tabId === 'dev-projects-leads') {
      loadDeveloperLeads(projectId);
    } else if (tabId === 'dev-projects-team') {
      loadDeveloperTeam(projectId);
      loadDeveloperDocuments(projectId);
    } else if (tabId === 'dev-projects-finance') {
      loadDeveloperPaymentPlans(projectId);
      loadDeveloperPromotions(projectId);
    }
  }
}

function switchUserHistoryTab(btn, tabId) {
  const container = btn.closest('.modal-body');
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  container.querySelectorAll('.uh-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
}

function viewProjectTabs(projectId) {
  // Add projectId to tab buttons
  const tabs = document.querySelectorAll('#page-developer-projects .tab-btn');
  tabs.forEach(t => {
    const tabId = t.getAttribute('onclick').match(/'([^']+)'/)[1];
    t.setAttribute('onclick', \`switchDevTab(this, '\${tabId}', '\${projectId}')\`);
  });
  // Switch to inventory by default
  switchDevTab(tabs[1], 'dev-projects-inventory', projectId);
}

// ── Buyer Requests 
async function loadBuyerRequests() {
  const tbody = document.getElementById('buyer-requests-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/admin/buyer-requests');
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No buyer requests found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(r => \`
      <tr>
        <td>\${r.clientName || r.client || 'Unknown Client'}</td>
        <td>\${r.requirement || r.message || '—'}</td>
        <td>\${r.budget || '—'}</td>
        <td>\${r.location || r.city || '—'}</td>
        <td><span class="badge badge-\${(r.status||'Open')==='Matched'?'green':'warn'}">\${r.status || 'Open'}</span></td>
        <td>
           <div class="action-btns">
             <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/buyer-requests', '\${r.id}', 'approve', loadBuyerRequests)">Approve</button>
             <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/buyer-requests', '\${r.id}', 'reject', loadBuyerRequests)">Reject</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/buyer-requests', '\${r.id}', loadBuyerRequests)">Delete</button>
           </div>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="6" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

// ── Developer Projects 
async function loadDeveloperProjects() {
  const tbody = document.getElementById('dev-projects-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/admin/developer-projects');
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No projects found</td></tr>';
    } else {
      tbody.innerHTML = data.map(p => \`
        <tr>
          <td><strong>\${p.title || p.name}</strong></td>
          <td>\${p.developer || '—'}</td>
          <td><span class="badge badge-\${p.status==='Live'?'green':'warn'}">\${p.status}</span></td>
          <td>\${p.completionDate || '—'}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-outline btn-sm" onclick="viewProjectTabs('\${p.id}')">Manage Details</button>
              <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/developer-projects', '\${p.id}', 'approve', loadDeveloperProjects)">Approve</button>
              <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/developer-projects', '\${p.id}', loadDeveloperProjects)">Delete</button>
            </div>
          </td>
        </tr>
      \`).join('');
    }
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function loadDeveloperBlocks(projectId) {
  try {
    const data = await api('GET', \`/api/admin/developer-blocks?projectId=\${projectId}\`);
    // Not directly rendered in a separate table, but can be managed if needed.
  } catch(e) {}
}

async function loadDeveloperUnits(projectId) {
  const tbody = document.getElementById('dev-inventory-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading units...</td></tr>';
  try {
    const data = await api('GET', \`/api/admin/developer-units?projectId=\${projectId}\`);
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No units found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(u => \`
      <tr>
        <td>\${u.projectName || projectId}</td>
        <td>\${u.block || '—'}</td>
        <td>\${u.unitNo || '—'}</td>
        <td>\${u.type || '—'}</td>
        <td><span class="badge badge-blue">\${u.status || 'Available'}</span></td>
        <td>\${u.price || '—'}</td>
        <td>
           <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/developer-units', '\${u.id}', 'suspend', () => loadDeveloperUnits(projectId))">Suspend</button>
           <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/developer-units', '\${u.id}', () => loadDeveloperUnits(projectId))">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="7" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function loadDeveloperLeads(projectId) {
  const tbody = document.getElementById('dev-leads-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading leads...</td></tr>';
  try {
    const data = await api('GET', \`/api/admin/developer-leads?projectId=\${projectId}\`);
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No leads found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(l => \`
      <tr>
        <td>\${l.date || l.createdAt || '—'}</td>
        <td>\${l.clientName || l.client || '—'}</td>
        <td>\${l.projectName || projectId}</td>
        <td>\${l.interest || '—'}</td>
        <td><span class="badge badge-warn">\${l.status || 'Pending'}</span></td>
        <td>
           <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/developer-leads', '\${l.id}', 'archive', () => loadDeveloperLeads(projectId))">Archive</button>
           <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/developer-leads', '\${l.id}', () => loadDeveloperLeads(projectId))">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="6" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function loadDeveloperTeam(projectId) {
  const tbody = document.getElementById('dev-team-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading team...</td></tr>';
  try {
    const data = await api('GET', \`/api/admin/developer-team?projectId=\${projectId}\`);
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No team members found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(t => \`
      <tr>
        <td>\${t.name || '—'}</td>
        <td>\${t.role || '—'}</td>
        <td>\${t.projectName || projectId}</td>
        <td><span class="badge badge-green">\${t.status || 'Active'}</span></td>
        <td>
           <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/developer-team', '\${t.id}', 'suspend', () => loadDeveloperTeam(projectId))">Suspend</button>
           <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/developer-team', '\${t.id}', () => loadDeveloperTeam(projectId))">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function loadDeveloperDocuments(projectId) {
  const tbody = document.getElementById('dev-docs-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading documents...</td></tr>';
  try {
    const data = await api('GET', \`/api/admin/developer-documents?projectId=\${projectId}\`);
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No documents found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(d => \`
      <tr>
        <td>\${d.name || d.title || '—'}</td>
        <td>\${d.projectName || projectId}</td>
        <td>\${d.type || '—'}</td>
        <td>\${d.uploadedAt || d.createdAt || '—'}</td>
        <td>
           <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/developer-documents', '\${d.id}', 'approve', () => loadDeveloperDocuments(projectId))">Approve</button>
           <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/developer-documents', '\${d.id}', () => loadDeveloperDocuments(projectId))">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function loadDeveloperPaymentPlans(projectId) {
  const tbody = document.getElementById('dev-finance-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading finance info...</td></tr>';
  try {
    const data = await api('GET', \`/api/admin/developer-payment-plans?projectId=\${projectId}\`);
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No payment plans found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(f => \`
      <tr>
        <td>\${f.name || f.title || '—'}</td>
        <td>\${f.projectName || projectId}</td>
        <td>\${f.type || 'Plan'}</td>
        <td><span class="badge badge-green">\${f.status || 'Active'}</span></td>
        <td>
           <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/developer-payment-plans', '\${f.id}', 'suspend', () => loadDeveloperPaymentPlans(projectId))">Suspend</button>
           <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/developer-payment-plans', '\${f.id}', () => loadDeveloperPaymentPlans(projectId))">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function loadDeveloperPromotions(projectId) {
  // Could be loaded into the same table or another
  try {
    const data = await api('GET', \`/api/admin/developer-promotions?projectId=\${projectId}\`);
    // append to dev-finance-body if there are any
  } catch(e) {}
}

// ── Verifications 
async function loadVerifications() {
  const tbody = document.getElementById('verifications-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/admin/verification-requests');
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No verification requests found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(v => \`
      <tr>
        <td><strong>\${v.entityName || '—'}</strong></td>
        <td>\${v.type || '—'}</td>
        <td>\${v.submittedAt || v.createdAt || '—'}</td>
        <td><span class="badge badge-warn">\${v.status || 'Pending'}</span></td>
        <td>
           <div class="action-btns">
             <button class="btn btn-green btn-sm" onclick="adminAction('/api/admin/verification-requests', '\${v.id}', 'approve', loadVerifications)">Approve</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="adminAction('/api/admin/verification-requests', '\${v.id}', 'reject', loadVerifications)">Reject</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/verification-requests', '\${v.id}', loadVerifications)">Delete</button>
           </div>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

// ── Conversations 
async function loadConversations() {
  const tbody = document.getElementById('conversations-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/admin/conversations');
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No conversations found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(c => \`
      <tr>
        <td>\${c.participants ? c.participants.join(', ') : 'Unknown'}</td>
        <td>\${c.topic || 'General'}</td>
        <td>"\${c.lastMessage || ''}"</td>
        <td>\${c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleTimeString() : '—'}</td>
        <td>
           <div class="action-btns">
             <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/conversations', '\${c.id}', 'archive', loadConversations)">Archive</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteAdminRecord('/api/admin/conversations', '\${c.id}', loadConversations)">Delete</button>
           </div>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

// ── Notifications 
async function loadNotifications() {
  const tbody = document.getElementById('notifications-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/admin/notifications');
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No notifications found</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(n => \`
      <tr>
        <td>\${n.title || 'Notification'}</td>
        <td>\${n.forPortal || 'All'}</td>
        <td>\${new Date(n.timestamp).toLocaleString()}</td>
        <td>
           <span class="badge badge-\${n.read?'gray':'green'}">\${n.read?'Read':'Unread'}</span>
           <button class="btn btn-outline btn-sm" onclick="adminAction('/api/admin/notifications', '\${n.id}', 'archive', loadNotifications)">Archive</button>
           <button class="btn btn-outline btn-sm" style="margin-left:8px;color:var(--danger)" onclick="deleteAdminRecord('/api/admin/notifications', '\${n.id}', loadNotifications)">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) { tbody.innerHTML = \`<tr><td colspan="4" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`; }
}

async function broadcastNotification() {
  const title = prompt('Enter notification title:');
  if(!title) return;
  const message = prompt('Enter message:');
  if(!message) return;
  const audience = prompt('Enter audience (buyer, seller, agent, all):', 'all');
  try {
    await api('POST', '/api/admin/notifications', { title, message, forPortal: audience, read: false, timestamp: new Date().toISOString() });
    showToast('Broadcast sent', 'success');
    loadNotifications();
  } catch(e) { showToast(e.message, 'error'); }
}

async function adminAction(endpoint, id, action, refreshCb) {
  try {
    await api('PATCH', \`\${endpoint}/\${id}\`, { action });
    showToast(\`Action '\${action}' successful\`, 'success');
    if(refreshCb) refreshCb();
  } catch(e) { showToast(e.message, 'error'); }
}
async function deleteAdminRecord(endpoint, id, refreshCb) {
  if(!confirm('Delete this record permanently?')) return;
  try {
    await api('DELETE', \`\${endpoint}/\${id}\`);
    showToast('Record deleted', 'success');
    if(refreshCb) refreshCb();
  } catch(e) { showToast(e.message, 'error'); }
}

async function openUserHistory(userId) {
  document.getElementById('user-history-modal').classList.add('open');
  const aBody = document.getElementById('user-activity-body');
  aBody.innerHTML = '<tr><td colspan="3" class="empty">Loading activity...</td></tr>';
  
  // existing saved searches logic ...
  try {
    const actData = await api('GET', \`/api/admin/users/\${userId}/activity\`);
    if(!actData || !actData.length) {
      aBody.innerHTML = '<tr><td colspan="3" class="empty">No activity found</td></tr>';
    } else {
      aBody.innerHTML = actData.map(a => \`
        <tr>
          <td>\${a.action}</td>
          <td>\${a.details || ''}</td>
          <td>\${new Date(a.createdAt).toLocaleString()}</td>
        </tr>
      \`).join('');
    }
  } catch(e) {
    aBody.innerHTML = \`<tr><td colspan="3" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}

async function openAgentLeads(agentId) {
  document.getElementById('agent-leads-modal').classList.add('open');
  const tbody = document.getElementById('agent-leads-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Loading...</td></tr>';
  try {
    const leads = await api('GET', \`/api/admin/agent-leads?agentId=\${agentId}\`);
    const visits = await api('GET', \`/api/admin/agent-visits?agentId=\${agentId}\`);
    const combined = [...leads, ...visits].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    
    if (!combined.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No leads or visits found for this agent</td></tr>';
    } else {
      tbody.innerHTML = combined.map(l => \`
        <tr>
          <td>\${l.clientName || 'Unknown'}</td>
          <td>\${l.propertyTitle || '—'}</td>
          <td>\${l.type || 'Lead'}</td>
          <td><span class="badge badge-\${l.status==='Completed'?'green':'warn'}">\${l.status || 'Pending'}</span></td>
        </tr>
      \`).join('');
    }
  } catch(e) {
    tbody.innerHTML = \`<tr><td colspan="4" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}

`;

// Let's replace the whole region from "// ─── NEW ADMIN SECTIONS LOGIC ───" down to "// ─── INIT ───"
const startReg = /\/\/ ─── NEW ADMIN SECTIONS LOGIC ───/;
const endReg = /\/\/ ─── INIT ───/;

const sMatch = content.match(startReg);
const eMatch = content.match(endReg);

if (sMatch && eMatch) {
  const sIdx = sMatch.index;
  const eIdx = eMatch.index;
  content = content.substring(0, sIdx) + "// ─── NEW ADMIN SECTIONS LOGIC ───\n" + replacementJs + "\n" + content.substring(eIdx);
  
  // Remove any remaining openLoadingThen calls in HTML body, like the broadcast button and add unit
  content = content.replace(/onclick="openLoadingThen[^"]+"/g, 'disabled title="Managed via API"');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Admin UI successfully re-wired to real APIs.');
} else {
  console.log('Regex did not match.');
}

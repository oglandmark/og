const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

// Find the block where the mocked methods begin and end
const startPattern = "// ─── NEW ADMIN SECTIONS LOGIC ───";
const endPattern = "function openUserHistory(userId)";
const replacement = `// ─── NEW ADMIN SECTIONS LOGIC ───

function switchDevTab(btn, tabId) {
  const container = btn.closest('.page');
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  container.querySelectorAll('.dev-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
}

function switchUserHistoryTab(btn, tabId) {
  const container = btn.closest('.modal-body');
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  container.querySelectorAll('.uh-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
}

function openCreateProjectModal() {
  alert('// TODO: wire up when API exists for project creation');
}

// ── Buyer Requests (Real API)
async function loadBuyerRequests() {
  const tbody = document.getElementById('buyer-requests-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/buyer-requests');
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
             <button class="btn btn-outline btn-sm" onclick="updateBuyerRequest('\${r.id}', 'Matched')">Mark Matched</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteBuyerRequest('\${r.id}')">Delete</button>
           </div>
        </td>
      </tr>
    \`).join('');
  } catch(e) {
    tbody.innerHTML = \`<tr><td colspan="6" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}
async function updateBuyerRequest(id, status) {
  try {
    await api('PATCH', \`/api/buyer-requests/\${id}\`, { status });
    showToast('Status updated', 'success');
    loadBuyerRequests();
  } catch(e) { showToast(e.message, 'error'); }
}
async function deleteBuyerRequest(id) {
  if(!confirm('Delete this request?')) return;
  try {
    await api('DELETE', \`/api/buyer-requests/\${id}\`);
    showToast('Request deleted', 'success');
    loadBuyerRequests();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Developer Projects (Real API - list only)
async function loadDeveloperProjects() {
  const tbody = document.getElementById('dev-projects-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/projects'); // the public endpoint works to list them
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
              <button class="btn btn-outline btn-sm" disabled title="TODO: wire up when API exists">Edit</button>
              <button class="btn btn-outline btn-sm" style="color:var(--danger)" disabled title="TODO: wire up when API exists">Delete</button>
            </div>
          </td>
        </tr>
      \`).join('');
    }

    // Other tabs are stubs since APIs don't exist generically or require project selection
    document.getElementById('dev-inventory-body').innerHTML = '<tr><td colspan="7" class="empty">Select a project first (// TODO: wire up when API exists)</td></tr>';
    document.getElementById('dev-leads-body').innerHTML = '<tr><td colspan="6" class="empty">No leads endpoint available (// TODO)</td></tr>';
    document.getElementById('dev-team-body').innerHTML = '<tr><td colspan="5" class="empty">No team endpoint available (// TODO)</td></tr>';
    document.getElementById('dev-docs-body').innerHTML = '<tr><td colspan="5" class="empty">No documents endpoint available (// TODO)</td></tr>';
    document.getElementById('dev-finance-body').innerHTML = '<tr><td colspan="5" class="empty">No finance endpoint available (// TODO)</td></tr>';

  } catch(e) {
    tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}

// ── Verifications (No API)
async function loadVerifications() {
  const tbody = document.getElementById('verifications-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty" style="color:var(--muted)">No verifications endpoint available (// TODO: wire up when API exists)</td></tr>';
}

// ── Conversations (Real API)
async function loadConversations() {
  const tbody = document.getElementById('conversations-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/conversations');
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
             <button class="btn btn-outline btn-sm" disabled title="TODO: Monitor message view">Monitor</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="deleteConversation('\${c.id}')">Delete</button>
           </div>
        </td>
      </tr>
    \`).join('');
  } catch(e) {
    tbody.innerHTML = \`<tr><td colspan="5" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}
async function deleteConversation(id) {
  if(!confirm('Delete this conversation?')) return;
  try {
    await api('DELETE', \`/api/conversations/\${id}\`);
    showToast('Conversation deleted', 'success');
    loadConversations();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Notifications (Real API)
async function loadNotifications() {
  const tbody = document.getElementById('notifications-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Loading...</td></tr>';
  try {
    const data = await api('GET', '/api/notifications');
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
           <button class="btn btn-outline btn-sm" style="margin-left:8px;color:var(--danger)" onclick="deleteNotification('\${n.id}')">Delete</button>
        </td>
      </tr>
    \`).join('');
  } catch(e) {
    tbody.innerHTML = \`<tr><td colspan="4" class="empty" style="color:var(--danger)">Error: \${e.message}</td></tr>\`;
  }
}
async function deleteNotification(id) {
  if(!confirm('Delete this notification?')) return;
  try {
    await api('DELETE', \`/api/notifications/\${id}\`);
    showToast('Notification deleted', 'success');
    loadNotifications();
  } catch(e) { showToast(e.message, 'error'); }
}

async function broadcastNotification() {
  const title = prompt('Enter notification title:');
  if(!title) return;
  const message = prompt('Enter message:');
  if(!message) return;
  const audience = prompt('Enter audience (buyer, seller, agent, all):', 'all');
  try {
    await api('POST', '/api/notifications', { title, message, forPortal: audience, read: false, timestamp: new Date().toISOString() });
    showToast('Broadcast sent', 'success');
    loadNotifications();
  } catch(e) { showToast(e.message, 'error'); }
}

`;

const origIndexStart = content.indexOf(startPattern);
const origIndexEnd = content.indexOf(endPattern);

if (origIndexStart !== -1 && origIndexEnd !== -1) {
  content = content.substring(0, origIndexStart) + replacement + content.substring(origIndexEnd);
  
  // Also fix the broadcast button in HTML
  content = content.replace(
    `<button class="btn btn-outline" onclick="openLoadingThen('Notification sent', 'Broadcasting message...')">Broadcast Message</button>`,
    `<button class="btn btn-outline" onclick="broadcastNotification()">Broadcast Message</button>`
  );

  // Now deal with the user history and agent leads
  const newModalsLogic = `
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
  const existingModalsStart = "function openUserHistory(userId) {";
  const existingModalsEnd = "// ─── INIT ───";
  const mStart = content.indexOf(existingModalsStart);
  const mEnd = content.indexOf(existingModalsEnd);
  
  if (mStart !== -1 && mEnd !== -1) {
    content = content.substring(0, mStart) + newModalsLogic + '\n' + content.substring(mEnd);
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Real fetch logic applied successfully.');
} else {
  console.log('Could not find injection points.');
}


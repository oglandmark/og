const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove emojis
content = content.replace(/⏳ /g, '')
                 .replace(/👥 /g, '')
                 .replace(/🧑‍💼 /g, '')
                 .replace(/🚀 /g, '');

// 2. Add Sidebar links
const sidebarNavInsertionPoint = `    <a onclick="showPage('mobile')" id="nav-mobile">`;
const newNavLinks = `
    <a onclick="showPage('buyer-requests')" id="nav-buyer-requests">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
      Buyer Requests
    </a>
    <a onclick="showPage('developer-projects')" id="nav-developer-projects">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
      Developer Projects
    </a>
    <a onclick="showPage('verifications')" id="nav-verifications">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
      Verifications
    </a>
    <a onclick="showPage('conversations')" id="nav-conversations">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
      Conversations
    </a>
    <a onclick="showPage('notifications')" id="nav-notifications">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
      Notifications
    </a>
`;
content = content.replace(sidebarNavInsertionPoint, newNavLinks + sidebarNavInsertionPoint);

// 3. Add Main Pages
const pagesInsertionPoint = `  <!-- AGENTS -->`;
const newPagesHTML = `
  <!-- BUYER REQUESTS -->
  <div class="page" id="page-buyer-requests">
    <div class="sec-head"><h3>Buyer Requests</h3></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Client</th><th>Requirement</th><th>Budget</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="buyer-requests-body"></tbody>
      </table>
    </div>
  </div>

  <!-- DEVELOPER PROJECTS -->
  <div class="page" id="page-developer-projects">
    <div class="sec-head">
      <h3>Developer Projects</h3>
      <button class="btn btn-red" onclick="openCreateProjectModal()">Create Project</button>
    </div>
    
    <div class="tabs" style="margin-bottom:20px">
      <button class="tab-btn active" onclick="switchDevTab(this, 'dev-projects-list')">Projects</button>
      <button class="tab-btn" onclick="switchDevTab(this, 'dev-projects-inventory')">Inventory & Units</button>
      <button class="tab-btn" onclick="switchDevTab(this, 'dev-projects-leads')">Leads & Analytics</button>
      <button class="tab-btn" onclick="switchDevTab(this, 'dev-projects-team')">Team & Documents</button>
      <button class="tab-btn" onclick="switchDevTab(this, 'dev-projects-finance')">Payment Plans & Promotions</button>
    </div>

    <div id="dev-projects-list" class="dev-tab-content active">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Project Name</th><th>Developer</th><th>Status</th><th>Completion</th><th>Actions</th></tr></thead>
          <tbody id="dev-projects-body"></tbody>
        </table>
      </div>
    </div>
    <div id="dev-projects-inventory" class="dev-tab-content" style="display:none">
      <div class="sec-head"><h4>Inventory Blocks & Units</h4><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Unit added', 'Unit creation simulation...')">Add Unit</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Project</th><th>Block/Phase</th><th>Unit No</th><th>Type</th><th>Status</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody id="dev-inventory-body"></tbody>
        </table>
      </div>
    </div>
    <div id="dev-projects-leads" class="dev-tab-content" style="display:none">
       <div class="stats-grid" style="margin-bottom:16px;">
        <div class="stat-card"><div><div class="stat-val">120</div><div class="stat-lbl">Total Leads</div></div></div>
        <div class="stat-card"><div><div class="stat-val">45</div><div class="stat-lbl">Visits Scheduled</div></div></div>
        <div class="stat-card"><div><div class="stat-val">12</div><div class="stat-lbl">Units Sold</div></div></div>
       </div>
       <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Client Name</th><th>Project</th><th>Interest</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="dev-leads-body"></tbody>
        </table>
      </div>
    </div>
    <div id="dev-projects-team" class="dev-tab-content" style="display:none">
      <div class="sec-head"><h4>Team Members & Approvals</h4></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Project</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="dev-team-body"></tbody>
        </table>
      </div>
      <div class="sec-head" style="margin-top:20px"><h4>Project Documents</h4></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Document</th><th>Project</th><th>Type</th><th>Uploaded</th><th>Actions</th></tr></thead>
          <tbody id="dev-docs-body"></tbody>
        </table>
      </div>
    </div>
    <div id="dev-projects-finance" class="dev-tab-content" style="display:none">
      <div class="sec-head"><h4>Payment Plans & Promotions</h4></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Plan / Promo Name</th><th>Project</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="dev-finance-body"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- VERIFICATIONS -->
  <div class="page" id="page-verifications">
    <div class="sec-head"><h3>Verification Requests</h3></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Entity</th><th>Type</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="verifications-body"></tbody>
      </table>
    </div>
  </div>

  <!-- CONVERSATIONS -->
  <div class="page" id="page-conversations">
    <div class="sec-head"><h3>Conversations</h3></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Participants</th><th>Topic / Property</th><th>Last Message</th><th>Time</th><th>Actions</th></tr></thead>
        <tbody id="conversations-body"></tbody>
      </table>
    </div>
  </div>

  <!-- NOTIFICATIONS -->
  <div class="page" id="page-notifications">
    <div class="sec-head">
      <h3>System Notifications</h3>
      <button class="btn btn-outline" onclick="openLoadingThen('Notification sent', 'Broadcasting message...')">Broadcast Message</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Title</th><th>Audience</th><th>Date Sent</th><th>Status</th></tr></thead>
        <tbody id="notifications-body"></tbody>
      </table>
    </div>
  </div>
`;
content = content.replace(pagesInsertionPoint, newPagesHTML + '\n' + pagesInsertionPoint);

// 4. Extend Modals
const modalsInsertionPoint = `  <!-- Modal: Add / Edit User -->`;
const newUserModalsHTML = `
  <!-- Modal: User Account History / Saved Searches -->
  <div class="modal-overlay" id="user-history-modal">
    <div class="modal">
      <div class="modal-head">
        <h3>User Activity & History</h3>
        <button class="modal-close" onclick="closeModal('user-history-modal')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="tabs" style="margin-bottom:16px">
          <button class="tab-btn active" onclick="switchUserHistoryTab(this, 'uh-searches')">Saved Searches</button>
          <button class="tab-btn" onclick="switchUserHistoryTab(this, 'uh-activity')">Activity Log</button>
        </div>
        <div id="uh-searches" class="uh-tab-content">
          <table style="width:100%;font-size:12px;text-align:left">
            <thead><tr><th>Criteria</th><th>Alerts</th><th>Date</th></tr></thead>
            <tbody id="user-saved-searches-body"></tbody>
          </table>
        </div>
        <div id="uh-activity" class="uh-tab-content" style="display:none">
          <table style="width:100%;font-size:12px;text-align:left">
            <thead><tr><th>Action</th><th>Details</th><th>Time</th></tr></thead>
            <tbody id="user-activity-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Agent Leads & Visits -->
  <div class="modal-overlay" id="agent-leads-modal">
    <div class="modal">
      <div class="modal-head">
        <h3>Agent Leads & Visits</h3>
        <button class="modal-close" onclick="closeModal('agent-leads-modal')">&times;</button>
      </div>
      <div class="modal-body">
         <table style="width:100%;font-size:12px;text-align:left">
            <thead><tr><th>Lead Name</th><th>Property</th><th>Type</th><th>Status</th></tr></thead>
            <tbody id="agent-leads-body"></tbody>
          </table>
      </div>
    </div>
  </div>
`;
content = content.replace(modalsInsertionPoint, newUserModalsHTML + '\n' + modalsInsertionPoint);

// 5. Add JS Logic
const jsInsertionPoint = `// ─── INIT ───`;
const newJS = `
// ─── NEW ADMIN SECTIONS LOGIC ───
function openLoadingThen(toastMsg, loadingMsg = 'Processing...') {
  const oldTitle = document.getElementById('page-title').textContent;
  document.getElementById('page-title').textContent = loadingMsg;
  setTimeout(() => {
    document.getElementById('page-title').textContent = oldTitle;
    showToast(toastMsg);
  }, 600);
}

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
  openLoadingThen('Project creation form opened (mock)');
}

async function loadBuyerRequests() {
  const tbody = document.getElementById('buyer-requests-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';
  setTimeout(() => {
    const data = [
      { id: 1, client: 'Ali Raza', req: '3 Bed Apartment in Gulberg', budget: '2 Cr', loc: 'Lahore', status: 'Open' },
      { id: 2, client: 'Aisha Khan', req: '5 Marla Plot', budget: '80 Lac', loc: 'Islamabad', status: 'Matched' }
    ];
    tbody.innerHTML = data.map(r => \`
      <tr>
        <td>\${r.client}</td>
        <td>\${r.req}</td>
        <td>\${r.budget}</td>
        <td>\${r.loc}</td>
        <td><span class="badge badge-\${r.status==='Open'?'warn':'green'}">\${r.status}</span></td>
        <td>
           <div class="action-btns">
             <button class="btn btn-outline btn-sm" onclick="openLoadingThen('Assigned agent to request')">Assign Agent</button>
             <button class="btn btn-outline btn-sm" onclick="openLoadingThen('Status updated')">Update Status</button>
           </div>
        </td>
      </tr>
    \`).join('');
  }, 300);
}

async function loadDeveloperProjects() {
  document.getElementById('dev-projects-body').innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  setTimeout(() => {
    document.getElementById('dev-projects-body').innerHTML = \`
      <tr>
        <td><strong>Skyline Towers</strong></td>
        <td>Habib Developers</td>
        <td><span class="badge badge-green">Under Construction</span></td>
        <td>Dec 2025</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-outline btn-sm" onclick="openLoadingThen('Viewing project details')">View</button>
            <button class="btn btn-outline btn-sm" onclick="openLoadingThen('Project updated')">Edit</button>
          </div>
        </td>
      </tr>
    \`;
    document.getElementById('dev-inventory-body').innerHTML = \`
      <tr><td>Skyline Towers</td><td>Block A</td><td>A-402</td><td>Apartment</td><td><span class="badge badge-blue">Available</span></td><td>1.5 Cr</td>
      <td><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Unit marked sold')">Mark Sold</button></td></tr>
    \`;
    document.getElementById('dev-leads-body').innerHTML = \`
      <tr><td>2024-02-15</td><td>Usman Tariq</td><td>Skyline Towers</td><td>3 Bed Unit</td><td><span class="badge badge-warn">Follow Up</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Lead updated')">Update</button></td></tr>
    \`;
    document.getElementById('dev-team-body').innerHTML = \`
      <tr><td>Nadeem Ali</td><td>Sales Head</td><td>Skyline Towers</td><td><span class="badge badge-green">Active</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Access revoked')">Revoke</button></td></tr>
    \`;
    document.getElementById('dev-docs-body').innerHTML = \`
      <tr><td>NOC Approval.pdf</td><td>Skyline Towers</td><td>Legal</td><td>2024-01-10</td>
      <td><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Download started')">Download</button></td></tr>
    \`;
    document.getElementById('dev-finance-body').innerHTML = \`
      <tr><td>3-Year Installment Plan</td><td>Skyline Towers</td><td>Payment Plan</td><td><span class="badge badge-green">Active</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Plan edited')">Edit</button></td></tr>
    \`;
  }, 300);
}

async function loadVerifications() {
  const tbody = document.getElementById('verifications-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  setTimeout(() => {
    tbody.innerHTML = \`
      <tr>
        <td><strong>Blue Estate Agency</strong></td>
        <td>Agency KYC</td>
        <td>2024-02-18</td>
        <td><span class="badge badge-warn">Pending Review</span></td>
        <td>
           <div class="action-btns">
             <button class="btn btn-green btn-sm" onclick="openLoadingThen('Verification Approved')">Approve</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="openLoadingThen('Verification Rejected')">Reject</button>
           </div>
        </td>
      </tr>
      <tr>
        <td><strong>Zahid Imran</strong></td>
        <td>Freelance Agent</td>
        <td>2024-02-17</td>
        <td><span class="badge badge-warn">Pending Review</span></td>
        <td>
           <div class="action-btns">
             <button class="btn btn-green btn-sm" onclick="openLoadingThen('Verification Approved')">Approve</button>
             <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="openLoadingThen('Verification Rejected')">Reject</button>
           </div>
        </td>
      </tr>
    \`;
  }, 300);
}

async function loadConversations() {
  const tbody = document.getElementById('conversations-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
  setTimeout(() => {
    tbody.innerHTML = \`
      <tr>
        <td>Buyer: Ali, Seller: Hassan</td>
        <td>Plot #45, DHA</td>
        <td>"Can we schedule a visit?"</td>
        <td>10 mins ago</td>
        <td><button class="btn btn-outline btn-sm" onclick="openLoadingThen('Conversation monitor opened')">Monitor</button></td>
      </tr>
    \`;
  }, 300);
}

async function loadNotifications() {
  const tbody = document.getElementById('notifications-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Loading...</td></tr>';
  setTimeout(() => {
    tbody.innerHTML = \`
      <tr>
        <td>System Maintenance</td>
        <td>All Users</td>
        <td>2024-02-10</td>
        <td><span class="badge badge-green">Sent</span></td>
      </tr>
    \`;
  }, 300);
}

function openUserHistory(userId) {
  document.getElementById('user-history-modal').classList.add('open');
  document.getElementById('user-saved-searches-body').innerHTML = \`
    <tr><td>DHA Lahore, 1-2 Cr, House</td><td>Email Weekly</td><td>2024-01-20</td></tr>
    <tr><td>Gulberg, Apartment</td><td>Push Immediate</td><td>2024-02-15</td></tr>
  \`;
  document.getElementById('user-activity-body').innerHTML = \`
    <tr><td>Login</td><td>IP: 192.168.1.1</td><td>2024-02-20 10:00 AM</td></tr>
    <tr><td>Inquiry</td><td>Sent inquiry for Prop #1</td><td>2024-02-19 02:30 PM</td></tr>
  \`;
}

function openAgentLeads(agentId) {
  document.getElementById('agent-leads-modal').classList.add('open');
  document.getElementById('agent-leads-body').innerHTML = \`
    <tr><td>Farhan Ali</td><td>Villa 5, Phase 6</td><td>Site Visit</td><td><span class="badge badge-green">Completed</span></td></tr>
    <tr><td>Kamran Shah</td><td>Apartment 12B</td><td>Call</td><td><span class="badge badge-warn">Follow Up</span></td></tr>
  \`;
}
`;
content = content.replace(jsInsertionPoint, newJS + '\n' + jsInsertionPoint);


// 6. Inject buttons into the table row strings for users and agents.
const editUserBtn = '<button class="btn btn-outline btn-sm" onclick="editUser(${u.id})">Edit</button>';
const historyBtn = '<button class="btn btn-outline btn-sm" onclick="openUserHistory(${u.id})">History</button>';
content = content.split(editUserBtn).join(editUserBtn + ' ' + historyBtn);

const viewAgentBtn = '<button class="btn btn-outline btn-sm" onclick="viewAgentDetails(${ag.id})">View</button>';
const leadsBtn = '<button class="btn btn-outline btn-sm" onclick="openAgentLeads(${ag.id})">Leads</button>';
content = content.split(viewAgentBtn).join(viewAgentBtn + ' ' + leadsBtn);


// 7. Inject into showPage function logic
const showPageInjectionStr = `if (pageId === 'dashboard')`;
const ourShowPageLogic = `
  if (pageId === 'buyer-requests') loadBuyerRequests();
  if (pageId === 'developer-projects') loadDeveloperProjects();
  if (pageId === 'verifications') loadVerifications();
  if (pageId === 'conversations') loadConversations();
  if (pageId === 'notifications') loadNotifications();
`;
content = content.replace(showPageInjectionStr, ourShowPageLogic + '\n    ' + showPageInjectionStr);


fs.writeFileSync(filePath, content, 'utf8');
console.log('Update applied successfully');

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts/og-landmark-web/public/portal/admin-dashboard.html');
let content = fs.readFileSync(filePath, 'utf8');

const jsInsertionPoint = `function init(){`;
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
if (!content.includes('function switchDevTab')) {
  content = content.replace(jsInsertionPoint, newJS + '\n' + jsInsertionPoint);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('JS methods injected successfully.');

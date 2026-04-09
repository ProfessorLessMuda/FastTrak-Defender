/* ── FastTrak Beater — SPA Application ────────────────────────────────── */

const API = '';
let state = {
  currentView: 'dashboard',
  selectedCaseId: '',
  cases: [],
  violations: [],
  defenses: [],
  letters: [],
  timeline: [],
  dashboard: null,
  legalRef: [],
  fileTree: []
};

// ── API Helpers ─────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  return res.json();
}

// ── Navigation ──────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  loadView(view);
}

// ── Case Selector ───────────────────────────────────────────────────────

const caseSelector = document.getElementById('caseSelector');
caseSelector.addEventListener('change', () => {
  state.selectedCaseId = caseSelector.value;
  loadView(state.currentView);
});

async function loadCases() {
  state.cases = await api('/api/cases');
  caseSelector.innerHTML = '<option value="">All Cases</option>';
  state.cases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    caseSelector.appendChild(opt);
  });
  if (state.cases.length === 1 && !state.selectedCaseId) {
    state.selectedCaseId = state.cases[0].id;
    caseSelector.value = state.selectedCaseId;
  }
}

// ── View Loaders ────────────────────────────────────────────────────────

async function loadView(view) {
  switch (view) {
    case 'dashboard': return renderDashboard();
    case 'case-detail': return renderCaseDetail();
    case 'violations': return renderViolations();
    case 'defenses': return renderDefenses();
    case 'letters': return renderLetters();
    case 'timeline': return renderTimeline();
    case 'legal-ref': return renderLegalRef();
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────

async function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  const data = await api('/api/dashboard');
  state.dashboard = data;

  let html = '<div class="section-header">Dashboard</div>';
  html += '<div class="section-sub">Overview of all active cases and upcoming deadlines</div>';

  // Deadline banner
  const urgent = data.deadlineAlerts.find(d => d.daysLeft <= 14);
  if (urgent) {
    const cls = urgent.daysLeft <= 5 ? '' : 'urgent';
    html += `<div class="deadline-banner ${cls}">
      <div class="countdown">${urgent.daysLeft}d</div>
      <div class="detail">
        <div class="detail-label">${urgent.label}</div>
        <div class="detail-sub">${urgent.description || ''} ${urgent.violationNumber ? '(' + urgent.violationNumber + ')' : ''}</div>
      </div>
    </div>`;
  }

  // Stats
  html += '<div class="stats-grid">';
  html += statCard('$' + (data.totalDue || 0).toFixed(2), 'Total Due', 'red');
  html += statCard(data.activeCases || 0, 'Active Cases', 'amber');
  html += statCard(data.totalViolations || 0, 'Violations', 'cyan');
  html += statCard(data.totalDefenses || 0, 'Defenses', 'mint');
  html += statCard(data.totalLetters || 0, 'Letters', 'violet');
  html += '</div>';

  // Deadline alerts
  if (data.deadlineAlerts.length > 0) {
    html += '<div class="card"><div class="card-title">Upcoming Deadlines</div>';
    data.deadlineAlerts.forEach(d => {
      const color = d.daysLeft <= 5 ? 'var(--red)' : d.daysLeft <= 14 ? 'var(--amber)' : 'var(--text-sub)';
      html += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-mono);font-weight:700;color:${color};min-width:40px">${d.daysLeft}d</span>
        <div><div style="font-weight:500">${d.label}</div><div style="font-size:12px;color:var(--text-muted)">${d.description || ''}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  // Next actions
  if (data.nextActions.length > 0) {
    html += '<div class="card"><div class="card-title">Next Actions</div>';
    data.nextActions.forEach(a => {
      html += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--amber)">&#9654;</span>
        <div><div style="font-weight:500">${a.action}</div><div style="font-size:12px;color:var(--text-muted)">${a.violationNumber || ''}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  // Cases list
  if (data.cases && data.cases.length > 0) {
    html += '<div class="card"><div class="card-title">Cases</div>';
    data.cases.forEach(c => {
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="selectCase('${c.id}')">
        <div><div style="font-weight:500">${esc(c.name)}</div><div style="font-size:12px;color:var(--text-muted)">${esc(c.owner || '')}</div></div>
        <span class="status-badge ${c.status}">${c.status}</span>
      </div>`;
    });
    html += '</div>';
  } else {
    html += `<div class="empty-state">
      <div class="icon">&#9878;</div>
      <div class="msg">No cases yet</div>
      <div class="sub">Click "Seed Test Case" to load your first violation</div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="seedData()">Seed Test Case</button>
    </div>`;
  }

  el.innerHTML = html;
}

function statCard(value, label, color) {
  return `<div class="stat-card ${color}"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function selectCase(id) {
  state.selectedCaseId = id;
  caseSelector.value = id;
  switchView('case-detail');
}

// ── Case Detail ─────────────────────────────────────────────────────────

async function renderCaseDetail() {
  const el = document.getElementById('view-case-detail');
  if (!state.selectedCaseId) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#128194;</div><div class="msg">Select a case</div><div class="sub">Choose a case from the dropdown above</div></div>';
    return;
  }

  const c = await api(`/api/cases/${state.selectedCaseId}`);
  let html = `<div class="section-header">${esc(c.name)}</div>`;
  html += `<div class="section-sub">Owner: ${esc(c.owner || 'N/A')} | Status: <span class="status-badge ${c.status}">${c.status}</span></div>`;

  if (c.notes) html += `<div class="card"><div class="card-title">Notes</div><div class="card-sub">${esc(c.notes)}</div></div>`;

  // Violations in this case
  if (c.violations && c.violations.length > 0) {
    html += '<div class="card"><div class="card-title">Violations</div>';
    c.violations.forEach(v => {
      html += `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600;font-family:var(--font-mono)">${esc(v.violationNumber)}</div>
            <div style="font-size:13px;color:var(--text-sub)">${esc(v.location || '')} | ${v.violationDate} ${v.violationTime || ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--font-display);font-weight:700;color:var(--amber)">$${(v.totalDue || 0).toFixed(2)}</div>
            <span class="status-badge ${v.status}">${v.status}</span>
          </div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
          Plate: ${v.plateState} ${v.plate} | Make: ${v.vehicleMake} | ${v.vehicleDescription || ''}
        </div>
        <div style="margin-top:4px;font-size:12px;color:var(--rose)">${esc(v.photoDescription || '')}</div>
        <div class="btn-group" style="margin-top:8px">
          <button class="btn btn-sm btn-primary" onclick="runDefenseAnalysis('${v.id}')">Analyze Defenses</button>
          <button class="btn btn-sm" onclick="viewViolationDetail('${v.id}')">Details</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // Timeline for this case
  if (c.timeline && c.timeline.length > 0) {
    html += '<div class="card"><div class="card-title">Timeline</div><div class="timeline-list">';
    c.timeline.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    c.timeline.forEach(t => {
      html += `<div class="timeline-item ${t.type || ''}">
        <div class="timeline-date">${t.date || 'TBD'}</div>
        <div class="timeline-label">${esc(t.label)}</div>
        <div class="timeline-desc">${esc(t.description || '')}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
}

// ── Violations ──────────────────────────────────────────────────────────

async function renderViolations() {
  const el = document.getElementById('view-violations');
  const url = state.selectedCaseId ? `/api/violations?caseId=${state.selectedCaseId}` : '/api/violations';
  state.violations = await api(url);

  let html = '<div class="section-header">Violations</div>';
  html += '<div class="section-sub">All toll violations' + (state.selectedCaseId ? ' for selected case' : ' across all cases') + '</div>';

  if (state.violations.length === 0) {
    html += '<div class="empty-state"><div class="icon">&#9888;</div><div class="msg">No violations</div></div>';
    el.innerHTML = html;
    return;
  }

  html += '<table class="data-table"><thead><tr><th>Violation #</th><th>Date</th><th>Location</th><th>Amount</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
  state.violations.forEach(v => {
    html += `<tr>
      <td style="font-family:var(--font-mono)">${esc(v.violationNumber)}</td>
      <td>${v.violationDate || ''} ${v.violationTime || ''}</td>
      <td>${esc(v.location || '')}</td>
      <td style="color:var(--amber);font-weight:600">$${(v.totalDue || 0).toFixed(2)}</td>
      <td>${v.dueDate || ''}</td>
      <td><span class="status-badge ${v.status}">${v.status}</span></td>
      <td><button class="btn btn-sm" onclick="viewViolationDetail('${v.id}')">View</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

async function viewViolationDetail(id) {
  const v = await api(`/api/violations/${id}`);
  // Show violations view without reloading the list (we'll replace the content)
  state.currentView = 'violations';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'violations'));
  document.querySelectorAll('.view').forEach(vi => vi.classList.remove('active'));
  document.getElementById('view-violations').classList.add('active');
  const el = document.getElementById('view-violations');

  let html = `<button class="btn btn-sm" onclick="renderViolations()" style="margin-bottom:16px">&larr; Back</button>`;
  html += `<div class="section-header">Violation ${esc(v.violationNumber)}</div>`;

  // Detail card
  html += '<div class="card">';
  html += detailRow('Violation #', v.violationNumber);
  html += detailRow('Date/Time', `${v.violationDate} ${v.violationTime || ''}`);
  html += detailRow('Location', v.location);
  html += detailRow('Lane', v.lane);
  html += detailRow('Plate', `${v.plateState} ${v.plate}`);
  html += detailRow('Vehicle', `${v.vehicleMake} — ${v.vehicleDescription || ''}`);
  html += detailRow('Toll', `$${(v.tollAmount || 0).toFixed(2)}`);
  html += detailRow('Penalty', `$${(v.penaltyAmount || 0).toFixed(2)}`);
  html += detailRow('Total Due', `$${(v.totalDue || 0).toFixed(2)}`);
  html += detailRow('After Deadline', `$${(v.escalatedAmount || 0).toFixed(2)}`);
  html += detailRow('Due Date', v.dueDate);
  html += detailRow('Notice Date', v.noticeDate);
  html += detailRow('Photo', v.photoDescription, 'var(--rose)');
  html += detailRow('Photo Quality', v.photoQuality);
  html += detailRow('Status', `<span class="status-badge ${v.status}">${v.status}</span>`);
  html += '</div>';

  // Deadlines
  if (v.deadlines && v.deadlines.length > 0) {
    html += '<div class="card"><div class="card-title">Deadlines</div>';
    v.deadlines.forEach(d => {
      const color = d.status === 'overdue' || d.status === 'expired' ? 'var(--red)' : d.status === 'urgent' ? 'var(--amber)' : 'var(--text-sub)';
      html += `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-mono);color:${color};min-width:50px">${d.daysLeft !== null ? d.daysLeft + 'd' : '—'}</span>
        <div><div style="font-weight:500">${d.label}</div><div style="font-size:12px;color:var(--text-muted)">${d.description || ''}</div>
        ${d.legalBasis ? `<span class="legal-deadline">${d.legalBasis}</span>` : ''}</div>
      </div>`;
    });
    html += '</div>';
  }

  // Linked defenses
  if (v.defenses && v.defenses.length > 0) {
    html += '<div class="card"><div class="card-title">Defenses</div>';
    v.defenses.forEach(d => { html += renderDefenseCardHtml(d); });
    html += '</div>';
  }

  // Actions
  html += '<div class="btn-group">';
  html += `<button class="btn btn-primary" onclick="runDefenseAnalysis('${v.id}')">Run Defense Analysis</button>`;
  html += `<button class="btn" onclick="generateLetter('${v.id}')">Generate Contest Letter</button>`;
  html += '</div>';

  el.innerHTML = html;
}

function detailRow(label, value, color) {
  return `<div style="display:flex;padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="min-width:140px;color:var(--text-muted);font-size:12px;text-transform:uppercase">${label}</span>
    <span style="font-size:14px;${color ? 'color:' + color : ''}">${value || '—'}</span>
  </div>`;
}

// ── Defenses ────────────────────────────────────────────────────────────

async function renderDefenses() {
  const el = document.getElementById('view-defenses');
  const url = state.selectedCaseId
    ? `/api/violations?caseId=${state.selectedCaseId}`
    : '/api/violations';
  const vols = await api(url);

  let html = '<div class="section-header">Defense Strategies</div>';
  html += '<div class="section-sub">Analyze violations and build your defense</div>';

  if (vols.length === 0) {
    html += '<div class="empty-state"><div class="icon">&#128737;</div><div class="msg">No violations to defend</div></div>';
    el.innerHTML = html;
    return;
  }

  // For each violation, show analysis
  for (const v of vols) {
    html += `<div class="card"><div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>${esc(v.violationNumber)} — ${esc(v.location || '')}</span>
      <button class="btn btn-sm btn-primary" onclick="runDefenseAnalysis('${v.id}')">Analyze</button>
    </div>`;

    const defs = await api(`/api/defenses?violationId=${v.id}`);
    if (defs.length > 0) {
      defs.forEach(d => {
        html += renderDefenseCardHtml(d);
      });
    } else {
      html += '<div style="padding:12px;color:var(--text-muted);font-size:13px">No defenses generated yet. Click "Analyze" to run the defense engine.</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

function renderDefenseCardHtml(d) {
  let html = `<div class="card defense-card ${d.strength}" style="margin:12px 0">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <span class="strength-badge ${d.strength}">${d.strength}</span>
        <span style="margin-left:8px;font-weight:600">${esc(d.title)}</span>
      </div>
      <button class="defense-toggle ${d.enabled !== false ? 'on' : ''}" onclick="toggleDefense('${d.id}', ${d.enabled === false})"></button>
    </div>
    <div style="margin-top:4px;font-size:12px;color:var(--cyan)">${esc(d.legalBasis || '')}</div>
    <ul class="arguments">`;
  (d.arguments || []).forEach(arg => { html += `<li>${esc(arg)}</li>`; });
  html += '</ul>';
  if (d.supportingFacts && d.supportingFacts.length > 0) {
    html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Supporting: ' + d.supportingFacts.map(esc).join('; ') + '</div>';
  }
  html += '</div>';
  return html;
}

async function runDefenseAnalysis(violationId) {
  const result = await api(`/api/defense-analysis/${violationId}/apply`, { method: 'POST' });
  // Always navigate to defenses view to show results
  switchView('defenses');
}

async function toggleDefense(defenseId, newState) {
  await api(`/api/defenses/${defenseId}`, { method: 'PUT', body: { enabled: newState } });
  loadView(state.currentView);
}

// ── Letters ─────────────────────────────────────────────────────────────

async function renderLetters() {
  const el = document.getElementById('view-letters');
  let html = '<div class="section-header">Dispute Letters</div>';
  html += '<div class="section-sub">Generate and manage contest letters, admin review requests, and court appeals</div>';

  // Generator controls
  const vols = state.selectedCaseId
    ? await api(`/api/violations?caseId=${state.selectedCaseId}`)
    : await api('/api/violations');

  if (vols.length > 0) {
    html += '<div class="card"><div class="card-title">Generate New Letter</div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">';
    html += `<div class="form-group"><label class="form-label">Violation</label>
      <select class="form-select" id="letterViolation">${vols.map(v => `<option value="${v.id}">${v.violationNumber}</option>`).join('')}</select></div>`;
    html += `<div class="form-group"><label class="form-label">Template</label>
      <select class="form-select" id="letterTemplate">
        <option value="contest">Contest Letter (Section A)</option>
        <option value="admin-review">Administrative Review Request</option>
        <option value="court-appeal">Superior Court Appeal</option>
      </select></div>`;
    html += `<div class="form-group"><label class="form-label">Tone</label>
      <select class="form-select" id="letterTone">
        <option value="formal">Formal</option>
        <option value="firm">Firm</option>
        <option value="aggressive">Aggressive</option>
      </select></div>`;
    html += '</div>';
    html += `<div class="form-group"><label class="form-label">Your Name</label><input class="form-input" id="letterName" placeholder="Your full name"></div>`;
    html += `<div class="form-group"><label class="form-label">Your Address</label><input class="form-input" id="letterAddress" placeholder="Your mailing address"></div>`;
    html += `<div class="btn-group"><button class="btn btn-primary" onclick="doGenerateLetter()">Generate Letter</button></div>`;
    html += '</div>';
  }

  // Existing letters
  const allLetters = await api('/api/letters');
  if (allLetters.length > 0) {
    html += '<div class="card"><div class="card-title">Generated Letters</div>';
    allLetters.forEach(l => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewLetter('${l.id}')">
        <div>
          <div style="font-weight:500">${templateLabel(l.template)} — ${toneLabel(l.tone)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${new Date(l.createdAt).toLocaleString()}</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteLetter('${l.id}')">Delete</button>
      </div>`;
    });
    html += '</div>';
  }

  // Letter preview area
  html += '<div id="letterPreview"></div>';

  el.innerHTML = html;
}

function templateLabel(t) {
  const map = { contest: 'Contest Letter', 'admin-review': 'Admin Review Request', 'court-appeal': 'Court Appeal' };
  return map[t] || t;
}
function toneLabel(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

async function doGenerateLetter() {
  const body = {
    violationId: document.getElementById('letterViolation').value,
    template: document.getElementById('letterTemplate').value,
    tone: document.getElementById('letterTone').value,
    senderName: document.getElementById('letterName').value,
    senderAddress: document.getElementById('letterAddress').value,
    includeStatistics: true
  };
  const letter = await api('/api/generate-letter', { method: 'POST', body });
  viewLetter(letter.id);
  renderLetters();
}

async function viewLetter(id) {
  const letter = await api(`/api/letters/${id}`);
  const preview = document.getElementById('letterPreview') || document.getElementById('view-letters');
  let html = `<div class="card" style="margin-top:16px">
    <div class="card-title" style="display:flex;justify-content:space-between">
      <span>${templateLabel(letter.template)}</span>
      <div class="btn-group">
        <button class="btn btn-sm" onclick="copyLetter()">Copy</button>
        <button class="btn btn-sm" onclick="printLetter()">Print</button>
      </div>
    </div>
    <div class="letter-preview" id="letterText">${esc(letter.text)}</div>
  </div>`;
  if (document.getElementById('letterPreview')) {
    document.getElementById('letterPreview').innerHTML = html;
  }
}

function copyLetter() {
  const text = document.getElementById('letterText')?.textContent;
  if (text) navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
}

function printLetter() {
  const text = document.getElementById('letterText')?.textContent;
  if (!text) return;
  const win = window.open('', '_blank');
  win.document.write(`<pre style="font-family:monospace;font-size:13px;line-height:1.7;padding:40px;max-width:700px">${esc(text)}</pre>`);
  win.print();
}

async function deleteLetter(id) {
  if (!confirm('Delete this letter?')) return;
  await api(`/api/letters/${id}`, { method: 'DELETE' });
  renderLetters();
}

async function generateLetter(violationId) {
  state.selectedCaseId = state.selectedCaseId || '';
  switchView('letters');
  setTimeout(() => {
    const sel = document.getElementById('letterViolation');
    if (sel) sel.value = violationId;
  }, 300);
}

// ── Timeline ────────────────────────────────────────────────────────────

async function renderTimeline() {
  const el = document.getElementById('view-timeline');
  const url = state.selectedCaseId ? `/api/timeline?caseId=${state.selectedCaseId}` : '/api/timeline';
  state.timeline = await api(url);

  let html = '<div class="section-header">Timeline</div>';
  html += '<div class="section-sub">Chronological view of all case events and deadlines</div>';

  if (state.timeline.length === 0) {
    html += '<div class="empty-state"><div class="icon">&#128197;</div><div class="msg">No events yet</div></div>';
    el.innerHTML = html;
    return;
  }

  html += '<div class="timeline-list">';
  state.timeline.forEach(t => {
    html += `<div class="timeline-item ${t.type || ''}">
      <div class="timeline-date">${t.date || 'TBD'}</div>
      <div class="timeline-label">${esc(t.label)}</div>
      <div class="timeline-desc">${esc(t.description || '')}</div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── Legal Reference ─────────────────────────────────────────────────────

async function renderLegalRef() {
  const el = document.getElementById('view-legal-ref');
  if (state.legalRef.length === 0) state.legalRef = await api('/api/legal-reference');

  let html = '<div class="section-header">Legal Reference</div>';
  html += '<div class="section-sub">California Vehicle Code sections governing toll evasion violations</div>';

  state.legalRef.forEach(s => {
    html += `<details class="legal-section">
      <summary>${esc(s.section)} — ${esc(s.title)}</summary>
      <div class="legal-body">
        <p>${esc(s.summary)}</p>
        <ul>${(s.keyPoints || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        ${s.deadline ? `<div class="legal-deadline">${esc(s.deadline)}</div>` : ''}
      </div>
    </details>`;
  });

  el.innerHTML = html;
}

// ── File Tree ───────────────────────────────────────────────────────────

async function loadFileTree() {
  state.fileTree = await api('/api/files');
  renderFileTree();
}

function renderFileTree() {
  const el = document.getElementById('fileTree');
  el.innerHTML = renderTreeNodes(state.fileTree);
}

function renderTreeNodes(nodes) {
  let html = '';
  nodes.forEach(n => {
    if (n.type === 'directory') {
      html += `<div class="dir" onclick="this.parentElement.classList.toggle('collapsed')">
        <span class="dir-icon">&#128193;</span> ${esc(n.name)}
      </div>`;
      if (n.children && n.children.length > 0) {
        html += `<div class="children">${renderTreeNodes(n.children)}</div>`;
      }
    } else {
      const icon = n.ext === '.pdf' ? '&#128196;' : '&#128195;';
      html += `<div class="file" onclick="openFile('${esc(n.path)}')">${icon} ${esc(n.name)}</div>`;
    }
  });
  return html;
}

function openFile(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-pdf').classList.add('active');
    document.getElementById('pdfFrame').src = `/api/serve?path=${encodeURIComponent(filePath)}`;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  } else {
    window.open(`/api/serve?path=${encodeURIComponent(filePath)}`, '_blank');
  }
}

// ── Seed ────────────────────────────────────────────────────────────────

async function seedData() {
  const result = await api('/api/seed', { method: 'POST' });
  alert(result.message);
  await loadCases();
  await loadFileTree();
  renderDashboard();
}

// ── Utilities ───────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ── Init ────────────────────────────────────────────────────────────────

(async function init() {
  await loadCases();
  await loadFileTree();
  renderDashboard();
})();

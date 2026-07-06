const API = 'http://localhost:8080/api';
let allDevs = [], currentDev = null, currentDeployments = [], deployFilter = 'all';

const AVATARS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#f43f5e,#ec4899)',
  'linear-gradient(135deg,#8b5cf6,#06b6d4)',
  'linear-gradient(135deg,#f97316,#f59e0b)',
  'linear-gradient(135deg,#06b6d4,#6366f1)',
  'linear-gradient(135deg,#84cc16,#10b981)',
];

const TEAM_COLORS = { 'Payments API':'#6366f1','Checkout Web':'#f59e0b','Mobile Growth':'#10b981' };

const ini = n => n.split(' ').map(w=>w[0]).join('').toUpperCase();
const av = i => AVATARS[i % AVATARS.length];
const f1 = v => v != null ? parseFloat(v).toFixed(1) : '—';

function badgeClass(s) {
  const l = (s||'').toLowerCase();
  if (l === 'healthy') return 'bh';
  if (l === 'moderate') return 'bm';
  if (l.includes('opportunity')) return 'br';
  return 'bn';
}

function pillClass(s) {
  const l = (s||'').toLowerCase();
  if (l === 'healthy') return 'healthy';
  if (l === 'moderate') return 'moderate';
  return 'risk';
}

function trendEl(dir) {
  if (dir === 'improving') return '<span class="mc-trend up">↑ Improving</span>';
  if (dir === 'degrading') return '<span class="mc-trend down">↓ Degrading</span>';
  return '<span class="mc-trend stable">→ Stable</span>';
}

// ── Init ──
async function init() {
  try {
    const r = await fetch(`${API}/developers`);
    const d = await r.json();
    allDevs = d.developers || [];
    renderDevList(allDevs);
  } catch(e) {
    console.warn('Backend unreachable:', e);
    document.getElementById('devList').innerHTML = '<p style="font-size:11px;color:#9c9890;padding:8px">Backend offline. Start the Go server on :8080</p>';
  }
}

function renderDevList(devs) {
  const el = document.getElementById('devList');
  if (!devs.length) { el.innerHTML = '<p style="font-size:11px;color:#9c9890;padding:8px">No developers found.</p>'; return; }
  el.innerHTML = '';
  devs.forEach(dev => {
    const gi = allDevs.findIndex(d => d.developer_id === dev.developer_id);
    const idx = gi >= 0 ? gi : 0;
    const color = TEAM_COLORS[dev.team_name] || '#6366f1';
    const item = document.createElement('div');
    item.className = 'dev-item';
    item.dataset.id = dev.developer_id;
    item.innerHTML = `
      <div class="dev-av" style="background:${av(idx)}">${ini(dev.developer_name)}</div>
      <div>
        <div class="dev-iname">${dev.developer_name}</div>
        <div class="dev-imeta" style="color:${color}">${dev.level} · ${dev.team_name}</div>
      </div>`;
    item.addEventListener('click', () => selectDev(dev.developer_id, idx));
    el.appendChild(item);
  });
}

// Team filter
document.querySelectorAll('.tchip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tchip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.team;
    renderDevList(t === 'all' ? allDevs : allDevs.filter(d => d.team_name === t));
  });
});

// ── Select Dev ──
async function selectDev(devId, idx) {
  currentDev = { id: devId, idx };
  document.querySelectorAll('.dev-item').forEach(el => el.classList.toggle('active', el.dataset.id === devId));
  
  // Activate dashboard tab
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'dashboard');
  });
  
  document.getElementById('welcomeState').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  if (document.getElementById('teamView')) document.getElementById('teamView').style.display = 'none';
  document.getElementById('loader').style.display = 'flex';
  try {
    const r = await fetch(`${API}/dashboard/${devId}`);
    const data = await r.json();
    renderDashboard(data, idx);
  } catch(e) {
    console.error(e);
    document.getElementById('loader').style.display = 'none';
    document.getElementById('welcomeState').style.display = 'flex';
    alert('Could not reach backend at http://localhost:8080. Make sure the Go server is running.');
  }
}

// ── Render Dashboard ──
function renderDashboard(data, avatarIdx) {
  const { developer: dev, metrics, healthScore, crossMetricAnalysis, coaching, charts } = data;

  // Dev strip
  const dsAv = document.getElementById('dsAvatar');
  dsAv.style.background = av(avatarIdx);
  dsAv.textContent = ini(dev.developer_name);
  document.getElementById('dsName').textContent = dev.developer_name;
  document.getElementById('dsRole').textContent = dev.level;
  document.getElementById('dsTeam').textContent = dev.team_name;
  document.getElementById('dsId').textContent = dev.developer_id;

  // Score
  const score = healthScore.score || 0;
  document.getElementById('scoreNum').textContent = score;
  const arc = document.getElementById('scoreArc');
  arc.style.strokeDashoffset = 188.5 - (score / 100) * 188.5;
  const pill = document.getElementById('scorePill');
  pill.textContent = healthScore.status;
  pill.className = 'score-pill ' + pillClass(healthScore.status);

  // Health bar
  document.getElementById('hbText').textContent = healthScore.summary;
  const hbTags = document.getElementById('hbTags');
  hbTags.innerHTML = '';
  if (healthScore.strongestDriver) hbTags.innerHTML += `<span class="hb-tag">💪 ${healthScore.strongestDriver}</span>`;
  if (healthScore.weakestContributor) hbTags.innerHTML += `<span class="hb-tag">⚠️ ${healthScore.weakestContributor}</span>`;

  // Columns
  buildCycleCol(metrics, charts);
  buildDeployCol(metrics, charts);
  buildLeadCol(metrics, charts);
  buildPRCol(metrics, charts);

  // Coaching
  buildCoaching(coaching);
  buildCross(crossMetricAnalysis);

  // Timeline
  buildTimeline(charts);

  document.getElementById('loader').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
}

// ── Column builders ──
function summaryCard(label, val, status, trendDir, explanation, accentClass) {
  const bc = badgeClass(status);
  return `
    <div class="mcard summary">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:10px;font-weight:600;color:#9c9890;text-transform:uppercase;letter-spacing:0.6px">${label}</span>
        <span class="ch-badge ${bc}" style="font-size:9px">${status||'—'}</span>
      </div>
      <div class="mc-val" style="font-size:24px;color:#1a1814">${val}</div>
      ${trendEl(trendDir)}
      <div class="mc-exp">${explanation||''}</div>
    </div>`;
}

function sprintCard(date, valHtml, label, typeClass, barPct, barColor, delay) {
  return `
    <div class="mcard" style="animation-delay:${delay}s">
      <div class="mc-top">
        <span class="mc-date">${date}</span>
        <span class="mc-type ${typeClass}">${label.toLowerCase()}</span>
      </div>
      ${valHtml}
      <div class="mc-bar"><div class="mc-bar-fill" style="background:${barColor}" data-pct="${barPct}"></div></div>
    </div>`;
}

function buildCycleCol(metrics, charts) {
  const m = metrics.cycleTime || {};
  const pts = charts?.cycleTimeTrend || [];
  document.getElementById('ctCount').textContent = pts.length + ' sprints';
  document.getElementById('ctBadge').className = 'ch-badge ' + badgeClass(m.status);
  document.getElementById('ctBadge').textContent = m.display || '—';
  let html = summaryCard('Avg Cycle Time', m.display||'—', m.status, m.trendDirection, m.explanation);
  pts.forEach((pt,i) => {
    html += sprintCard(pt.date, `<div class="mc-val" style="color:#6366f1">${f1(pt.value)}d</div><div class="mc-label">Cycle Time</div>`, 'cycle', 'mt-cycle', Math.min(100,(pt.value/10)*100), 'linear-gradient(90deg,#6366f1,#8b5cf6)', i*0.06);
  });
  const el = document.getElementById('cardsCycle');
  el.innerHTML = html;
  animateBars(el);
}

function buildDeployCol(metrics, charts) {
  const m = metrics.deploymentFreq || {};
  const pts = charts?.deploymentTrend || [];
  document.getElementById('depCount').textContent = pts.length + ' sprints';
  document.getElementById('depBadge').className = 'ch-badge ' + badgeClass(m.status);
  document.getElementById('depBadge').textContent = m.display || '—';
  let html = summaryCard('Deploy Frequency', m.display||'—', m.status, m.trendDirection, m.explanation);
  pts.forEach((pt,i) => {
    html += sprintCard(pt.date, `<div class="mc-val" style="color:#f59e0b">${pt.value}</div><div class="mc-label">Deployments</div>`, 'deploy', 'mt-deploy', Math.min(100,(pt.value/5)*100), 'linear-gradient(90deg,#f59e0b,#ef4444)', i*0.06);
  });
  const el = document.getElementById('cardsDeploy');
  el.innerHTML = html;
  animateBars(el);
}

function buildLeadCol(metrics, charts) {
  const m = metrics.leadTime || {};
  const pts = charts?.prTrend || [];
  document.getElementById('ltCount').textContent = pts.length + ' sprints';
  document.getElementById('ltBadge').className = 'ch-badge ' + badgeClass(m.status);
  document.getElementById('ltBadge').textContent = m.display || '—';
  let html = summaryCard('Avg Lead Time', m.display||'—', m.status, m.trendDirection, m.explanation);
  pts.forEach((pt,i) => {
    html += sprintCard(pt.date, `<div class="mc-val" style="color:#10b981">${f1(pt.value)}d</div><div class="mc-label">Lead Time</div>`, 'lead', 'mt-lead', Math.min(100,(pt.value/10)*100), 'linear-gradient(90deg,#10b981,#06b6d4)', i*0.06);
  });
  const el = document.getElementById('cardsLead');
  el.innerHTML = html;
  animateBars(el);
}

function buildPRCol(metrics, charts) {
  const mPR = metrics.prThroughput || {};
  const mBug = metrics.bugRate || {};
  const pts = charts?.bugTrend || [];
  document.getElementById('prCount').textContent = pts.length + ' sprints';
  document.getElementById('prBadge').className = 'ch-badge ' + badgeClass(mPR.status);
  document.getElementById('prBadge').textContent = (mPR.display||'—') + ' · ' + (mBug.display||'—');
  let html = summaryCard('PR Throughput', mPR.display||'—', mPR.status, mPR.trendDirection, mPR.explanation);
  html += summaryCard('Bug Escape Rate', mBug.display||'—', mBug.status, mBug.trendDirection, mBug.explanation);
  pts.forEach((pt,i) => {
    html += sprintCard(pt.date, `<div class="mc-val" style="color:#f43f5e">${pt.value}</div><div class="mc-label">Escaped Bugs</div>`, 'bug', 'mt-bug', Math.min(100,(pt.value/5)*100), 'linear-gradient(90deg,#f43f5e,#ec4899)', i*0.06);
  });
  const el = document.getElementById('cardsPR');
  el.innerHTML = html;
  animateBars(el);
}

function animateBars(container) {
  setTimeout(() => container.querySelectorAll('.mc-bar-fill').forEach(el => el.style.width = el.dataset.pct + '%'), 150);
}

// ── Coaching ──
function buildCoaching(coaching) {
  const el = document.getElementById('coachBody');
  if (!coaching) { el.innerHTML = '<p style="font-size:12px;color:#9c9890">Coaching unavailable.</p>'; return; }

  let html = coaching.isFallback ? '<div class="fallback-note">⚡ Baseline coaching — add GEMINI_API_KEY for AI-powered insights</div>' : '';

  const groups = [
    { key:'strengths', color:'#10b981', label:'✅ Strengths' },
    { key:'opportunityArea', color:'#f59e0b', label:'⚡ Opportunities' },
    { key:'actionPlan', color:'#6366f1', label:'🎯 Action Plan' },
  ];
  groups.forEach(g => {
    const items = coaching[g.key] || [];
    if (!items.length) return;
    html += `<div class="coach-group"><div class="coach-group-title" style="color:${g.color}">${g.label}</div>`;
    items.forEach(t => {
      html += `<div class="coach-item"><div class="ci-dot" style="background:${g.color}"></div><span>${t}</span></div>`;
    });
    html += '</div>';
  });
  el.innerHTML = html || '<p style="font-size:12px;color:#9c9890">No coaching data.</p>';
}

// ── Cross-metric ──
function buildCross(analysis) {
  const el = document.getElementById('crossBody');
  if (!analysis?.length) { el.innerHTML = '<p style="font-size:12px;color:#9c9890">No insights available.</p>'; return; }
  el.innerHTML = analysis.map((t,i) => `
    <div class="cross-item">
      <span class="cross-num">${String(i+1).padStart(2,'0')}</span>
      <span>${t}</span>
    </div>`).join('');
}

// ── Timeline ──
function buildTimeline(charts) {
  currentDeployments = (charts?.deploymentTrend||[]).map((pt,i) => ({
    id: `DEP-${String(i+1).padStart(3,'0')}`,
    pr: `PR-${String(i+1).padStart(3,'0')}`,
    date: pt.date, status: 'success', env: 'prod',
    type: i % 3 === 0 ? 'hotfix' : 'standard',
    lead: f1(charts.prTrend?.[i]?.value || 0),
  }));
  renderTimeline(deployFilter);
}

function renderTimeline(filter) {
  deployFilter = filter;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.f === filter));
  const items = filter === 'all' ? currentDeployments : currentDeployments.filter(d => d.type === filter);
  const el = document.getElementById('timelineList');
  if (!items.length) { el.innerHTML = '<p style="font-size:12px;color:#9c9890;padding:8px">No deployments.</p>'; return; }
  el.innerHTML = items.map(d => `
    <div class="tl-item">
      <div class="tl-dot ${d.status}"></div>
      <div class="tl-id">${d.id}</div>
      <div class="tl-info">
        <div class="tl-pr">${d.pr}</div>
        <div class="tl-date">${d.date}</div>
      </div>
      <div class="tl-tags">
        <span class="tl-tag tl-env">${d.env}</span>
        <span class="tl-tag tl-${d.type}">${d.type}</span>
      </div>
      <div class="tl-lead">${d.lead}d</div>
    </div>`).join('');
}

document.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => renderTimeline(b.dataset.f)));

// Refresh
document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spin');
  if (currentDev) await selectDev(currentDev.id, currentDev.idx);
  else await init();
  btn.classList.remove('spin');
});

init();

// Nav Tabs
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('welcomeState').style.display = 'none';
    if (document.getElementById('teamView')) document.getElementById('teamView').style.display = 'none';
    
    const tab = btn.dataset.tab;
    if (tab === 'dashboard') {
      if (currentDev) document.getElementById('dashboard').style.display = 'flex';
      else document.getElementById('welcomeState').style.display = 'flex';
    } else if (tab === 'team') {
      if (document.getElementById('teamView')) document.getElementById('teamView').style.display = 'flex';
    }
  });
});

// ── AI Assistant Chat Orchestration ──
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatWindow = document.getElementById('chatWindow');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const chatChips = document.getElementById('chatChips');

// Toggle chat
chatToggleBtn.addEventListener('click', () => {
  const isHidden = chatWindow.style.display === 'none';
  chatWindow.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    chatInput.focus();
    // Hide the new message pulse indicator when opened
    const pulse = chatToggleBtn.querySelector('.chat-pulse');
    if (pulse) pulse.style.display = 'none';
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

chatCloseBtn.addEventListener('click', () => {
  chatWindow.style.display = 'none';
});

// Append message
function appendChatMessage(sender, text, isMarkdown = false) {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${sender}`;
  
  if (isMarkdown && sender === 'assistant') {
    msg.innerHTML = parseChatMarkdown(text);
  } else {
    // Plain text escaping
    const p = document.createElement('p');
    p.textContent = text;
    msg.appendChild(p);
  }
  
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Simple Markdown parser for clean bubble visual styling
function parseChatMarkdown(text) {
  if (!text) return '';
  let html = text;
  
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italics *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Lists
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');
  
  // Split into paragraphs unless it is a list
  const blocks = html.split('\n\n');
  return blocks.map(block => {
    const trimmed = block.trim();
    if (trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>') || trimmed.startsWith('<li>')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).join('');
}

// Show/hide typing loader
let loadingEl = null;
function showChatLoading() {
  if (loadingEl) return;
  loadingEl = document.createElement('div');
  loadingEl.className = 'chat-msg assistant loading';
  loadingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  chatMessages.appendChild(loadingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideChatLoading() {
  if (loadingEl && loadingEl.parentNode) {
    loadingEl.parentNode.removeChild(loadingEl);
  }
  loadingEl = null;
}

// Send request
async function handleChatSubmit(text) {
  if (!text || text.trim() === '') return;
  
  // Add user bubble
  appendChatMessage('user', text);
  showChatLoading();
  
  try {
    const activeDevId = currentDev ? currentDev.id : '';
    const response = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        developerId: activeDevId
      })
    });
    
    const data = await response.json();
    hideChatLoading();
    
    if (data.isFallback) {
      appendChatMessage('assistant', data.reply + '\n\n*(Baseline answer — start Gemini for personalized insights)*', true);
    } else {
      appendChatMessage('assistant', data.reply, true);
    }
  } catch(e) {
    console.error(e);
    hideChatLoading();
    appendChatMessage('assistant', '⚠️ Failed to connect to the assistant backend. Please verify that the Go server is running.');
  }
}

// Form submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value;
  chatInput.value = '';
  handleChatSubmit(text);
});

// Quick suggestion chips
chatChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chat-chip');
  if (!chip) return;
  const q = chip.dataset.q;
  handleChatSubmit(q);
});


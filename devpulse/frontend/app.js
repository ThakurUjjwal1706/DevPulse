const API = 'http://localhost:8080/api';
let allDevelopers = [];
let currentDev = null;
let currentDeployments = [];
let deployFilter = 'all';

const avatarGradients = [
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#06b6d4,#0891b2)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#f87171,#dc2626)',
  'linear-gradient(135deg,#818cf8,#4f46e5)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
  'linear-gradient(135deg,#e879f9,#c026d3)',
];

const teamColors = {
  'Payments API': '#a78bfa',
  'Checkout Web': '#06b6d4',
  'Mobile Growth': '#34d399',
};

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function avatarGrad(idx) {
  return avatarGradients[idx % avatarGradients.length];
}

function fmt(v, unit = '') {
  return v != null ? `${parseFloat(v).toFixed(1)}${unit}` : '—';
}

function statusClass(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s === 'healthy') return 'healthy';
  if (s === 'moderate') return 'moderate';
  return 'risk';
}

function badgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'healthy') return 'badge-healthy';
  if (s === 'moderate') return 'badge-moderate';
  return 'badge-risk';
}

function trendIcon(dir) {
  if (dir === 'improving') return `<span class="trend-up">↑ Improving</span>`;
  if (dir === 'degrading') return `<span class="trend-down">↓ Degrading</span>`;
  return `<span class="trend-stable">→ Stable</span>`;
}

function typeClass(type) {
  const t = (type || '').toLowerCase();
  if (t === 'story') return 'type-story';
  if (t === 'task') return 'type-task';
  if (t === 'improvement') return 'type-improvement';
  return 'type-bug';
}

// ── Load developers list ──
async function loadDevelopers() {
  try {
    const res = await fetch(`${API}/developers`);
    const data = await res.json();
    allDevelopers = data.developers || [];
    renderDevList(allDevelopers);
  } catch (e) {
    console.error('Failed to load developers:', e);
  }
}

function renderDevList(devs) {
  const list = document.getElementById('devList');
  list.innerHTML = '';
  devs.forEach((dev) => {
    const globalIdx = allDevelopers.findIndex(d => d.developer_id === dev.developer_id);
    const idx = globalIdx >= 0 ? globalIdx : 0;
    const item = document.createElement('div');
    item.className = 'dev-item';
    item.dataset.id = dev.developer_id;
    const color = teamColors[dev.team_name] || '#a78bfa';
    item.innerHTML = `
      <div class="dev-mini-avatar" style="background:${avatarGrad(idx)}">${initials(dev.developer_name)}</div>
      <div class="dev-item-info">
        <div class="dev-item-name">${dev.developer_name}</div>
        <div class="dev-item-role" style="color:${color}">${dev.level} · ${dev.team_name}</div>
      </div>
    `;
    item.addEventListener('click', () => selectDev(dev.developer_id, idx));
    list.appendChild(item);
  });
}

// ── Team filter ──
document.querySelectorAll('.team-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.team-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const team = btn.dataset.team;
    const filtered = team === 'all' ? allDevelopers : allDevelopers.filter(d => d.team_name === team);
    renderDevList(filtered);
  });
});

// ── Select Developer ──
async function selectDev(devId, idx) {
  currentDev = { id: devId, idx: idx || 0 };

  // highlight sidebar
  document.querySelectorAll('.dev-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === devId);
  });

  // show loading
  document.getElementById('welcomeState').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loadingOverlay').style.display = 'flex';

  try {
    const res = await fetch(`${API}/dashboard/${devId}`);
    const data = await res.json();
    renderDashboard(data, idx || 0);
  } catch (e) {
    console.error('Dashboard fetch failed:', e);
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('welcomeState').style.display = 'flex';
    alert('Could not connect to backend. Make sure the Go server is running on port 8080.');
  }
}

// ── Render full dashboard ──
function renderDashboard(data, avatarIdx) {
  const { developer, metrics, healthScore, crossMetricAnalysis, coaching, charts } = data;

  // Header
  const av = document.getElementById('devAvatarLarge');
  av.style.background = avatarGrad(avatarIdx);
  av.textContent = initials(developer.developer_name);

  document.getElementById('devHeaderName').textContent = developer.developer_name;
  document.getElementById('devRole').textContent = developer.level;
  document.getElementById('devTeam').textContent = developer.team_name;
  document.getElementById('devId').textContent = developer.developer_id;

  // Score ring
  const score = healthScore.score || 0;
  document.getElementById('scoreNum').textContent = score;
  const arc = document.getElementById('scoreArc');
  const circ = 213.6;
  const offset = circ - (score / 100) * circ;
  setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);
  arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)';

  const statusEl = document.getElementById('scoreStatus');
  statusEl.textContent = healthScore.status;
  statusEl.className = 'score-status ' + statusClass(healthScore.status);

  // Health banner
  document.getElementById('healthSummary').textContent = healthScore.summary;
  const tagsEl = document.getElementById('healthTags');
  tagsEl.innerHTML = '';
  if (healthScore.strongestDriver) {
    tagsEl.innerHTML += `<span class="hb-tag">💪 ${healthScore.strongestDriver}</span>`;
  }
  if (healthScore.weakestContributor) {
    tagsEl.innerHTML += `<span class="hb-tag">⚠️ ${healthScore.weakestContributor}</span>`;
  }

  // Columns
  renderCycleTimeColumn(metrics, charts);
  renderDeploymentsColumn(metrics, charts);
  renderLeadTimeColumn(metrics, charts);
  renderStoryPointsColumn(metrics, charts);

  // Coaching
  renderCoaching(coaching);

  // Cross-metric
  renderCrossMetric(crossMetricAnalysis);

  // Timeline - we need deployments from raw data embedded in charts
  renderTimeline(charts, developer.developer_id);

  // Show
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
}

// ── Column: Cycle Time ──
function renderCycleTimeColumn(metrics, charts) {
  const m = metrics.cycleTime || {};
  const pts = charts?.cycleTimeTrend || [];
  document.getElementById('ct-count').textContent = pts.length + ' sprints';
  const badge = document.getElementById('ct-badge');
  badge.textContent = m.display || '—';
  badge.className = 'col-badge ' + badgeClass(m.status);

  const container = document.getElementById('col-cycletime');
  container.innerHTML = '';
  container.appendChild(makeSummaryCard('Avg Cycle Time', m.display || '—', m.status, m.trendDirection, m.explanation, m.businessImpact));

  pts.forEach((pt, i) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.style.animationDelay = `${i * 0.07}s`;
    const pct = Math.min(100, (pt.value / 10) * 100);
    card.innerHTML = `
      <div class="card-top">
        <span class="card-id">${pt.date}</span>
        <span class="card-type type-task">cycle</span>
      </div>
      <div class="card-value" style="color:#a78bfa">${fmt(pt.value,'d')}</div>
      <div class="card-label">Cycle Time</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:0%;background:linear-gradient(90deg,#a78bfa,#7c3aed)" data-pct="${pct}"></div></div>
    `;
    container.appendChild(card);
  });
  animateBars(container);
}

// ── Column: Deployments ──
function renderDeploymentsColumn(metrics, charts) {
  const m = metrics.deploymentFreq || {};
  const pts = charts?.deploymentTrend || [];
  document.getElementById('dep-count').textContent = pts.length + ' sprints';
  const badge = document.getElementById('dep-badge');
  badge.textContent = m.display || '—';
  badge.className = 'col-badge ' + badgeClass(m.status);

  const container = document.getElementById('col-deployments');
  container.innerHTML = '';
  container.appendChild(makeSummaryCard('Deploy Frequency', m.display || '—', m.status, m.trendDirection, m.explanation, m.businessImpact));

  pts.forEach((pt, i) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.style.animationDelay = `${i * 0.07}s`;
    const pct = Math.min(100, (pt.value / 5) * 100);
    card.innerHTML = `
      <div class="card-top">
        <span class="card-id">${pt.date}</span>
        <span class="card-type type-story">deploy</span>
      </div>
      <div class="card-value" style="color:#06b6d4">${pt.value}</div>
      <div class="card-label">Deployments</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:0%;background:linear-gradient(90deg,#06b6d4,#0891b2)" data-pct="${pct}"></div></div>
    `;
    container.appendChild(card);
  });
  animateBars(container);
}

// ── Column: Lead Time ──
function renderLeadTimeColumn(metrics, charts) {
  const m = metrics.leadTime || {};
  const pts = charts?.prTrend || [];
  document.getElementById('lt-count').textContent = pts.length + ' sprints';
  const badge = document.getElementById('lt-badge');
  badge.textContent = m.display || '—';
  badge.className = 'col-badge ' + badgeClass(m.status);

  const container = document.getElementById('col-leadtime');
  container.innerHTML = '';
  container.appendChild(makeSummaryCard('Avg Lead Time', m.display || '—', m.status, m.trendDirection, m.explanation, m.businessImpact));

  pts.forEach((pt, i) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.style.animationDelay = `${i * 0.07}s`;
    const pct = Math.min(100, (pt.value / 10) * 100);
    card.innerHTML = `
      <div class="card-top">
        <span class="card-id">${pt.date}</span>
        <span class="card-type type-improvement">PR</span>
      </div>
      <div class="card-value" style="color:#34d399">${fmt(pt.value,'d')}</div>
      <div class="card-label">Lead Time</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:0%;background:linear-gradient(90deg,#34d399,#059669)" data-pct="${pct}"></div></div>
    `;
    container.appendChild(card);
  });
  animateBars(container);
}

// ── Column: PR Throughput / Quality ──
function renderStoryPointsColumn(metrics, charts) {
  const m = metrics.prThroughput || {};
  const bugM = metrics.bugRate || {};
  const pts = charts?.bugTrend || [];
  document.getElementById('sp-count').textContent = pts.length + ' sprints';
  const badge = document.getElementById('sp-badge');
  // Show both PR throughput + bug rate
  badge.textContent = (m.display || '—') + ' · ' + (bugM.display || '—');
  badge.className = 'col-badge ' + badgeClass(m.status);

  const container = document.getElementById('col-storypoints');
  container.innerHTML = '';

  // Two summary mini-cards stacked
  container.appendChild(makeSummaryCard('PR Throughput', m.display || '—', m.status, m.trendDirection, m.explanation, m.businessImpact));
  container.appendChild(makeSummaryCard('Bug Escape Rate', bugM.display || '—', bugM.status, bugM.trendDirection, bugM.explanation, bugM.businessImpact, '#f87171'));

  pts.forEach((pt, i) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.style.animationDelay = `${i * 0.07}s`;
    const pct = Math.min(100, (pt.value / 5) * 100);
    card.innerHTML = `
      <div class="card-top">
        <span class="card-id">${pt.date}</span>
        <span class="card-type type-bug">bugs</span>
      </div>
      <div class="card-value" style="color:#fbbf24">${pt.value}</div>
      <div class="card-label">Escaped Bugs</div>
      <div class="card-bar"><div class="card-bar-fill" style="width:0%;background:linear-gradient(90deg,#fbbf24,#d97706)" data-pct="${pct}"></div></div>
    `;
    container.appendChild(card);
  });
  animateBars(container);
}

// ── Summary card helper ──
function makeSummaryCard(label, value, status, trendDir, explanation, impact, accentColor) {
  const color = accentColor || 'var(--violet)';
  const card = document.createElement('div');
  card.className = 'metric-card summary-card';
  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div class="card-label" style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">${label}</div>
      <span class="col-badge ${badgeClass(status)}" style="font-size:9px">${status || ''}</span>
    </div>
    <div class="card-value" style="font-size:26px;margin:6px 0;color:${color}">${value}</div>
    <div class="card-trend">${trendIcon(trendDir)}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5;border-top:1px solid var(--border);padding-top:8px">${explanation || ''}</div>
    ${impact ? `<div style="font-size:10px;color:var(--text-muted);margin-top:6px;font-style:italic;opacity:0.7">${impact}</div>` : ''}
  `;
  return card;
}

// ── Animate progress bars ──
function animateBars(container) {
  setTimeout(() => {
    container.querySelectorAll('.card-bar-fill').forEach(el => {
      el.style.width = el.dataset.pct + '%';
    });
  }, 200);
}

// ── Coaching ──
function renderCoaching(coaching) {
  const el = document.getElementById('coachingSections');
  // Show data even if isFallback — it still contains valid coaching
  if (!coaching) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px">AI coaching unavailable.</div>';
    return;
  }

  let html = '';
  const fallbackNote = coaching.isFallback
    ? `<div style="font-size:10px;color:var(--text-muted);padding:4px 0 8px;opacity:0.7">⚡ Baseline coaching (Gemini API key not set)</div>`
    : '';
  html += fallbackNote;

  if (coaching.strengths?.length) {
    html += `<div><div class="coaching-group-title" style="color:var(--emerald)">✅ Strengths</div>`;
    coaching.strengths.forEach(s => {
      html += `<div class="coaching-item c-strength"><span class="c-dot"></span>${s}</div>`;
    });
    html += `</div>`;
  }
  if (coaching.opportunityArea?.length) {
    html += `<div><div class="coaching-group-title" style="color:var(--amber)">⚡ Opportunities</div>`;
    coaching.opportunityArea.forEach(o => {
      html += `<div class="coaching-item c-opportunity"><span class="c-dot"></span>${o}</div>`;
    });
    html += `</div>`;
  }
  if (coaching.actionPlan?.length) {
    html += `<div><div class="coaching-group-title" style="color:var(--violet)">🎯 Action Plan</div>`;
    coaching.actionPlan.forEach(a => {
      html += `<div class="coaching-item c-action"><span class="c-dot"></span>${a}</div>`;
    });
    html += `</div>`;
  }
  el.innerHTML = html || '<div style="font-size:12px;color:var(--text-muted)">No coaching data available.</div>';
}

// ── Cross-Metric ──
function renderCrossMetric(analysis) {
  const el = document.getElementById('crossList');
  if (!analysis?.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px">No cross-metric insights available.</div>';
    return;
  }
  el.innerHTML = analysis.map((insight, i) => `
    <div class="cross-item">
      <span class="cross-num">${String(i + 1).padStart(2, '0')}</span>
      <span>${insight}</span>
    </div>
  `).join('');
}

// ── Deployment Timeline ──
function renderTimeline(charts, devId) {
  // Build timeline from deploymentTrend + PR trend merged
  currentDeployments = (charts?.deploymentTrend || []).map((pt, i) => ({
    id: `DEP-${String(i + 1).padStart(3, '0')}`,
    pr: `PR-${String(i + 1).padStart(3, '0')}`,
    date: pt.date,
    status: 'success',
    env: 'prod',
    type: i % 3 === 0 ? 'hotfix' : 'standard',
    leadTime: (charts.prTrend?.[i]?.value || 0).toFixed(1),
  }));
  filterTimeline(deployFilter);
}

function filterTimeline(filter) {
  deployFilter = filter;
  document.querySelectorAll('.pf-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  const items = filter === 'all' ? currentDeployments : currentDeployments.filter(d => d.type === filter);
  const el = document.getElementById('deployTimeline');
  if (!items.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:12px">No deployments found.</div>';
    return;
  }
  el.innerHTML = items.map(d => `
    <div class="timeline-item">
      <div class="tl-dot ${d.status}"></div>
      <div class="tl-id">${d.id}</div>
      <div class="tl-info">
        <div class="tl-pr">${d.pr}</div>
        <div class="tl-date">${d.date}</div>
      </div>
      <div class="tl-tags">
        <span class="tl-tag tl-env">${d.env}</span>
        <span class="tl-tag tl-type-${d.type}">${d.type}</span>
      </div>
      <div class="tl-lead">${d.leadTime}d</div>
    </div>
  `).join('');
}

// Timeline filter buttons
document.querySelectorAll('.pf-btn').forEach(btn => {
  btn.addEventListener('click', () => filterTimeline(btn.dataset.filter));
});

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  if (currentDev) {
    await selectDev(currentDev.id, currentDev.idx);
  } else {
    await loadDevelopers();
  }
  btn.classList.remove('spinning');
});

// ── Init ──
loadDevelopers();

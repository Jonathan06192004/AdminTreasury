const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

let missions = [];
let activeMissionId = null;
let activeMissionName = '';
let deleteTargetId = null;
let allRows = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadMissions();
  setupModal();
  setupDeleteModal();
});

async function loadMissions() {
  const isSuperAdmin = user.role === 'superadmin';

  let query = dbData.from('missions').select('*').order('code');

  // Admin: only their own mission
  if (!isSuperAdmin) {
    query = query.eq('code', user.mission_code);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    document.getElementById('tithes-tbody').innerHTML =
      '<tr><td colspan="5" class="empty-row">No missions found for your account.</td></tr>';
    return;
  }

  missions = data;
  renderTabs();
  selectMission(missions[0]);
}

function renderTabs() {
  const container = document.getElementById('mission-tabs');
  container.innerHTML = '';
  missions.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = m.code;
    btn.dataset.id = m.id;
    btn.addEventListener('click', () => selectMission(m));
    container.appendChild(btn);
  });
}

function selectMission(mission) {
  activeMissionId = mission.id;
  activeMissionName = mission.name;

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.id) === mission.id);
  });

  document.getElementById('table-title').textContent = `Tithes — ${mission.code}`;
  document.getElementById('table-subtitle').textContent = mission.name;

  loadData();
}

async function loadData() {
  document.getElementById('tithes-tbody').innerHTML =
    '<tr><td colspan="5" class="empty-row">Loading...</td></tr>';

  const { data, error } = await dbData
    .from('tithes')
    .select('*')
    .eq('mission_id', activeMissionId)
    .order('year', { ascending: false })
    .order('month', { ascending: true });

  if (error) {
    document.getElementById('tithes-tbody').innerHTML =
      '<tr><td colspan="5" class="empty-row">Failed to load data.</td></tr>';
    return;
  }

  allRows = data || [];
  populateYearFilter(allRows);
  renderTable(allRows);
}

function populateYearFilter(rows) {
  const years = [...new Set(rows.map(r => r.year))].sort((a,b) => b - a);
  const sel = document.getElementById('filter-year');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Years</option>';
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (String(y) === current) opt.selected = true;
    sel.appendChild(opt);
  });

  sel.onchange = () => {
    const yr = sel.value;
    renderTable(yr ? allRows.filter(r => String(r.year) === yr) : allRows);
  };
}

function renderTable(rows) {
  const tbody = document.getElementById('tithes-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No entries found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.year}</td>
      <td>${MONTHS[r.month]}</td>
      <td>${formatNum(r.amount)}</td>
      <td>${formatNum(r.budget)}</td>
      <td class="td-actions">
        <button class="btn-edit" onclick="openEdit(${r.id}, ${r.year}, ${r.month}, ${r.amount}, ${r.budget})">Edit</button>
        <button class="btn-delete" onclick="openDelete(${r.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function formatNum(val) {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Modal ──────────────────────────────────────────
function setupModal() {
  document.getElementById('btn-add').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('entry-form').addEventListener('submit', handleSubmit);
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'Add Entry';
  document.getElementById('entry-id').value = '';
  document.getElementById('entry-form').reset();
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEdit(id, year, month, amount, budget) {
  document.getElementById('modal-title').textContent = 'Edit Entry';
  document.getElementById('entry-id').value = id;
  document.getElementById('entry-year').value = year;
  document.getElementById('entry-month').value = month;
  document.getElementById('entry-amount').value = amount;
  document.getElementById('entry-budget').value = budget;
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

async function handleSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('modal-msg');
  msgEl.className = 'modal-msg';
  msgEl.textContent = '';

  const id     = document.getElementById('entry-id').value;
  const year   = parseInt(document.getElementById('entry-year').value);
  const month  = parseInt(document.getElementById('entry-month').value);
  const amount = parseFloat(document.getElementById('entry-amount').value);
  const budget = parseFloat(document.getElementById('entry-budget').value);
  const btn    = document.getElementById('btn-submit');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  let error;
  if (id) {
    ({ error } = await dbData.from('tithes').update({ year, month, amount, budget }).eq('id', id));
  } else {
    ({ error } = await dbData.from('tithes').insert({ mission_id: activeMissionId, year, month, amount, budget }));
  }

  btn.disabled = false;
  btn.textContent = 'Save';

  if (error) {
    msgEl.textContent = 'Failed to save. ' + error.message;
    msgEl.classList.add('error');
    return;
  }

  closeModal();
  loadData();
}

// ── Delete Modal ───────────────────────────────────
function setupDeleteModal() {
  document.getElementById('delete-close').addEventListener('click', closeDelete);
  document.getElementById('delete-cancel').addEventListener('click', closeDelete);
  document.getElementById('delete-confirm').addEventListener('click', confirmDelete);
}

function openDelete(id) {
  deleteTargetId = id;
  document.getElementById('delete-overlay').classList.add('open');
}

function closeDelete() {
  deleteTargetId = null;
  document.getElementById('delete-overlay').classList.remove('open');
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  const { error } = await dbData.from('tithes').delete().eq('id', deleteTargetId);
  closeDelete();
  if (!error) loadData();
}

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

let missions = [];
let activeMissionId = null;
let churches = [];
let deleteTargetId = null;
let allRows = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadMissions();
  setupExport();
  setupModal();
  setupDeleteModal();
});

async function loadMissions() {
  const isSuperAdmin = user.role === 'superadmin';
  let query = dbData.from('missions').select('*').order('code');
  if (!isSuperAdmin) query = query.eq('code', user.mission_code);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    document.getElementById('tithes-tbody').innerHTML =
      '<tr><td colspan="6" class="empty-row">No missions found for your account.</td></tr>';
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
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.id) === mission.id);
  });
  document.getElementById('table-title').textContent = `Tithes — ${mission.code}`;
  document.getElementById('table-subtitle').textContent = mission.name;
  loadData();
}

async function loadData() {
  document.getElementById('tithes-tbody').innerHTML =
    '<tr><td colspan="6" class="empty-row">Loading...</td></tr>';

  // Load churches for this mission (via districts)
  const { data: churchData } = await dbData
    .from('churches')
    .select('id, name, districts!inner(mission_id)')
    .eq('districts.mission_id', activeMissionId);

  churches = churchData || [];
  const churchIds = churches.map(c => c.id);
  populateChurchFilter(churches);

  if (churchIds.length === 0) {
    allRows = [];
    renderTable([]);
    return;
  }

  const { data, error } = await dbData
    .from('tithes')
    .select('*, churches(name)')
    .in('church_id', churchIds)
    .order('year', { ascending: false })
    .order('month', { ascending: true });

  if (error) {
    document.getElementById('tithes-tbody').innerHTML =
      '<tr><td colspan="6" class="empty-row">Failed to load data.</td></tr>';
    return;
  }

  allRows = data || [];
  populateYearFilter(allRows);
  renderTable(allRows);
}

function populateChurchFilter(churchList) {
  const sel = document.getElementById('filter-church');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All Churches</option>';
  churchList.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (String(c.id) === current) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = applyFilters;
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
  sel.onchange = applyFilters;
}

function applyFilters() {
  const yr = document.getElementById('filter-year').value;
  const ch = document.getElementById('filter-church').value;
  let rows = allRows;
  if (yr) rows = rows.filter(r => String(r.year) === yr);
  if (ch) rows = rows.filter(r => String(r.church_id) === ch);
  renderTable(rows);
}

function renderTable(rows) {
  const tbody = document.getElementById('tithes-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No entries found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.year}</td>
      <td>${MONTHS[r.month]}</td>
      <td>${r.churches?.name || '—'}</td>
      <td>${formatNum(r.amount)}</td>
      <td>${formatNum(r.budget)}</td>
      <td class="td-actions">
        <button class="btn-edit" onclick="openEdit(${r.id}, ${r.year}, ${r.month}, ${r.church_id}, ${r.amount}, ${r.budget})">Edit</button>
        <button class="btn-delete" onclick="openDelete(${r.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function formatNum(val) {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function populateChurchSelect(selectedId) {
  const sel = document.getElementById('entry-church');
  sel.innerHTML = '<option value="">Select church</option>';
  churches.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function setupExport() {
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const yr = document.getElementById('filter-year').value;
    const ch = document.getElementById('filter-church').value;
    let rows = allRows;
    if (yr) rows = rows.filter(r => String(r.year) === yr);
    if (ch) rows = rows.filter(r => String(r.church_id) === ch);

    const title = document.getElementById('table-title').textContent;
    const header = 'Year,Month,Church,Amount,Budget';
    const csvRows = rows.map(r =>
      `${r.year},${MONTHS[r.month]},"${(r.churches?.name || '').replace(/"/g, '""')}",${r.amount},${r.budget}`
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

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
  populateChurchSelect(null);
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEdit(id, year, month, churchId, amount, budget) {
  document.getElementById('modal-title').textContent = 'Edit Entry';
  document.getElementById('entry-id').value = id;
  document.getElementById('entry-year').value = year;
  document.getElementById('entry-month').value = month;
  populateChurchSelect(churchId);
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

  const id       = document.getElementById('entry-id').value;
  const year     = parseInt(document.getElementById('entry-year').value);
  const month    = parseInt(document.getElementById('entry-month').value);
  const churchId = parseInt(document.getElementById('entry-church').value);
  const amount   = parseFloat(document.getElementById('entry-amount').value);
  const budget   = parseFloat(document.getElementById('entry-budget').value);
  const btn      = document.getElementById('btn-submit');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  let error;
  if (id) {
    ({ error } = await dbData.from('tithes').update({ year, month, church_id: churchId, amount, budget }).eq('id', id));
  } else {
    ({ error } = await dbData.from('tithes').insert({ year, month, church_id: churchId, amount, budget }));
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

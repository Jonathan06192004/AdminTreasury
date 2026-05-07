let missions = [];
let activeMissionId = null;
let allRows = [];
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadMissions();
  setupModal();
  setupDeleteModal();
});

async function loadMissions() {
  const isSuperAdmin = user.role === 'superadmin';
  let query = dbData.from('missions').select('*').order('code');
  if (!isSuperAdmin) query = query.eq('code', user.mission_code);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    document.getElementById('districts-tbody').innerHTML =
      '<tr><td colspan="4" class="empty-row">No missions found for your account.</td></tr>';
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
  document.getElementById('table-title').textContent = `Districts — ${mission.code}`;
  document.getElementById('table-subtitle').textContent = mission.name;
  loadData();
}

async function loadData() {
  document.getElementById('districts-tbody').innerHTML =
    '<tr><td colspan="4" class="empty-row">Loading...</td></tr>';

  const { data, error } = await dbData
    .from('districts')
    .select('*')
    .eq('mission_id', activeMissionId)
    .order('name');

  if (error) {
    document.getElementById('districts-tbody').innerHTML =
      '<tr><td colspan="4" class="empty-row">Failed to load data.</td></tr>';
    return;
  }

  allRows = data || [];
  renderTable(allRows);
}

function renderTable(rows) {
  const tbody = document.getElementById('districts-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No districts found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.leader_name || '—'}</td>
      <td>${r.location || '—'}</td>
      <td class="td-actions">
        <button class="btn-edit" onclick="openEdit(${r.id}, ${JSON.stringify(r.name)}, ${JSON.stringify(r.leader_name || '')}, ${JSON.stringify(r.location || '')})">Edit</button>
        <button class="btn-delete" onclick="openDelete(${r.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function setupModal() {
  document.getElementById('btn-add').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('entry-form').addEventListener('submit', handleSubmit);
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'Add District';
  document.getElementById('entry-id').value = '';
  document.getElementById('entry-form').reset();
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEdit(id, name, leader, location) {
  document.getElementById('modal-title').textContent = 'Edit District';
  document.getElementById('entry-id').value = id;
  document.getElementById('entry-name').value = name;
  document.getElementById('entry-leader').value = leader;
  document.getElementById('entry-location').value = location;
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
  const name     = document.getElementById('entry-name').value.trim();
  const leader   = document.getElementById('entry-leader').value.trim() || null;
  const location = document.getElementById('entry-location').value.trim() || null;
  const btn      = document.getElementById('btn-submit');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  let error;
  if (id) {
    ({ error } = await dbData.from('districts').update({ name, leader_name: leader, location }).eq('id', id));
  } else {
    ({ error } = await dbData.from('districts').insert({ mission_id: activeMissionId, name, leader_name: leader, location }));
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
  const { error } = await dbData.from('districts').delete().eq('id', deleteTargetId);
  closeDelete();
  if (!error) loadData();
}

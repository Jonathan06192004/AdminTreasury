let missions = [];
let activeMissionId = null;
let districts = [];
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
    document.getElementById('churches-tbody').innerHTML =
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
  document.getElementById('table-title').textContent = `Churches — ${mission.code}`;
  document.getElementById('table-subtitle').textContent = mission.name;
  loadData();
}

async function loadData() {
  document.getElementById('churches-tbody').innerHTML =
    '<tr><td colspan="6" class="empty-row">Loading...</td></tr>';

  const { data: distData } = await dbData
    .from('districts')
    .select('id, name')
    .eq('mission_id', activeMissionId)
    .order('name');

  districts = distData || [];
  populateDistrictFilter(districts);

  if (districts.length === 0) {
    allRows = [];
    renderTable([]);
    return;
  }

  const districtIds = districts.map(d => d.id);
  const { data, error } = await dbData
    .from('churches')
    .select('*, districts(name)')
    .in('district_id', districtIds)
    .order('name');

  if (error) {
    document.getElementById('churches-tbody').innerHTML =
      '<tr><td colspan="6" class="empty-row">Failed to load data.</td></tr>';
    return;
  }

  allRows = data || [];
  renderTable(allRows);
}

function populateDistrictFilter(distList) {
  const sel = document.getElementById('filter-district');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Districts</option>';
  distList.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    if (String(d.id) === current) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.onchange = () => {
    const val = sel.value;
    renderTable(val ? allRows.filter(r => String(r.district_id) === val) : allRows);
  };
}

function renderTable(rows) {
  const tbody = document.getElementById('churches-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No churches found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.districts?.name || '—'}</td>
      <td>${r.address || '—'}</td>
      <td>${r.latitude != null ? r.latitude : '—'} / ${r.longitude != null ? r.longitude : '—'}</td>
      <td class="td-actions">
        <button class="btn-edit" onclick="openEditById(${r.id})">Edit</button>
        <button class="btn-delete" onclick="openDelete(${r.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openEditById(id) {
  const r = allRows.find(row => row.id === id);
  if (!r) return;
  openEdit(r.id, r.district_id, r.name, r.address || '', r.latitude, r.longitude);
}

function populateDistrictSelect(selectedId) {
  const sel = document.getElementById('entry-district');
  sel.innerHTML = '<option value="">Select district</option>';
  districts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    if (d.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function setupModal() {
  document.getElementById('btn-add').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('entry-form').addEventListener('submit', handleSubmit);
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'Add Church';
  document.getElementById('entry-id').value = '';
  document.getElementById('entry-form').reset();
  populateDistrictSelect(null);
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEdit(id, districtId, name, address, lat, lng) {
  document.getElementById('modal-title').textContent = 'Edit Church';
  document.getElementById('entry-id').value = id;
  populateDistrictSelect(districtId);
  document.getElementById('entry-name').value = name;
  document.getElementById('entry-address').value = address;
  document.getElementById('entry-latitude').value = lat != null ? lat : '';
  document.getElementById('entry-longitude').value = lng != null ? lng : '';
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

  const id         = document.getElementById('entry-id').value;
  const districtId = parseInt(document.getElementById('entry-district').value);
  const name       = document.getElementById('entry-name').value.trim();
  const address    = document.getElementById('entry-address').value.trim() || null;
  const latVal     = document.getElementById('entry-latitude').value.trim();
  const lngVal     = document.getElementById('entry-longitude').value.trim();
  const latitude   = latVal !== '' ? parseFloat(latVal) : null;
  const longitude  = lngVal !== '' ? parseFloat(lngVal) : null;
  const btn        = document.getElementById('btn-submit');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  let error;
  if (id) {
    ({ error } = await dbData.from('churches').update({ district_id: districtId, name, address, latitude, longitude }).eq('id', id));
  } else {
    ({ error } = await dbData.from('churches').insert({ district_id: districtId, name, address, latitude, longitude }));
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
  const { error } = await dbData.from('churches').delete().eq('id', deleteTargetId);
  closeDelete();
  if (!error) loadData();
}

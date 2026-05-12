let missions = [];
let activeMissionId = null;
let allRows = [];
let deleteTargetId = null;

const STORAGE_BUCKET = 'district-photos';

document.addEventListener('DOMContentLoaded', async () => {
  await loadMissions();
  setupModal();
  setupDeleteModal();
  setupPhotoPreview();
});

async function loadMissions() {
  const isSuperAdmin = user.role === 'superadmin';
  let query = dbData.from('missions').select('*').order('code');
  if (!isSuperAdmin) query = query.eq('code', user.mission_code);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    document.getElementById('districts-tbody').innerHTML =
      '<tr><td colspan="7" class="empty-row">No missions found for your account.</td></tr>';
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
    '<tr><td colspan="7" class="empty-row">Loading...</td></tr>';

  const { data, error } = await dbData
    .from('districts')
    .select('*')
    .eq('mission_id', activeMissionId)
    .order('name');

  if (error) {
    document.getElementById('districts-tbody').innerHTML =
      '<tr><td colspan="7" class="empty-row">Failed to load data.</td></tr>';
    return;
  }

  allRows = data || [];
  renderTable(allRows);
}

function renderTable(rows) {
  const tbody = document.getElementById('districts-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No districts found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const lat = r.latitude != null ? r.latitude : null;
    const lng = r.longitude != null ? r.longitude : null;
    const photo = r.profile_photo_url || '';
    return `
    <tr>
      <td>
        ${photo
          ? `<img src="${photo}" class="district-avatar" alt="${r.name}" />`
          : `<div class="district-avatar-placeholder">${r.name.charAt(0).toUpperCase()}</div>`
        }
      </td>
      <td>${r.name}</td>
      <td>${r.leader_name || '—'}</td>
      <td>${r.contact || '—'}</td>
      <td>${r.address || '—'}</td>
      <td>${lat !== null ? lat : '—'} / ${lng !== null ? lng : '—'}</td>
      <td class="td-actions">
        <button class="btn-edit" onclick="openEditById(${r.id})">Edit</button>
        <button class="btn-delete" onclick="openDelete(${r.id})">Delete</button>
      </td>
    </tr>
  `;
  }).join('');
}

function openEditById(id) {
  const r = allRows.find(row => row.id === id);
  if (!r) return;
  openEdit(r.id, r.name, r.leader_name || '', r.contact || '', r.address || '', r.latitude, r.longitude, r.profile_photo_url || '');
}

function setupPhotoPreview() {
  document.getElementById('entry-photo').addEventListener('change', function () {
    const file = this.files[0];
    const preview = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    if (file) {
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
    }
  });
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
  document.getElementById('entry-current-photo').value = '';
  document.getElementById('entry-form').reset();
  resetPhotoPreview();
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openEdit(id, name, leader, contact, address, lat, lng, photoUrl) {
  document.getElementById('modal-title').textContent = 'Edit District';
  document.getElementById('entry-id').value = id;
  document.getElementById('entry-name').value = name;
  document.getElementById('entry-leader').value = leader;
  document.getElementById('entry-contact').value = contact;
  document.getElementById('entry-address').value = address;
  document.getElementById('entry-latitude').value = lat != null ? lat : '';
  document.getElementById('entry-longitude').value = lng != null ? lng : '';
  document.getElementById('entry-current-photo').value = photoUrl;

  const preview = document.getElementById('photo-preview');
  const placeholder = document.getElementById('photo-placeholder');
  if (photoUrl) {
    preview.src = photoUrl;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    resetPhotoPreview();
  }

  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function resetPhotoPreview() {
  const preview = document.getElementById('photo-preview');
  const placeholder = document.getElementById('photo-placeholder');
  preview.src = '';
  preview.style.display = 'none';
  placeholder.style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

async function handleSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('modal-msg');
  msgEl.className = 'modal-msg';
  msgEl.textContent = '';

  const id          = document.getElementById('entry-id').value;
  const name        = document.getElementById('entry-name').value.trim();
  const leader      = document.getElementById('entry-leader').value.trim() || null;
  const contact    = document.getElementById('entry-contact').value.trim() || null;
  const address     = document.getElementById('entry-address').value.trim() || null;
  const latVal      = document.getElementById('entry-latitude').value.trim();
  const lngVal      = document.getElementById('entry-longitude').value.trim();
  const latitude    = latVal !== '' ? parseFloat(latVal) : null;
  const longitude   = lngVal !== '' ? parseFloat(lngVal) : null;
  const photoFile   = document.getElementById('entry-photo').files[0];
  const currentPhoto = document.getElementById('entry-current-photo').value;
  const btn         = document.getElementById('btn-submit');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  let profile_photo_url = currentPhoto || null;

  if (photoFile) {
    const ext = photoFile.name.split('.').pop();
    const filePath = `district-${Date.now()}.${ext}`;
    const { error: uploadError } = await dbData.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, photoFile, { upsert: true });

    if (uploadError) {
      msgEl.textContent = 'Photo upload failed. ' + uploadError.message;
      msgEl.classList.add('error');
      btn.disabled = false;
      btn.textContent = 'Save';
      return;
    }

    const { data: urlData } = dbData.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    profile_photo_url = urlData.publicUrl;

    // Delete old photo from storage now that new one is uploaded
    if (currentPhoto) await deleteStoragePhoto(currentPhoto, STORAGE_BUCKET);
  }

  const payload = { name, leader_name: leader, contact, address, latitude, longitude, profile_photo_url };
  let error;
  if (id) {
    ({ error } = await dbData.from('districts').update(payload).eq('id', id));
  } else {
    ({ error } = await dbData.from('districts').insert({ mission_id: activeMissionId, ...payload }));
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
  const row = allRows.find(r => r.id === deleteTargetId);
  const { error } = await dbData.from('districts').delete().eq('id', deleteTargetId);
  if (!error && row?.profile_photo_url) await deleteStoragePhoto(row.profile_photo_url, STORAGE_BUCKET);
  closeDelete();
  if (!error) loadData();
}

function deleteStoragePhoto(url, bucket) {
  const base = dbData.storage.from(bucket).getPublicUrl('').data.publicUrl.replace(/\/$/, '');
  const filePath = url.replace(base + '/', '');
  return dbData.storage.from(bucket).remove([filePath]);
}

let missions = [];
let activeMission = null;
let allRows = [];
let deleteTargetId = null;
const isSuperAdmin = user.role === 'superadmin';

document.addEventListener('DOMContentLoaded', async () => {
  setDate();
  await loadMissions();
  setupFilters();
  setupModal();
  setupDeleteModal();
});

function setDate() {
  const el = document.getElementById('today-date');
  if (el) el.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

async function loadMissions() {
  let query = dbData.from('missions').select('id, code, name').order('code');
  if (!isSuperAdmin) query = query.eq('code', user.mission_code);

  const { data } = await query;
  missions = data || [];

  if (!missions.length) {
    document.getElementById('users-tbody').innerHTML =
      '<tr><td colspan="6" class="empty-row">No missions found.</td></tr>';
    return;
  }

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
    btn.title = m.name;
    btn.dataset.id = m.id;
    btn.addEventListener('click', () => selectMission(m));
    container.appendChild(btn);
  });
}

function selectMission(mission) {
  activeMission = mission;

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.id) === mission.id);
  });

  document.getElementById('table-title').textContent = `Users — ${mission.code}`;
  document.getElementById('table-subtitle').textContent = mission.name;

  loadUsers();
}

async function loadUsers() {
  document.getElementById('users-tbody').innerHTML =
    '<tr><td colspan="9" class="empty-row">Loading...</td></tr>';

  // Get mission_id from db for the active mission
  const { data: missionRow } = await db
    .from('missions')
    .select('id')
    .eq('code', activeMission.code)
    .single();

  if (!missionRow) {
    document.getElementById('users-tbody').innerHTML =
      '<tr><td colspan="9" class="empty-row">Mission not found in viewer database.</td></tr>';
    return;
  }

  // Fetch directly from mission_users — always fresh from DB
  const { data: muData, error: muError } = await db
    .from('mission_users')
    .select('*')
    .eq('mission_id', missionRow.id)
    .order('created_at', { ascending: false });

  if (muError) {
    document.getElementById('users-tbody').innerHTML =
      '<tr><td colspan="9" class="empty-row">Failed to load users.</td></tr>';
    return;
  }

  // Also fetch users table to get plain_password, is_active, role per username
  const usernames = (muData || []).map(r => r.username);
  let usersMap = {};
  if (usernames.length) {
    const { data: usersData } = await db
      .from('users')
      .select('username, plain_password, is_active, role, id, created_at')
      .in('username', usernames);
    (usersData || []).forEach(u => { usersMap[u.username] = u; });
  }

  allRows = (muData || []).map(r => ({
    ...r,
    plain_password: usersMap[r.username]?.plain_password || null,
    is_active: usersMap[r.username]?.is_active ?? r.is_active,
    role: usersMap[r.username]?.role || 'viewer',
    users_id: usersMap[r.username]?.id || null,
    created_at: usersMap[r.username]?.created_at || r.created_at
  }));

  applyFilters();
}

function setupFilters() {
  document.getElementById('filter-status').onchange = applyFilters;
}

function applyFilters() {
  const status = document.getElementById('filter-status').value;
  let rows = allRows;
  if (status !== '') rows = rows.filter(r => String(r.is_active) === status);
  renderTable(rows);
}

function renderTable(rows) {
  const tbody = document.getElementById('users-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No users found for this mission.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>
        <div class="user-name-cell">
          <div class="user-avatar-sm">${r.full_name.charAt(0).toUpperCase()}</div>
          <span>${r.full_name}</span>
        </div>
      </td>
      <td><code class="username-code">${r.username}</code></td>
      <td class="muted">${r.email || '—'}</td>
      <td class="muted">${r.phone || '—'}</td>
      <td>
        <div class="password-cell">
          <span class="password-dots" data-id="${r.id}">••••••••</span>
          <span class="password-plain" data-id="${r.id}" style="display:none;">${r.plain_password || '—'}</span>
          <button class="btn-eye" onclick="togglePassword('${r.id}')" title="Show/Hide">
            <i data-lucide="eye" width="14" height="14"></i>
          </button>
        </div>
      </td>
      <td><span class="role-badge role-${r.role}">${r.role}</span></td>
      <td><span class="status-badge ${r.is_active ? 'active' : 'inactive'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="muted">${formatDate(r.created_at)}</td>
      <td class="td-actions">
        <button class="btn-edit" onclick="openEditById('${r.id}')">Edit</button>
        <button class="btn-delete" onclick="openDelete('${r.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function togglePassword(id) {
  const dots  = document.querySelector(`.password-dots[data-id="${id}"]`);
  const plain = document.querySelector(`.password-plain[data-id="${id}"]`);
  const isHidden = plain.style.display === 'none';
  dots.style.display  = isHidden ? 'none' : 'inline';
  plain.style.display = isHidden ? 'inline' : 'none';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Modal ──────────────────────────────────────────

function setupModal() {
  document.getElementById('btn-add').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('entry-form').addEventListener('submit', handleSubmit);
}

function setMissionDisplay() {
  const el = document.getElementById('modal-mission-display');
  el.textContent = `${activeMission.code} — ${activeMission.name}`;
}

function openAdd() {
  document.getElementById('modal-title').textContent = 'Add User';
  document.getElementById('entry-id').value = '';
  document.getElementById('entry-form').reset();
  setMissionDisplay();
  document.getElementById('entry-password').required = true;
  document.getElementById('password-hint').style.display = 'none';
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('modal-msg').className = 'modal-msg';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEditById(id) {
  const r = allRows.find(row => row.id === id);
  if (!r) return;

  document.getElementById('modal-title').textContent = 'Edit User';
  document.getElementById('entry-id').value = r.users_id || '';
  setMissionDisplay();
  document.getElementById('entry-fullname').value = r.full_name;
  document.getElementById('entry-username').value = r.username;
  document.getElementById('entry-email').value = r.email || '';
  document.getElementById('entry-phone').value = r.phone || '';
  document.getElementById('entry-active').value = String(r.is_active);
  document.getElementById('entry-password').value = '';
  document.getElementById('entry-password').required = false;
  document.getElementById('password-hint').style.display = 'block';
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
  const fullName = document.getElementById('entry-fullname').value.trim();
  const username = document.getElementById('entry-username').value.trim();
  const email    = document.getElementById('entry-email').value.trim() || null;
  const phone    = document.getElementById('entry-phone').value.trim() || null;
  const role     = 'viewer';
  const password = document.getElementById('entry-password').value.trim();
  const isActive = document.getElementById('entry-active').value === 'true';
  const btn      = document.getElementById('btn-submit');

  if (!id && !password) {
    msgEl.textContent = 'Password is required for new users.';
    msgEl.classList.add('error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  let error;

  if (id) {
    // Update users table
    const payload = {
      mission_code: activeMission.code,
      full_name: fullName,
      username,
      role,
      is_active: isActive,
      updated_at: new Date().toISOString()
    };
    if (password) payload.plain_password = password;
    ({ error } = await db.from('users').update(payload).eq('id', id));

    if (!error) {
      // Update matching mission_users row by username
      const muPayload = {
        full_name: fullName,
        email,
        phone,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };
      if (password) muPayload.password_hash = password;
      await db.from('mission_users').update(muPayload).eq('username', username);
    }
  } else {
    // Insert into users table
    const { error: usersError } = await db.from('users').insert({
      mission_code: activeMission.code,
      full_name: fullName,
      username,
      role,
      is_active: isActive,
      plain_password: password
    });

    if (usersError) {
      error = usersError;
    } else {
      // Look up mission_id from db's own missions table using mission code
      const { data: missionRow, error: missionErr } = await db
        .from('missions')
        .select('id')
        .eq('code', activeMission.code)
        .single();

      let resolvedMissionId = missionRow?.id;

      // Auto-create mission in db if it doesn't exist yet
      if (missionErr || !missionRow) {
        const { data: newMission, error: createErr } = await db
          .from('missions')
          .insert({ code: activeMission.code, name: activeMission.name })
          .select('id')
          .single();
        if (createErr || !newMission) {
          await db.from('users').delete().eq('username', username);
          error = { message: 'Failed to sync mission. ' + (createErr?.message || '') };
        } else {
          resolvedMissionId = newMission.id;
        }
      }

      if (!error && resolvedMissionId) {
        const { error: muError } = await db.from('mission_users').insert({
          mission_id: resolvedMissionId,
          username,
          password_hash: password,
          full_name: fullName,
          email,
          phone,
          is_active: isActive
        });
        if (muError) {
          await db.from('users').delete().eq('username', username);
          error = muError;
        }
      }
    }
  }

  btn.disabled = false;
  btn.textContent = 'Save';

  if (error) {
    let msg = 'Failed to save. ' + error.message;
    if (error.message.includes('users_username_key') || error.message.includes('mission_users_username_key')) {
      msg = 'Username "' + username + '" is already taken. Please choose a different username.';
    } else if (error.message.includes('users_email_key') || error.message.includes('mission_users_email_key')) {
      msg = 'Email "' + email + '" is already in use. Please use a different email.';
    }
    msgEl.textContent = msg;
    msgEl.classList.add('error');
    return;
  }

  closeModal();
  loadUsers();
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
  const target = allRows.find(r => r.id === deleteTargetId);
  if (target?.users_id) {
    await db.from('users').delete().eq('id', target.users_id);
  }
  await db.from('mission_users').delete().eq('id', deleteTargetId);
  closeDelete();
  loadUsers();
}

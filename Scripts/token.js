// Must have a pending user from the login step
const pendingUser = sessionStorage.getItem('pending_user');
if (!pendingUser) {
  window.location.href = '../index.html';
}

const user = JSON.parse(pendingUser);

// Show who is verifying
const badge = document.getElementById('token-badge');
badge.textContent = user.mission_code
  ? `${user.mission_code} — ${user.full_name}`
  : user.full_name;

// Eye toggle
document.getElementById('toggle-token').addEventListener('click', function () {
  const input = document.getElementById('token-input');
  input.type = input.type === 'password' ? 'text' : 'password';
  this.classList.toggle('active');
});

// Back to login
document.getElementById('btn-back').addEventListener('click', () => {
  sessionStorage.removeItem('pending_user');
  window.location.href = '../index.html';
});

// Token form submit
document.getElementById('token-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const errorEl = document.getElementById('token-error');
  errorEl.textContent = '';

  const tokenInput = document.getElementById('token-input').value.trim();
  const btn = document.getElementById('btn-verify');

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  // Verify token against the user's own record in DB
  const { data, error } = await db
    .from('users')
    .select('id, username, full_name, role, mission_code, is_active, token')
    .eq('id', user.id)
    .eq('token', tokenInput)
    .eq('is_active', true)
    .single();

  btn.disabled = false;
  btn.textContent = 'Verify Token';

  if (error || !data) {
    errorEl.textContent = 'Invalid token. Please try again.';
    document.getElementById('token-input').value = '';
    return;
  }

  // Fully authenticated — move to localStorage and clear session
  const { token: _t, ...safeUser } = data; // don't store token in localStorage
  sessionStorage.removeItem('pending_user');
  localStorage.setItem('auth_user', JSON.stringify(safeUser));

  window.location.href = 'Dashboard.html';
});

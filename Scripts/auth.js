const loginForm = document.getElementById('login-form');
const errorMsg  = document.getElementById('error-msg');

if (localStorage.getItem('auth_user')) {
  window.location.href = 'Pages/Dashboard.html';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const btnLogin = document.getElementById('btn-login');

  btnLogin.disabled    = true;
  btnLogin.textContent = 'Signing in...';

  const { data, error } = await db
    .from('users')
    .select('id, username, full_name, role, mission_code, is_active, two_fa_enabled, totp_secret')
    .eq('username', username)
    .eq('plain_password', password)
    .eq('is_active', true)
    .single();

  btnLogin.disabled    = false;
  btnLogin.textContent = 'Sign In';

  if (error || !data) {
    errorMsg.textContent = 'Invalid username or password.';
    return;
  }

  const { two_fa_enabled, totp_secret, ...safeUser } = data;

  if (two_fa_enabled && totp_secret) {
    // Store pending user + secret for 2FA verification
    sessionStorage.setItem('pending_user',   JSON.stringify(safeUser));
    sessionStorage.setItem('pending_secret', totp_secret);
    window.location.href = 'Pages/2fa.html';
  } else {
    localStorage.setItem('auth_user', JSON.stringify(safeUser));
    window.location.href = 'Pages/Dashboard.html';
  }
});

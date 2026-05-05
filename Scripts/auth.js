const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');

// Redirect if already fully authenticated
if (localStorage.getItem('auth_user')) {
  window.location.href = 'Pages/Dashboard.html';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const btnLogin = document.getElementById('btn-login');

  btnLogin.disabled = true;
  btnLogin.textContent = 'Signing in...';

  const { data, error } = await db
    .from('users')
    .select('id, username, full_name, role, mission_code, is_active')
    .eq('username', username)
    .eq('plain_password', password)
    .eq('is_active', true)
    .single();

  btnLogin.disabled = false;
  btnLogin.textContent = 'Sign In';

  if (error || !data) {
    errorMsg.textContent = 'Invalid username or password.';
    return;
  }

  if (data.role === 'superadmin') {
    // Superadmin skips token — go straight to dashboard
    localStorage.setItem('auth_user', JSON.stringify(data));
    window.location.href = 'Pages/Dashboard.html';
  } else {
    // Admin requires token verification
    sessionStorage.setItem('pending_user', JSON.stringify(data));
    window.location.href = 'Pages/token.html';
  }
});

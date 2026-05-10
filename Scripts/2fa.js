const pendingUser   = sessionStorage.getItem('pending_user');
const pendingSecret = sessionStorage.getItem('pending_secret');

if (!pendingUser || !pendingSecret) {
  window.location.href = '../index.html';
}

const user = JSON.parse(pendingUser);

const badge = document.getElementById('tfa-badge');
badge.textContent = user.mission_code
  ? `${user.mission_code} — ${user.full_name}`
  : user.full_name;

document.getElementById('btn-back').addEventListener('click', () => {
  sessionStorage.removeItem('pending_user');
  sessionStorage.removeItem('pending_secret');
  window.location.href = '../index.html';
});

// Auto-submit when 6 digits are entered
document.getElementById('tfa-input').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value.length === 6) {
    document.getElementById('tfa-form').requestSubmit();
  }
});

document.getElementById('tfa-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const errorEl = document.getElementById('tfa-error');
  errorEl.textContent = '';

  const code = document.getElementById('tfa-input').value.trim();
  const btn  = document.getElementById('btn-verify');

  btn.disabled    = true;
  btn.textContent = 'Verifying...';

  try {
    const totp = new OTPAuth.TOTP({
      issuer:    'AdminTreasury',
      label:     user.username,
      algorithm: 'SHA1',
      digits:    6,
      period:    30,
      secret:    OTPAuth.Secret.fromBase32(pendingSecret)
    });

    // delta: allow ±1 window (30s tolerance)
    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      errorEl.textContent = 'Invalid or expired code. Please try again.';
      document.getElementById('tfa-input').value = '';
      btn.disabled    = false;
      btn.textContent = 'Verify';
      return;
    }
  } catch {
    errorEl.textContent = 'Verification failed. Please try again.';
    btn.disabled    = false;
    btn.textContent = 'Verify';
    return;
  }

  sessionStorage.removeItem('pending_user');
  sessionStorage.removeItem('pending_secret');
  localStorage.setItem('auth_user', JSON.stringify(user));
  window.location.href = 'Dashboard.html';
});

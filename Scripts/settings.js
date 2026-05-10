document.addEventListener('DOMContentLoaded', async () => {
  const user = JSON.parse(localStorage.getItem('auth_user'));

  // ── Profile ──────────────────────────────────────────────
  document.getElementById('profile-name').textContent     = user.full_name || '—';
  document.getElementById('profile-username').textContent = user.username  || '—';
  document.getElementById('profile-role').textContent     = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  document.getElementById('profile-mission').textContent  = user.mission_code || 'N/A';

  // ── Password eye toggles ─────────────────────────────────
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type  = input.type === 'password' ? 'text' : 'password';
      btn.classList.toggle('active');
    });
  });

  // ── Change Password ──────────────────────────────────────
  const pwForm  = document.getElementById('change-password-form');
  const pwMsg   = document.getElementById('pw-msg');
  const btnSave = document.getElementById('btn-save-pw');

  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    pwMsg.className = 'settings-msg';
    pwMsg.textContent = '';

    const current = document.getElementById('current-password').value.trim();
    const newPw   = document.getElementById('new-password').value.trim();
    const confirm = document.getElementById('confirm-password').value.trim();

    if (newPw !== confirm) {
      pwMsg.textContent = 'New passwords do not match.';
      pwMsg.classList.add('error');
      return;
    }
    if (newPw.length < 6) {
      pwMsg.textContent = 'Password must be at least 6 characters.';
      pwMsg.classList.add('error');
      return;
    }

    btnSave.disabled    = true;
    btnSave.textContent = 'Updating...';

    const { data: check, error: checkErr } = await db
      .from('users').select('id')
      .eq('id', user.id).eq('plain_password', current).single();

    if (checkErr || !check) {
      pwMsg.textContent = 'Current password is incorrect.';
      pwMsg.classList.add('error');
      btnSave.disabled    = false;
      btnSave.textContent = 'Update Password';
      return;
    }

    const { error: updateErr } = await db
      .from('users')
      .update({ plain_password: newPw, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    btnSave.disabled    = false;
    btnSave.textContent = 'Update Password';

    if (updateErr) {
      pwMsg.textContent = 'Failed to update password. Try again.';
      pwMsg.classList.add('error');
      return;
    }

    pwMsg.textContent = 'Password updated successfully!';
    pwMsg.classList.add('success');
    pwForm.reset();
  });

  // ── Sign out ─────────────────────────────────────────────
  document.getElementById('btn-logout-settings').addEventListener('click', () => {
    localStorage.removeItem('auth_user');
    window.location.href = '../index.html';
  });

  // ── 2FA ──────────────────────────────────────────────────
  let tfaEnabled = false;
  let pendingSecret = null;

  const dot         = document.getElementById('tfa-dot');
  const statusLabel = document.getElementById('tfa-status-label');
  const actionsEl   = document.getElementById('tfa-actions');
  const setupPanel  = document.getElementById('tfa-setup-panel');
  const viewPanel   = document.getElementById('tfa-view-panel');

  function hideAllPanels() {
    setupPanel.style.display = 'none';
    viewPanel.style.display  = 'none';
  }

  async function loadTfaStatus() {
    const { data } = await db
      .from('users').select('two_fa_enabled, totp_secret')
      .eq('id', user.id).single();

    tfaEnabled = data?.two_fa_enabled || false;
    renderTfaStatus(tfaEnabled);
  }

  function renderTfaStatus(enabled) {
    hideAllPanels();
    dot.className        = 'tfa-dot ' + (enabled ? 'enabled' : 'disabled');
    statusLabel.textContent = enabled ? 'Enabled' : 'Disabled';

    actionsEl.innerHTML = '';
    if (enabled) {
      actionsEl.appendChild(makeBtn('View QR',      'btn-tfa-secondary', onViewQR));
      actionsEl.appendChild(makeBtn('Disable 2FA',  'btn-danger btn-sm',  onDisableClick));
    } else {
      actionsEl.appendChild(makeBtn('Enable 2FA',   'btn-save',           onEnable));
    }
  }

  function makeBtn(label, cls, handler) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className   = cls;
    b.addEventListener('click', handler);
    return b;
  }

  // ── Enable: generate secret + show QR ───────────────────
  function onEnable() {
    pendingSecret = generateBase32Secret();
    const uri = buildOtpUri(pendingSecret);

    document.getElementById('tfa-qr-img').src       = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(uri);
    document.getElementById('tfa-secret-text').textContent = pendingSecret;
    document.getElementById('tfa-setup-msg').textContent   = '';
    document.getElementById('tfa-setup-msg').className     = 'settings-msg';
    document.getElementById('tfa-confirm-input').value     = '';

    hideAllPanels();
    setupPanel.style.display = 'block';
  }

  document.getElementById('btn-tfa-cancel').addEventListener('click', () => {
    pendingSecret = null;
    hideAllPanels();
  });

  // Auto-submit on 6 digits
  document.getElementById('tfa-confirm-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (e.target.value.length === 6) confirmEnable();
  });

  document.getElementById('btn-tfa-confirm').addEventListener('click', confirmEnable);

  async function confirmEnable() {
    const msgEl = document.getElementById('tfa-setup-msg');
    const code  = document.getElementById('tfa-confirm-input').value.trim();
    const btn   = document.getElementById('btn-tfa-confirm');

    if (code.length !== 6) {
      msgEl.textContent = 'Please enter the 6-digit code.';
      msgEl.className   = 'settings-msg error';
      return;
    }

    if (!validateTotp(pendingSecret, code)) {
      msgEl.textContent = 'Invalid code. Make sure your authenticator is synced.';
      msgEl.className   = 'settings-msg error';
      document.getElementById('tfa-confirm-input').value = '';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Saving...';

    const { error } = await db.from('users')
      .update({ two_fa_enabled: true, totp_secret: pendingSecret })
      .eq('id', user.id);

    btn.disabled    = false;
    btn.textContent = 'Confirm & Enable';

    if (error) {
      msgEl.textContent = 'Failed to save. Try again.';
      msgEl.className   = 'settings-msg error';
      return;
    }

    pendingSecret = null;
    tfaEnabled    = true;
    renderTfaStatus(true);
  }

  // ── View QR ──────────────────────────────────────────────
  async function onViewQR() {
    const { data } = await db
      .from('users').select('totp_secret')
      .eq('id', user.id).single();

    if (!data?.totp_secret) return;

    const uri = buildOtpUri(data.totp_secret);
    document.getElementById('tfa-view-qr-img').src             = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(uri);
    document.getElementById('tfa-view-secret-text').textContent = data.totp_secret;

    hideAllPanels();
    viewPanel.style.display = 'block';
  }

  document.getElementById('btn-view-close').addEventListener('click', hideAllPanels);

  // ── Disable 2FA modal ────────────────────────────────────
  const disableOverlay = document.getElementById('disable-tfa-overlay');

  function onDisableClick() { disableOverlay.classList.add('open'); }

  document.getElementById('disable-tfa-close').addEventListener('click',  () => disableOverlay.classList.remove('open'));
  document.getElementById('disable-tfa-cancel').addEventListener('click', () => disableOverlay.classList.remove('open'));

  document.getElementById('disable-tfa-confirm').addEventListener('click', async () => {
    const btn = document.getElementById('disable-tfa-confirm');
    btn.disabled    = true;
    btn.textContent = 'Disabling...';

    const { error } = await db.from('users')
      .update({ two_fa_enabled: false, totp_secret: null })
      .eq('id', user.id);

    btn.disabled    = false;
    btn.textContent = 'Disable 2FA';
    disableOverlay.classList.remove('open');

    if (!error) {
      tfaEnabled = false;
      renderTfaStatus(false);
    }
  });

  // ── Helpers ──────────────────────────────────────────────
  function buildOtpUri(secret) {
    return `otpauth://totp/AdminTreasury:${encodeURIComponent(user.username)}?secret=${secret}&issuer=AdminTreasury&algorithm=SHA1&digits=6&period=30`;
  }

  function validateTotp(secret, code) {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: 'AdminTreasury', label: user.username,
        algorithm: 'SHA1', digits: 6, period: 30,
        secret: OTPAuth.Secret.fromBase32(secret)
      });
      return totp.validate({ token: code, window: 1 }) !== null;
    } catch { return false; }
  }

  function generateBase32Secret() {
    const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes  = crypto.getRandomValues(new Uint8Array(20));
    let secret   = '';
    for (const b of bytes) secret += chars[b % 32];
    return secret;
  }

  await loadTfaStatus();
});

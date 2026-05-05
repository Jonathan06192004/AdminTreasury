document.addEventListener('DOMContentLoaded', async () => {
  const user = JSON.parse(localStorage.getItem('auth_user'));

  // Populate profile fields
  document.getElementById('profile-name').textContent     = user.full_name || '—';
  document.getElementById('profile-username').textContent = user.username || '—';
  document.getElementById('profile-role').textContent     = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  document.getElementById('profile-mission').textContent  = user.mission_code || 'N/A';

  // Password eye toggles
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.classList.toggle('active');
    });
  });

  // Change password
  const form   = document.getElementById('change-password-form');
  const msg    = document.getElementById('pw-msg');
  const btnSave = document.getElementById('btn-save-pw');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'settings-msg';
    msg.textContent = '';

    const current = document.getElementById('current-password').value.trim();
    const newPw   = document.getElementById('new-password').value.trim();
    const confirm = document.getElementById('confirm-password').value.trim();

    if (newPw !== confirm) {
      msg.textContent = 'New passwords do not match.';
      msg.classList.add('error');
      return;
    }

    if (newPw.length < 6) {
      msg.textContent = 'Password must be at least 6 characters.';
      msg.classList.add('error');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Updating...';

    // Verify current password
    const { data: check, error: checkErr } = await db
      .from('users')
      .select('id')
      .eq('id', user.id)
      .eq('plain_password', current)
      .single();

    if (checkErr || !check) {
      msg.textContent = 'Current password is incorrect.';
      msg.classList.add('error');
      btnSave.disabled = false;
      btnSave.textContent = 'Update Password';
      return;
    }

    // Update password
    const { error: updateErr } = await db
      .from('users')
      .update({ plain_password: newPw, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    btnSave.disabled = false;
    btnSave.textContent = 'Update Password';

    if (updateErr) {
      msg.textContent = 'Failed to update password. Try again.';
      msg.classList.add('error');
      return;
    }

    msg.textContent = 'Password updated successfully!';
    msg.classList.add('success');
    form.reset();
  });

  // Sign out all sessions
  document.getElementById('btn-logout-settings').addEventListener('click', () => {
    localStorage.removeItem('auth_user');
    window.location.href = '../index.html';
  });
});

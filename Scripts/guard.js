const authUser = localStorage.getItem('auth_user');

// Not fully authenticated (token not verified)
if (!authUser) {
  // Clear any leftover pending session
  sessionStorage.removeItem('pending_user');
  window.location.href = '../index.html';
}

const user = JSON.parse(authUser);

document.addEventListener('DOMContentLoaded', () => {
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl)   nameEl.textContent   = user.full_name;
  if (roleEl)   roleEl.textContent   = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  if (avatarEl) avatarEl.textContent = user.full_name.charAt(0).toUpperCase();

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('auth_user');
    window.location.href = '../index.html';
  });
});

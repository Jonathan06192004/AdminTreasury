// Apply saved theme immediately on load
(function () {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  // Set initial toggle label
  updateThemeToggle();

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeToggle();
  });
});

function updateThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.classList.contains('dark');
  btn.innerHTML = isDark
    ? '<i data-lucide="sun"></i> Light Mode'
    : '<i data-lucide="moon"></i> Dark Mode';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

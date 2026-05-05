document.getElementById('toggle-password').addEventListener('click', function () {
  const input = document.getElementById('password');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  this.classList.toggle('active', isHidden);
});

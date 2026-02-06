document.getElementById('role').addEventListener('change', function() {
  document.getElementById('translator-fields').style.display =
    this.value === 'translator' ? 'block' : 'none';
});

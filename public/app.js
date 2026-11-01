const form = document.querySelector('#login-form');
const feedback = document.querySelector('#feedback');
const button = form.querySelector('button');
form.addEventListener('submit', async event => {
  event.preventDefault();
  feedback.className = 'feedback';
  feedback.textContent = '';
  button.disabled = true;
  button.querySelector('span').textContent = 'Signing in…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      feedback.textContent = typeof data.error === 'string' ? data.error : 'Unable to sign in. Please try again.';
      return;
    }
    window.location.assign('/workspace.html');
  } catch {
    feedback.textContent = 'Could not reach the server. Check your connection and try again.';
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Sign in';
  }
});

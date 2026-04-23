(() => {
  const _hostname = window.location.hostname;
  const API_BASE = (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
    ? window.location.origin
    : "https://botalsepaisa-2-0.onrender.com";

  const loginForm = document.getElementById('login-form');
  const errorMsg = document.getElementById('error-message');
  const loginBtn = document.getElementById('login-btn');

  function showError(msg) {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = 'block';
    }
  }

  function hideError() {
    if (errorMsg) errorMsg.style.display = 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        showError('Please enter both email and password.');
        return;
      }

      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'LOGGING IN...';
      }

      try {
        const response = await fetch(`${API_BASE}/api/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
          localStorage.setItem('token', data.token);
          if (data.user && data.user.name) {
             localStorage.setItem('userName', data.user.name);
          }
          window.location.href = 'user.html';
        } else {
          showError(data.message || 'Invalid email or password');
        }
      } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
      } finally {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = 'SIGN IN';
        }
      }
    });
  }
})();

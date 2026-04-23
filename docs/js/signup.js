(() => {
  const _hostname = window.location.hostname;
  const API_BASE = (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
    ? window.location.origin
    : "https://botalsepaisa-2-0.onrender.com";

  const signupForm = document.getElementById('signup-form');
  const errorMsg = document.getElementById('error-message');
  const signupBtn = document.getElementById('signup-btn');

  function showError(msg) {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = 'block';
    }
  }

  function hideError() {
    if (errorMsg) errorMsg.style.display = 'none';
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!name || !email || !password || !confirmPassword) {
        showError('Please fill in all fields.');
        return;
      }

      if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
      }

      if (signupBtn) {
        signupBtn.disabled = true;
        signupBtn.textContent = 'CREATING ACCOUNT...';
      }

      try {
        const response = await fetch(`${API_BASE}/api/users/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
          // Success, redirect to login
          window.location.href = 'login.html?registered=true';
        } else {
          showError(data.message || 'Registration failed');
        }
      } catch (error) {
        console.error('Signup error:', error);
        showError('Network error. Please try again.');
      } finally {
        if (signupBtn) {
          signupBtn.disabled = false;
          signupBtn.textContent = 'SIGN UP';
        }
      }
    });
  }
})();

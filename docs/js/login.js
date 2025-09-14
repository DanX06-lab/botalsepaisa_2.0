const container = document.getElementById('container');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');

registerBtn?.addEventListener('click', () => {
    container?.classList.add('active');
    clearMessages();
});
loginBtn?.addEventListener('click', () => {
    container?.classList.remove('active');
    clearMessages();
});

const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const signupMessage = document.getElementById('signupMessage');
const loginMessage = document.getElementById('loginMessage');

const API_BASE = 'https://botalsepaisa-user-server.onrender.com';

signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(signupMessage, '', '');

    const formData = new FormData(signupForm);
    const payload = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
    };

    try {
        const res = await fetch(`${API_BASE}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) {
            setMsg(signupMessage, result.message || 'Signup successful', 'success');
            signupForm.reset();
            container?.classList.remove('active');
        } else {
            setMsg(signupMessage, result.message || 'Signup failed', 'error');
        }
    } catch {
        setMsg(signupMessage, 'Error connecting to server', 'error');
    }
});

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(loginMessage, '', '');

    const formData = new FormData(loginForm);
    const payload = {
        email: formData.get('email'),
        password: formData.get('password'),
    };

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('userName', result.user?.name || '');
            window.location.assign('user.html'); // redirect to dashboard page
            return;
        } else {
            setMsg(loginMessage, result.message || 'Login failed', 'error');
        }
    } catch {
        setMsg(loginMessage, 'Error connecting to server', 'error');
    }
});

function clearMessages() {
    setMsg(signupMessage, '', '');
    setMsg(loginMessage, '', '');
}
function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = type ? `message ${type}` : 'message';
}

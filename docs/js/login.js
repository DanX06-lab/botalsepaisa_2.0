// Debug log to verify script is loaded
console.log('Login script loaded');

// DOM Elements
const container = document.getElementById('container');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');
const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const signupMessage = document.getElementById('signupMessage');
const loginMessage = document.getElementById('loginMessage');

// API Configuration
const API_BASE = 'https://botalsepaisa-2-0.onrender.com';

// Debug: Log all elements to verify they exist
console.log('Elements:', {
    container,
    registerBtn,
    loginBtn,
    signupForm,
    loginForm,
    signupMessage,
    loginMessage
});

// Event Listeners for Toggle Buttons
if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Register button clicked');
        if (container) {
            container.classList.add('active');
            clearMessages();
        }
    });
}

if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Login button clicked');
        if (container) {
            container.classList.remove('active');
            clearMessages();
        }
    });
}

signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(signupMessage, '', '');

    console.log('Signup form submitted');

    const formData = new FormData(signupForm);
    const payload = {
        name: formData.get('name')?.trim(),
        email: formData.get('email')?.trim().toLowerCase(),
        password: formData.get('password')
    };

    console.log('Sending signup request with:', payload);

    try {
        const res = await fetch(`${API_BASE}/api/users/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            credentials: 'include',
            mode: 'cors'
        });

        console.log('Response status:', res.status);

        // Handle non-JSON responses
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response');
        }

        const result = await res.json();
        console.log('Server response:', result);

        if (res.ok) {
            setMsg(signupMessage, result.message || 'Signup successful', 'success');
            signupForm.reset();
            // Small delay before switching to login
            setTimeout(() => container?.classList.remove('active'), 1500);
        } else {
            const errorMsg = result.message ||
                (result.errors ? JSON.stringify(result.errors) : 'Signup failed');
            setMsg(signupMessage, errorMsg, 'error');
        }
    } catch (error) {
        console.error('Signup error:', error);
        setMsg(signupMessage, `Error: ${error.message || 'Failed to connect to server'}`, 'error');
    }
});

// Login Form Submission
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submit event triggered');

        try {
            // Clear previous messages
            setMsg(loginMessage, 'Logging in...', 'info');

            // Get form data
            const formData = new FormData(loginForm);
            const payload = {
                email: formData.get('email')?.trim().toLowerCase(),
                password: formData.get('password')
            };

            console.log('Sending login request with:', { email: payload.email });

            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn?.textContent;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Logging in...';
            }

            try {
                const response = await fetch(`${API_BASE}/api/users/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                    mode: 'cors'
                });

                console.log('Login response status:', response.status);

                // Handle response
                const contentType = response.headers.get('content-type');
                let result;

                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                    console.log('Login response:', result);
                } else {
                    const text = await response.text();
                    console.error('Non-JSON login response:', text);
                    throw new Error('Server returned non-JSON response');
                }

                if (response.ok) {
                    if (result.token) {
                        // Store token and user data
                        localStorage.setItem('token', result.token);
                        if (result.user?.name) {
                            localStorage.setItem('userName', result.user.name);
                        }

                        // Show success message
                        setMsg(loginMessage, 'Login successful! Redirecting...', 'success');

                        // Redirect after a short delay
                        setTimeout(() => {
                            window.location.href = 'user.html';
                        }, 1000);
                    } else {
                        throw new Error('Authentication token missing in response');
                    }
                } else {
                    // Handle API errors
                    const errorMessage = result.message ||
                        result.error ||
                        `Login failed with status ${response.status}`;

                    console.error('Login failed:', errorMessage);
                    setMsg(loginMessage, errorMessage, 'error');

                    // Highlight problematic fields
                    if (result.errors) {
                        Object.entries(result.errors).forEach(([field, message]) => {
                            const input = loginForm.querySelector(`[name="${field}"]`);
                            if (input) {
                                input.classList.add('input-error');
                                // Remove error class after user starts typing
                                input.addEventListener('input', function clearError() {
                                    this.classList.remove('input-error');
                                    this.removeEventListener('input', clearError);
                                }, { once: true });
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Network/Request error:', error);
                setMsg(loginMessage,
                    `Error: ${error.message || 'Failed to connect to server. Please try again.'}`,
                    'error'
                );
            }
        } catch (error) {
            console.error('Unexpected error during login:', error);
            setMsg(loginMessage, 'An unexpected error occurred. Please try again.', 'error');
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
} else {
    console.error('Login form not found in the DOM');
}

function clearMessages() {
    setMsg(signupMessage, '', '');
    setMsg(loginMessage, '', '');
}
function setMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = type ? `message ${type}` : 'message';
}

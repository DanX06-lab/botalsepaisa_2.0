(() => {
  const TOKEN_KEY = 'token';
  const _hostname = window.location.hostname;
  const API_BASE =
  (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
    ? window.location.origin
    : "https://botalsepaisa-2-0.onrender.com";
  const POLL_MS = 10000;

  const els = {
    nameSpan: document.querySelector('#user-name'),
    bottles: document.querySelector('#bottles-returned'),
    upi: document.querySelector('#total-earnings'),
    balance: document.querySelector('#current-balance'),
    withdrawBtn: document.querySelector('#withdraw-btn'),
    withdrawMsg: document.querySelector('#withdraw-msg'),
    recyclingRate: document.querySelector('#recycling-rate'),
    activity: document.querySelector('#activity-list')
  };

  let socket;
  let isSocketConnected = false;

  // Enhanced Socket.IO initialization with better error handling
  function initSocket() {
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
      console.warn('⚠️ Socket.IO client not loaded. Using polling mode only.');
      return false;
    }

    try {
      console.log('🔌 Initializing Socket.IO connection...');

      const token = localStorage.getItem(TOKEN_KEY);
      socket = io({
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });

      socket.on('connect', () => {
        console.log('✅ Socket.IO connected successfully:', socket.id);
        isSocketConnected = true;

        // Join user-specific room
        if (token) {
          socket.emit('join-user-room', { token });
        }

        showNotification('🔗 Real-time updates connected', 'success');
      });

      socket.on('disconnect', (reason) => {
        console.warn('❌ Socket.IO disconnected:', reason);
        isSocketConnected = false;
        showNotification('⚠️ Real-time updates disconnected', 'warning');
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        isSocketConnected = false;
        showNotification('❌ Real-time connection failed', 'error');
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
        isSocketConnected = true;
        showNotification('✅ Real-time updates restored', 'success');
      });

      // Listen for QR status updates
      socket.on('qr-status-update', (data) => {
        console.log('📱 Received QR update:', data);
        showNotification(data.message, data.status === 'approved' ? 'success' : 'info');
        loadQRActivity();
        loadMetrics(); // Immediately reload metrics
      });

      // Listen for metric updates
      socket.on('metrics-update', (data) => {
        console.log('📊 Metrics updated:', data);
        loadMetrics();
      });

      return true;

    } catch (error) {
      console.error('❌ Socket initialization error:', error);
      showNotification('❌ Real-time setup failed', 'error');
      return false;
    }
  }

  // Enhanced notification system
  function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    let notification = document.querySelector('.dashboard-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'dashboard-notification';
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 999;
        max-width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
        font-size: 14px;
        ${type === 'success' ? 'background: linear-gradient(135deg, #00D68F, #00b377);' :
          type === 'error' ? 'background: linear-gradient(135deg, #FF3D71, #e0285a);' :
            type === 'warning' ? 'background: linear-gradient(135deg, #FFAA00, #e69900);' :
              'background: linear-gradient(135deg, #0095FF, #0077cc);'}
      `;

      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.style.display = 'block';

    // Auto-hide notification
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.style.display = 'none';
        notification.style.opacity = '1';
      }, 300);
    }, 5000);
  }

  // Token helpers
  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  function logoutRedirect() {
    localStorage.removeItem(TOKEN_KEY);
    if (socket) socket.disconnect();
    window.location.replace('login.html');
  }

  // Enhanced API fetch
  async function apiGet(path) {
    const token = getToken();
    if (!token) {
      logoutRedirect();
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logoutRedirect();
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error for ${path}:`, error.message);
      return null;
    }
  }

  function setText(element, value) {
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  // Load user profile
  async function loadProfile() {
    const profileData = await apiGet('/api/users/me');
    if (profileData?.user?.name) {
      setText(els.nameSpan, profileData.user.name);
    }
  }

  // Load metrics
  async function loadMetrics() {
    const metricsData = await apiGet('/api/users/metrics');
    if (!metricsData) {
      console.warn('⚠️ No metrics data received');
      return;
    }

    try {
      const withdrawableAmt = metricsData.balance || 0;
      const pendingAmt = metricsData.pendingBalance || 0;
      const totalAmt = withdrawableAmt + pendingAmt;

      setText(els.bottles, String(metricsData.bottlesReturned ?? 0));
      setText(els.upi, `₹${totalAmt.toFixed(2)}`); 
      setText(els.balance, `₹${totalAmt.toFixed(2)}`);

      // Handle Withdrawal Button State
      if (els.withdrawBtn) {
        const minWithdrawal = 20;
        if (withdrawableAmt >= minWithdrawal) {
          els.withdrawBtn.style.opacity = '1';
          els.withdrawBtn.style.cursor = 'pointer';
          if(els.withdrawMsg) {
             els.withdrawMsg.textContent = 'Ready to withdraw!';
             els.withdrawMsg.style.color = 'var(--success)';
          }
          els.withdrawBtn.onclick = () => {
            alert(`Initiating withdrawal of ₹${withdrawableAmt.toFixed(2)} to your bank account...`);
          };
        } else {
          els.withdrawBtn.style.opacity = '0.5';
          els.withdrawBtn.style.cursor = 'not-allowed';
          if(els.withdrawMsg) {
             els.withdrawMsg.textContent = `₹${(minWithdrawal - withdrawableAmt).toFixed(2)} more needed to withdraw`;
             els.withdrawMsg.style.color = 'var(--text-muted)';
          }
          els.withdrawBtn.onclick = null;
        }
      }

      // Update recycling rate
      if (els.recyclingRate && typeof metricsData.recyclingRate === 'number') {
        const pct = Math.min(100, Math.round(metricsData.recyclingRate));
        els.recyclingRate.textContent = `${pct}%`;
        const wrap = els.recyclingRate.closest('.progress-circle-wrap');
        if(wrap) {
            wrap.style.background = `conic-gradient(var(--accent-primary) ${pct}%, rgba(255,255,255,0.05) 0)`;
        }
      }

      console.log('📊 Metrics updated successfully');

    } catch (error) {
      console.error('❌ Error updating metrics display:', error);
    }
  }

  // Load QR activity
  async function loadQRActivity() {
    try {
      const data = await apiGet('/api/qr/my-scans');
      if (data && data.success) {
        displayRecentQRActivity(data.data?.scans || data.bottles || data.scans || []);
      }
    } catch (error) {
      console.error('❌ Load QR activity error:', error);
    }
  }

  // Display QR activity
  function displayRecentQRActivity(scans) {
    if (!els.activity) return;

    els.activity.innerHTML = '';
    els.activity.classList.remove('empty-activity');

    if (scans.length === 0) {
      els.activity.classList.add('empty-activity');
      els.activity.innerHTML = `
        <div class="empty-icon"><i class='bx bx-history'></i></div>
        <h4 style="margin-bottom: 6px; font-size: 0.9rem;">No recent activity</h4>
        <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 16px;">Start recycling to earn Paisa!</p>
        <a href="qr.html" class="btn-secondary" style="display: inline-block; padding: 10px 20px; text-decoration: none; border-radius: 20px;">Find a machine</a>
      `;
      return;
    }

    scans.slice(0, 3).forEach(scan => {
      const date = new Date(scan.scannedAt || scan.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short'
      });
      const isCompleted = scan.status === 'completed' || scan.status === 'approved';
      const statusColor = isCompleted ? 'var(--success)' : 'var(--warning)';
      const statusText = isCompleted ? 'COMPLETED' : 'PENDING';
      const value = isCompleted ? `₹${scan.reward || 5}` : '---';

      const html = `
        <div style="display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,138,0,0.1); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                <i class='bx bx-recycle'></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 4px;">Bottle Return</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${date} • <span style="color: ${statusColor}; font-weight:700;">${statusText}</span></div>
            </div>
            <div style="text-align: right; font-weight: 700; color: var(--accent-secondary); font-size: 1rem;">
                ${value}
            </div>
        </div>
      `;
      els.activity.insertAdjacentHTML('beforeend', html);
    });
  }

  // Main update cycle
  let errorCount = 0;
  async function cycle() {
    try {
      await Promise.all([
        loadProfile(),
        loadMetrics(),
        loadQRActivity()
      ]);

      errorCount = 0;
      setTimeout(cycle, POLL_MS);

    } catch (error) {
      console.error('❌ Update cycle error:', error);
      errorCount++;
      const backoffDelay = Math.min(POLL_MS * Math.pow(2, errorCount), 60000);
      setTimeout(cycle, backoffDelay);
    }
  }

  // Handle logout
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[href="login.html"]')) {
      localStorage.removeItem(TOKEN_KEY);
      if (socket) socket.disconnect();
    }
  });

  // Initialize dashboard
  function init() {
    const token = getToken();
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    console.log('🚀 Initializing BotalSePaisa dashboard...');

    // Initialize Socket.IO (if available)
    const socketInitialized = initSocket();

    // Start polling cycle
    cycle();

    console.log(`📡 Socket.IO: ${socketInitialized ? 'Initialized' : 'Not available'}`);
    console.log(`🔄 Polling every ${POLL_MS / 1000} seconds`);

    // Show ready notification
    setTimeout(() => {
      showNotification('🚀 Dashboard ready!', 'success');
    }, 1000);
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(() => {
  const TOKEN_KEY = 'token';
  const API_BASE = 'https://botalsepaisa-2-0.onrender.com';
  const POLL_MS = 10000;

  const els = {
    nameSpan: document.querySelector('#user-name'),
    bottles: document.querySelector('#bottles-returned'),
    upi: document.querySelector('#total-earnings'),
    rank: document.querySelector('#user-rank'),
    balance: document.querySelector('#current-balance'),
    withdrawals: document.querySelector('#total-withdrawals-meta'),
    rewards: document.querySelector('#total-rewards'),
    bottlesMeta: document.querySelector('#bottles-meta'),
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
        updateActivity(data);
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
        ${type === 'success' ? 'background: linear-gradient(135deg, #28a745, #20c997);' :
          type === 'error' ? 'background: linear-gradient(135deg, #dc3545, #e74c3c);' :
            type === 'warning' ? 'background: linear-gradient(135deg, #ffc107, #e0a800);' :
              'background: linear-gradient(135deg, #17a2b8, #138496);'}
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

  // Enhanced activity updates
  function updateActivity(data) {
    if (!els.activity) return;

    // Remove loading message
    const loadingItem = Array.from(els.activity.children).find(li =>
      li.textContent.includes('Loading activity') || li.textContent.includes('No recent activity')
    );
    if (loadingItem) {
      loadingItem.remove();
    }

    const li = document.createElement('li');
    const dotClass = data.status === 'approved' ? 'green' :
      data.status === 'rejected' ? 'red' : 'yellow';

    li.innerHTML = `
      <span class="dot ${dotClass}"></span>
      QR ${data.status === 'approved' ? 'Approved ✅' :
        data.status === 'rejected' ? 'Rejected ❌' : 'Pending ⏳'} - 
      ${new Date().toLocaleTimeString()}
    `;

    els.activity.insertBefore(li, els.activity.firstChild);

    // Keep only last 5 activity items
    while (els.activity.children.length > 5) {
      els.activity.removeChild(els.activity.lastChild);
    }
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
          'Content-Type': 'application/json'
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
    const profileData = await apiGet('/users/me');
    if (profileData?.user?.name) {
      setText(els.nameSpan, profileData.user.name);
    }
  }

  // Load metrics
  async function loadMetrics() {
    const metricsData = await apiGet('/users/metrics');
    if (!metricsData) {
      console.warn('⚠️ No metrics data received');
      return;
    }

    try {
      // Update summary cards
      setText(els.bottles, String(metricsData.bottlesReturned ?? 0));
      setText(els.upi, `₹${(metricsData.upiEarned ?? 0).toLocaleString()}`);
      setText(els.rank, `#${metricsData.rank ?? 0}`);

      // Update overview widgets
      setText(els.balance, `₹${(metricsData.balance ?? 0).toFixed(2)}`);
      setText(els.withdrawals, `₹${(metricsData.withdrawals ?? 0).toLocaleString()}`);
      setText(els.rewards, `₹${(metricsData.rewards ?? 0).toLocaleString()}`);
      setText(els.bottlesMeta, String(metricsData.bottlesReturned ?? 0));

      // Update recycling rate
      if (typeof metricsData.recyclingRate === 'number') {
        setText(els.recyclingRate, `${Math.round(metricsData.recyclingRate)}%`);
      }

      console.log('📊 Metrics updated successfully');

    } catch (error) {
      console.error('❌ Error updating metrics display:', error);
    }
  }

  // Load QR activity
  async function loadQRActivity() {
    try {
      const response = await fetch(`${API_BASE}/qr/my-scans`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (response.ok) {
        const data = await response.json();
        displayRecentQRActivity(data.scans || []);
      }
    } catch (error) {
      console.error('❌ Load QR activity error:', error);
    }
  }

  // Display QR activity
  function displayRecentQRActivity(scans) {
    if (!els.activity) return;

    els.activity.innerHTML = '';

    if (scans.length === 0) {
      els.activity.innerHTML = '<li><span class="dot yellow"></span>No recent QR activity</li>';
      return;
    }

    scans.slice(0, 3).forEach(scan => {
      const li = document.createElement('li');
      const dotClass = scan.status === 'approved' ? 'green' :
        scan.status === 'rejected' ? 'red' : 'yellow';

      li.innerHTML = `
        <span class="dot ${dotClass}"></span>
        QR ${scan.qrType || 'bottle_return'} - ${scan.status.toUpperCase()} 
        (${new Date(scan.createdAt).toLocaleDateString()})
      `;
      els.activity.appendChild(li);
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

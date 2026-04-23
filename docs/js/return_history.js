(() => {
  const TOKEN_KEY = 'token';
  const _hostname = window.location.hostname;
  const API_BASE = (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
    ? window.location.origin
    : "https://botalsepaisa-2-0.onrender.com";

  let allTransactions = [];
  let currentFilter = 'all'; // all, completed, pending

  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  async function apiGet(path) {
    const token = getToken();
    if (!token) return null;
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error(`API Error for ${path}:`, error.message);
      return null;
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderTransactions() {
    const listEl = document.getElementById('transactions-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    const filtered = allTransactions.filter(tx => {
      if (currentFilter === 'all') return true;
      const status = (tx.status || 'pending').toLowerCase();
      if (currentFilter === 'completed') return status === 'completed' || status === 'approved';
      if (currentFilter === 'pending') return status === 'pending';
      return true;
    });

    setText('showing-text', `Showing ${filtered.length} records`);

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 2rem; color: var(--text-muted); margin-bottom: 10px;"><i class='bx bx-history'></i></div>
            <div style="color: var(--text-muted);">No transactions found</div>
        </div>
      `;
      return;
    }

    filtered.forEach(tx => {
      const dateStr = new Date(tx.scannedAt || tx.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      
      const status = (tx.status || 'pending').toLowerCase();
      const isCompleted = status === 'completed' || status === 'approved';
      
      // We will map status to UI pills
      let pillHtml = '';
      if (isCompleted) {
        pillHtml = `<span class="badge badge-completed"><i class='bx bx-check'></i> COMPLETED</span>`;
      } else if (status === 'rejected') {
        pillHtml = `<span class="badge badge-rejected"><i class='bx bx-x'></i> REJECTED</span>`;
      } else {
        pillHtml = `<span class="badge badge-pending"><i class='bx bx-time-five'></i> PENDING</span>`;
      }

      const val = isCompleted ? `₹${tx.reward || 5}` : '---';

      const html = `
        <div class="transaction-card">
            <div class="tx-icon"><i class='bx bx-recycle'></i></div>
            <div class="tx-details">
                <div class="tx-id">#BOT-${(tx.qrCode || tx._id || '').substring(0, 4).toUpperCase()}</div>
                <div class="tx-meta"><i class='bx bx-map'></i> Hub • ${dateStr}</div>
                <div style="margin-top: 8px;">${pillHtml}</div>
            </div>
            <div class="tx-right">
                <div class="tx-amount ${status === 'rejected' ? 'rejected' : ''}">${val}</div>
            </div>
        </div>
      `;
      listEl.insertAdjacentHTML('beforeend', html);
    });
  }

  function updateSummary(data) {
    if(!data || !data.bottles) return;
    
    let totalCompleted = 0;
    let earned = 0;
    let countPending = 0;
    let countCompleted = 0;

    data.bottles.forEach(tx => {
      const status = (tx.status || 'pending').toLowerCase();
      if (status === 'completed' || status === 'approved') {
        totalCompleted++;
        earned += (tx.reward || 5);
        countCompleted++;
      } else if (status === 'pending') {
        countPending++;
      }
    });

    setText('count-completed', countCompleted);
    setText('count-pending', countPending);
    
    // Summary
    setText('summary-bottles', totalCompleted);
    setText('summary-earned', `₹${earned.toFixed(2)}`);
  }

  async function loadData() {
    try {
      const data = await apiGet('/api/qr/my-scans');
      if (data && data.success) {
        allTransactions = data.data?.scans || data.bottles || data.scans || [];
        updateSummary({ bottles: allTransactions });
        renderTransactions();
      }
    } catch (error) {
      console.error('Failed to load history', error);
    }
  }

  function setupFilters() {
    const pills = document.querySelectorAll('.pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        const text = pill.textContent.toLowerCase();
        if (text.includes('all')) currentFilter = 'all';
        else if (text.includes('completed')) currentFilter = 'completed';
        else if (text.includes('pending')) currentFilter = 'pending';
        
        renderTransactions();
      });
    });

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      loadData();
    });
    
    document.getElementById('status-filter')?.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      renderTransactions();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.replace('login.html');
        return;
    }
    setupFilters();
    loadData();
  });
})();

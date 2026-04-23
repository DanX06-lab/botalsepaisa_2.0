(() => {
  const TOKEN_KEY = 'token';
  const _hostname = window.location.hostname;
  const API_BASE = (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
    ? window.location.origin
    : "https://botalsepaisa-2-0.onrender.com";

  let myRankData = null;

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

  function renderPodium(top3) {
    const container = document.getElementById('podium-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (top3.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); width:100%; text-align:center;">No data available</div>';
      return;
    }

    // Rearrange to 2 - 1 - 3 order for visual podium
    const ordered = [];
    if (top3[1]) ordered.push({ ...top3[1], pos: 2 });
    if (top3[0]) ordered.push({ ...top3[0], pos: 1 });
    if (top3[2]) ordered.push({ ...top3[2], pos: 3 });

    ordered.forEach(user => {
      const isFirst = user.pos === 1;
      const crownHtml = isFirst ? `<i class='bx bxs-crown crown'></i>` : '';
      
      const html = `
        <div class="podium-item podium-${user.pos}">
            <div class="avatar-wrap">
                ${crownHtml}
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1A2235&color=fff" class="avatar-img">
                <div class="rank-badge">${user.pos}</div>
            </div>
            <div class="p-name">${user.name}</div>
            <div class="p-pts">${user.totalBottles} pts</div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', html);
    });
  }

  function renderList(rest) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (rest.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">No more users</div>';
      return;
    }

    rest.forEach(user => {
      const html = `
        <div class="l-item">
            <div class="l-rank">${user.rank}</div>
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1A2235&color=fff" class="l-avatar">
            <div class="l-info">
                <div class="l-name">${user.name}</div>
                <div class="l-desc">${user.totalBottles} bottles recycled</div>
            </div>
            <div class="l-stats">
                <div class="l-val">&#8377;${user.totalRewards || 0}</div>
                <div class="l-label">REWARDS</div>
            </div>
        </div>
      `;
      list.insertAdjacentHTML('beforeend', html);
    });
  }

  async function loadMyRank() {
    try {
      const metrics = await apiGet('/api/users/metrics');
      if (metrics) {
        myRankData = {
          rank: metrics.rank || '-',
          earned: metrics.upiEarned || 0
        };
        setText('my-rank-num', myRankData.rank);
        setText('my-earned', `₹${myRankData.earned}`);
      }
    } catch (error) {
      console.error('Failed to load my rank', error);
    }
  }

  async function loadLeaderboard() {
    try {
      const data = await apiGet('/api/users/leaderboard');
      if (data && data.success && data.leaderboard) {
        const top3 = data.leaderboard.slice(0, 3);
        const rest = data.leaderboard.slice(3);
        
        renderPodium(top3);
        renderList(rest);
      }
    } catch (error) {
      console.error('Failed to load leaderboard', error);
      document.getElementById('podium-container').innerHTML = '<div style="color:var(--danger); width:100%; text-align:center;">Failed to load</div>';
      document.getElementById('leaderboard-list').innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.replace('login.html');
        return;
    }
    loadLeaderboard();
    loadMyRank();
  });
})();

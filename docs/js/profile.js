(() => {
  const TOKEN_KEY = 'token';
  const _hostname = window.location.hostname;
  const API_BASE = (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
    ? window.location.origin
    : "https://botalsepaisa-2-0.onrender.com";

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

  async function loadProfileData() {
    try {
      const [profileData, metricsData] = await Promise.all([
        apiGet('/api/users/me'),
        apiGet('/api/users/metrics')
      ]);

      if (profileData && profileData.user) {
        setText('profile-name', profileData.user.name);
        setText('profile-email', profileData.user.email);
        setText('detail-name', profileData.user.name);
        setText('detail-email', profileData.user.email);
        const initial = profileData.user.name.charAt(0).toUpperCase();
        document.getElementById('profile-avatar').src = `https://ui-avatars.com/api/?name=${initial}&background=1A2235&color=FF8A00`;
      }

      if (metricsData) {
        setText('profile-wallet', `₹${((metricsData.balance || 0) + (metricsData.pendingBalance || 0)).toFixed(2)}`);
        setText('profile-earned', `₹${(metricsData.upiEarned || 0).toFixed(2)}`);
        setText('profile-bottles', metricsData.bottlesReturned || 0);

        if (metricsData.environmentalImpact) {
            document.getElementById('impact-plastic').innerHTML = `${metricsData.environmentalImpact.plasticDiverted}<span class="ic-unit">kg</span>`;
            document.getElementById('impact-co2').innerHTML = `${metricsData.environmentalImpact.co2Saved}<span class="ic-unit">kg</span>`;
            document.getElementById('impact-water').innerHTML = `${metricsData.environmentalImpact.waterSaved}<span class="ic-unit">L</span>`;
        }

        // Achievements logic (for now just styling based on level)
        if (metricsData.levelName) {
            // Update UI with levelName if there is a spot for it (e.g. next to name)
        }
      }
    } catch (error) {
      console.error('Failed to load profile data', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.replace('login.html');
        return;
    }
    loadProfileData();
  });
})();

(() => {
    const TOKEN_KEY = 'token';
    const hostname = window.location.hostname;
    const API_BASE = (hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("ngrok"))
        ? window.location.origin
        : "https://botalsepaisa-2-0.onrender.com";

    const els = {
        name: document.getElementById('admin-name'),
        list: document.getElementById('pending-list'),
        refreshBtn: document.getElementById('refresh-btn'),
        startScanBtn: document.getElementById('start-scan-btn'),
        stopScanBtn: document.getElementById('stop-scan-btn'),
        scanMsg: document.getElementById('scan-result-msg'),
        status: document.getElementById('scanner-status'),
        logoutBtn: document.getElementById('logout-btn'),
        manualInput: document.getElementById('manual-qr-input'),
        manualBtn: document.getElementById('manual-qr-btn'),
        
        // Modal
        modal: document.getElementById('approval-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalUser: document.getElementById('modal-user'),
        modalReward: document.getElementById('modal-reward'),
        modalComment: document.getElementById('admin-comment'),
        modalCancel: document.getElementById('modal-cancel'),
        modalReject: document.getElementById('modal-reject'),
        modalApprove: document.getElementById('modal-approve')
    };

    let html5QrcodeScanner = null;
    let pendingRequests = [];
    let currentProcessingId = null;

    // ─── API Helper ───
    async function apiRequest(path, method = 'GET', body = null) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            window.location.href = 'admin-login.html';
            return null;
        }

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        };

        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(`${API_BASE}${path}`, options);
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    window.location.href = 'admin-login.html';
                }
                throw new Error(data.message || 'API request failed');
            }
            return data;
        } catch (error) {
            console.error(`API Error (${path}):`, error);
            throw error;
        }
    }

    // ─── Auth Check ───
    async function checkAuth() {
        try {
            const data = await apiRequest('/api/users/me');
            if (!data.user.isAdmin) {
                alert('Access denied. Admins only.');
                window.location.href = 'user.html';
                return;
            }
            els.name.textContent = data.user.name;
        } catch (error) {
            window.location.href = 'admin-login.html';
        }
    }

    // ─── Load Pending Requests ───
    async function loadPendingRequests() {
        els.list.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
        
        try {
            const res = await apiRequest('/api/qr/admin/pending');
            pendingRequests = res.data.requests || [];
            
            if (pendingRequests.length === 0) {
                els.list.innerHTML = '<tr><td colspan="4" class="text-center">No pending requests at the moment.</td></tr>';
                return;
            }
            
            els.list.innerHTML = pendingRequests.map(req => {
                const date = new Date(req.createdAt).toLocaleString('en-IN');
                const reward = req.metadata?.value || 1.00;
                
                return `
                    <tr id="row-${req._id}">
                        <td>
                            <strong>${req.userId?.name || 'Unknown User'}</strong><br>
                            <small style="color:var(--text-muted)">${req.userId?.email || ''}</small>
                        </td>
                        <td style="color:var(--success); font-weight:600;">₹${reward.toFixed(2)}</td>
                        <td>${date}</td>
                        <td>
                            <button class="btn btn-primary btn-sm" onclick="openReviewModal('${req._id}')">Review</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            els.list.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--error)">Failed to load data.</td></tr>`;
        }
    }

    // ─── QR Scanner: Find matching pending request ───
    function onScanSuccess(decodedText) {
        // Stop scanner
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
            els.startScanBtn.style.display = 'inline-block';
            els.stopScanBtn.style.display = 'none';
        }
        
        findAndOpenRequest(decodedText);
    }

    // Find a pending request by QR code and open review modal
    async function findAndOpenRequest(qrCode) {
        console.log('Looking for pending request with QR:', qrCode);
        
        // Fetch the absolute latest pending requests from backend just in case
        // it was scanned very recently and our local list is stale
        try {
            els.status.textContent = 'Fetching...';
            els.status.className = 'badge';
            await loadPendingRequests();
        } catch(e) {
            console.error('Failed to refresh list before scan', e);
        }
        
        const match = pendingRequests.find(r => r.qrCode === qrCode);
        
        if (match) {
            // Highlight the row briefly
            const row = document.getElementById(`row-${match._id}`);
            if (row) {
                row.style.background = 'rgba(59, 130, 246, 0.2)';
                row.style.transition = 'background 0.3s';
                setTimeout(() => { row.style.background = ''; }, 3000);
            }
            
            showScannerMessage(`✅ Found! Request from ${match.userId?.name || 'Unknown'}. Opening review...`, 'success');
            els.status.textContent = 'Match Found ✅';
            els.status.className = 'badge success';
            
            // Open review modal for this request
            setTimeout(() => openReviewModal(match._id), 500);
        } else {
            showScannerMessage(`❌ No pending request found for this QR code.`, 'error');
            els.status.textContent = 'No Match';
            els.status.className = 'badge';
        }
    }

    function showScannerMessage(msg, type) {
        els.scanMsg.textContent = msg;
        els.scanMsg.className = `message ${type}`;
        els.scanMsg.style.display = 'block';
        
        setTimeout(() => {
            els.scanMsg.style.display = 'none';
        }, 5000);
    }

    // ─── Scanner Init ───
    function initScanner() {
        els.startScanBtn.addEventListener('click', () => {
            if (!html5QrcodeScanner) {
                html5QrcodeScanner = new Html5QrcodeScanner(
                    "reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
            }
            
            html5QrcodeScanner.render(onScanSuccess);
            
            els.startScanBtn.style.display = 'none';
            els.stopScanBtn.style.display = 'inline-block';
            els.status.textContent = 'Scanning...';
            els.status.className = 'badge success';
        });

        els.stopScanBtn.addEventListener('click', () => {
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear();
            }
            els.startScanBtn.style.display = 'inline-block';
            els.stopScanBtn.style.display = 'none';
            els.status.textContent = 'Ready';
            els.status.className = 'badge';
        });

        // Manual QR entry
        els.manualBtn.addEventListener('click', () => {
            const qrCode = els.manualInput.value.trim();
            if (!qrCode) {
                showScannerMessage('Please enter a QR code.', 'error');
                return;
            }
            findAndOpenRequest(qrCode);
        });

        els.manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                els.manualBtn.click();
            }
        });
    }

    // ─── Modal Logic ───
    window.openReviewModal = function(requestId) {
        const req = pendingRequests.find(r => r._id === requestId);
        if (!req) return;
        
        currentProcessingId = requestId;
        els.modalTitle.textContent = 'Review Request';
        els.modalUser.textContent = `${req.userId?.name || 'Unknown'} (${req.userId?.email || ''})`;
        els.modalReward.textContent = (req.metadata?.value || 1.00).toFixed(2);
        els.modalComment.value = '';
        
        els.modal.classList.add('show');
    };

    function closeModal() {
        els.modal.classList.remove('show');
        currentProcessingId = null;
    }

    async function processManualAction(action) {
        if (!currentProcessingId) return;
        
        const comment = els.modalComment.value.trim();
        const originalText = action === 'approve' ? els.modalApprove.textContent : els.modalReject.textContent;
        const btn = action === 'approve' ? els.modalApprove : els.modalReject;
        
        btn.textContent = 'Processing...';
        btn.disabled = true;

        try {
            const result = await apiRequest('/api/qr/admin/process', 'POST', {
                requestId: currentProcessingId,
                action: action,
                comment: comment
            });
            
            closeModal();
            showScannerMessage(
                action === 'approve' 
                    ? `✅ Approved! ₹${result.data?.reward || 0} credited to user.` 
                    : '❌ Request rejected.',
                action === 'approve' ? 'success' : 'error'
            );
            
            // Refresh the pending list
            loadPendingRequests();
        } catch (error) {
            alert(error.message || 'Failed to process request');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // ─── Event Listeners ───
    els.refreshBtn.addEventListener('click', loadPendingRequests);
    els.modalCancel.addEventListener('click', closeModal);
    els.modalApprove.addEventListener('click', () => processManualAction('approve'));
    els.modalReject.addEventListener('click', () => processManualAction('reject'));
    
    els.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('isAdmin');
        window.location.href = 'admin-login.html';
    });

    // ─── Init ───
    checkAuth();
    loadPendingRequests();
    initScanner();
})();

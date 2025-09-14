(() => {
    console.log('📊 User Transaction History Loading...');

    // API Configuration
    const API_CONFIG = {
        ngrok: 'https://botalsepaisa-user-server.onrender.com',
        local: 'http://localhost:6000/api/admin'
    };

    let currentApiBase = null;
    let currentUser = null;
    let allTransactions = [];
    let filteredTransactions = [];

    // Get working API base
    async function getApiBase() {
        if (currentApiBase) return currentApiBase;

        try {
            const response = await fetch(`${API_CONFIG.ngrok}/health`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (response.ok) {
                currentApiBase = API_CONFIG.ngrok;
                return currentApiBase;
            }
        } catch (e) {
            console.log('Ngrok not available, trying localhost...');
        }

        try {
            const response = await fetch(`${API_CONFIG.local}/health`);
            if (response.ok) {
                currentApiBase = API_CONFIG.local;
                return currentApiBase;
            }
        } catch (e) {
            console.log('Localhost not available');
        }

        throw new Error('No API endpoints available');
    }

    // Get current user ID
    function getCurrentUser() {
        return localStorage.getItem('userId') || 'user_' + Date.now();
    }

    // Load user transaction history
    async function loadUserTransactions() {
        try {
            showLoading();

            const apiBase = await getApiBase();
            const userId = getCurrentUser();
            currentUser = userId;

            console.log('📊 Loading transactions for user:', userId);

            // Fetch user's transaction history
            const response = await fetch(`${apiBase}/all-bottles-history?userId=${userId}&limit=100`, {
                headers: {
                    'Authorization': 'Bearer admin123',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                allTransactions = data.bottles.map(bottle => ({
                    bottleId: bottle.qrCode,
                    dateReturned: bottle.scannedAt,
                    processedAt: bottle.approvedAt || bottle.rejectedAt,
                    location: 'BotalSePaisa Collection Center',
                    status: bottle.status,
                    reward: bottle.reward,
                    rewardText: bottle.reward === 0.5 ? '₹0.50 (50p)' : `₹${bottle.reward.toFixed(2)}`,
                    rejectionReason: bottle.rejectionReason,
                    processingTimeMinutes: bottle.processingTimeMinutes,
                    adminId: bottle.approvedBy
                }));

                filteredTransactions = [...allTransactions];
                displayTransactions(filteredTransactions);
                updateSummaryStats(allTransactions);

                console.log('✅ Loaded', allTransactions.length, 'transactions');
            } else {
                throw new Error(data.message || 'Failed to load transactions');
            }

        } catch (error) {
            console.error('❌ Error loading transactions:', error);
            showError(error.message);
            loadDemoData(); // Fallback to demo data
        }
    }

    // Display transactions in table
    function displayTransactions(transactions) {
        const tbody = document.getElementById('history-table-body');

        if (!tbody) {
            console.error('Table body not found');
            return;
        }

        if (transactions.length === 0) {
            showEmptyState();
            return;
        }

        tbody.innerHTML = transactions.map((transaction, index) => {
            const dateReturned = formatDate(transaction.dateReturned);
            const processedDate = transaction.processedAt ? formatDate(transaction.processedAt) : 'Processing...';
            const bottleId = transaction.bottleId.length > 15 ?
                transaction.bottleId.substring(0, 15) + '...' : transaction.bottleId;

            // Determine reward display based on status
            let rewardDisplay = '';
            if (transaction.status === 'completed') {
                rewardDisplay = `<span style="color: var(--success-green); font-weight: 700;">${transaction.rewardText}</span>`;
            } else if (transaction.status === 'pending') {
                rewardDisplay = `<span style="color: var(--warning-orange); font-weight: 700;">${transaction.rewardText} (Pending)</span>`;
            } else {
                rewardDisplay = `<span style="color: var(--error-red); font-weight: 700;">₹0 (Rejected)</span>`;
            }

            return `
                <tr style="animation-delay: ${index * 0.1}s;" onclick="showTransactionDetails('${transaction.bottleId}')">
                    <td title="${transaction.bottleId}">${bottleId}</td>
                    <td>${dateReturned}</td>
                    <td>${transaction.location}</td>
                    <td><span class="status ${transaction.status}">${transaction.status}</span></td>
                    <td>${rewardDisplay}</td>
                </tr>
            `;
        }).join('');

        // Add click to view details functionality
        addRowClickHandlers();
    }

    // Add click handlers for transaction details
    function addRowClickHandlers() {
        const rows = document.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.style.cursor = 'pointer';
        });
    }

    // Show transaction details modal
    function showTransactionDetails(bottleId) {
        const transaction = allTransactions.find(t => t.bottleId === bottleId);
        if (!transaction) return;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        `;

        const statusIcon = transaction.status === 'completed' ? '✅' :
            transaction.status === 'pending' ? '⏳' : '❌';

        const statusColor = transaction.status === 'completed' ? 'var(--success-green)' :
            transaction.status === 'pending' ? 'var(--warning-orange)' : 'var(--error-red)';

        modal.innerHTML = `
            <div style="
                background: var(--panel-bg);
                border-radius: 16px;
                padding: 2rem;
                max-width: 500px;
                width: 90%;
                color: var(--text-light);
                font-family: var(--font-main);
                border: 2px solid var(--accent-amber);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
            ">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">${statusIcon}</div>
                    <h2 style="color: var(--accent-amber); margin-bottom: 1rem;">Transaction Details</h2>
                </div>
                
                <div style="background: rgba(245, 158, 11, 0.1); padding: 1.5rem; border-radius: 0.8rem; margin-bottom: 1.5rem; border-left: 4px solid var(--accent-amber);">
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Bottle ID:</span>
                            <span style="font-family: monospace; color: var(--accent-amber); font-weight: 600;">${transaction.bottleId}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Scanned Date:</span>
                            <span style="font-weight: 600;">${formatDateTime(transaction.dateReturned)}</span>
                        </div>
                        ${transaction.processedAt ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Processed Date:</span>
                                <span style="font-weight: 600;">${formatDateTime(transaction.processedAt)}</span>
                            </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Status:</span>
                            <span style="color: ${statusColor}; font-weight: 700; text-transform: capitalize;">${statusIcon} ${transaction.status}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Reward:</span>
                            <span style="font-weight: 700; font-size: 1.2rem; color: ${statusColor};">${transaction.status === 'rejected' ? '₹0' : transaction.rewardText}</span>
                        </div>
                        ${transaction.processingTimeMinutes ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Processing Time:</span>
                                <span style="font-weight: 600;">${transaction.processingTimeMinutes} minutes</span>
                            </div>
                        ` : ''}
                        ${transaction.adminId ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Processed By:</span>
                                <span style="font-weight: 600;">${transaction.adminId}</span>
                            </div>
                        ` : ''}
                        ${transaction.rejectionReason ? `
                            <div style="margin-top: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 0.5rem; border-left: 3px solid var(--error-red);">
                                <div style="color: var(--error-red); font-weight: 600; margin-bottom: 0.5rem;">Rejection Reason:</div>
                                <div style="color: var(--text-light); font-size: 0.9rem;">${transaction.rejectionReason}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <button onclick="this.closest('div').parentNode.remove()" style="
                        background: var(--accent-amber);
                        color: var(--dark-blue);
                        border: none;
                        padding: 1rem 2rem;
                        border-radius: 0.8rem;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: var(--font-main);
                        transition: all 0.3s ease;
                    ">
                        Close Details
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Update summary statistics
    function updateSummaryStats(transactions) {
        const stats = {
            total: transactions.length,
            completed: transactions.filter(t => t.status === 'completed').length,
            pending: transactions.filter(t => t.status === 'pending').length,
            rejected: transactions.filter(t => t.status === 'rejected').length,
            totalEarned: transactions.filter(t => t.status === 'completed')
                .reduce((sum, t) => sum + t.reward, 0)
        };

        // Add summary stats section if it doesn't exist
        let summarySection = document.querySelector('.summary-stats');
        if (!summarySection) {
            summarySection = document.createElement('div');
            summarySection.className = 'summary-stats';
            summarySection.innerHTML = `
                <div class="stat-card success">
                    <span class="stat-value" id="completed-count">0</span>
                    <span class="stat-label">Completed</span>
                </div>
                <div class="stat-card warning">
                    <span class="stat-value" id="pending-count">0</span>
                    <span class="stat-label">Pending</span>
                </div>
                <div class="stat-card error">
                    <span class="stat-value" id="rejected-count">0</span>
                    <span class="stat-label">Rejected</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" id="total-earned">₹0</span>
                    <span class="stat-label">Total Earned</span>
                </div>
            `;

            const container = document.querySelector('.container');
            const filterSection = document.querySelector('.filter-section');
            container.insertBefore(summarySection, filterSection.nextSibling);
        }

        // Update values
        document.getElementById('completed-count').textContent = stats.completed;
        document.getElementById('pending-count').textContent = stats.pending;
        document.getElementById('rejected-count').textContent = stats.rejected;
        document.getElementById('total-earned').textContent = `₹${stats.totalEarned.toFixed(2)}`;

        console.log('📊 Summary stats:', stats);
    }

    // Apply filters
    function applyFilters() {
        const dateFilter = document.getElementById('date-filter').value;
        const statusFilter = document.getElementById('status-filter').value;

        filteredTransactions = allTransactions.filter(transaction => {
            let matchesDate = true;
            let matchesStatus = true;

            if (dateFilter) {
                const transactionDate = new Date(transaction.dateReturned).toISOString().split('T')[0];
                matchesDate = transactionDate === dateFilter;
            }

            if (statusFilter) {
                matchesStatus = transaction.status === statusFilter;
            }

            return matchesDate && matchesStatus;
        });

        displayTransactions(filteredTransactions);
        updateSummaryStats(filteredTransactions);

        console.log('🔍 Filters applied. Showing', filteredTransactions.length, 'of', allTransactions.length, 'transactions');
    }

    // Clear filters
    function clearFilters() {
        document.getElementById('date-filter').value = '';
        document.getElementById('status-filter').value = '';

        filteredTransactions = [...allTransactions];
        displayTransactions(filteredTransactions);
        updateSummaryStats(allTransactions);

        console.log('🗑️ Filters cleared');
    }

    // Format date for display
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN');
    }

    // Format date and time for details
    function formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN');
    }

    // Show loading state
    function showLoading() {
        const tbody = document.getElementById('history-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="loading">
                        <div class="loading-spinner"></div>
                        Loading your transaction history...
                    </td>
                </tr>
            `;
        }
    }

    // Show error state
    function showError(message) {
        const tbody = document.getElementById('history-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--error-red);">
                        <div style="font-size: 2rem; margin-bottom: 1rem;">❌</div>
                        <strong>Error loading transactions:</strong><br>
                        ${message}<br><br>
                        <em style="color: var(--text-muted);">Loading demo data instead...</em>
                    </td>
                </tr>
            `;
        }
    }

    // Show empty state
    function showEmptyState() {
        const tbody = document.getElementById('history-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <h3>No Transaction History</h3>
                        <p>You haven't scanned any bottles yet. Start scanning QR codes to see your transaction history here!</p>
                        <div style="margin-top: 1.5rem;">
                            <a href="user-qr.html" style="
                                background: var(--accent-amber);
                                color: var(--dark-blue);
                                padding: 0.8rem 1.5rem;
                                border-radius: 0.8rem;
                                text-decoration: none;
                                font-weight: 600;
                                display: inline-block;
                                transition: all 0.3s ease;
                            ">📱 Scan Your First Bottle</a>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // Load demo data as fallback
    function loadDemoData() {
        const now = Date.now();
        const demoTransactions = [
            {
                bottleId: 'BSP_S_1757757154964_1',
                dateReturned: new Date(now - 86400000), // 1 day ago
                processedAt: new Date(now - 86000000),
                location: 'BotalSePaisa Collection Center',
                status: 'completed',
                reward: 0.5,
                rewardText: '₹0.50 (50p)',
                processingTimeMinutes: 7,
                adminId: 'admin1'
            },
            {
                bottleId: 'BSP_M_1757757154964_2',
                dateReturned: new Date(now - 172800000), // 2 days ago
                processedAt: null,
                location: 'BotalSePaisa Collection Center',
                status: 'pending',
                reward: 1.00,
                rewardText: '₹1.00',
                processingTimeMinutes: null,
                adminId: null
            },
            {
                bottleId: 'BSP_XL_1757757154964_3',
                dateReturned: new Date(now - 259200000), // 3 days ago
                processedAt: new Date(now - 258600000),
                location: 'BotalSePaisa Collection Center',
                status: 'rejected',
                reward: 0,
                rewardText: '₹2.00',
                rejectionReason: 'Physical bottle not received at collection center',
                processingTimeMinutes: 10,
                adminId: 'admin2'
            }
        ];

        allTransactions = demoTransactions;
        filteredTransactions = [...allTransactions];
        displayTransactions(filteredTransactions);
        updateSummaryStats(allTransactions);

        console.log('📊 Demo data loaded');
    }

    // Setup event listeners
    function setupEventListeners() {
        // Filter events
        document.getElementById('date-filter')?.addEventListener('change', applyFilters);
        document.getElementById('status-filter')?.addEventListener('change', applyFilters);
        document.getElementById('clear-filters')?.addEventListener('click', clearFilters);

        console.log('📝 Event listeners setup complete');
    }

    // Auto-refresh data every 30 seconds
    function startAutoRefresh() {
        setInterval(() => {
            console.log('🔄 Auto-refreshing transaction data...');
            loadUserTransactions();
        }, 30000); // 30 seconds
    }

    // Initialize
    function init() {
        console.log('📊 Initializing User Transaction History...');

        setupEventListeners();
        loadUserTransactions();

        // Start auto-refresh after initial load
        setTimeout(startAutoRefresh, 5000);

        console.log('✅ Transaction history initialized for user:', getCurrentUser());
    }

    // Make global functions available
    window.showTransactionDetails = showTransactionDetails;
    window.applyFilters = applyFilters;
    window.clearFilters = clearFilters;

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ User Transaction History script loaded');
})();

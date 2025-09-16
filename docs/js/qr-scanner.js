(() => {
    console.log('👤 User QR Scanner with New Workflow...');

    window.qrScanner = {
        html5QrCode: null,
        isScanning: false,
        socket: null,
        scannedData: null
    };

    // API Configuration
    const API_CONFIG = {
        ngrok: 'https://botalsepaisa-2-0.onrender.com',
        local: 'http://localhost:6000/api/admin'
    };
    let currentApiBase = null;

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

    // Auth check
    function checkAuth() {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
            // Create guest user if no auth
            const guestId = 'user_' + Date.now();
            localStorage.setItem('userId', guestId);
            localStorage.setItem('token', 'guest_token');
            console.log('Created guest user:', guestId);
            return true;
        }
        return true;
    }

    // Get current user ID
    function getCurrentUserId() {
        return localStorage.getItem('userId') || 'user_' + Date.now();
    }

    window.goBack = function () {
        window.location.href = 'user.html';
    }

    // Simple status update
    function updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('scan-status');
        if (statusEl) {
            statusEl.innerHTML = `<p class="status-message ${type}">${message}</p>`;
        }
        console.log(`[${type}] ${message}`);
    }

    // Socket connection (optional - for real-time updates)
    async function initSocket() {
        try {
            if (typeof io !== 'undefined') {
                const token = localStorage.getItem('token');
                window.qrScanner.socket = io({
                    auth: { token },
                    transports: ['websocket', 'polling']
                });

                window.qrScanner.socket.on('connect', () => {
                    console.log('✅ Socket connected');
                });

                window.qrScanner.socket.on('qr-status-update', (data) => {
                    console.log('📱 QR Status Update received:', data);
                    if (data.status === 'approved') {
                        updateStatus(`🎉 Approved! You earned ${data.rewardText}!`, 'success');
                        showSuccess(data.reward, data.rewardText);
                    } else if (data.status === 'rejected') {
                        updateStatus(`❌ Rejected: ${data.message}`, 'error');
                        showRejected(data.message);
                    }
                });
            }
        } catch (error) {
            console.error('Socket failed:', error);
        }
    }

    // Camera Start
    async function startCamera() {
        try {
            updateStatus('📷 Starting camera...', 'loading');

            if (typeof Html5Qrcode === 'undefined') {
                throw new Error('QR library not loaded');
            }

            // Stop existing
            if (window.qrScanner.html5QrCode) {
                try {
                    await window.qrScanner.html5QrCode.stop();
                    await window.qrScanner.html5QrCode.clear();
                } catch (e) { }
            }

            // New instance
            window.qrScanner.html5QrCode = new Html5Qrcode("qr-reader");

            // Try different camera configs
            const configs = [
                { facingMode: "environment" },
                { facingMode: "user" }
            ];

            let started = false;
            for (const config of configs) {
                try {
                    await window.qrScanner.html5QrCode.start(
                        config,
                        {
                            fps: 10,
                            qrbox: 250
                        },
                        (decodedText) => {
                            console.log('🎯 QR Scanned:', decodedText);
                            onQRSuccess(decodedText);
                        },
                        (error) => {
                            // Silent errors
                        }
                    );
                    started = true;
                    break;
                } catch (err) {
                    continue;
                }
            }

            if (!started) {
                throw new Error('Camera not available');
            }

            window.qrScanner.isScanning = true;
            updateStatus('🎯 Point camera at BotalSePaisa QR code', 'success');

            // Hide placeholder
            const placeholder = document.getElementById('scanner-placeholder');
            const controls = document.getElementById('scanner-controls');
            if (placeholder) placeholder.style.display = 'none';
            if (controls) controls.style.display = 'flex';

        } catch (error) {
            console.error('Camera failed:', error);
            updateStatus('❌ Camera failed. Use image upload or try again.', 'error');
        }
    }

    // NEW WORKFLOW: QR SUCCESS - Send to backend
    async function onQRSuccess(qrText) {
        console.log('✅ QR detected:', qrText);

        // Stop camera immediately
        if (window.qrScanner.isScanning) {
            try {
                await window.qrScanner.html5QrCode.stop();
                window.qrScanner.isScanning = false;
                console.log('📷 Camera stopped after scan');
            } catch (e) {
                console.log('Camera stop error:', e);
            }
        }

        // Get user ID
        const userId = getCurrentUserId();

        // Show initial detection
        showInitialResult(qrText);

        // Process QR with backend
        try {
            updateStatus('🔄 Verifying QR code...', 'loading');

            const apiBase = await getApiBase();
            const response = await fetch(`${apiBase}/user-scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    qrCode: qrText,
                    userId: userId
                })
            });

            const result = await response.json();
            console.log('📡 User scan response:', result);

            if (result.success) {
                // SUCCESS - Show pending verification
                updateStatus('✅ QR scanned successfully!', 'success');
                showPendingVerification(result.bottle);

                // Emit socket event if connected
                if (window.qrScanner.socket) {
                    window.qrScanner.socket.emit('user-qr-scanned', {
                        qrCode: qrText,
                        userId: userId,
                        bottle: result.bottle
                    });
                }

            } else {
                // ERROR - Show specific error
                updateStatus('❌ QR scan failed', 'error');
                showErrorResult(result.message, result.status);
            }

        } catch (error) {
            console.error('❌ QR processing error:', error);
            updateStatus('❌ Network error', 'error');
            showErrorResult('Network error. Please check your connection and try again.', 'network_error');
        }
    }

    // Show initial QR detection
    function showInitialResult(qrText) {
        const results = document.getElementById('scan-results');
        const display = document.getElementById('qr-data-display');

        if (results && display) {
            display.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <h3 style="color: #f59e0b;">QR Code Detected!</h3>
                    <div style="font-family: monospace; background: #f3f4f6; padding: 0.5rem; border-radius: 0.5rem; margin: 1rem 0; font-size: 0.8rem; word-break: break-all;">
                        ${qrText.substring(0, 50)}${qrText.length > 50 ? '...' : ''}
                    </div>
                    <div style="font-size: 1rem; color: #666; margin: 1rem 0;">
                        Verifying with server...
                    </div>
                    <div class="loading-spinner" style="margin: 1rem auto; width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #f59e0b; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
            `;
            results.style.display = 'block';
        }
    }

    // Show pending verification (SUCCESS)
    function showPendingVerification(bottle) {
        const display = document.getElementById('qr-data-display');
        if (display) {
            const rewardText = bottle.rewardText || (bottle.reward === 0.5 ? '50 paisa' : `₹${bottle.reward}`);

            display.innerHTML = `
                <div style="text-align: center; padding: 2.5rem; background: linear-gradient(135deg, #10b981, #34d399); border-radius: 1rem; color: white; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3); animation: slideUp 0.5s ease;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 1.5s infinite;">🎉</div>
                    
                    <h2 style="color: white; margin-bottom: 1rem; font-size: 1.8rem; font-weight: 700;">
                        QR Scan Successful! 🌟
                    </h2>
                    
                    <div style="font-size: 2.2rem; font-weight: bold; margin-bottom: 1.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        Pending Verification ⏳
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.2); padding: 1.5rem; border-radius: 0.8rem; margin-bottom: 1.5rem; backdrop-filter: blur(10px);">
                        <p style="font-size: 1.1rem; margin-bottom: 0.8rem; line-height: 1.5; font-weight: 600;">
                            🎊 Your bottle scan is with our admin team! 🎊
                        </p>
                        <p style="font-size: 1rem; margin-bottom: 0.8rem; opacity: 0.95;">
                            💰 You'll get ${rewardText} once admin verifies your bottle
                        </p>
                        <p style="font-size: 0.9rem; opacity: 0.9;">
                            🚀 Keep recycling to help save our planet!
                        </p>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: center; margin: 1.5rem 0;">
                        <div style="background: rgba(255,255,255,0.15); padding: 0.8rem 1.2rem; border-radius: 0.5rem; backdrop-filter: blur(5px);">
                            <div style="font-size: 0.9rem; opacity: 0.9;">💰 Reward</div>
                            <div style="font-size: 1.1rem; font-weight: bold;">${rewardText}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.15); padding: 0.8rem 1.2rem; border-radius: 0.5rem; backdrop-filter: blur(5px);">
                            <div style="font-size: 0.9rem; opacity: 0.9;">📋 Status</div>
                            <div style="font-size: 1.1rem; font-weight: bold;">Pending</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 0.5rem; border: 1px dashed rgba(255,255,255,0.3);">
                        <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">
                            💡 <strong>What happens next?</strong>
                        </div>
                        <div style="font-size: 0.8rem; opacity: 0.8; line-height: 1.4;">
                            Our admin will verify your bottle and add ${rewardText} to your wallet once approved! 🔔
                        </div>
                    </div>
                    
                    <button onclick="goBackToDashboard()" style="width: 100%; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 1rem; border-radius: 0.8rem; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1.5rem; backdrop-filter: blur(5px); transition: all 0.2s;">
                        ← Back to Dashboard
                    </button>
                </div>
            `;
        }

        // Play success sound and show confetti
        playSuccessSound();
        showConfetti();
    }

    // Show error result with specific messages
    function showErrorResult(errorMessage, errorType) {
        const display = document.getElementById('qr-data-display');
        if (display) {
            let title = 'Scan Failed';
            let actionButton = '';
            let suggestion = '';

            if (errorType === 'already_completed') {
                title = 'Already Rewarded';
                suggestion = 'This bottle has already been processed and rewarded.';
                actionButton = `
                    <button onclick="goBackToDashboard()" style="background: white; color: #ef4444; border: none; padding: 0.8rem 1.2rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-right: 0.5rem;">
                        ← Dashboard
                    </button>
                `;
            } else if (errorType === 'already_pending') {
                title = 'Already Submitted';
                suggestion = 'This QR is already waiting for admin verification.';
                actionButton = `
                    <button onclick="goBackToDashboard()" style="background: white; color: #ef4444; border: none; padding: 0.8rem 1.2rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-right: 0.5rem;">
                        ← Dashboard
                    </button>
                `;
            } else if (errorType === 'already_rejected') {
                title = 'Previously Rejected';
                suggestion = 'This bottle was rejected by admin. Try with a different bottle.';
                actionButton = `
                    <button onclick="resetAndRestart()" style="background: white; color: #ef4444; border: none; padding: 0.8rem 1.2rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-right: 0.5rem;">
                        Try Another QR
                    </button>
                `;
            } else if (errorType === 'invalid_qr') {
                title = 'Invalid QR Code';
                suggestion = 'Please use a valid BotalSePaisa QR code from your bottle.';
                actionButton = `
                    <button onclick="resetAndRestart()" style="background: white; color: #ef4444; border: none; padding: 0.8rem 1.2rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-right: 0.5rem;">
                        Scan Valid QR
                    </button>
                `;
            } else {
                actionButton = `
                    <button onclick="resetAndRestart()" style="background: white; color: #ef4444; border: none; padding: 0.8rem 1.2rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-right: 0.5rem;">
                        Try Again
                    </button>
                `;
            }

            display.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #ef4444, #f87171); border-radius: 1rem; color: white; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h3 style="color: white; margin-bottom: 1rem;">${title}</h3>
                    <div style="background: rgba(255,255,255,0.2); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                        <p style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Message:</strong></p>
                        <p style="font-size: 0.85rem; line-height: 1.4;">${errorMessage}</p>
                        ${suggestion ? `<p style="font-size: 0.8rem; line-height: 1.4; margin-top: 0.8rem; opacity: 0.9;">${suggestion}</p>` : ''}
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap;">
                        ${actionButton}
                        <button onclick="goBackToDashboard()" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 0.8rem 1.2rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer;">
                            ← Dashboard
                        </button>
                    </div>
                </div>
            `;

            const results = document.getElementById('scan-results');
            if (results) results.style.display = 'block';
        }
    }

    // Show admin approved success
    function showSuccess(reward, rewardText) {
        const display = document.getElementById('qr-data-display');
        if (display) {
            display.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #10b981, #34d399); border-radius: 1rem; color: white; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);">
                    <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite;">✅</div>
                    <h3 style="color: white; font-size: 1.8rem; margin-bottom: 1rem;">Approved!</h3>
                    <div style="font-size: 2rem; color: white; font-weight: bold; margin: 1rem 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        +${rewardText}
                    </div>
                    <p style="color: white; font-size: 1.1rem; margin-bottom: 1rem;">
                        🎉 Reward added to your balance! 🎉
                    </p>
                    <div style="background: rgba(255,255,255,0.2); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                        <p style="font-size: 0.9rem; color: white; opacity: 0.9;">
                            💰 Check your wallet - money has been credited!
                        </p>
                    </div>
                    
                    <button onclick="goBackToDashboard()" style="width: 100%; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 1rem; border-radius: 0.8rem; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1rem;">
                        ← Back to Dashboard
                    </button>
                </div>
            `;
        }

        showConfetti();
    }

    // Show rejected message
    function showRejected(message) {
        const display = document.getElementById('qr-data-display');
        if (display) {
            display.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #ef4444, #f87171); border-radius: 1rem; color: white; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h3 style="color: white; margin-bottom: 1rem;">Request Rejected</h3>
                    <div style="background: rgba(255,255,255,0.2); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                        <p style="font-size: 0.9rem; margin-bottom: 0.5rem;"><strong>Admin Message:</strong></p>
                        <p style="font-size: 0.85rem; line-height: 1.4;">${message || 'Please try again with a valid bottle.'}</p>
                    </div>
                    
                    <button onclick="goBackToDashboard()" style="width: 100%; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 1rem; border-radius: 0.8rem; font-size: 1rem; font-weight: 600; cursor: pointer;">
                        ← Back to Dashboard
                    </button>
                </div>
            `;

            const results = document.getElementById('scan-results');
            if (results) results.style.display = 'block';
        }
    }

    // Play success sound
    function playSuccessSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Audio not supported');
        }
    }

    // Show confetti animation
    function showConfetti() {
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.innerHTML = ['🎉', '🌟', '💰', '🎊', '✨', '🎈', '🥳'][Math.floor(Math.random() * 7)];
                confetti.style.position = 'fixed';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.top = '-10px';
                confetti.style.fontSize = (Math.random() * 1 + 1.2) + 'rem';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '9999';
                confetti.style.animation = `confetti-fall ${Math.random() * 2 + 3}s linear forwards`;

                document.body.appendChild(confetti);

                setTimeout(() => {
                    if (document.body.contains(confetti)) {
                        document.body.removeChild(confetti);
                    }
                }, 5000);
            }, i * 100);
        }
    }

    // File upload handler - Also uses new workflow
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        updateStatus('📁 Processing image...', 'loading');

        try {
            const tempScanner = new Html5Qrcode("qr-reader");
            const result = await tempScanner.scanFile(file, true);

            console.log('📁 QR found in file:', result);
            onQRSuccess(result);

        } catch (error) {
            updateStatus('❌ No QR code found in image', 'error');
            showErrorResult('No valid QR code found in the uploaded image. Please try with a clear image of your bottle QR code.', 'invalid_file');
        }
    }

    // Reset and restart - Manual only
    function resetAndRestart() {
        window.qrScanner.scannedData = null;

        const results = document.getElementById('scan-results');
        if (results) results.style.display = 'none';

        updateStatus('🔄 Ready for next scan...', 'info');

        // Restart camera
        setTimeout(() => startCamera(), 500);
    }

    // Go back to dashboard
    function goBackToDashboard() {
        window.location.href = 'user.html';
    }

    // Make functions global
    window.resetAndRestart = resetAndRestart;
    window.goBackToDashboard = goBackToDashboard;

    // Event listeners
    function setupEvents() {
        document.getElementById('start-camera-btn')?.addEventListener('click', startCamera);
        document.getElementById('stop-camera-btn')?.addEventListener('click', () => {
            if (window.qrScanner.html5QrCode && window.qrScanner.isScanning) {
                window.qrScanner.html5QrCode.stop();
                window.qrScanner.isScanning = false;
                updateStatus('Camera stopped', 'info');
            }
        });
        document.getElementById('file-input')?.addEventListener('change', handleFileUpload);
    }

    // Initialize
    async function init() {
        console.log('👤 Initializing User QR Scanner with New Workflow...');

        if (!checkAuth()) return;

        setupEvents();
        await initSocket();

        updateStatus('📷 Starting camera automatically...', 'loading');

        // Auto start camera
        setTimeout(() => startCamera(), 1000);

        console.log('✅ User QR Scanner ready!');
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(50px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bounce {
            0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
            40%, 43% { transform: translate3d(0,-30px,0); }
            70% { transform: translate3d(0,-15px,0); }
            90% { transform: translate3d(0,-4px,0); }
        }

        @keyframes confetti-fall {
            0% { 
                transform: translateY(-10px) rotate(0deg); 
                opacity: 1; 
            }
            100% { 
                transform: translateY(100vh) rotate(360deg); 
                opacity: 0; 
            }
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading-spinner {
            display: inline-block;
        }
    `;
    document.head.appendChild(style);

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

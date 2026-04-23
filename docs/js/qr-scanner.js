(() => {
    console.log('👤 Initializing Scanner for new UI...');

    window.qrScanner = {
        html5QrCode: null,
        isScanning: false,
    };

    const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.includes("ngrok"))
        ? window.location.origin
        : "https://botalsepaisa-2-0.onrender.com";

    function getToken() { return localStorage.getItem('token'); }

    async function startCamera() {
        try {
            if (typeof Html5Qrcode === 'undefined') {
                console.error('QR library not loaded');
                return;
            }

            if (window.qrScanner.html5QrCode) {
                try {
                    await window.qrScanner.html5QrCode.stop();
                    await window.qrScanner.html5QrCode.clear();
                } catch (e) { }
            }

            window.qrScanner.html5QrCode = new Html5Qrcode("reader");

            try {
                // First try to explicitly get the rear camera (environment)
                await window.qrScanner.html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => onQRSuccess(decodedText),
                    (error) => {}
                );
                window.qrScanner.isScanning = true;
            } catch (err) {
                console.log("Rear camera failed, falling back to default camera", err);
                try {
                    // Fallback to whatever default camera the browser gives us (useful for laptops with only 1 webcam)
                    const devices = await Html5Qrcode.getCameras();
                    if (devices && devices.length > 0) {
                        await window.qrScanner.html5QrCode.start(
                            devices[0].id,
                            { fps: 10, qrbox: { width: 250, height: 250 } },
                            (decodedText) => onQRSuccess(decodedText),
                            (error) => {}
                        );
                        window.qrScanner.isScanning = true;
                    } else {
                        throw new Error("No cameras found");
                    }
                } catch (fallbackErr) {
                    console.error("All camera attempts failed:", fallbackErr);
                    alert('Camera failed. Please check your browser permissions.');
                }
            }
    }

    async function onQRSuccess(qrText) {
        if (window.qrScanner.isScanning) {
            try {
                await window.qrScanner.html5QrCode.stop();
                window.qrScanner.isScanning = false;
            } catch (e) {}
        }

        processQR(qrText);
    }

    async function processQR(qrText) {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/qr/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ qrData: qrText })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showSuccessOverlay();
            } else {
                alert(result.message || 'QR scan failed');
                startCamera(); // restart on failure
            }
        } catch (error) {
            alert('Network error during scan.');
            startCamera();
        }
    }

    function showSuccessOverlay() {
        const overlay = document.getElementById('success-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
        playSuccessSound();
    }

    function playSuccessSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {}
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!getToken()) {
            window.location.replace('login.html');
            return;
        }

        // Auto start camera
        setTimeout(() => startCamera(), 500);

        // Manual entry listener
        const manualSubmit = document.getElementById('manual-submit');
        if (manualSubmit) {
            manualSubmit.addEventListener('click', () => {
                const val = document.getElementById('manual-input').value.trim();
                if (val) processQR(val);
            });
        }
        
        const restartBtn = document.getElementById('restart-btn');
        if(restartBtn) {
            restartBtn.addEventListener('click', () => {
                startCamera();
            });
        }
    });
})();

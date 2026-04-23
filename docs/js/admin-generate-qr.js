(() => {
    // API Configuration
    const _hostname = window.location.hostname;
    const API_BASE = (_hostname === "localhost" || _hostname === "127.0.0.1" || _hostname.includes("ngrok"))
        ? window.location.origin
        : "https://botalsepaisa-2-0.onrender.com";

    const form = document.getElementById('qr-generator-form');
    const generateBtn = document.getElementById('generate-btn');
    const qrResult = document.getElementById('qr-result');
    const qrImage = document.getElementById('qr-image');
    const downloadLink = document.getElementById('download-link');
    const statusMsg = document.getElementById('status-message');

    // Auto-update reward value based on size
    const sizeSelect = document.getElementById('bottle-size');
    const valueInput = document.getElementById('reward-value');
    
    sizeSelect.addEventListener('change', (e) => {
        const size = e.target.value;
        if (size === '250ml') valueInput.value = '0.50';
        else if (size === '500ml') valueInput.value = '1.00';
        else if (size === '1ltr') valueInput.value = '1.00';
        else if (size === '2ltr') valueInput.value = '2.00';
    });

    function showStatus(msg, isError = false) {
        statusMsg.textContent = msg;
        statusMsg.style.display = 'block';
        if (isError) {
            statusMsg.className = 'message error';
        } else {
            statusMsg.className = 'message';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const size = sizeSelect.value;
        const value = parseFloat(valueInput.value);

        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        statusMsg.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE}/api/qr/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    type: 'bottle_return',
                    value: value,
                    metadata: { size: size }
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Show QR code
                qrImage.src = data.qrCode;
                downloadLink.href = data.qrCode;
                downloadLink.download = `bsp_qr_${size}_${Date.now()}.png`;
                
                form.style.display = 'none';
                qrResult.style.display = 'block';
            } else {
                if (response.status === 403) {
                    showStatus('Access Denied. You do not have Admin privileges.', true);
                } else {
                    showStatus(data.message || 'Failed to generate QR code', true);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            showStatus('Network error. Please try again.', true);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate QR Code';
        }
    });

    window.resetForm = function() {
        qrResult.style.display = 'none';
        form.style.display = 'block';
        statusMsg.style.display = 'none';
    };

    // Check if user is logged in
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
    }
})();

const express = require('express');
const router = express.Router();
const qrController = require('../controllers/QrController'); // Make sure path is correct
const auth = require('../middlewares/authMiddleware');
const adminAuth = require('../middlewares/adminMiddleware');

// Verify all controller functions exist
console.log('QR Controller functions:', Object.keys(qrController));

// QR Code Routes
router.post('/generate', auth, adminAuth, qrController.generateQR);
router.post('/scan', auth, qrController.scanQR);
router.get('/my-scans', auth, qrController.getUserScans);
router.get('/admin/pending', auth, adminAuth, qrController.getPendingRequests);
router.post('/admin/process', auth, adminAuth, qrController.processRequest);

module.exports = router;

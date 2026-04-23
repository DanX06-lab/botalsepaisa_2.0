const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/authMiddleware');

// Public routes
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Protected routes (require JWT token)
router.get('/me', auth, userController.me);
router.get('/metrics', auth, userController.metrics);
router.get('/activity', auth, userController.activity);
router.get('/history', auth, userController.history);
router.get('/leaderboard', auth, userController.getLeaderboard);

module.exports = router;

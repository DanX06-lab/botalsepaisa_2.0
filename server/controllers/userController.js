const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const BottleReturn = require('../models/BottleReturn');
const Transaction = require('../models/Transaction');
const Leaderboard = require('../models/Leaderboard');
const UserStats = require('../models/UserStats');

exports.signup = async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email, and password are required' });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const user = new User({ name, email, password });
    await user.save();
    console.log(`New user registered: ${email}`);
    return res.status(201).json({ message: 'Signup successful' });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  console.log('Login attempt received');
  
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    console.log('Missing credentials - Email or password not provided');
    return res.status(400).json({ 
      success: false,
      message: 'Email and password are required' 
    });
  }

  try {
    console.log(`Looking up user: ${email}`);
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    console.log('User found, comparing password...');
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    console.log('Password match, generating token...');
    const token = jwt.sign(
      { 
        id: user._id.toString(), 
        email: user.email 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    console.log(`✅ User logged in successfully: ${email}`);
    return res.json({ 
      success: true,
      token, 
      user: { 
        name: user.name, 
        email: user.email 
      } 
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Get personalized metrics for each user
exports.metrics = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Try to get cached stats first (faster)
    const cached = await UserStats.findOne({ userId }).lean();
    
    let bottlesReturned, upiEarned, withdrawals, rewards, balance, recyclingRate;

    if (cached) {
      // Use cached values
      bottlesReturned = cached.bottlesReturnedTotal || 0;
      upiEarned = cached.upiEarnedTotal || 0;
      withdrawals = cached.withdrawalsTotal || 0;
      rewards = cached.rewardsTotal || 0;
      balance = cached.balance || 0;
      recyclingRate = cached.recyclingRate || 0;
    } else {
      // Calculate from raw data (slower but real-time)
      
      // Get total bottles returned by this user
      bottlesReturned = await BottleReturn.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$count' } } }
      ]).then(a => a[0]?.total || 0);

      // Get transaction totals by type for this user
      const transactionTotals = await Transaction.aggregate([
        { $match: { userId } },
        { $group: { _id: '$kind', total: { $sum: '$amount' } } }
      ]);

      const transMap = Object.fromEntries(transactionTotals.map(t => [t._id, t.total]));
      upiEarned = transMap.credit || 0;
      withdrawals = transMap.withdrawal || 0;
      rewards = transMap.reward || 0;
      balance = upiEarned + rewards - withdrawals;
      recyclingRate = bottlesReturned > 0 ? Math.min(100, (bottlesReturned * 10)) : 0; // Example calculation
    }

    // Get user's rank
    const leaderboardEntry = await Leaderboard.findOne({ userId }).select('rank').lean();
    const rank = leaderboardEntry?.rank || 0;

    return res.json({
      bottlesReturned,
      upiEarned,
      withdrawals,
      rewards,
      balance,
      rank,
      recyclingRate
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Get recent activity for this user
exports.activity = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const recentReturns = await BottleReturn.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type count value createdAt')
      .lean();

    const items = recentReturns.map(item => ({
      type: 'bottle_return',
      description: `Returned ${item.count} ${item.type || 'bottles'}`,
      value: item.value,
      date: item.createdAt
    }));

    return res.json({ items });
  } catch (error) {
    console.error('Activity error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

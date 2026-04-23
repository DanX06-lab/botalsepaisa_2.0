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
        email: user.email,
        isAdmin: user.isAdmin || false
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
        email: user.email,
        isAdmin: user.isAdmin || false
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
    const user = await User.findById(req.user.id).select('name email isAdmin');
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

    // Calculate user's rank dynamically
    const higherRankedUsers = await BottleReturn.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$userId', totalBottles: { $sum: '$count' } } },
      { $match: { totalBottles: { $gt: bottlesReturned } } },
      { $count: 'count' }
    ]);
    const rank = bottlesReturned > 0 ? (higherRankedUsers[0]?.count || 0) + 1 : 0;
    
    // Also send pending balance
    const pendingBalance = cached ? (cached.pendingBalance || 0) : 0;

    // Calculcate Environmental Impact
    const environmentalImpact = {
      plasticDiverted: parseFloat((bottlesReturned * 0.025).toFixed(2)),
      co2Saved: parseFloat((bottlesReturned * 0.1).toFixed(2)),
      waterSaved: parseFloat((bottlesReturned * 0.6).toFixed(2))
    };

    // Calculate Achievements & Levels
    const level = Math.floor(bottlesReturned / 20) + 1;
    let levelName = 'Recruit';
    if (level >= 2) levelName = 'Active Recycler';
    if (level >= 4) levelName = 'Eco Warrior';
    if (level >= 8) levelName = 'Planet Saver';

    const achievements = [];
    if (bottlesReturned > 0) achievements.push({ id: 'first_scan', name: 'First Scan', unlocked: true });
    if (bottlesReturned >= 10) achievements.push({ id: 'eco_warrior', name: 'Eco Warrior', unlocked: true });
    if (bottlesReturned >= 50) achievements.push({ id: 'tree_planter', name: 'Tree Planter', unlocked: true });

    return res.json({
      bottlesReturned,
      upiEarned,
      withdrawals,
      rewards,
      balance,
      pendingBalance,
      rank,
      recyclingRate,
      environmentalImpact,
      level,
      levelName,
      achievements
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

// NEW: Get full return history for a user
exports.history = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const returns = await BottleReturn.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Map to the format expected by the updated return.html
    const bottles = returns.map(item => ({
      qrCode: item._id.toString(), // We use the document ID as a fallback bottle ID
      scannedAt: item.createdAt,
      status: item.status,
      reward: item.value || 0
    }));

    return res.json({ success: true, bottles });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// NEW: Get monthly leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const date = new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    
    // Aggregate bottles returned this month
    const leaderboard = await BottleReturn.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startOfMonth },
          status: 'completed'
        } 
      },
      { 
        $group: { 
          _id: '$userId', 
          totalBottles: { $sum: '$count' },
          totalRewards: { $sum: '$value' }
        } 
      },
      { $sort: { totalBottles: -1 } },
      { $limit: 10 },
      { 
        $lookup: { 
          from: 'users', 
          localField: '_id', 
          foreignField: '_id', 
          as: 'user' 
        } 
      },
      { $unwind: '$user' },
      { 
        $project: { 
          userId: '$_id',
          name: '$user.name', 
          totalBottles: 1,
          totalRewards: 1
        } 
      }
    ]);
    
    // Add rank
    const rankedLeaderboard = leaderboard.map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    return res.json({ 
      success: true, 
      month: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      leaderboard: rankedLeaderboard 
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

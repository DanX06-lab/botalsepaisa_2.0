const QRCode = require('../models/QRCode');
const BottleReturn = require('../models/BottleReturn');
const Transaction = require('../models/Transaction');
const QRScanRequest = require('../models/QRScanRequest');
const UserStats = require('../models/UserStats');
const User = require('../models/User');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

// Generate QR Code
exports.generateQR = async (req, res) => {
  try {
    const { type, value, metadata } = req.body;
    const codeId = uuidv4();

    const qrCodeRecord = new QRCode({
      codeId,
      type: type || 'bottle_return',
      value: value || 1.00,
      metadata
    });

    await qrCodeRecord.save();

    const qrData = JSON.stringify({
      id: codeId,
      type: type || 'bottle_return',
      value: value || 1.00
    });

    const qrCodeDataURL = await qrcode.toDataURL(qrData);

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      codeId,
      data: qrData
    });
  } catch (error) {
    console.error('❌ Generate QR error:', error);
    res.status(500).json({
      success: false,
      message: 'QR generation failed'
    });
  }
};

// FIXED: Scan QR Code - NO AUTO APPROVAL
exports.scanQR = async (req, res) => {
  try {
    const { qrData } = req.body;
    const userId = req.user.id;

    console.log('📱 QR Scan Request:', { userId, qrData, isAdmin: req.user.isAdmin });

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    if (req.user.isAdmin) {
      // Hub Admin Verification Flow
      console.log('🛡️ Admin scanning QR code for verification:', qrData);

      const pendingRequest = await QRScanRequest.findOne({
        qrCode: qrData,
        status: 'pending'
      });

      if (!pendingRequest) {
        return res.status(400).json({
          success: false,
          message: 'No pending request found for this bottle. Either it was never scanned by a user, or already verified.'
        });
      }

      // Found the pending request, approve it!
      pendingRequest.status = 'approved';
      pendingRequest.adminId = req.user.id;
      pendingRequest.processedAt = new Date();
      await pendingRequest.save();

      const rewardValue = pendingRequest.metadata?.value || 1.00;
      const originalUserId = pendingRequest.userId;

      // Update User Stats
      const userStats = await UserStats.findOne({ userId: originalUserId });
      if (userStats) {
        userStats.pendingBalance = Math.max(0, (userStats.pendingBalance || 0) - rewardValue);
        userStats.balance = (userStats.balance || 0) + rewardValue;
        userStats.bottlesReturnedTotal += 1;
        userStats.rewardsTotal += rewardValue;
        await userStats.save();
      }

      // Create Transaction
      const transaction = new Transaction({
        userId: originalUserId,
        type: 'bottle_return',
        amount: rewardValue,
        status: 'completed',
        metadata: {
          qrCode: qrData,
          adminId: req.user.id
        }
      });
      await transaction.save();

      // Mark QR code as inactive so it can't be reused
      await QRCode.updateOne({ codeId: pendingRequest.qrCode }, { isActive: false });

      // Notify original user
      if (req.io) {
        req.io.emit('qr-status-update', {
          userId: originalUserId,
          status: 'approved',
          message: `✅ Bottle Verified at Hub! ₹${rewardValue.toFixed(2)} moved to your withdrawable balance.`,
          reward: rewardValue
        });
      }

      return res.json({
        success: true,
        message: 'Bottle Verified & Approved successfully.',
        data: {
          reward: rewardValue
        }
      });
    }

    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: 'QR data is required'
      });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(qrData);
    } catch (e) {
      console.log('🔄 QR not JSON, creating default structure');
      parsedData = {
        id: qrData.startsWith('BSP_') ? qrData : `BSP_M_${Date.now()}`,
        type: 'bottle_return',
        value: 1.00
      };
    }

    console.log('📤 Parsed data:', parsedData);

    // Auto-create QR record if doesn't exist
    let qrRecord = await QRCode.findOne({ codeId: parsedData.id });

    if (!qrRecord) {
      console.log('🔄 Creating QR record for:', parsedData.id);
      qrRecord = new QRCode({
        codeId: parsedData.id,
        type: parsedData.type || 'bottle_return',
        value: parsedData.value || 1.00,
        isActive: true,
        metadata: {
          autoCreated: true,
          originalQR: qrData,
          createdAt: new Date()
        }
      });

      await qrRecord.save();
      console.log('✅ QR record created');
    }

    // Check for existing pending request from this user
    const existingRequest = await QRScanRequest.findOne({
      userId,
      qrCode: qrData,
      status: 'pending'
    });

    if (existingRequest) {
      return res.json({
        success: true,
        status: 'pending',
        message: 'Verification already pending for this QR code',
        data: {
          requestId: existingRequest._id,
          reward: parsedData.value || 1.00
        }
      });
    }

    // Check if already approved by anyone
    const approvedRequest = await QRScanRequest.findOne({
      qrCode: qrData,
      status: 'approved'
    });

    if (approvedRequest) {
      return res.status(400).json({
        success: false,
        message: 'QR code already used and approved'
      });
    }

    // Create new scan request
    const scanRequest = new QRScanRequest({
      userId,
      qrCode: qrData,
      qrType: parsedData.type || 'bottle_return',
      metadata: {
        value: parsedData.value || 1.00,
        scannedAt: new Date(),
        bottleSize: parsedData.size || '500ml',
        originalQRData: qrData
      }
    });

    await scanRequest.save();
    console.log('✅ Scan request created:', scanRequest._id);

    // Add to pending balance
    const userStats = await UserStats.findOne({ userId });
    if (userStats) {
      userStats.pendingBalance = (userStats.pendingBalance || 0) + (parsedData.value || 1.00);
      await userStats.save();
    } else {
      await UserStats.create({
        userId,
        pendingBalance: (parsedData.value || 1.00)
      });
    }

    // REMOVED: Auto-approval - Admin will approve manually
    // setTimeout(async () => {
    //   try {
    //     await autoApproveRequest(scanRequest._id, req.io, userId);
    //   } catch (error) {
    //     console.error('❌ Auto-approval error:', error);
    //   }
    // }, 3000);

    // Notify admins
    if (req.io) {
      req.io.emit('admin-notification', {
        type: 'new-qr-scan',
        data: {
          requestId: scanRequest._id,
          userId,
          qrType: parsedData.type,
          value: parsedData.value || 1.00
        }
      });
    }

    res.json({
      success: true,
      status: 'pending',
      message: 'QR code scanned successfully! Awaiting admin verification.',
      data: {
        requestId: scanRequest._id,
        reward: parsedData.value || 1.00,
        estimatedApproval: 'Admin verification required'
      }
    });

  } catch (error) {
    console.error('❌ Scan QR error:', error);
    res.status(500).json({
      success: false,
      message: 'QR scan processing failed. Please try again.'
    });
  }
};

// Auto-approve function (kept for admin manual approval)
async function autoApproveRequest(requestId, io, userId) {
  try {
    const request = await QRScanRequest.findById(requestId);
    if (!request || request.status !== 'pending') {
      console.log('⚠️ Request not found or already processed');
      return;
    }

    let qrData;
    try {
      qrData = JSON.parse(request.qrCode);
    } catch (e) {
      qrData = {
        value: request.metadata?.value || 1.00,
        type: 'bottle_return'
      };
    }

    const rewardAmount = calculateReward(qrData);

    // Update request status
    request.status = 'approved';
    request.processedAt = new Date();
    await request.save();

    // Create bottle return record
    await BottleReturn.create({
      userId: request.userId,
      count: 1,
      type: 'scanned',
      value: rewardAmount,
      bottleSize: qrData.size || '500ml'
    });

    // Create transaction
    await Transaction.create({
      userId: request.userId,
      kind: 'credit',
      type: 'bottle_return',
      amount: rewardAmount,
      description: `Bottle return reward - QR scan`,
      status: 'completed'
    });

    // Update user balance directly
    await User.findByIdAndUpdate(request.userId, {
      $inc: {
        balance: rewardAmount,
        totalEarnings: rewardAmount,
        bottlesReturned: 1
      }
    });

    // Update user stats
    await UserStats.findOneAndUpdate(
      { userId: request.userId },
      {
        $inc: {
          bottlesReturned: 1,
          totalEarnings: rewardAmount,
          currentBalance: rewardAmount
        }
      },
      { upsert: true }
    );

    // Send real-time notification
    if (io) {
      io.to(`user_${userId}`).emit('qr-status-update', {
        requestId: request._id,
        status: 'approved',
        reward: rewardAmount,
        message: `Bottle return approved! You earned ₹${rewardAmount}`
      });

      console.log(`✅ Admin approved QR scan ${requestId} for user ${userId} - Reward: ₹${rewardAmount}`);
    }

  } catch (error) {
    console.error('❌ Auto-approval process error:', error);
  }
}

// Calculate reward function
function calculateReward(qrData) {
  // Use the value from QR data if available
  if (qrData.value && typeof qrData.value === 'number') {
    return qrData.value;
  }

  // Default rewards based on bottle size
  if (qrData.size) {
    const sizeRewards = {
      '250ml': 0.50,
      '500ml': 1.00,
      '1ltr': 1.00,
      '2ltr': 2.00
    };
    return sizeRewards[qrData.size] || 1.00;
  }

  // Default reward
  return 1.00;
}

// Get user's scan history
exports.getUserScans = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const scans = await QRScanRequest.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await QRScanRequest.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        scans,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('❌ Get user scans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scan history'
    });
  }
};

// Get pending requests (for admins)
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await QRScanRequest.find({ status: 'pending' })
      .populate('userId', 'name email phone balance')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    console.error('❌ Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending requests'
    });
  }
};

// Process request (approve/reject) - For Admin Use
exports.processRequest = async (req, res) => {
  try {
    const { requestId, action, comment } = req.body;
    const adminId = req.user.id;

    const request = await QRScanRequest.findById(requestId)
      .populate('userId', 'name email balance');

    if (!request || request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request or already processed'
      });
    }

    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.adminId = adminId;
    request.adminComment = comment;
    request.processedAt = new Date();
    await request.save();

    let rewardAmount = 0;

    if (action === 'approve') {
      let qrData;
      try {
        qrData = JSON.parse(request.qrCode);
      } catch (e) {
        qrData = { value: request.metadata?.value || 1.00 };
      }

      rewardAmount = calculateReward(qrData);

      // Create records
      await BottleReturn.create({
        userId: request.userId._id,
        count: 1,
        type: 'scanned',
        value: rewardAmount
      });

      await Transaction.create({
        userId: request.userId._id,
        kind: 'credit',
        type: 'bottle_return',
        amount: rewardAmount,
        description: `Admin approved bottle return`,
        status: 'completed'
      });

      // Update user balance in User model
      await User.findByIdAndUpdate(request.userId._id, {
        $inc: {
          balance: rewardAmount,
          totalEarnings: rewardAmount,
          bottlesReturned: 1
        }
      });

      // Update user stats in UserStats model
      await UserStats.findOneAndUpdate(
        { userId: request.userId._id },
        {
          $inc: {
            bottlesReturnedTotal: 1,
            upiEarnedTotal: rewardAmount,
            balance: rewardAmount,
            pendingBalance: -rewardAmount
          }
        },
        { upsert: true }
      );
    }

    // Notify user via Socket.IO
    if (req.io) {
      req.io.to(`user_${request.userId._id}`).emit('qr-status-update', {
        requestId: request._id,
        status: request.status,
        reward: rewardAmount,
        message: action === 'approve'
          ? `Your QR code has been verified! You earned ₹${rewardAmount}`
          : `Your QR code was rejected. ${comment || 'Please try again.'}`
      });
    }

    res.json({
      success: true,
      message: `Request ${action}d successfully`,
      data: {
        request,
        reward: rewardAmount
      }
    });

  } catch (error) {
    console.error('❌ Process request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request'
    });
  }
};

// Test endpoint
exports.test = async (req, res) => {
  res.json({
    success: true,
    message: 'QR Controller is working',
    timestamp: new Date().toISOString()
  });
};

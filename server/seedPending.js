const mongoose = require('mongoose');
const dotenv = require('dotenv');
const QRScanRequest = require('./models/QRScanRequest');
const User = require('./models/User');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const users = await User.find({ isAdmin: { $ne: true } }).limit(3);
    
    if (users.length === 0) {
        console.log('No non-admin users found!');
        process.exit(1);
    }

    console.log('Creating pending scan requests for:', users.map(u => u.name));

    for (const user of users) {
        const qrCode = `BSP_BOTTLE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        const request = new QRScanRequest({
            userId: user._id,
            qrCode: qrCode,
            qrType: 'bottle_return',
            status: 'pending',
            metadata: {
                value: 2.00,
                scannedAt: new Date(),
                bottleSize: '500ml',
                originalQRData: qrCode
            }
        });
        
        await request.save();
        console.log(`Created pending request for ${user.name} (QR: ${qrCode})`);
    }

    console.log('\nDone! Now go to Admin Dashboard and hit Refresh to see pending requests.');
    process.exit(0);
});

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const alice = await User.findOne({email: 'alice@example.com'});
    if (!alice) { console.log('Alice not found'); process.exit(1); }
    
    const token = jwt.sign({id: alice._id, isAdmin: alice.isAdmin}, process.env.JWT_SECRET, {expiresIn: '24h'});
    
    const qrPayload = JSON.stringify({id: 'test_bottle_999', type: 'bottle_return', value: 1.00});
    
    const response = await fetch('http://localhost:5000/api/qr/scan', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ qrData: qrPayload })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    process.exit(0);
});

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const UserStats = require('./models/UserStats');
const Transaction = require('./models/Transaction');
const BottleReturn = require('./models/BottleReturn');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const userId = '69ea333c8c2e87e5ee99da64';
    
    const totalBottles = await BottleReturn.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, total: { $sum: '$count' } } }
    ]).then(r => r[0]?.total || 0);
    
    const upiEarned = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), kind: 'credit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(r => r[0]?.total || 0);
    
    await UserStats.findOneAndUpdate(
        { userId },
        { 
            bottlesReturnedTotal: totalBottles, 
            upiEarnedTotal: upiEarned, 
            balance: upiEarned, 
            pendingBalance: 0 
        }
    );
    
    console.log('Fixed User Stats:', totalBottles, 'bottles, ₹' + upiEarned);
    process.exit(0);
});

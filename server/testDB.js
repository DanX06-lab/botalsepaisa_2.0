const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BottleReturn = require('./models/BottleReturn');
const Transaction = require('./models/Transaction');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const returns = await BottleReturn.find();
  console.log('Returns count:', returns.length);
  if (returns.length > 0) {
    console.log('First return:', returns[0]);
  }
  
  const date = new Date();
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
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
  console.log('Leaderboard result:', leaderboard);
  process.exit(0);
});

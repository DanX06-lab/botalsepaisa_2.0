const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const User = require('./models/User');
const BottleReturn = require('./models/BottleReturn');
const Transaction = require('./models/Transaction');

const seedDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create demo users
    const usersData = [
      { name: 'Alice Smith', email: 'alice@example.com', password: 'password123' },
      { name: 'Bob Jones', email: 'bob@example.com', password: 'password123' },
      { name: 'Charlie Brown', email: 'charlie@example.com', password: 'password123' },
      { name: 'Test User', email: 'test@example.com', password: 'password123' } // For the user to login with
    ];

    const users = [];
    for (const u of usersData) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = new User(u);
        await user.save();
      }
      users.push(user);
    }
    console.log('✅ Users created/found');

    // Insert Bottle Returns & Transactions to populate leaderboard and return history
    for (const user of users) {
      // Create 2 returns per user
      for (let i = 0; i < 2; i++) {
        const count = Math.floor(Math.random() * 20) + 5; // 5 to 24 bottles
        const value = count * 2; // Assuming ₹2 per bottle
        
        const bottleReturn = new BottleReturn({
          userId: user._id,
          count: count,
          value: value,
          status: 'completed',
          type: 'manual'
        });
        await bottleReturn.save();
        
        const transaction = new Transaction({
          userId: user._id,
          amount: value,
          kind: 'credit',
          type: 'bottle_return',
          description: `Returned ${count} bottles`
        });
        await transaction.save();
      }
    }

    console.log('🎉 Demo data inserted successfully!');
    console.log('-----------------------------------');
    console.log('You can login with: test@example.com / password123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedDB();

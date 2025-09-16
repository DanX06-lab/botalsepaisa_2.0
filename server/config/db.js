const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('❌ MONGO_URI is not defined in environment variables');
    }

    console.log('🔗 Attempting to connect to MongoDB Atlas...');
    
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📌 Database: ${conn.connection.name}`);
    
    // Log any connection errors after initial connection
    mongoose.connection.on('error', err => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Connection string used:', 
      process.env.MONGO_URI 
        ? process.env.MONGO_URI.substring(0, 50) + '...' 
        : 'Not defined');
    process.exit(1);
  }
};

module.exports = connectDB;

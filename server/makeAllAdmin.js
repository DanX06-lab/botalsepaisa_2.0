const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to DB. Making all existing users admins...');
    const result = await mongoose.connection.collection('users').updateMany(
      {}, 
      { $set: { isAdmin: true } }
    );
    console.log(`Successfully upgraded ${result.modifiedCount} user(s) to Admin status.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to DB:', err);
    process.exit(1);
  });

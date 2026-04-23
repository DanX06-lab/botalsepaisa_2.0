const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Only test@example.com should be admin
    await User.updateMany({}, { isAdmin: false });
    await User.updateOne({ email: 'test@example.com' }, { isAdmin: true });
    
    const users = await User.find({}, 'name email isAdmin');
    users.forEach(u => console.log(u.email, '| isAdmin:', u.isAdmin));
    process.exit(0);
});

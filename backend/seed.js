require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing admins to ensure only one exists
    await User.deleteMany({ role: 'admin' });
    console.log('Cleared existing Administrator accounts');
    
    const admin = new User({
      name: 'System Admin',
      email: 'admin@civic.gov',
      password: 'admin123',
      role: 'admin',
      status: 'approved',
      isEmailVerified: true
    });

    await admin.save();
    console.log('Admin User Created: admin@civic.gov / admin123');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedAdmin();

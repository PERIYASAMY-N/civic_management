require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { getRoleValues } = require('./utils/userAccess');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing admins to ensure only one exists
    await User.deleteMany({ role: { $in: getRoleValues('admin') } });
    console.log('Cleared existing Administrator accounts');
    
    const admin = new User({
      name: 'System Admin',
      email: 'admin@civic.com',
      password: 'admin123',
      role: 'ADMIN',
      status: 'APPROVED',
      isEmailVerified: true
    });

    await admin.save();
    console.log('Admin User Created: admin@civic.com / admin123');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedAdmin();

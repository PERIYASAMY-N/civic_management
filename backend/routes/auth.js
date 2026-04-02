const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { generateOTP, sendOTP } = require('../utils/otp');
const { auth, authorize } = require('../middleware/auth');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/id-proofs/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, JPEG, and PNG images are allowed'));
  }
});

// Multi-step Registration: Step 1 & 2 (Initial Signup)
router.post('/register', upload.single('government_id_proof'), async (req, res) => {
  try {
    const { name, email, password, role, department_id, employee_id, government_id } = req.body;
    
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // Validation for Volunteer role
    if (role === 'volunteer' && !req.file) {
      return res.status(400).json({ message: 'Government ID proof photo is required for Volunteers' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + (process.env.OTP_EXPIRY || 5) * 60000); 

    const userData = {
      name,
      email,
      password,
      role,
      status: 'approved', // Default approved for now
      otp,
      otpExpiry
    };

    // Filter optional fields to avoid CastError from empty strings
    if (department_id && department_id.trim()) {
      // Find department by its human-readable ID (e.g., WATE-0411)
      const dept = await Department.findOne({ department_id: department_id.trim() });
      if (!dept) {
        return res.status(400).json({ 
          message: `Department Code "${department_id}" not found. Please verify with your admin.` 
        });
      }
      userData.department_id = dept._id; // Use the actual ObjectId
    }
    
    if (employee_id && employee_id.trim()) userData.employee_id = employee_id;
    if (government_id && government_id.trim()) userData.government_id = government_id;
    
    // Save file path if uploaded
    if (req.file) {
      userData.government_id_proof = req.file.path.replace(/\\/g, '/');
    }

    user = new User(userData);
    await user.save();
    await sendOTP('email', email, otp);

    res.status(201).json({ 
      message: 'Registration successful. Please verify your email with the OTP sent.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status }
    });
  } catch (err) {
    console.error(`[REGISTRATION ERROR] ${new Date().toISOString()}:`, err);
    res.status(500).json({ 
      message: err.message || 'Server error during registration', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ 
        message: `Account is temporarily locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}` 
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ message: 'Your account is pending approval' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your account application was rejected' });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 3600000); // Lock for 1 hour
      }
      await user.save();
      return res.status(400).json({ 
        message: 'Invalid credentials',
        remainingAttempts: 5 - user.failedLoginAttempts
      });
    }

    // Reset failed attempts on success
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    const token = jwt.sign(
      { id: user._id, role: user.role, dept: user.department_id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 600000); // 10 mins
    await user.save();

    await sendOTP('email', email, otp);
    res.json({ message: 'Password reset OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isEmailVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now log in if approved.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token provided' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token: newToken });
  } catch (err) {
    res.status(403).json({ message: 'Invalid refresh token' });
  }
});

// Get Staff (Workers & Volunteers) for Dept Head
router.get('/staff', auth, authorize('head'), async (req, res) => {
  try {
    const staff = await User.find({
      department_id: req.user.department_id,
      role: { $in: ['worker', 'volunteer'] },
      status: 'approved'
    }).select('name email role');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

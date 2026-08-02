const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const VolunteerCode = require('../models/VolunteerCode');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { generateOTP, sendOTP } = require('../utils/otp');
const { auth, authorize } = require('../middleware/auth');
const {
  getRoleValues,
  getStatusValues,
  hasRole,
  hasStatus,
  normalizeRole,
  normalizeUserForClient
} = require('../utils/userAccess');

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

// Validate Department Code
router.post('/departments/validate-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required' });

    const department = await Department.findOne({ department_id: code.trim() });
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    // Check if the department has an active head. (Using active status for department head might be needed, but checking if head_id is set is a good start, or querying User table)
    const head = await User.findOne({ department_id: department._id, role: { $in: getRoleValues('head') }, status: 'APPROVED' });

    res.json({
      success: true,
      department: {
        id: department._id,
        name: department.name,
        code: department.department_id,
        hasApprovedHead: !!head
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Validate Volunteer Code
router.post('/volunteers/validate-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required' });

    const volunteerCode = await VolunteerCode.findOne({ code: code.trim() }).populate('department_id', 'name department_id');
    
    if (!volunteerCode) {
      return res.status(404).json({ message: 'Volunteer Code not found' });
    }
    if (!volunteerCode.is_active) {
      return res.status(400).json({ message: 'Volunteer Code is no longer active' });
    }
    if (volunteerCode.is_used) {
      return res.status(400).json({ message: 'Volunteer Code has already been used' });
    }

    res.json({
      success: true,
      codeData: {
        code: volunteerCode.code,
        department: volunteerCode.department_id ? {
          id: volunteerCode.department_id._id,
          name: volunteerCode.department_id.name,
          code: volunteerCode.department_id.department_id
        } : null
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Multi-step Registration: Step 1 & 2 (Initial Signup)
router.post('/register', upload.single('government_id_proof'), async (req, res) => {
  try {
    const { name, email, password, role, department_id, employee_id, government_id } = req.body;
    const normalizedRole = normalizeRole(role);
    
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // Validation for Volunteer role
    if (hasRole(normalizedRole, 'volunteer') && !req.file) {
      return res.status(400).json({ message: 'Government ID proof photo is required for Volunteers' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + (process.env.OTP_EXPIRY || 5) * 60000); 

    const userData = {
      name,
      email,
      password,
      role: normalizedRole,
      status: hasRole(normalizedRole, ['worker', 'volunteer', 'head']) ? 'PENDING' : 'APPROVED',
      otp,
      otpExpiry
    };

    const isHead = hasRole(normalizedRole, 'head');
    const isWorker = hasRole(normalizedRole, 'worker');
    const isVolunteer = hasRole(normalizedRole, 'volunteer');

    // Handle Department Code
    if ((isHead || isWorker) && department_id && department_id.trim()) {
      const dept = await Department.findOne({ department_id: department_id.trim() });
      if (!dept) {
        return res.status(400).json({ 
          message: `Department Code "${department_id}" not found. Please verify with your admin.` 
        });
      }

      const activeHead = await User.findOne({ department_id: dept._id, role: { $in: getRoleValues('head') }, status: 'APPROVED' });
      
      if (isHead && activeHead) {
        return res.status(400).json({ message: `Department ${dept.name} already has an active Department Head.` });
      }
      
      if (isWorker && !activeHead) {
        return res.status(400).json({ message: `Department ${dept.name} does not have an approved Department Head yet.` });
      }

      userData.department_id = dept._id;
    }

    // Handle Volunteer Code
    if (isVolunteer) {
      const volunteer_code = req.body.volunteer_code;
      if (!volunteer_code) {
        return res.status(400).json({ message: 'Volunteer Code is required' });
      }
      const vCode = await VolunteerCode.findOne({ code: volunteer_code.trim(), is_active: true, is_used: false });
      if (!vCode) {
        return res.status(400).json({ message: 'Invalid, inactive, or already used Volunteer Code' });
      }
      if (vCode.department_id) {
        userData.department_id = vCode.department_id;
      }
      // Attach the code to the user object temporarily to mark it used after successful save
      userData._volunteerCodeDoc = vCode;
    }
    
    if (employee_id && employee_id.trim()) userData.employee_id = employee_id;
    if (government_id && government_id.trim()) userData.government_id = government_id;
    
    // Save file path if uploaded
    if (req.file) {
      userData.government_id_proof = req.file.path.replace(/\\/g, '/');
    }

    user = new User(userData);
    await user.save();

    if (userData._volunteerCodeDoc) {
      userData._volunteerCodeDoc.is_used = true;
      userData._volunteerCodeDoc.used_by = user._id;
      await userData._volunteerCodeDoc.save();
    }
    await sendOTP('email', email, otp);

    res.status(201).json({ 
      message: 'Registration successful. Please verify your email with the OTP sent.',
      user: normalizeUserForClient({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      })
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
    const user = await User.findOne({ email }).populate('department_id', 'name department_id');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ 
        message: `Account is temporarily locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}` 
      });
    }

    if (hasStatus(user.status, 'pending')) {
      return res.status(403).json({ message: 'Your account is pending approval' });
    }

    if (hasStatus(user.status, 'rejected')) {
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
      user: normalizeUserForClient({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        department_id: user.department_id,
        profile_image: user.profile_image,
        notification_preferences: user.notification_preferences
      })
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
      role: { $in: getRoleValues(['worker', 'volunteer']) },
      status: { $in: getStatusValues('approved') }
    }).select('name email role');
    res.json(staff.map((user) => normalizeUserForClient(user.toObject())));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Pending Staff for Dept Head (Workers) / Admin (Volunteers)
router.get('/pending-staff', auth, authorize('admin', 'head'), async (req, res) => {
  try {
    const query = hasRole(req.user.role, 'admin')
      ? {
          role: { $in: getRoleValues(['head', 'volunteer']) },
          status: { $in: getStatusValues('pending') }
        }
      : {
          role: { $in: getRoleValues('worker') },
          status: { $in: getStatusValues('pending') },
          department_id: req.user.department_id
        };
    
    const staff = await User.find(query)
      .select('name email role status department_id employee_id government_id')
      .populate('department_id', 'name');
    res.json(
      staff.map((user) => {
        const normalizedUser = normalizeUserForClient(user.toObject());
        return {
          ...normalizedUser,
          department: normalizedUser.department_id || null
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

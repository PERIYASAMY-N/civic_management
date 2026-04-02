const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['public', 'admin', 'head', 'worker', 'volunteer'], 
    default: 'public' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'approved' // Default approved for public, admin
  },
  department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, // For Heads and Workers
  employee_id: { type: String },   // For Workers
  government_id: { type: String }, // For Volunteers (Aadhaar/Voter ID)
  government_id_proof: { type: String }, // For Volunteers (File path)
  otp: { type: String },
  otpExpiry: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  isMobileVerified: { type: Boolean, default: false },
  twoFactorEnabled: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  refreshToken: { type: String }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

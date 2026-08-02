const mongoose = require('mongoose');

const volunteerCodeSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  department_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department' 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  },
  is_used: { 
    type: Boolean, 
    default: false 
  },
  used_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

module.exports = mongoose.model('VolunteerCode', volunteerCodeSchema);

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String }, // URL or path
  address: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  location: {
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number }
  },
  status: { 
    type: String, 
    enum: [
      'pending',
      'assigned_to_dept',
      'assigned_to_worker',
      'in_progress',
      'waiting_for_verification',
      'verified',
      'rework_required',
      'completed'
    ], 
    default: 'pending' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  assigned_worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assigned_volunteer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sla_expiry: { type: Date },
  timeline: [
    {
      status: String,
      updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date, default: Date.now },
      comments: String
    }
  ],
  work_proof: {
    before_image: String,
    after_image: String,
    completed_at: Date
  },
  beforeImage: { type: String },
  afterImage: { type: String },
  verification: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verified_at: Date,
    comments: String
  },
  image_context: {
    source: { type: String },
    captured_at: { type: Date },
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    overlay_label: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);

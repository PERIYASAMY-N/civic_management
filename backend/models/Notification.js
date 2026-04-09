const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  message: { type: String, required: true },
  status: {
    type: String,
    enum: ['unread', 'read'],
    default: 'unread'
  },
  read: { type: Boolean, default: false },
  read_at: { type: Date },
  type: { type: String },
  complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

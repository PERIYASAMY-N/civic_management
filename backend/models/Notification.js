const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  type: { type: String },
  complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

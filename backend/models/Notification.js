const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

notificationSchema.pre('validate', function syncUserFields(next) {
  if (!this.userId && this.user_id) {
    this.userId = this.user_id;
  }

  if (!this.user_id && this.userId) {
    this.user_id = this.userId;
  }

  next();
});

module.exports = mongoose.model('Notification', notificationSchema);

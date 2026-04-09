const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

// Get User Notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.id })
      .sort({ read: 1, createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as Read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      {
        read: true,
        status: 'read',
        read_at: new Date()
      },
      { new: true }
    );
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

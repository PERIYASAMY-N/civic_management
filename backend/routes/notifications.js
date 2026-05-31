const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

const getNotificationUserQuery = (userId) => ({
  $or: [
    { userId },
    { user_id: userId }
  ]
});

// Get User Notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      ...getNotificationUserQuery(req.user.id),
      read: false
    })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      ...getNotificationUserQuery(req.user.id)
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    notification.status = 'read';
    notification.read_at = new Date();
    await notification.save();

    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark as Read
router.patch('/:id/read', auth, markNotificationRead);
router.put('/:id/read', auth, markNotificationRead);

module.exports = router;

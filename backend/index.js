require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');

const app = express();

// Ensure upload directories exist
['id-proofs', 'issues', 'proofs', 'profile'].forEach((directory) => {
  const uploadDir = path.join(__dirname, 'uploads', directory);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: true, // Allow any origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logger for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', require('./routes/user'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/images', require('./routes/images'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/tasks', require('./routes/complaints'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/public', require('./routes/public'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `CIVIC_BACKEND_404: route ${req.url} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[UNHANDLED ERROR] ${new Date().toISOString()}:`, err);
  res.status(500).json({ 
    message: 'Internal Server Error', 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

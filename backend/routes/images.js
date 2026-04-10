const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { auth } = require('../middleware/auth');

const router = express.Router();

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const proofsDirectory = path.join(uploadsRoot, 'proofs');
const issuesDirectory = path.join(uploadsRoot, 'issues');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png']);

const captureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, proofsDirectory);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname || '.jpg').toLowerCase() || '.jpg'}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimetype = String(file.mimetype || '').toLowerCase();

    if (supportedExtensions.has(extension || '.jpg') && /^image\/(jpeg|jpg|png)$/.test(mimetype)) {
      return cb(null, true);
    }

    cb(new Error('Only JPG, JPEG, and PNG images are allowed'));
  }
});

const listImagesFromDirectory = (directoryName) => {
  const absoluteDirectory = path.join(uploadsRoot, directoryName);
  if (!fs.existsSync(absoluteDirectory)) {
    return [];
  }

  return fs.readdirSync(absoluteDirectory)
    .filter((fileName) => supportedExtensions.has(path.extname(fileName).toLowerCase()))
    .map((fileName) => {
      const absolutePath = path.join(absoluteDirectory, fileName);
      const stats = fs.statSync(absolutePath);
      return {
        id: `${directoryName}-${fileName}`,
        name: fileName,
        path: `/uploads/${directoryName}/${fileName}`,
        source: directoryName,
        createdAt: stats.mtime
      };
    });
};

router.get('/', auth, async (req, res) => {
  try {
    const images = [
      ...listImagesFromDirectory('proofs'),
      ...listImagesFromDirectory('issues')
    ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

    res.json(images);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/capture', auth, captureUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Captured image is required' });
    }

    res.status(201).json({
      path: `/uploads/proofs/${req.file.filename}`,
      name: req.file.filename,
      source: 'camera_capture'
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

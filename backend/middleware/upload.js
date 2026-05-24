const fs = require('fs');
const path = require('path');
const multer = require('multer');

const TASK_UPLOAD_DIRECTORY = path.join(__dirname, '..', 'uploads', 'tasks');
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

if (!fs.existsSync(TASK_UPLOAD_DIRECTORY)) {
  fs.mkdirSync(TASK_UPLOAD_DIRECTORY, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TASK_UPLOAD_DIRECTORY);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (ALLOWED_MIME_TYPES.has(mimeType) && ALLOWED_EXTENSIONS.has(extension)) {
    return cb(null, true);
  }

  const error = new Error('Only JPG, JPEG, PNG, and WEBP images are allowed');
  error.status = 400;
  return cb(error);
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});

module.exports = upload;

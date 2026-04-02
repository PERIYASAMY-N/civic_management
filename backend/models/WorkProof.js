const mongoose = require('mongoose');

const workProofSchema = new mongoose.Schema({
  complaint_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  before_image: { type: String },
  after_image: { type: String },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('WorkProof', workProofSchema);

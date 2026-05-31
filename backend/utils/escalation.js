const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
require('dotenv').config();

const COMPLETED_STATUSES = ['completed', 'closed'];

const escalateComplaints = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const overdue = await Complaint.find({
      $expr: {
        $not: [
          {
            $in: [
              { $toLower: { $ifNull: ['$status', ''] } },
              COMPLETED_STATUSES
            ]
          }
        ]
      },
      sla_expiry: { $lt: new Date() }
    });

    for (const complaint of overdue) {
      console.log(`[ESCALATION] Complaint ${complaint._id} is overdue. Notifying Admin.`);
      // Logic to notify admin/head would go here
    }

    console.log(`Checked ${overdue.length} overdue complaints.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

escalateComplaints();

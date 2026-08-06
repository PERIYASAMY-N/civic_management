const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Complaint = require('./models/Complaint');

const statusMapping = {
  'pending': 'NEW',
  'assigned_to_dept': 'DEPARTMENT_ASSIGNED',
  'assigned_to_worker': 'ASSIGNED',
  'in_progress': 'IN_PROGRESS',
  'waiting_for_head': 'WAITING_FOR_DEPARTMENT_APPROVAL',
  'waiting_for_verification': 'WAITING_FOR_ADMIN_APPROVAL',
  'verified': 'COMPLETED',
  'completed': 'COMPLETED',
  'rework_required': 'REWORK_REQUIRED',
  'closed': 'CLOSED',
  'PENDING': 'NEW'
};

async function migrate() {
  try {
    console.log('Connecting to MongoDB...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const complaints = await Complaint.find();
    let updatedCount = 0;

    for (const complaint of complaints) {
      let modified = false;

      if (statusMapping[complaint.status]) {
        complaint.status = statusMapping[complaint.status];
        modified = true;
      }

      if (complaint.timeline && complaint.timeline.length > 0) {
        for (const event of complaint.timeline) {
          if (statusMapping[event.status]) {
            event.status = statusMapping[event.status];
            modified = true;
          }
        }
      }

      if (modified) {
        await complaint.save();
        updatedCount++;
      }
    }

    console.log(`Migration completed successfully. Updated ${updatedCount} complaints.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrate();

const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = 'mongodb://127.0.0.1:27017/narra';

async function deleteAdmins() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const result = await User.deleteMany({ role: { $in: ['platformadmin', 'supportadmin'] } });
    console.log(`Deleted ${result.deletedCount} old admin(s)`);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

deleteAdmins();

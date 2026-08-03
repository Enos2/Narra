const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = 'mongodb://127.0.0.1:27017/narra';

const admins = [
  {
    name: 'Platform Admin',
    email: 'platformadmin@narra.com',
    password: 'PlatformPass123!',
    role: 'platformadmin',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Other',
  },
  {
    name: 'Support Admin',
    email: 'supportadmin@narra.com',
    password: 'SupportPass123!',
    role: 'supportadmin',
    dateOfBirth: new Date('1992-02-02'),
    gender: 'Other',
  },
];

const resetAdmins = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    // 1️⃣ Delete old admins
    await User.deleteMany({ role: { $in: ['platformadmin', 'supportadmin'] } });
    console.log('Old admins deleted');

    // 2️⃣ Seed new admins with hashed passwords
    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 12);
      const newAdmin = new User({ ...admin, password: hashedPassword });
      await newAdmin.save();
      console.log(`Admin created: ${admin.email}`);
    }

    console.log('Admins reset complete');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

resetAdmins();

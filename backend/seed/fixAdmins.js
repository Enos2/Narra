// backend/seed/fixAdmins.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: '../.env' });

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
  {
    name: 'Super Admin',
    email: 'superadmin@example.com',
    password: 'SuperAdmin123!',
    role: 'superadmin',
    dateOfBirth: new Date('1990-01-01'),
  },
];

async function fixAdmins() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for fixing admins');

    // Delete old admins
    await User.deleteMany({ role: { $in: ['platformadmin', 'supportadmin', 'superadmin'] } });
    console.log('Old admins deleted');

    // Seed fresh admins with bcrypt-hashed passwords
    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 12);
      const user = new User({ ...admin, password: hashedPassword, isVerified: true });
      await user.save();
      console.log(`Admin created: ${admin.email}`);
    }

    console.log('All admins fixed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing admins:', err);
    process.exit(1);
  }
}

fixAdmins();

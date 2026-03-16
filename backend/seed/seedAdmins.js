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

const seedAdmins = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    for (const admin of admins) {
      const exists = await User.findOne({ email: admin.email });
      if (exists) {
        console.log(`Admin already exists: ${admin.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(admin.password, 12);

      const newAdmin = new User({
        ...admin,
        password: hashedPassword,
      });

      await newAdmin.save();
      console.log(`Admin account created: ${admin.email}`);
    }

    console.log('Admin seeding complete');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedAdmins();

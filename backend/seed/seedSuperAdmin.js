const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Load backend .env explicitly
dotenv.config({ path: '../.env' });

async function seedSuperAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment. Check your .env path.');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for seeding super admin');

    const existing = await User.findOne({ role: 'superadmin' });
    if (existing) {
      console.log('Super admin already exists:', existing.email);
      return process.exit(0);
    }

    const passwordHash = await bcrypt.hash('SuperAdmin123!', 12);

    const superAdmin = new User({
      name: 'Super Admin',
      email: 'superadmin@example.com',
      password: passwordHash,
      role: 'superadmin',
      status: 'active',
      dateOfBirth: new Date('1990-01-01'), // <-- required field
    });

    await superAdmin.save();
    console.log('Super admin created successfully:', superAdmin.email);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding super admin:', err);
    process.exit(1);
  }
}

seedSuperAdmin();

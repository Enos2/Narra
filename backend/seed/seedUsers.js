const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = 'mongodb://127.0.0.1:27017/narra';

// Seed users (all required fields included)
const users = [
  {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'password123',
    role: 'user',
    isCreator: true,
    balance: 50,
    dateOfBirth: new Date('1998-06-15'), // adult creator
  },
  {
    name: 'Bob',
    email: 'bob@example.com',
    password: 'password123',
    role: 'user',
    isCreator: true,
    balance: 20,
    dateOfBirth: new Date('1995-02-10'), // adult creator
  },
  {
    name: 'Charlie',
    email: 'charlie@example.com',
    password: 'password123',
    role: 'supportadmin', // correct enum role
    isCreator: false,
    balance: 0,
    dateOfBirth: new Date('1990-11-01'), // must be adult
  },
];

const seedUsers = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    // Clear existing users
    await User.deleteMany({});
    console.log('Existing users cleared');

    // Create users with hashed passwords
    for (const u of users) {
      const hashedPassword = await bcrypt.hash(u.password, 12);
      await User.create({ ...u, password: hashedPassword });
      console.log(`User ${u.name} created`);
    }

    console.log('User seeding complete');
    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedUsers();

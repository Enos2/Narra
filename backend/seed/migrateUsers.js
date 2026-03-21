/**
 * File: backend/seed/migrateUsers.js
 * Description: Migrate existing users to have firstName, lastName, username fields
 * Run with: node backend/seed/migrateUsers.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

async function migrateUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/narra');
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      let needsUpdate = false;
      const updates = {};

      // Convert name to firstName and lastName if they don't exist
      if (!user.firstName && user.name) {
        const nameParts = user.name.trim().split(' ');
        updates.firstName = nameParts[0] || '';
        if (nameParts.length > 1) {
          updates.lastName = nameParts.slice(1).join(' ');
        } else {
          updates.lastName = '';
        }
        needsUpdate = true;
        console.log(`User ${user.email}: Converting name "${user.name}" to firstName="${updates.firstName}", lastName="${updates.lastName}"`);
      }

      // Generate username if not exists
      if (!user.username && user.email) {
        let baseUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        // Ensure username is at least 3 characters
        if (baseUsername.length < 3) {
          baseUsername = baseUsername + Math.random().toString(36).substring(2, 5);
        }
        
        // Check if username exists
        let username = baseUsername;
        let counter = 1;
        const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
        if (existingUser) {
          username = `${baseUsername}${counter}`;
          counter++;
          // Check again with counter
          const anotherExisting = await User.findOne({ username, _id: { $ne: user._id } });
          if (anotherExisting) {
            username = `${baseUsername}${Math.floor(Math.random() * 1000)}`;
          }
        }
        updates.username = username;
        needsUpdate = true;
        console.log(`User ${user.email}: Generated username "${username}"`);
      }

      // Set default gender if not set
      if (user.gender === undefined) {
        updates.gender = '';
        needsUpdate = true;
      }

      // Set default middleName if not set
      if (user.middleName === undefined) {
        updates.middleName = '';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        updatedCount++;
        console.log(`✅ Updated user: ${user.email}`);
      } else {
        skippedCount++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Updated: ${updatedCount} users`);
    console.log(`Skipped (already have fields): ${skippedCount} users`);
    console.log(`Total processed: ${users.length} users`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateUsers();
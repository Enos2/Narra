/**
 * File: backend/seed/seedAdmins.js
 * Purpose: Safely create the first admin account(s). Replaces seedAdmins.js,
 *   seedSuperAdmin.js, resetAdmins.js, fixAdmins.js, seedUsers.js and
 *   deleteAdmins.js (delete those — see below).
 *
 * WHY THE OLD SCRIPTS WERE REMOVED FROM USE
 *   - They shipped fixed passwords ("PlatformPass123!", "SuperAdmin123!",
 *     "password123") in a public repository.
 *   - They hard-coded a localhost database URI.
 *   - They used a `name` field and gender "Other", which the User schema does
 *     not accept, so they could not even create valid users.
 *   - seedUsers.js ran User.deleteMany({}) — it wipes EVERY user — and
 *     fixAdmins.js / resetAdmins.js / deleteAdmins.js delete admin accounts.
 *
 * THIS SCRIPT
 *   - Only CREATES accounts that do not exist yet. It never deletes or
 *     overwrites anything.
 *   - Passwords come from environment variables; if one is not provided a
 *     strong random password is generated and printed ONCE. Nothing secret is
 *     stored in the repository.
 *   - Refuses to run when NODE_ENV=production unless --allow-production is given.
 *
 * USAGE (from the backend folder)
 *   node seed/seedAdmins.js                              # super admin only
 *   node seed/seedAdmins.js --roles=superadmin,platformadmin,supportadmin
 *   node seed/seedAdmins.js --dry-run                    # show what would happen
 *
 * OPTIONAL ENVIRONMENT VARIABLES (per role, e.g. SUPERADMIN):
 *   SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_USERNAME, SEED_SUPERADMIN_PASSWORD,
 *   SEED_SUPERADMIN_FIRST_NAME, SEED_SUPERADMIN_LAST_NAME, SEED_SUPERADMIN_DOB
 *   (same pattern for PLATFORMADMIN and SUPPORTADMIN)
 */

'use strict';

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { validatePassword, isValidEmail, isValidUsername } = require('../utils/authSecurity');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ALLOW_PRODUCTION = args.includes('--allow-production');
const rolesArg = (args.find((a) => a.startsWith('--roles=')) || '--roles=superadmin').split('=')[1];
const ROLES = rolesArg.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);

const DEFAULTS = {
  superadmin: { username: 'superadmin', first: 'Super', last: 'Admin' },
  platformadmin: { username: 'platformadmin', first: 'Platform', last: 'Admin' },
  supportadmin: { username: 'supportadmin', first: 'Support', last: 'Admin' },
};

/** 20 random characters guaranteed to contain letters and digits. */
const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let pw = '';
  while (pw.length < 20) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < 256 - (256 % alphabet.length)) pw += alphabet[byte % alphabet.length];
  }
  return /[A-Za-z]/.test(pw) && /\d/.test(pw) ? pw : generatePassword();
};

const buildAdmin = (role) => {
  const env = (suffix) => process.env[`SEED_${role.toUpperCase()}_${suffix}`];
  const d = DEFAULTS[role];

  const username = (env('USERNAME') || d.username).toLowerCase();
  const email = (env('EMAIL') || '').trim().toLowerCase();
  const providedPassword = env('PASSWORD');

  if (!isValidEmail(email)) {
    throw new Error(`Set SEED_${role.toUpperCase()}_EMAIL to a valid e-mail address for the ${role}.`);
  }
  if (!isValidUsername(username)) {
    throw new Error(`Invalid username for ${role}: use 3-30 letters, numbers or underscores.`);
  }

  const password = providedPassword || generatePassword();
  const policy = validatePassword(password, { email, username });
  if (!policy.valid) throw new Error(`SEED_${role.toUpperCase()}_PASSWORD rejected: ${policy.message}`);

  const dob = new Date(env('DOB') || '1990-01-01');
  if (Number.isNaN(dob.getTime())) throw new Error(`Invalid SEED_${role.toUpperCase()}_DOB.`);

  return {
    role,
    username,
    email,
    password,
    generated: !providedPassword,
    firstName: env('FIRST_NAME') || d.first,
    lastName: env('LAST_NAME') || d.last,
    dateOfBirth: dob,
  };
};

const run = async () => {
  if (process.env.NODE_ENV === 'production' && !ALLOW_PRODUCTION) {
    throw new Error('Refusing to run with NODE_ENV=production. Re-run with --allow-production if you really mean it.');
  }

  const invalid = ROLES.filter((r) => !DEFAULTS[r]);
  if (invalid.length) throw new Error(`Unknown role(s): ${invalid.join(', ')}`);

  const admins = ROLES.map(buildAdmin);

  if (DRY_RUN) {
    console.log('DRY RUN — nothing will be written:');
    admins.forEach((a) =>
      console.log(` • ${a.role}: ${a.username} <${a.email}> (password ${a.generated ? 'would be generated' : 'from environment'})`)
    );
    return;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI (or MONGO_URI) is not set.');

  const User = require('../models/User');
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  const created = [];

  for (const a of admins) {
    const exists = await User.findOne({ $or: [{ email: a.email }, { username: a.username }] });
    if (exists) {
      console.log(`Skipped ${a.role}: an account with that e-mail or username already exists.`);
      continue;
    }

    await User.create({
      firstName: a.firstName,
      lastName: a.lastName,
      username: a.username,
      email: a.email,
      password: await bcrypt.hash(a.password, 12),
      role: a.role,
      dateOfBirth: a.dateOfBirth,
      isVerified: true,
      restrictions: { upload: false, goLive: false, comment: false },
    });

    created.push(a);
    console.log(`Created ${a.role}: ${a.username} <${a.email}>`);
  }

  const generated = created.filter((a) => a.generated);
  if (generated.length) {
    console.log('\n──────── SAVE THESE NOW — they are shown only once ────────');
    generated.forEach((a) => console.log(` ${a.role.padEnd(14)} ${a.username}  /  ${a.password}`));
    console.log('Sign in, then change the password from the Account page.');
    console.log('────────────────────────────────────────────────────────────\n');
  }

  console.log('Admin seeding complete.');
};

run()
  .then(() => mongoose.disconnect().catch(() => {}))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });

// ═══ END OF FILE: backend/seed/seedAdmins.js ═══
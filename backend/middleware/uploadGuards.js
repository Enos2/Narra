/**
 * File: backend/middleware/uploadGuards.js
 * Purpose: Guards for the upload routes.
 *
 *   requireCreatorUpload  — who may publish videos: not restricted from
 *     uploading, adult (18+) with a known date of birth (admins excepted).
 *     The upload routes previously had NO such check at all: a minor, or a user
 *     an admin had restricted from uploading, could still upload.
 *   cleanupTempFiles      — deletes multer's temporary files when the response
 *     ends, whether the request succeeded, failed or the client disconnected.
 */

'use strict';

const fs = require('fs');

const ADMIN_ROLES = ['supportadmin', 'platformadmin', 'superadmin'];

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

const requireCreatorUpload = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  if (user.restrictions && user.restrictions.upload === true) {
    return res.status(403).json({
      success: false,
      message: 'Your account is restricted from uploading content.',
      code: 'UPLOAD_RESTRICTED',
    });
  }

  if (ADMIN_ROLES.includes(user.role)) return next();

  const age = getAge(user.dateOfBirth);
  if (age === null) {
    return res.status(403).json({
      success: false,
      message: 'Please add your date of birth before uploading content.',
      code: 'AGE_UNVERIFIED',
    });
  }
  if (age < 18) {
    return res.status(403).json({
      success: false,
      message: 'Users under 18 cannot upload content.',
      code: 'MINOR_NO_UPLOAD',
    });
  }

  return next();
};

const cleanupTempFiles = (req, res, next) => {
  res.on('close', () => {
    const files = [...(req.files || []), ...(req.file ? [req.file] : [])];
    for (const f of files) {
      if (f && f.path) fs.unlink(f.path, () => {});
    }
  });
  next();
};

module.exports = { requireCreatorUpload, cleanupTempFiles, getAge };

// ═══ END OF FILE: backend/middleware/uploadGuards.js ═══
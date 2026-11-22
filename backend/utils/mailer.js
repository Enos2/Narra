/**
 * File: backend/utils/mailer.js
 * Purpose: Sends transactional e-mail (password reset + password-changed
 *   notice) through any SMTP provider (Gmail app password, Brevo, Mailgun,
 *   SendGrid SMTP, Zoho, ...).
 *
 * Previously "forgot password" generated a reset token but never delivered it,
 * so password reset could not work at all.
 *
 * Configuration (see .env.example): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * SMTP_SECURE (true for port 465), MAIL_FROM.
 *
 * If SMTP is not configured nothing is sent. In development the reset link is
 * printed to the console so the flow can still be tested; in production it is
 * never logged.
 */

'use strict';

const nodemailer = require('nodemailer');

const isProduction = process.env.NODE_ENV === 'production';

let transporter = null;

const isConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const from = () => process.env.MAIL_FROM || `Narra <${process.env.SMTP_USER}>`;

/**
 * @returns {Promise<boolean>} true if a message was handed to the SMTP server
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresMinutes }) => {
  if (!isConfigured()) {
    console.warn('[Mail] SMTP is not configured — password reset e-mail NOT sent.');
    if (!isProduction) console.log(`[Mail][dev] Reset link for ${to}: ${resetUrl}`);
    return false;
  }

  const safeName = escapeHtml(name || 'there');
  await getTransporter().sendMail({
    from: from(),
    to,
    subject: 'Reset your Narra password',
    text:
      `Hi ${name || 'there'},\n\n` +
      `We received a request to reset your Narra password. Open this link within ${expiresMinutes} minutes:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not ask for this, you can ignore this e-mail — your password will not change.\n`,
    html:
      `<p>Hi ${safeName},</p>` +
      `<p>We received a request to reset your Narra password. This link works for ${expiresMinutes} minutes:</p>` +
      `<p><a href="${escapeHtml(resetUrl)}">Reset my password</a></p>` +
      `<p>If you did not ask for this, you can ignore this e-mail — your password will not change.</p>`,
  });
  return true;
};

/** Security notice after a successful reset, so a hijacked reset is noticed. */
const sendPasswordChangedEmail = async ({ to, name }) => {
  if (!isConfigured()) return false;

  await getTransporter().sendMail({
    from: from(),
    to,
    subject: 'Your Narra password was changed',
    text:
      `Hi ${name || 'there'},\n\nYour Narra password was just changed and you were signed out of all devices.\n` +
      `If this was not you, reset your password again immediately and contact support.\n`,
    html:
      `<p>Hi ${escapeHtml(name || 'there')},</p>` +
      `<p>Your Narra password was just changed and you were signed out of all devices.</p>` +
      `<p>If this was not you, reset your password again immediately and contact support.</p>`,
  });
  return true;
};

module.exports = { isConfigured, sendPasswordResetEmail, sendPasswordChangedEmail };

// ═══ END OF FILE: backend/utils/mailer.js ═══
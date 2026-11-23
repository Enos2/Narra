/**
 * File: backend/utils/mpesa.js
 * Purpose: Minimal Safaricom Daraja (M-Pesa) client for wallet top-ups —
 *   OAuth token, STK push ("Lipa na M-Pesa Online"), STK status query, phone
 *   normalisation, callback parsing and callback-secret verification.
 *
 * Written from the public Daraja API documentation and NOT yet exercised
 * against Safaricom's sandbox from this codebase — test top-ups in the sandbox
 * (MPESA_ENV=sandbox) before going live.
 *
 * Environment variables (see .env.example):
 *   MPESA_ENV                 sandbox | production   (default sandbox)
 *   MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE           paybill or till (store) number
 *   MPESA_PASSKEY             Lipa na M-Pesa Online passkey
 *   MPESA_TRANSACTION_TYPE    CustomerPayBillOnline (default) | CustomerBuyGoodsOnline
 *   MPESA_PARTY_B             defaults to MPESA_SHORTCODE (for till numbers use the till)
 *   MPESA_CALLBACK_SECRET     long random string; becomes part of the callback URL
 *   API_PUBLIC_URL            public https URL of THIS API (e.g. https://narra-q4p4.onrender.com)
 */

'use strict';

const axios = require('axios');
const crypto = require('crypto');

const BASES = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

class MpesaError extends Error {
  constructor(message, { code = null, status = null } = {}) {
    super(message);
    this.name = 'MpesaError';
    this.code = code;
    this.status = status;
  }
}

const mode = () => (process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox');
const baseUrl = () => BASES[mode()];

const isConfigured = () =>
  !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_CALLBACK_SECRET &&
    process.env.MPESA_CALLBACK_SECRET.length >= 24 &&
    process.env.API_PUBLIC_URL
  );

/** Public callback URL registered with every STK push. The secret authenticates Safaricom. */
const buildCallbackUrl = () =>
  `${String(process.env.API_PUBLIC_URL).replace(/\/+$/, '')}/api/payments/mpesa/callback/${process.env.MPESA_CALLBACK_SECRET}`;

/** Constant-time comparison of the secret taken from the callback URL. */
const verifyCallbackSecret = (provided) => {
  const expected = process.env.MPESA_CALLBACK_SECRET || '';
  if (typeof provided !== 'string' || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * 0712345678 / 0112345678 / +254712345678 / 254712345678 / 712345678 → 254712345678
 * Returns null when the number is not a valid Kenyan mobile number.
 */
const normalizePhone = (input) => {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let p = String(input).replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (/^0[17]\d{8}$/.test(p)) p = `254${p.slice(1)}`;
  else if (/^[17]\d{8}$/.test(p)) p = `254${p}`;
  return /^254[17]\d{8}$/.test(p) ? p : null;
};

/** YYYYMMDDHHmmss in East Africa Time (UTC+3). */
const timestamp = () => {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
};

const password = (ts) =>
  Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString('base64');

// ── OAuth token (cached until shortly before it expires) ───────────────────
let cachedToken = null;
let cachedUntil = 0;

const getAccessToken = async () => {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;

  try {
    const res = await axios.get(`${baseUrl()}/oauth/v1/generate`, {
      params: { grant_type: 'client_credentials' },
      auth: { username: process.env.MPESA_CONSUMER_KEY, password: process.env.MPESA_CONSUMER_SECRET },
      timeout: 15000,
    });
    cachedToken = res.data.access_token;
    cachedUntil = Date.now() + Math.max(60, Number(res.data.expires_in || 3500) - 60) * 1000;
    return cachedToken;
  } catch (err) {
    cachedToken = null;
    throw new MpesaError('Could not authenticate with M-Pesa', { status: err.response?.status || null });
  }
};

const post = async (path, body) => {
  const token = await getAccessToken();
  try {
    const res = await axios.post(`${baseUrl()}${path}`, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    });
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    if (err.response?.status === 401) cachedToken = null;
    throw new MpesaError(data?.errorMessage || data?.ResponseDescription || 'M-Pesa request failed', {
      code: data?.errorCode || data?.ResponseCode || null,
      status: err.response?.status || null,
    });
  }
};

/**
 * Sends the "enter your PIN" prompt to the customer's phone.
 * @returns {{ merchantRequestId: string, checkoutRequestId: string, customerMessage: string }}
 */
const stkPush = async ({ phone, amount, reference, description }) => {
  const ts = timestamp();
  const shortcode = process.env.MPESA_SHORTCODE;

  const data = await post('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: shortcode,
    Password: password(ts),
    Timestamp: ts,
    TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: process.env.MPESA_PARTY_B || shortcode,
    PhoneNumber: phone,
    CallBackURL: buildCallbackUrl(),
    AccountReference: String(reference).slice(0, 12),
    TransactionDesc: String(description || 'Narra wallet').slice(0, 13),
  });

  if (String(data.ResponseCode) !== '0' || !data.CheckoutRequestID) {
    throw new MpesaError(data.ResponseDescription || 'M-Pesa rejected the request', { code: data.ResponseCode });
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    customerMessage: data.CustomerMessage || '',
  };
};

/**
 * Asks Safaricom what happened to a push whose callback never arrived.
 * @returns {{ pending: boolean, resultCode: number|null, resultDesc: string }}
 */
const stkQuery = async (checkoutRequestId) => {
  const ts = timestamp();
  try {
    const data = await post('/mpesa/stkpushquery/v1/query', {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password(ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    });
    return { pending: false, resultCode: Number(data.ResultCode), resultDesc: data.ResultDesc || '' };
  } catch (err) {
    // Daraja answers "still being processed" with an error body, not a result.
    if (err instanceof MpesaError && /process/i.test(err.message)) {
      return { pending: true, resultCode: null, resultDesc: err.message };
    }
    throw err;
  }
};

/** Normalises the asynchronous callback Safaricom POSTs. Returns null if malformed. */
const parseCallback = (body) => {
  const cb = body && body.Body && body.Body.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== 'string') return null;

  const items = Array.isArray(cb.CallbackMetadata?.Item) ? cb.CallbackMetadata.Item : [];
  const pick = (name) => items.find((i) => i && i.Name === name)?.Value;

  const amount = Number(pick('Amount'));
  const receipt = pick('MpesaReceiptNumber');

  return {
    merchantRequestId: String(cb.MerchantRequestID || ''),
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: String(cb.ResultDesc || '').slice(0, 300),
    amount: Number.isFinite(amount) ? amount : null,
    receipt: typeof receipt === 'string' && /^[A-Z0-9]{8,20}$/i.test(receipt) ? receipt.toUpperCase() : null,
    phone: pick('PhoneNumber') ? String(pick('PhoneNumber')) : '',
  };
};

module.exports = {
  MpesaError,
  isConfigured,
  normalizePhone,
  buildCallbackUrl,
  verifyCallbackSecret,
  stkPush,
  stkQuery,
  parseCallback,
};

// ═══ END OF FILE: backend/utils/mpesa.js ═══
"use strict";

const crypto = require("crypto");
const COOKIE_NAME = "sendora_admin";
const SESSION_SECONDS = 8 * 60 * 60;

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizedPassword(value) {
  return String(value || "").trim();
}

function passwordIsConfigured() {
  return normalizedPassword(process.env.ADMIN_DASHBOARD_PASSWORD).length >= 12;
}

function getSecret() {
  const secret = String(process.env.ADMIN_DASHBOARD_SECRET || "");
  if (secret.length < 32) throw new Error("admin_secret_not_configured");
  return secret;
}

function verifyPassword(password) {
  const expected = normalizedPassword(process.env.ADMIN_DASHBOARD_PASSWORD);
  const supplied = normalizedPassword(password);
  return expected.length >= 12 && timingSafeEqualText(supplied, expected);
}

function signature(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function createSession(now) {
  const timestamp = String(Math.floor((now || Date.now()) / 1000));
  return `${timestamp}.${signature(timestamp)}`;
}

function parseCookies(req) {
  return String(req.headers && req.headers.cookie || "").split(";").reduce((result, item) => {
    const index = item.indexOf("=");
    if (index > 0) result[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    return result;
  }, {});
}

function sessionToken(req) {
  const authorization = String(req.headers && req.headers.authorization || "");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  return bearer ? bearer[1].trim() : (parseCookies(req)[COOKIE_NAME] || "");
}

function isAuthorized(req, now) {
  try {
    const token = sessionToken(req);
    const [timestamp, suppliedSignature] = token.split(".");
    if (!/^\d+$/.test(timestamp || "") || !suppliedSignature) return false;
    const age = Math.floor((now || Date.now()) / 1000) - Number(timestamp);
    if (age < 0 || age > SESSION_SECONDS) return false;
    return timingSafeEqualText(suppliedSignature, signature(timestamp));
  } catch (_) {
    return false;
  }
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

module.exports = { COOKIE_NAME, SESSION_SECONDS, clearCookie, createSession, isAuthorized, passwordIsConfigured, sessionCookie, timingSafeEqualText, verifyPassword };

const crypto = require("crypto");

function hmacBase64(text, secret) {
  return crypto
    .createHmac("sha512", String(secret).trim())
    .update(text, "utf8")
    .digest("base64");
}

function hashValues(payload, fieldOrder, apiKey) {
  const beforeHash = fieldOrder
    .filter((name) => Object.prototype.hasOwnProperty.call(payload, name))
    .map((name) => {
      const value = payload[name];
      if (value === null || value === undefined) return "";
      return String(value);
    })
    .join("");

  return hmacBase64(beforeHash, apiKey);
}

/*
 * PayWay callback verification:
 * 1. sort JSON fields by key
 * 2. concatenate values
 * 3. HMAC-SHA512
 * 4. Base64
 */
function verifyCallback(body, signature, secret) {
  if (!body || !signature || !secret) return false;

  const beforeHash = Object.keys(body)
    .sort()
    .map((key) => {
      const value = body[key];
      if (value === null || value === undefined) return "";
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    })
    .join("");

  const expected = hmacBase64(beforeHash, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { hashValues, verifyCallback };

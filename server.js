require("dotenv").config();

const express = require("express");
const cors = require("cors");
const PRODUCTS = require("./products");
const { hashValues, verifyCallback } = require("./payway");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (
  process.env.PAYWAY_BASE_URL ||
  "https://checkout-sandbox.payway.com.kh"
).trim();

const MERCHANT_ID = (process.env.PAYWAY_MERCHANT_ID || "").trim();
const API_KEY = (process.env.PAYWAY_API_KEY || "").trim();
const CALLBACK_URL = (process.env.PAYWAY_CALLBACK_URL || "").trim();

const PAYMENT_OPTION = (
  process.env.PAYWAY_PAYMENT_OPTION || "abapay_khqr"
).trim();

const QR_TEMPLATE = (
  process.env.PAYWAY_QR_TEMPLATE || "template3_color"
).trim();

const QR_LIFETIME = Math.min(
  30,
  Math.max(1, Number(process.env.PAYWAY_QR_LIFETIME_MINUTES || 6))
);

const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS ||
  process.env.ALLOWED_ORIGIN ||
  ""
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const QR_FIELD_ORDER = [
  "req_time",
  "merchant_id",
  "tran_id",
  "amount",
  "purchase_type",
  "payment_option",
  "currency",
  "callback_url",
  "lifetime",
  "qr_image_template"
];

const CHECK_FIELD_ORDER = [
  "req_time",
  "merchant_id",
  "tran_id"
];

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST"]
  })
);

function payWayReqTime() {
  // Use Phnom Penh local time even when the hosting server runs in UTC.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const value = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );

  return (
    value.year +
    value.month +
    value.day +
    value.hour +
    value.minute +
    value.second
  );
}

function newTranId() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`.slice(0, 20);
}

function configured() {
  return Boolean(MERCHANT_ID && API_KEY);
}

function validCallbackUrl(url) {
  if (!url) return false;
  if (url.includes("YOUR-BACKEND-DOMAIN") || url.includes("REPLACE")) return false;
  return /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/|$)/.test(url);
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Angkea Sil Learning PayWay",
    environment: BASE_URL.includes("sandbox") ? "sandbox" : "production",
    configured: configured()
  });
});

app.post("/api/payway/create-qr", async (req, res) => {
  try {
    if (!configured()) {
      return res.status(503).json({
        ok: false,
        message: "PayWay Merchant ID ឬ API Key មិនទាន់បានកំណត់។"
      });
    }

    const course = PRODUCTS[String(req.body?.courseId || "")];

    if (!course) {
      return res.status(400).json({
        ok: false,
        message: "វគ្គសិក្សាមិនត្រឹមត្រូវ។"
      });
    }

    const tranId = newTranId();

    const payload = {
      req_time: payWayReqTime(),
      merchant_id: MERCHANT_ID,
      tran_id: tranId,
      amount: course.price,
      purchase_type: "purchase",
      payment_option: PAYMENT_OPTION,
      currency: course.currency,
      lifetime: QR_LIFETIME,
      qr_image_template: QR_TEMPLATE
    };

    // PayWay expects callback_url Base64 encoded when it is sent.
    if (CALLBACK_URL && validCallbackUrl(CALLBACK_URL)) {
      payload.callback_url = Buffer.from(CALLBACK_URL, "utf8").toString("base64");
    }

    payload.hash = hashValues(payload, QR_FIELD_ORDER, API_KEY);

    const upstream = await fetch(
      `${BASE_URL}/api/payment-gateway/v1/payments/generate-qr`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await upstream.json().catch(() => ({}));

    const success =
      upstream.ok &&
      ["0", "00"].includes(String(data?.status?.code ?? ""));

    if (!success) {
      console.error("PayWay create QR error:", data?.status || data);

      return res.status(502).json({
        ok: false,
        message: "ABA PayWay មិនអាចបង្កើតកូដទូទាត់បាន។",
        status: data?.status || null
      });
    }

    return res.json({
      ok: true,
      tranId,
      course,
      qrImage: data.qrImage || null,
      qrString: data.qrString || null,
      lifetimeSeconds: QR_LIFETIME * 60
    });

  } catch (error) {
    console.error("create-qr:", error);

    return res.status(500).json({
      ok: false,
      message: "មានបញ្ហាក្នុងការតភ្ជាប់ទៅ ABA PayWay។"
    });
  }
});

app.post("/api/payway/check", async (req, res) => {
  try {
    if (!configured()) {
      return res.status(503).json({
        ok: false,
        message: "PayWay មិនទាន់បានកំណត់។"
      });
    }

    const tranId = String(req.body?.tranId || "").trim();

    if (!/^[0-9]{5,20}$/.test(tranId)) {
      return res.status(400).json({
        ok: false,
        message: "លេខប្រតិបត្តិការមិនត្រឹមត្រូវ។"
      });
    }

    const payload = {
      req_time: payWayReqTime(),
      merchant_id: MERCHANT_ID,
      tran_id: tranId
    };

    payload.hash = hashValues(payload, CHECK_FIELD_ORDER, API_KEY);

    const upstream = await fetch(
      `${BASE_URL}/api/payment-gateway/v1/payments/check-transaction-2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await upstream.json().catch(() => ({}));

    return res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      data
    });

  } catch (error) {
    console.error("check-payment:", error);

    return res.status(500).json({
      ok: false,
      message: "មានបញ្ហាក្នុងការពិនិត្យការទូទាត់។"
    });
  }
});

app.post("/api/payway/callback", (req, res) => {
  const signature = req.get("x-payway-hmac-sha512") || "";

  if (!verifyCallback(req.body, signature, API_KEY)) {
    return res.status(401).json({ ok: false });
  }

  const callback = {
    tran_id: req.body?.tran_id || req.body?.transaction_id || null,
    status: req.body?.status ?? req.body?.payment_status_code ?? null,
    apv: req.body?.apv || null
  };

  console.log("Verified PayWay callback:", callback);

  /*
   * Production note:
   * Persist verified callbacks in a database before unlocking paid content.
   */

  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Angkea Sil Learning PayWay backend running on ${PORT}`);
});

const API_BASE = String(window.ASL_PAYWAY_API || "").replace(/\/+$/, "");
const params = new URLSearchParams(window.location.search);

const LEGACY_COURSE_MAP = {
  "មូលដ្ឋានភាសាចិន": "chinese-basics",
  "Chinese Language Basics": "chinese-basics",
  "ជំនាញតារាងទិន្នន័យសម្រាប់អាជីវកម្ម": "excel-business",
  "Excel for Business": "excel-business",
  "បង្កើតគេហទំព័រ": "website-basics",
  "Build a Website": "website-basics",
  "Build a Website with HTML, CSS & JS": "website-basics"
};

function resolveCourseId() {
  const direct = (params.get("courseId") || "").trim();
  if (direct) return direct;

  const oldCourse = (params.get("course") || "").trim();
  if (oldCourse && LEGACY_COURSE_MAP[oldCourse]) {
    return LEGACY_COURSE_MAP[oldCourse];
  }

  const oldPrice = Number(params.get("price") || 0);
  if (oldPrice === 12) return "chinese-basics";
  if (oldPrice === 10) return "excel-business";
  if (oldPrice === 15) return "website-basics";

  return "";
}

const courseId = resolveCourseId();

const el = {
  courseName: document.getElementById("courseName"),
  coursePrice: document.getElementById("coursePrice"),
  totalPrice: document.getElementById("totalPrice"),
  payAmount: document.getElementById("payAmount"),
  paymentQr: document.getElementById("paymentQr"),
  qrLoading: document.getElementById("qrLoading"),
  qrError: document.getElementById("qrError"),
  qrErrorText: document.getElementById("qrErrorText"),
  retryQr: document.getElementById("retryQr"),
  regenerateQr: document.getElementById("regenerateQr"),
  tranId: document.getElementById("tranId"),
  countdown: document.getElementById("countdown"),
  paymentStatus: document.getElementById("paymentStatus"),
  checkPayment: document.getElementById("checkPayment"),
  notice: document.getElementById("notice"),
  successModal: document.getElementById("successModal"),
  successText: document.getElementById("successText")
};

let activeTranId = "";
let pollTimer = null;
let countdownTimer = null;
let expiresAt = 0;
let checking = false;
let paymentCompleted = false;

const khDigits = ["០","១","២","៣","៤","៥","៦","៧","៨","៩"];

function khNumber(value) {
  return String(value).replace(/\d/g, d => khDigits[Number(d)]);
}

function money(amount, currency) {
  const n = Number(amount || 0);
  if (currency === "KHR") return `${Math.round(n).toLocaleString()} រៀល`;
  return `$${n.toFixed(2)}`;
}

function setStatus(text, type = "") {
  if (!el.paymentStatus) return;

  el.paymentStatus.textContent = text;
  el.paymentStatus.classList.remove(
    "payment-status-pending",
    "payment-status-success",
    "payment-status-error"
  );

  if (type) el.paymentStatus.classList.add(`payment-status-${type}`);
}

function setLoading(loading) {
  if (el.qrLoading) el.qrLoading.hidden = !loading;

  if (loading) {
    if (el.paymentQr) el.paymentQr.hidden = true;
    if (el.qrError) el.qrError.hidden = true;
  }
}

function stopTimers() {
  if (pollTimer) clearInterval(pollTimer);
  if (countdownTimer) clearInterval(countdownTimer);

  pollTimer = null;
  countdownTimer = null;
}

function showError(message, allowRegenerate = true) {
  setLoading(false);

  if (el.paymentQr) el.paymentQr.hidden = true;
  if (el.qrError) el.qrError.hidden = false;
  if (el.qrErrorText) el.qrErrorText.textContent = message || "សូមព្យាយាមម្តងទៀត។";
  if (el.checkPayment) el.checkPayment.disabled = true;
  if (el.retryQr) el.retryQr.hidden = !allowRegenerate;
  if (el.regenerateQr) el.regenerateQr.hidden = !allowRegenerate;

  setStatus("មានបញ្ហាក្នុងការបង្កើតកូដ", "error");
}

function startCountdown(seconds) {
  expiresAt = Date.now() + seconds * 1000;

  const tick = () => {
    const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const mm = Math.floor(left / 60);
    const ss = left % 60;

    if (el.countdown) {
      el.countdown.textContent =
        `${khNumber(String(mm).padStart(2, "0"))}:${khNumber(String(ss).padStart(2, "0"))}`;
    }

    if (left <= 0 && !paymentCompleted) {
      stopTimers();
      activeTranId = "";

      if (el.paymentQr) el.paymentQr.style.opacity = ".35";
      if (el.checkPayment) el.checkPayment.disabled = true;
      if (el.regenerateQr) el.regenerateQr.hidden = false;

      setStatus("កូដបានផុតសុពលភាព", "error");

      if (el.notice) {
        el.notice.textContent =
          "កូដនេះលែងអាចប្រើបាន។ សូមចុច «បង្កើតកូដថ្មី» ដើម្បីបន្ត។";
      }
    }
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function extractPaymentData(result) {
  return result?.data?.data || result?.data || {};
}

function paymentState(result) {
  const data = extractPaymentData(result);
  const code = Number(data.payment_status_code);
  const status = String(data.payment_status || "").toUpperCase();

  if (code === 0 || status === "APPROVED") return "approved";
  if (code === 2 || status === "PENDING") return "pending";
  return "other";
}

async function checkPayment({ manual = false } = {}) {
  if (!activeTranId || checking || !API_BASE || paymentCompleted) return false;

  checking = true;

  const previousButtonText = el.checkPayment?.textContent || "ពិនិត្យការទូទាត់";

  if (manual && el.checkPayment) {
    el.checkPayment.disabled = true;
    el.checkPayment.textContent = "កំពុងពិនិត្យ...";
  }

  try {
    const response = await fetch(`${API_BASE}/api/payway/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tranId: activeTranId })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "មិនអាចពិនិត្យស្ថានភាពបាន។");
    }

    const state = paymentState(result);

    if (state === "approved") {
      paymentCompleted = true;
      stopTimers();

      setStatus("ការទូទាត់បានជោគជ័យ", "success");

      if (el.notice) {
        el.notice.textContent = "ABA PayWay បានបញ្ជាក់ថាប្រតិបត្តិការនេះ APPROVED។";
      }

      if (el.checkPayment) el.checkPayment.disabled = true;
      if (el.regenerateQr) el.regenerateQr.hidden = true;

      if (el.successModal) {
        el.successModal.classList.add("open");
        el.successModal.setAttribute("aria-hidden", "false");
      }

      return true;
    }

    if (state === "pending") {
      setStatus("កំពុងរង់ចាំការទូទាត់…", "pending");

      if (el.notice) {
        el.notice.textContent =
          "មិនទាន់មានការទូទាត់ទេ។ បន្ទាប់ពីស្កេន និងបង់រួច ប្រព័ន្ធនឹងពិនិត្យម្តងទៀតដោយស្វ័យប្រវត្តិ។";
      }

      return false;
    }

    setStatus("ការទូទាត់មិនទាន់បានបញ្ជាក់", "error");

    if (el.notice) {
      el.notice.textContent =
        "ប្រតិបត្តិការនេះមិនទាន់មានស្ថានភាព APPROVED ទេ។ សូមពិនិត្យម្តងទៀត ឬបង្កើតកូដថ្មី។";
    }

    return false;

  } catch (err) {
    console.error("PayWay check error:", err);

    setStatus("មិនអាចពិនិត្យស្ថានភាពបាន", "error");

    if (el.notice) {
      el.notice.textContent =
        "សូមពិនិត្យការតភ្ជាប់ Backend ហើយសាកម្តងទៀត។";
    }

    return false;

  } finally {
    checking = false;

    if (manual && el.checkPayment && !paymentCompleted && activeTranId) {
      el.checkPayment.disabled = false;
      el.checkPayment.textContent = previousButtonText;
    }
  }
}

async function createQr() {
  stopTimers();
  activeTranId = "";
  paymentCompleted = false;

  if (el.checkPayment) {
    el.checkPayment.disabled = true;
    el.checkPayment.textContent = "ពិនិត្យការទូទាត់";
  }

  if (el.regenerateQr) el.regenerateQr.hidden = true;
  if (el.retryQr) el.retryQr.hidden = true;
  if (el.tranId) el.tranId.textContent = "—";
  if (el.paymentQr) el.paymentQr.style.opacity = "1";

  setLoading(true);
  setStatus("កំពុងបង្កើតកូដទូទាត់...");

  if (!courseId) {
    showError(
      "រកមិនឃើញវគ្គសិក្សាដែលបានជ្រើស។ សូមត្រឡប់ទៅទំព័រមេរៀន ហើយជ្រើសវគ្គម្តងទៀត។",
      false
    );
    return;
  }

  if (
    !API_BASE ||
    API_BASE.includes("REPLACE-WITH-YOUR-BACKEND") ||
    API_BASE.includes("YOUR-BACKEND-DOMAIN")
  ) {
    showError(
      "Backend សម្រាប់ ABA PayWay មិនទាន់បានកំណត់សម្រាប់ Website Online ទេ។",
      false
    );
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/payway/create-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "ABA PayWay មិនអាចបង្កើតកូដបាន។");
    }

    activeTranId = result.tranId;

    if (el.courseName) el.courseName.textContent = result.course.name;

    const formattedAmount = money(result.course.price, result.course.currency);

    if (el.coursePrice) el.coursePrice.textContent = formattedAmount;
    if (el.totalPrice) el.totalPrice.textContent = formattedAmount;
    if (el.payAmount) el.payAmount.textContent = formattedAmount;
    if (el.tranId) el.tranId.textContent = result.tranId;

    if (!result.qrImage) {
      throw new Error("PayWay មិនបានផ្ញើរូប QR មកវិញ។");
    }

    if (el.paymentQr) {
      el.paymentQr.src = result.qrImage;
      el.paymentQr.hidden = false;
    }

    setLoading(false);

    setStatus("សូមស្កេនកូដ និងបញ្ជាក់ការទូទាត់");

    if (el.notice) {
      el.notice.textContent =
        "ក្រោយបង់រួច ប្រព័ន្ធនឹងពិនិត្យស្ថានភាព ABA PayWay ដោយស្វ័យប្រវត្តិ។";
    }

    if (el.checkPayment) el.checkPayment.disabled = false;

    const lifetimeSeconds = Number(result.lifetimeSeconds || 360);
    startCountdown(lifetimeSeconds);

    // Check every 5 seconds while the QR is active.
    pollTimer = setInterval(() => checkPayment({ manual: false }), 5000);

  } catch (err) {
    console.error("PayWay create QR error:", err);
    showError(err.message || "មានបញ្ហាក្នុងការតភ្ជាប់ទៅ ABA PayWay។");
  }
}

el.retryQr?.addEventListener("click", createQr);
el.regenerateQr?.addEventListener("click", createQr);
el.checkPayment?.addEventListener("click", () => checkPayment({ manual: true }));

/* ពន្លឺ / ងងឹត */
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.body.classList.toggle("dark-mode", theme === "dark");
  localStorage.setItem("asl-theme", theme);
}

applyTheme(localStorage.getItem("asl-theme") || "light");

themeToggle?.addEventListener("click", () => {
  applyTheme(
    document.body.classList.contains("dark-mode") ? "light" : "dark"
  );
});

createQr();

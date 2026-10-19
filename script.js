/* =====================================================================
   Mental Health AI – frontend logic (vanilla JS, no build step)
   ===================================================================== */

/* ---------- 1. Configuration: change backend settings here ---------- */
const CONFIG = {
  API_BASE_URL: "https://mental-health-score-5fbm.onrender.com", // FastAPI server (uvicorn main:app --reload)
  PREDICT_PATH: "/predict",              // POST endpoint defined in main.py
  TIMEOUT_MS: 15000,
  // The backend does not define a score range. This value is ONLY the reference
  // scale for the gauge fill. Set it to the maximum score in your training data.
  SCORE_MAX: 10,
};

/* ---------- 2. Form schema: mirrors the Student_Data Pydantic model ----------
   `name` must match the backend field names exactly. */
const OPTIONS = {
  Gender: ["Male", "Female", "Other"],
  Academic_Level: ["High School", "Undergraduate", "Graduate"],
  Most_Used_Platform: ["Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter", "YouTube", "TikTok", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat"],
  Purpose_Of_Use: ["Networking", "Education", "Entertainment", "News"],
  Stress_Level: ["Low", "Medium", "High", "Very High"],
};
const COUNTRIES = ["India", "USA", "Canada", "Australia", "UK", "Germany", "Mexico", "Turkey", "France", "Other"];

const SECTIONS = [
  { title: "Profile", icon: "user", fields: [
    { name: "Age", label: "Age", type: "int", min: 0, max: 100, placeholder: "e.g. 21", hint: "Whole number, 0–100" },
    { name: "Gender", label: "Gender", type: "select" },
    { name: "Country", label: "Country", type: "text", list: COUNTRIES, placeholder: "e.g. India", hint: "Pick a suggestion or type your own" },
    { name: "Academic_Level", label: "Academic level", type: "select" },
  ]},
  { title: "Social media use", icon: "smartphone", fields: [
    { name: "Most_Used_Platform", label: "Most used platform", type: "select" },
    { name: "Purpose_Of_Use", label: "Main purpose of use", type: "select" },
    { name: "Avg_Daily_Usage_Hours", label: "Average daily usage (hours)", type: "float", min: 0, max: 24, placeholder: "e.g. 4.5", hint: "0–24 hours" },
    { name: "Daily_Unlocks", label: "Daily phone unlocks", type: "int", min: 0, placeholder: "e.g. 60", hint: "Times per day, 0 or more" },
  ]},
  { title: "Daily routine & stress", icon: "activity", fields: [
    { name: "Study_Hours", label: "Study hours per day", type: "float", min: 0, max: 24, placeholder: "e.g. 3", hint: "0–24 hours" },
    { name: "Physical_Activity_Hours", label: "Physical activity per day (hours)", type: "float", min: 0, max: 24, placeholder: "e.g. 1", hint: "0–24 hours" },
    { name: "Sleep_Hours_Per_Night", label: "Sleep per night (hours)", type: "float", min: 0, max: 24, placeholder: "e.g. 7", hint: "0–24 hours" },
    { name: "Stress_Level", label: "Stress level", type: "select" },
  ]},
];
const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

/* ---------- 3. Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const refreshIcons = () => window.lucide && window.lucide.createIcons();
const labelOf = (name) => ALL_FIELDS.find((f) => f.name === name)?.label || name;

/* ---------- 4. Render form from schema ---------- */
function renderForm() {
  const html = SECTIONS.map((section, si) => `
    <fieldset class="fieldset">
      <legend><i data-lucide="${section.icon}"></i>${section.title}</legend>
      <div class="fields">${section.fields.map((f) => fieldHTML(f, si)).join("")}</div>
    </fieldset>`).join("");
  $("#form-sections").innerHTML = html;
  refreshIcons();
}

function fieldHTML(f) {
  const id = `f-${f.name}`;
  const described = `${id}-hint ${id}-error`;
  let control;
  if (f.type === "select") {
    control = `<select id="${id}" name="${f.name}" required aria-describedby="${described}">
      <option value="">Select…</option>${OPTIONS[f.name].map((o) => `<option>${o}</option>`).join("")}</select>`;
  } else if (f.type === "text") {
    control = `<input id="${id}" name="${f.name}" type="text" required list="${id}-list" autocomplete="off" placeholder="${f.placeholder}" aria-describedby="${described}">
      <datalist id="${id}-list">${f.list.map((c) => `<option value="${c}">`).join("")}</datalist>`;
  } else {
    const step = f.type === "int" ? "1" : "any";
    const max = f.max !== undefined ? `max="${f.max}"` : "";
    control = `<input id="${id}" name="${f.name}" type="number" inputmode="decimal" required min="${f.min}" ${max} step="${step}" placeholder="${f.placeholder}" aria-describedby="${described}">`;
  }
  return `<div class="field" data-field="${f.name}">
    <label for="${id}">${f.label}</label>${control}
    <span class="hint" id="${id}-hint">${f.hint || ""}</span>
    <span class="error" id="${id}-error" aria-live="polite"></span></div>`;
}

/* ---------- 5. Validation ---------- */
function setFieldError(name, message) {
  const wrap = $(`[data-field="${name}"]`);
  if (!wrap) return;
  wrap.classList.toggle("invalid", Boolean(message));
  $(".error", wrap).textContent = message || "";
  $("input, select", wrap).setAttribute("aria-invalid", message ? "true" : "false");
}

function validateField(f, raw) {
  const value = raw.trim();
  if (value === "") return "This field is required.";
  if (f.type === "int" || f.type === "float") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "Enter a valid number.";
    if (f.type === "int" && !Number.isInteger(n)) return "Enter a whole number.";
    if (n < f.min) return `Value must be at least ${f.min}.`;
    if (f.max !== undefined && n > f.max) return `Value must be at most ${f.max}.`;
  }
  return "";
}

/** Validates all fields. Returns a typed payload, or null when invalid. */
function collectPayload(form) {
  const payload = {};
  let firstInvalid = null;
  ALL_FIELDS.forEach((f) => {
    const raw = form.elements[f.name].value;
    const error = validateField(f, raw);
    setFieldError(f.name, error);
    if (error) { firstInvalid = firstInvalid || form.elements[f.name]; return; }
    // Convert to the types the backend expects (int / float / str)
    payload[f.name] = f.type === "int" || f.type === "float" ? Number(raw) : raw.trim();
  });
  if (firstInvalid) { firstInvalid.focus(); return null; }
  return payload;
}

/* ---------- 6. Backend integration ---------- */
/** Builds a readable message from FastAPI's 422 validation response. */
function formatValidationDetail(detail) {
  if (!Array.isArray(detail)) return "The server rejected the submitted data.";
  return detail.map((d) => `${labelOf(d.loc?.[d.loc.length - 1])}: ${d.msg}`).join(" ");
}

/** POSTs the payload to /predict and returns the numeric score. Throws Error with a user-friendly message. */
async function requestPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  let response;
  try {
    response = await fetch(CONFIG.API_BASE_URL + CONFIG.PREDICT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(err.name === "AbortError"
      ? "The request timed out. Please try again."
      : `Could not reach the prediction server at ${CONFIG.API_BASE_URL}. Make sure it is running (uvicorn main:app --reload).`);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await response.json(); } catch { /* non-JSON body */ }

  if (!response.ok) {
    if (response.status === 422) throw new Error(formatValidationDetail(data?.detail));
    throw new Error(`The server returned an error (HTTP ${response.status}). Check the backend terminal for details.`);
  }
  // Response schema: { "Mental_Health_Score": float }
  const score = data?.Mental_Health_Score;
  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new Error("The server returned an unexpected response. No prediction is available.");
  }
  return score;
}

/* ---------- 7. UI state ---------- */
function setLoading(isLoading) {
  const btn = $("#submit-btn");
  btn.disabled = isLoading;
  btn.setAttribute("aria-busy", String(isLoading));
  $(".spinner", btn).hidden = !isLoading;
  $(".btn__label", btn).textContent = isLoading ? "Predicting…" : "Predict Score";
}

function showAlert(message) {
  const box = $("#form-alert");
  box.textContent = message;
  box.hidden = !message;
}

function renderResults(score, payload) {
  const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  $("#score-value").textContent = fmt.format(score);
  $("#score-scale").textContent = `of ${CONFIG.SCORE_MAX} (reference)`;
  $("#score-text").textContent = `The model estimates a mental health score of ${fmt.format(score)} for the information you entered. The gauge is drawn against a reference scale of ${CONFIG.SCORE_MAX}.`;

  const circumference = 2 * Math.PI * 50;
  const ratio = Math.min(Math.max(score / CONFIG.SCORE_MAX, 0), 1);
  const gauge = $("#gauge-fg");
  gauge.setAttribute("stroke-dasharray", `0 ${circumference}`);
  requestAnimationFrame(() => gauge.setAttribute("stroke-dasharray", `${ratio * circumference} ${circumference}`));

  // Echo of submitted inputs (textContent only, so user text is never parsed as HTML)
  const summary = $("#summary");
  summary.replaceChildren();
  ALL_FIELDS.forEach((f) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt"); dt.textContent = f.label;
    const dd = document.createElement("dd"); dd.textContent = payload[f.name];
    row.append(dt, dd);
    summary.append(row);
  });

  const results = $("#results");
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
  results.focus({ preventScroll: true });
}

function resetAll() {
  ALL_FIELDS.forEach((f) => setFieldError(f.name, ""));
  showAlert("");
  $("#results").hidden = true;
}

/* ---------- 8. Event wiring ---------- */
function initForm() {
  renderForm();
  const form = $("#predict-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAlert("");
    const payload = collectPayload(form);
    if (!payload) { showAlert("Please correct the highlighted fields."); return; }

    setLoading(true);
    try {
      const score = await requestPrediction(payload);
      renderResults(score, payload);
    } catch (err) {
      $("#results").hidden = true; // never show a stale or fake result after a failure
      showAlert(err.message);
    } finally {
      setLoading(false);
    }
  });

  form.addEventListener("reset", resetAll);
  // Clear a field's error as soon as the user edits it
  form.addEventListener("input", (e) => e.target.name && setFieldError(e.target.name, ""));

  $("#again-btn").addEventListener("click", () => {
    form.reset();
    $("#prediction").scrollIntoView({ behavior: "smooth" });
    form.elements[ALL_FIELDS[0].name].focus({ preventScroll: true });
  });
  $("#print-btn").addEventListener("click", () => window.print());
}

function initNav() {
  const toggle = $("#nav-toggle");
  const menu = $("#nav-menu");
  const setOpen = (open) => {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
  menu.addEventListener("click", (e) => e.target.tagName === "A" && setOpen(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
}

function initReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(".step, .preview");
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  targets.forEach((t) => { t.classList.add("reveal"); io.observe(t); });
}

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initForm();
  initReveal();
  refreshIcons();
  // Lucide loads deferred from a CDN; render icons again once everything is ready.
  window.addEventListener("load", refreshIcons);
});

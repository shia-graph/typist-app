'use strict';

// ============================================================
// ۱. پیکربندی
// ============================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const SESSION_KEY = 'typist_panel_session';
const SESSION_DURATION_HOURS = 8;

if (!window.supabase) {
  console.error('Supabase SDK بارگذاری نشده است.');
} else {
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================================
// ۲. State
// ============================================================
const state = {
  typistId: null,
  typistIdentifier: null,
  typist: null,
  reports: [],
  payments: [],
  dashboardData: [],
  editingReportId: null,
  editingPaymentId: null,
  role: null,
  sessionToken: null,
  currentView: 'dashboard', // 'dashboard' | 'detail'
};

// ============================================================
// ۳. Session
// ============================================================
const Session = {
  save(data) {
    const session = { ...data, expiresAt: Date.now() + SESSION_DURATION_HOURS * 3600000 };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  },
  load() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.expiresAt || s.expiresAt < Date.now()) { this.clear(); return null; }
      return s;
    } catch (e) { return null; }
  },
  clear() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} },
};

// ============================================================
// ۴. SafeNum
// ============================================================
const SafeNum = {
  parse(val, fallback = 0) {
    if (val == null || val === '') return fallback;
    const cleaned = String(val)
      .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) & 0xf))
      .replace(/[,،\s]/g, '').trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : fallback;
  },
  format(val, fallback = '۰') {
    const n = this.parse(val, null);
    if (n === null) return fallback;
    return n.toLocaleString('fa-IR');
  },
  toToman(val) { return this.format(val) + ' تومان'; },
  short(val) {
    const n = this.parse(val, 0);
    if (n >= 1e9) return (n / 1e9).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' میلیارد';
    if (n >= 1e6) return (n / 1e6).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' میلیون';
    if (n >= 1e3) return (n / 1e3).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' هزار';
    return n.toLocaleString('fa-IR');
  },
};

// ============================================================
// ۵. تاریخ شمسی
// ============================================================
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const faToEn = (s) => String(s).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
const enToFa = (s) => String(s).replace(/\d/g, (d) => FA_DIGITS[+d]);

function toShamsiDate(dateInput) {
  if (!dateInput) return '---';
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput).split('T')[0];
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch (e) { return '---'; }
}

function getShamsiParts(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(safe);
  const get = (t) => { const f = parts.find(p => p.type === t); return f ? f.value : null; };
  return { year: parseInt(get('year'), 10), month: parseInt(get('month'), 10), day: parseInt(get('day'), 10) };
}

function shamsiToGregorian(jy, jm, jd) {
  let jy2 = jy - 979, jm2 = jm - 1, jd2 = jd - 1;
  let jDayNo = 365*jy2 + Math.floor(jy2/33)*8 + Math.floor(((jy2%33)+3)/4) + 78 + jd2 + (jm2<7 ? (jm2+1)*31 : (jm2+1)*30-6);
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) { gDayNo--; gy += 100*Math.floor(gDayNo/36524); gDayNo %= 36524; if (gDayNo >= 365) gDayNo++; else leap = false; }
  gy += 4*Math.floor(gDayNo/1461); gDayNo %= 1461;
  if (gDayNo >= 366) { leap = false; gDayNo--; gy += Math.floor(gDayNo/365); gDayNo %= 365; }
  let gd = gDayNo + 1;
  const gMonthDays = [31, leap?29:28, 31,30,31,30,31,31,30,31,30,31];
  let gm = 1;
  for (let i = 0; i < 12; i++) { if (gd <= gMonthDays[i]) { gm = i+1; break; } gd -= gMonthDays[i]; }
  return { gy, gm, gd };
}

function shamsiToISO(jy, jm, jd) {
  const g = shamsiToGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2,'0')}-${String(g.gd).padStart(2,'0')}`;
}

function todayShamsi() { return getShamsiParts(new Date()); }

function shamsiStringToParts(str) {
  if (!str) return null;
  const clean = faToEn(str).replace(/[\/\-\.]/g, '/');
  const m = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [_, y, mo, d] = m;
  const year = +y, month = +mo, day = +d;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatShamsiInput(parts) {
  if (!parts) return '';
  return `${enToFa(parts.year)}/${enToFa(String(parts.month).padStart(2,'0'))}/${enToFa(String(parts.day).padStart(2,'0'))}`;
}

// ============================================================
// ۶. UI utilities
// ============================================================
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

function confirmDialog(message, title = 'تأیید عملیات') {
  return new Promise((resolve) => {
    const old = document.getElementById('custom-confirm-overlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.className = 'modal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `<div class="modal-content" style="max-width:420px;">
      <h3 style="margin:0 0 1rem;">${title}</h3>
      <p style="margin:0 0 1.5rem;line-height:1.8;">${message}</p>
      <div class="row" style="justify-content:flex-end;gap:.5rem;">
        <button type="button" class="btn btn-outline" id="confirm-cancel">انصراف</button>
        <button type="button" class="btn btn-danger" id="confirm-ok">تأیید</button>
      </div></div>`;
    document.body.appendChild(overlay);
    const cleanup = (r) => { overlay.remove(); resolve(r); };
    overlay.querySelector('#confirm-ok').onclick = () => cleanup(true);
    overlay.querySelector('#confirm-cancel').onclick = () => cleanup(false);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
  });
}

function promptDialog(message, title = 'ورود اطلاعات', isPassword = false) {
  return new Promise((resolve) => {
    const old = document.getElementById('custom-prompt-overlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-prompt-overlay';
    overlay.className = 'modal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `<div class="modal-content" style="max-width:420px;">
      <h3 style="margin:0 0 1rem;">${title}</h3>
      <p style="margin:0 0 1rem;line-height:1.8;">${message}</p>
      <input type="${isPassword ? 'password' : 'text'}" id="prompt-input"
        style="width:100%;padding:.65rem .85rem;border-radius:.75rem;border:1px solid #e2e8f0;font-family:inherit;font-size:.9rem;margin-bottom:1rem;" />
      <div class="row" style="justify-content:flex-end;gap:.5rem;">
        <button type="button" class="btn btn-outline" id="prompt-cancel">انصراف</button>
        <button type="button" class="btn btn-primary" id="prompt-ok">تأیید</button>
      </div></div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#prompt-input');
    setTimeout(() => input.focus(), 50);
    const cleanup = (r) => { overlay.remove(); resolve(r); };
    overlay.querySelector('#prompt-ok').onclick = () => cleanup(input.value);
    overlay.querySelector('#prompt-cancel').onclick = () => cleanup(null);
    input.onkeydown = (e) => { if (e.key === 'Enter') cleanup(input.value); if (e.key === 'Escape') cleanup(null); };
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };
  });
}

function escapeHTML(str) {
  return String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function cleanInput(str) { return String(str == null ? '' : str).trim(); }

function showLoginAlert(msg, type = 'error') {
  const box = document.getElementById('login-alert');
  if (!box) return;
  box.textContent = msg;
  box.className = 'login-alert ' + (type === 'success' ? 'success' : 'error');
}

function hideLoginAlert() {
  const box = document.getElementById('login-alert');
  if (box) box.className = 'login-alert hidden';
}

function setLoading(btn, loading, defaultLabel) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span> در حال بررسی...' : `<span>${defaultLabel}</span>`;
}

function csvEscape(val) {
  const s = String(val == null ? '' : val);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

async function rpc(fnName, params) {
  const res = await window.db.rpc(fnName, params || {});
  if (res.error) throw new Error(res.error.message || 'خطای سرور');
  return res.data;
}

// ============================================================
// ۷. Date Picker
// ============================================================
const DP_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const DP_DOWS = ['ش','ی','د','س','چ','پ','ج'];

function buildDatePicker(wrap) {
  if (!wrap || wrap.dataset.dpInit === '1') return;
  wrap.dataset.dpInit = '1';
  const input = wrap.querySelector('input');
  const popup = wrap.querySelector('[data-dp-popup]');
  const trigger = wrap.querySelector('.date-picker-input');
  if (!input || !popup || !trigger) return;
  let selectedParts = input.value ? shamsiStringToParts(input.value) : null;
  let viewYear, viewMonth;

  function refreshView() {
    const base = selectedParts || todayShamsi();
    viewYear = base.year; viewMonth = base.month;
  }
  function render() {
    const t = todayShamsi();
    const firstDow = getFirstDowOfMonth(viewYear, viewMonth);
    const daysInMonth = getDaysInShamsiMonth(viewYear, viewMonth);
    let html = `<div class="dp-header">
      <button type="button" data-dp-nav="-1">‹</button>
      <span class="dp-title">${DP_MONTHS[viewMonth-1]} ${enToFa(viewYear)}</span>
      <button type="button" data-dp-nav="1">›</button>
    </div><div class="dp-grid">${DP_DOWS.map(d => `<div class="dp-dow">${d}</div>`).join('')}`;
    for (let i = 0; i < firstDow; i++) html += '<button type="button" class="dp-day empty" disabled></button>';
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = t.year === viewYear && t.month === viewMonth && t.day === d;
      const isSelected = selectedParts && selectedParts.year === viewYear && selectedParts.month === viewMonth && selectedParts.day === d;
      html += `<button type="button" class="dp-day${isToday?' today':''}${isSelected?' selected':''}" data-dp-day="${d}">${enToFa(d)}</button>`;
    }
    html += '</div>';
    popup.innerHTML = html;
    popup.querySelectorAll('[data-dp-nav]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); viewMonth += +b.dataset.dpNav; if(viewMonth<1){viewMonth=12;viewYear--;} if(viewMonth>12){viewMonth=1;viewYear++;} render(); };
    });
    popup.querySelectorAll('[data-dp-day]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); const day = +b.dataset.dpDay; selectedParts = {year:viewYear,month:viewMonth,day}; input.value = formatShamsiInput(selectedParts); input.dispatchEvent(new Event('change',{bubbles:true})); popup.classList.remove('open'); render(); };
    });
  }
  trigger.onclick = (e) => { e.stopPropagation(); if (popup.classList.contains('open')) popup.classList.remove('open'); else { refreshView(); render(); popup.classList.add('open'); } };
  document.addEventListener('click', (e) => { if (!document.body.contains(wrap)) return; if (!wrap.contains(e.target)) popup.classList.remove('open'); });
  if (!input.value) input.value = formatShamsiInput(todayShamsi());
}

function getFirstDowOfMonth(jy, jm) {
  const g = shamsiToGregorian(jy, jm, 1);
  const d = new Date(g.gy, g.gm-1, g.gd);
  const map = {0:1,1:2,2:3,3:4,4:5,5:6,6:0};
  return map[d.getDay()];
}
function getDaysInShamsiMonth(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const cyc = jy % 33;
  return [1,5,9,13,17,22,26,30].includes(cyc) ? 30 : 29;
}
function initAllDatePickers() { document.querySelectorAll('[data-datepicker]').forEach(buildDatePicker); }

// ============================================================
// ۸. Validator
// ============================================================
const Validator = {
  positiveNumber(val, max = Number.MAX_SAFE_INTEGER) {
    const n = SafeNum.parse(val, -1);
    return n >= 0 && n <= max ? n : null;
  },
  text(val, maxLen = 500) {
    const s = String(val || '').trim();
    return s.length <= maxLen ? s : s.substring(0, maxLen);
  },
};

// ============================================================
// ۹. Login
// ============================================================
function switchLoginTab(role) {
  const isAdmin = role === 'admin';
  document.getElementById('tab-admin').classList.toggle('active', isAdmin);
  document.getElementById('tab-typist').classList.toggle('active', !isAdmin);
  document.getElementById('form-admin').classList.toggle('hidden', !isAdmin);
  document.getElementById('form-typist').classList.toggle('hidden', isAdmin);
  hideLoginAlert();
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-admin-submit');
  const pass = cleanInput(document.getElementById('admin-password').value);
  if (!pass) { showLoginAlert('رمز عبور را وارد کنید.'); return; }
  setLoading(btn, true, 'ورود به پنل مدیریت');
  try {
    const result = await rpc('verify_admin_password', { p_password: pass });
    if (result?.success) {
      Session.save({ role: 'admin', token: result.token });
      state.sessionToken = result.token;
      showLoginAlert('ورود موفق!', 'success');
      setTimeout(() => enterPanel('admin', null), 400);
    } else {
      showLoginAlert(result?.message || 'رمز نادرست!');
    }
  } catch (err) {
    showLoginAlert('خطا: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پنل مدیریت');
  }
}

async function handleTypistLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-typist-submit');
  const idRaw = cleanInput(document.getElementById('typist-identifier').value);
  const passRaw = cleanInput(document.getElementById('typist-password').value);
  const identifier = faToEn(idRaw).replace(/\s/g, '');
  if (!/^09\d{9}$/.test(identifier) && !/^\d{10}$/.test(identifier)) {
    showLoginAlert('کد ملی یا شماره همراه معتبر وارد کنید.'); return;
  }
  if (!passRaw) { showLoginAlert('رمز عبور را وارد کنید.'); return; }
  const passClean = faToEn(passRaw).replace(/\s/g, '');
  setLoading(btn, true, 'ورود به پرتال تایپیست');
  try {
    const result = await rpc('verify_typist_password', { p_identifier: identifier, p_password: passClean });
    if (result?.success) {
      Session.save({ role: 'typist', typistId: result.typist_id, typistIdentifier: identifier, token: result.token });
      state.sessionToken = result.token;
      state.typistIdentifier = identifier;
      showLoginAlert(`خوش آمدید، ${result.name || 'تایپیست'}!`, 'success');
      setTimeout(() => enterPanel('typist', result.typist_id), 400);
    } else {
      showLoginAlert(result?.message || 'ورود ناموفق!');
    }
  } catch (err) {
    showLoginAlert('خطا: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پرتال تایپیست');
  }
}

// ============================================================
// ۱۰. ورود/خروج
// ============================================================
function enterPanel(role, typistId) {
  state.role = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('panel-screen').classList.add('visible');
  const userInfo = document.getElementById('user-info');
  if (userInfo) userInfo.textContent = role === 'admin' ? 'مدیر سامانه' : 'پرتال تایپیست';
  applyRolePermissions(role);

  if (role === 'typist' && typistId) {
    state.typistId = typistId;
    showDetailView(typistId, false);
  } else {
    showDashboardView();
  }
  initAllDatePickers();
}

function applyRolePermissions(role) {
  const isTypist = role === 'typist';
  document.querySelectorAll('[data-admin-only]').forEach(el => { el.style.display = isTypist ? 'none' : ''; });
  document.querySelectorAll('[data-typist-only]').forEach(el => { el.style.display = isTypist ? '' : 'none'; });
}

async function logout() {
  const ok = await confirmDialog('خروج از حساب کاربری؟', 'خروج');
  if (!ok) return;
  Session.clear();
  Object.assign(state, { typistId: null, typistIdentifier: null, typist: null, reports: [], payments: [], dashboardData: [], role: null, sessionToken: null, currentView: 'dashboard' });
  document.getElementById('panel-screen').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');
  ['admin-password','typist-identifier','typist-password'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  hideLoginAlert();
}

// ============================================================
// ۱۱. مدیریت نماها (Views)
// ============================================================
function showDashboardView() {
  if (state.role !== 'admin') return;
  state.currentView = 'dashboard';
  document.getElementById('dashboard-view').classList.remove('hidden');
  document.getElementById('detail-view').classList.remove('visible');
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'block';
  loadDashboard();
}

function showDetailView(typistId, scrollTop = true) {
  state.currentView = 'detail';
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('detail-view').classList.add('visible');
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  loadTypistDetail(typistId);
}

// ============================================================
// ۱۲. داشبورد
// ============================================================
async function loadDashboard() {
  const tbody = document.getElementById('dash-typists-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-dash"><div class="big-icon">⏳</div>در حال بارگذاری...</td></tr>';
  try {
    const data = await rpc('get_dashboard_summary') || [];
    state.dashboardData = data;
    renderDashboardStats(data);
    renderDashboardTable(data);
  } catch (err) {
    console.error('[loadDashboard]', err);
    toast('خطا در بارگذاری داشبورد: ' + err.message, 'error');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-dash"><div class="big-icon">⚠️</div>خطا در بارگذاری</td></tr>';
  }
}

function renderDashboardStats(data) {
  let totalWords = 0, totalPayable = 0, totalPaid = 0;
  data.forEach(t => {
    totalWords += SafeNum.parse(t.total_words, 0);
    totalPayable += SafeNum.parse(t.total_payable, 0);
    totalPaid += SafeNum.parse(t.total_paid, 0);
  });
  const remaining = totalPayable - totalPaid;
  document.getElementById('dash-count').textContent = enToFa(data.length);
  document.getElementById('dash-words').textContent = SafeNum.format(totalWords);
  document.getElementById('dash-payable').textContent = SafeNum.short(totalPayable);
  document.getElementById('dash-paid').textContent = SafeNum.short(totalPaid);
  const remEl = document.getElementById('dash-remaining');
  remEl.textContent = SafeNum.short(Math.abs(remaining));
  remEl.style.color = remaining > 0 ? '#e11d48' : remaining < 0 ? '#2563eb' : '#059669';
}

function getAvatarColors(name) {
  const palettes = [
    ['#6366f1', '#8b5cf6'], ['#06b6d4', '#3b82f6'],
    ['#10b981', '#059669'], ['#f59e0b', '#ef4444'],
    ['#ec4899', '#8b5cf6'], ['#14b8a6', '#0891b2'],
  ];
  const hash = String(name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function getInitials(name) {
  if (!name) return '؟';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0][0] || '؟').toUpperCase();
}

function renderDashboardTable(data) {
  const tbody = document.getElementById('dash-typists-tbody');
  const countEl = document.getElementById('dash-typists-count');
  if (countEl) countEl.textContent = enToFa(data.length);
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-dash"><div class="big-icon">👥</div>هیچ تایپیستی ثبت نشده است</td></tr>';
    return;
  }

  let html = '';
  data.forEach(t => {
    const remaining = SafeNum.parse(t.remaining, 0);
    const paid = SafeNum.parse(t.total_paid, 0);
    const payable = SafeNum.parse(t.total_payable, 0);
    const [c1, c2] = getAvatarColors(t.name);
    const initials = getInitials(t.name);

    let statusHtml;
    if (payable === 0 && paid === 0) {
      statusHtml = '<span class="status-pill status-pending">⏳ بدون گزارش</span>';
    } else if (remaining === 0) {
      statusHtml = '<span class="status-pill status-settled">✓ تسویه</span>';
    } else if (remaining > 0) {
      statusHtml = '<span class="status-pill status-pending">● بدهکار</span>';
    } else {
      statusHtml = '<span class="status-pill status-overpaid">↑ طلبکار</span>';
    }

    const searchText = `${t.name || ''} ${t.phone || ''} ${t.national_id || ''}`.toLowerCase();

    html += `<tr data-typist-id="${escapeHTML(t.id)}" data-search="${escapeHTML(searchText)}">
      <td style="text-align:right;">
        <div class="typist-name-cell">
          <div class="avatar" style="--a:${c1};--b:${c2};">${escapeHTML(initials)}</div>
          <div class="typist-name-info">
            <div class="typist-name">${escapeHTML(t.name || 'بدون نام')}</div>
            <div class="typist-phone">${escapeHTML(t.phone || t.national_id || '---')}</div>
          </div>
        </div>
      </td>
      <td class="num-cell indigo">${SafeNum.format(t.total_words)}</td>
      <td class="num-cell">${SafeNum.format(t.reports_count)}</td>
      <td class="num-cell amber">${SafeNum.short(payable)}</td>
      <td class="num-cell green">${SafeNum.short(paid)}</td>
      <td class="num-cell ${remaining > 0 ? 'rose' : 'green'}">${SafeNum.short(Math.abs(remaining))}</td>
      <td>${statusHtml}</td>
      <td><span class="click-hint">◀</span></td>
    </tr>`;
  });
  tbody.innerHTML = html;

  tbody.querySelectorAll('tr[data-typist-id]').forEach(tr => {
    tr.onclick = () => showDetailView(tr.dataset.typistId);
  });
}

function filterDashboard(query) {
  const q = (query || '').toLowerCase().trim();
  const tbody = document.getElementById('dash-typists-tbody');
  if (!tbody) return;
  let visible = 0;
  tbody.querySelectorAll('tr[data-search]').forEach(tr => {
    const match = !q || tr.dataset.search.includes(q);
    tr.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const countEl = document.getElementById('dash-typists-count');
  if (countEl) countEl.textContent = enToFa(visible);
}

// ============================================================
// ۱۳. جزئیات تایپیست
// ============================================================
let currentFetchId = 0;

async function loadTypistDetail(typistId) {
  if (!typistId) return;
  if (state.role === 'typist' && state.typistId && typistId !== state.typistId) {
    toast('دسترسی مجاز نیست.', 'error');
    return;
  }
  state.typistId = typistId;
  const fetchId = ++currentFetchId;
  try {
    const [profileArr, reportsArr, paymentsArr] = await Promise.all([
      rpc('get_typist_profile', { p_typist_id: typistId }),
      rpc('get_typist_reports', { p_typist_id: typistId }),
      rpc('get_typist_payments', { p_typist_id: typistId }),
    ]);
    if (fetchId !== currentFetchId) return;
    const typist = (profileArr || [])[0];
    if (!typist) { toast('تایپیست یافت نشد.', 'error'); return; }
    state.typist = typist;
    renderProfile(typist);
    state.reports = (reportsArr || []).map(r => normalizeReport(r, typist));
    state.payments = paymentsArr || [];
    renderReports();
    renderPayments();
    renderSummary();
  } catch (err) {
    if (fetchId !== currentFetchId) return;
    toast('خطا: ' + err.message, 'error');
  }
}

function renderProfile(typist) {
  const [c1, c2] = getAvatarColors(typist.name);
  const avatar = document.getElementById('profile-avatar');
  if (avatar) {
    avatar.style.setProperty('--a', c1);
    avatar.style.setProperty('--b', c2);
    avatar.textContent = getInitials(typist.name);
  }
  document.getElementById('profile-name').textContent = typist.name || 'نامشخص';
  document.getElementById('profile-national-id').textContent = typist.national_id || typist.national_code || '---';
  document.getElementById('profile-phone').textContent = typist.phone || '---';
  const rate = typist.rate_per_word || typist.default_word_rate || 0;
  document.getElementById('profile-default-rate').textContent = SafeNum.format(rate);
  const inpRate = document.getElementById('inp-rate');
  if (inpRate) inpRate.value = rate;
}

function normalizeReport(row, typist = {}) {
  const words = SafeNum.parse(row.words, 0);
  const pages = SafeNum.parse(row.pages, 0);
  const rate = SafeNum.parse(row.rate_per_word || row.rate || typist.rate_per_word || typist.default_word_rate || 0, 0);
  let total = SafeNum.parse(row.total_amount, 0);
  if (!total && words && rate) total = words * rate;
  return {
    id: row.id, typist_id: row.typist_id,
    period: row.period || row.period_number || 1,
    words, pages, rate_per_word: rate, total_amount: total,
    description: row.description || 'بدون توضیحات',
    is_settled: !!row.is_settled,
    created_at: row.created_at,
    shamsi_date: toShamsiDate(row.created_at),
  };
}

function renderReports() {
  const tbody = document.getElementById('typist-reports-tbody');
  const badge = document.getElementById('reports-count-badge');
  if (badge) badge.textContent = SafeNum.format(state.reports.length) + ' ردیف';
  if (!tbody) return;
  if (!state.reports.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">هیچ گزارشی ثبت نشده است.</td></tr>';
    return;
  }
  const isAdmin = state.role === 'admin';
  let html = '';
  state.reports.forEach((r, i) => {
    html += `<tr>
      <td style="color:#94a3b8;">${SafeNum.format(i+1)}</td>
      <td style="font-weight:600;white-space:nowrap;">${escapeHTML(r.shamsi_date)}</td>
      <td><span class="pill pill-indigo">دوره ${SafeNum.format(r.period)}</span></td>
      <td>${SafeNum.format(r.pages)}</td>
      <td style="font-weight:800;color:#4338ca;">${SafeNum.format(r.words)}</td>
      <td>${SafeNum.format(r.rate_per_word)}</td>
      <td class="amount">${SafeNum.toToman(r.total_amount)}</td>
      <td>${r.is_settled ? '<span class="pill pill-green">تسویه</span>' : '<span class="pill pill-amber">در انتظار</span>'}</td>
      <td class="desc-cell" title="${escapeHTML(r.description)}">${escapeHTML(r.description)}</td>
      <td>${isAdmin ? `<div class="row" style="justify-content:center;">
        <button class="btn btn-outline btn-sm" data-edit-report="${escapeHTML(r.id)}">✏️</button>
        <button class="btn btn-danger btn-sm" data-delete-report="${escapeHTML(r.id)}">🗑</button>
      </div>` : '<span style="color:#94a3b8;">—</span>'}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
  if (isAdmin) {
    tbody.querySelectorAll('[data-edit-report]').forEach(b => b.onclick = () => openEditReport(b.dataset.editReport));
    tbody.querySelectorAll('[data-delete-report]').forEach(b => b.onclick = () => deleteReport(b.dataset.deleteReport));
  }
}

function renderPayments() {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;
  if (!state.payments.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">هیچ پرداختی ثبت نشده است.</td></tr>';
    return;
  }
  const isAdmin = state.role === 'admin';
  let html = '';
  state.payments.forEach((p, i) => {
    html += `<tr>
      <td style="color:#94a3b8;">${SafeNum.format(i+1)}</td>
      <td style="font-weight:600;">${escapeHTML(toShamsiDate(p.payment_date))}</td>
      <td class="amount">${SafeNum.toToman(p.amount)}</td>
      <td>${escapeHTML(p.method || '---')}</td>
      <td style="font-family:monospace;font-size:.75rem;color:#64748b;">${escapeHTML(p.tracking_code || '---')}</td>
      <td class="desc-cell">${escapeHTML(p.description || '---')}</td>
      <td>${isAdmin ? `<div class="row" style="justify-content:center;">
        <button class="btn btn-outline btn-sm" data-edit-payment="${escapeHTML(p.id)}">✏️</button>
        <button class="btn btn-danger btn-sm" data-delete-payment="${escapeHTML(p.id)}">🗑</button>
      </div>` : '<span style="color:#94a3b8;">—</span>'}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
  if (isAdmin) {
    tbody.querySelectorAll('[data-edit-payment]').forEach(b => b.onclick = () => openEditPayment(b.dataset.editPayment));
    tbody.querySelectorAll('[data-delete-payment]').forEach(b => b.onclick = () => deletePayment(b.dataset.deletePayment));
  }
}

function renderSummary() {
  let totalWords = 0, totalPages = 0, totalPayable = 0;
  state.reports.forEach(r => { totalWords += r.words; totalPages += r.pages; totalPayable += r.total_amount; });
  let totalPaid = 0;
  state.payments.forEach(p => { totalPaid += SafeNum.parse(p.amount, 0); });
  const remaining = totalPayable - totalPaid;
  document.getElementById('sum-total-words').textContent = SafeNum.format(totalWords);
  document.getElementById('sum-total-pages').textContent = SafeNum.format(totalPages);
  document.getElementById('sum-total-payable').textContent = SafeNum.short(totalPayable);
  document.getElementById('sum-total-paid').textContent = SafeNum.short(totalPaid);
  const remEl = document.getElementById('sum-remaining-balance');
  remEl.textContent = SafeNum.short(Math.abs(remaining));
  remEl.style.color = remaining > 0 ? '#e11d48' : remaining < 0 ? '#2563eb' : '#059669';
}

// ============================================================
// ۱۴. Modals
// ============================================================
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// ============================================================
// ۱۵. ثبت/ویرایش گزارش
// ============================================================
function resetReportForm() {
  state.editingReportId = null;
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('inp-report-id', ''); setVal('inp-period', 1); setVal('inp-pages', 0); setVal('inp-words', 0);
  setVal('inp-rate', state.typist?.rate_per_word || 0); setVal('inp-desc', '');
  setVal('inp-date', formatShamsiInput(todayShamsi()));
  document.getElementById('modal-report-title').textContent = '➕ ثبت گزارش جدید';
  document.getElementById('btn-submit-report').textContent = 'ثبت در دیتابیس';
  updateReportPreview();
}

function updateReportPreview() {
  const w = SafeNum.parse(document.getElementById('inp-words')?.value, 0);
  const r = SafeNum.parse(document.getElementById('inp-rate')?.value, 0);
  document.getElementById('calculated-total-preview').textContent = SafeNum.toToman(w * r);
}

function openEditReport(id) {
  if (state.role !== 'admin') return;
  const r = state.reports.find(x => String(x.id) === String(id));
  if (!r) return;
  state.editingReportId = r.id;
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('inp-report-id', r.id); setVal('inp-period', r.period);
  setVal('inp-pages', r.pages); setVal('inp-words', r.words); setVal('inp-rate', r.rate_per_word);
  setVal('inp-desc', r.description === 'بدون توضیحات' ? '' : r.description);
  setVal('inp-date', r.shamsi_date);
  document.getElementById('modal-report-title').textContent = '✏️ ویرایش گزارش';
  document.getElementById('btn-submit-report').textContent = 'ذخیره تغییرات';
  updateReportPreview();
  openModal('modal-report');
}

async function handleSubmitReport(e) {
  e.preventDefault();
  if (state.role !== 'admin') return;
  if (!state.typistId) { toast('تایپیست انتخاب نشده.', 'warn'); return; }
  const btn = document.getElementById('btn-submit-report');
  const isEditing = !!state.editingReportId;
  btn.disabled = true; btn.textContent = 'در حال ذخیره...';
  try {
    const words = Validator.positiveNumber(document.getElementById('inp-words').value, 1e9);
    const pages = Validator.positiveNumber(document.getElementById('inp-pages').value, 1e6);
    const rate = Validator.positiveNumber(document.getElementById('inp-rate').value, 1e9);
    const period = Validator.positiveNumber(document.getElementById('inp-period').value, 1000) || 1;
    const desc = Validator.text(document.getElementById('inp-desc').value, 1000);
    if (words === null || pages === null || rate === null) { toast('مقادیر نامعتبر.', 'warn'); return; }
    const parts = shamsiStringToParts(document.getElementById('inp-date').value);
    const isoDate = parts ? shamsiToISO(parts.year, parts.month, parts.day) + 'T12:00:00.000Z' : new Date().toISOString();
    const result = await rpc('upsert_report', {
      p_id: state.editingReportId || null, p_typist_id: state.typistId,
      p_words: words, p_pages: pages, p_rate: rate, p_period: period,
      p_description: desc, p_created_at: isoDate,
    });
    if (result?.success) {
      toast(isEditing ? 'ویرایش شد.' : 'ثبت شد.', 'success');
      closeModal('modal-report');
      state.editingReportId = null;
      await loadTypistDetail(state.typistId);
    } else {
      toast(result?.message || 'خطا در ذخیره.', 'error');
    }
  } catch (err) {
    toast('خطا: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isEditing ? 'ذخیره تغییرات' : 'ثبت در دیتابیس';
  }
}

async function deleteReport(id) {
  if (state.role !== 'admin') return;
  const ok = await confirmDialog('حذف این گزارش؟ غیرقابل بازگشت است.', 'حذف گزارش');
  if (!ok) return;
  try {
    const result = await rpc('delete_report', { p_id: id });
    if (result?.success) { toast('حذف شد.', 'success'); await loadTypistDetail(state.typistId); }
    else toast(result?.message || 'خطا.', 'error');
  } catch (err) { toast('خطا: ' + err.message, 'error'); }
}

// ============================================================
// ۱۶. ثبت/ویرایش پرداخت
// ============================================================
function resetPaymentForm() {
  state.editingPaymentId = null;
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('inp-pay-id', ''); setVal('inp-pay-amount', 0); setVal('inp-pay-method', 'bank_transfer');
  setVal('inp-pay-track', ''); setVal('inp-pay-desc', '');
  setVal('inp-pay-date', formatShamsiInput(todayShamsi()));
  document.getElementById('modal-payment-title').textContent = '➕ ثبت پرداخت جدید';
  document.getElementById('btn-submit-payment').textContent = 'ثبت واریز';
}

function openEditPayment(id) {
  if (state.role !== 'admin') return;
  const p = state.payments.find(x => String(x.id) === String(id));
  if (!p) return;
  state.editingPaymentId = p.id;
  const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  setVal('inp-pay-id', p.id); setVal('inp-pay-amount', SafeNum.parse(p.amount, 0));
  setVal('inp-pay-method', p.method || 'bank_transfer');
  setVal('inp-pay-track', p.tracking_code || ''); setVal('inp-pay-desc', p.description || '');
  setVal('inp-pay-date', toShamsiDate(p.payment_date));
  document.getElementById('modal-payment-title').textContent = '✏️ ویرایش پرداخت';
  document.getElementById('btn-submit-payment').textContent = 'ذخیره تغییرات';
  openModal('modal-payment');
}

async function handleSubmitPayment(e) {
  e.preventDefault();
  if (state.role !== 'admin') return;
  if (!state.typistId) { toast('تایپیست انتخاب نشده.', 'warn'); return; }
  const btn = document.getElementById('btn-submit-payment');
  const isEditing = !!state.editingPaymentId;
  btn.disabled = true; btn.textContent = 'در حال ذخیره...';
  try {
    const amount = Validator.positiveNumber(document.getElementById('inp-pay-amount').value, 1e12);
    const method = Validator.text(document.getElementById('inp-pay-method').value, 50);
    const tracking = Validator.text(document.getElementById('inp-pay-track').value, 100);
    const desc = Validator.text(document.getElementById('inp-pay-desc').value, 500);
    if (amount === null || amount <= 0) { toast('مبلغ باید > ۰ باشد.', 'warn'); return; }
    const parts = shamsiStringToParts(document.getElementById('inp-pay-date').value);
    const isoDate = parts ? shamsiToISO(parts.year, parts.month, parts.day) : new Date().toISOString().slice(0,10);
    const result = await rpc('upsert_payment', {
      p_id: state.editingPaymentId || null, p_person_id: state.typistId,
      p_amount: amount, p_payment_date: isoDate, p_method: method,
      p_tracking_code: tracking || null, p_description: desc || null,
    });
    if (result?.success) {
      toast(isEditing ? 'ویرایش شد.' : 'ثبت شد.', 'success');
      closeModal('modal-payment');
      state.editingPaymentId = null;
      await loadTypistDetail(state.typistId);
    } else {
      toast(result?.message || 'خطا.', 'error');
    }
  } catch (err) {
    toast('خطا: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isEditing ? 'ذخیره تغییرات' : 'ثبت واریز';
  }
}

async function deletePayment(id) {
  if (state.role !== 'admin') return;
  const ok = await confirmDialog('حذف این پرداخت؟', 'حذف پرداخت');
  if (!ok) return;
  try {
    const result = await rpc('delete_payment', { p_id: id });
    if (result?.success) { toast('حذف شد.', 'success'); await loadTypistDetail(state.typistId); }
    else toast(result?.message || 'خطا.', 'error');
  } catch (err) { toast('خطا: ' + err.message, 'error'); }
}

// ============================================================
// ۱۷. تغییر رمز
// ============================================================
async function changeAdminPassword() {
  const oldPass = await promptDialog('رمز فعلی مدیر:', 'تغییر رمز مدیر', true);
  if (!oldPass) return;
  const newPass = await promptDialog('رمز جدید (حداقل ۶ کاراکتر):', 'تغییر رمز مدیر', true);
  if (!newPass) return;
  if (newPass.length < 6) { toast('رمز حداقل ۶ کاراکتر.', 'warn'); return; }
  const confirmPass = await promptDialog('تأیید رمز جدید:', 'تأیید', true);
  if (!confirmPass) return;
  if (newPass !== confirmPass) { toast('رمزها یکسان نیستند.', 'error'); return; }
  try {
    const result = await rpc('change_admin_password', { p_old_password: oldPass, p_new_password: newPass });
    toast(result?.message || 'انجام شد.', result?.success ? 'success' : 'error');
  } catch (err) { toast('خطا: ' + err.message, 'error'); }
}

async function changeTypistPassword() {
  if (!state.typistIdentifier) { toast('دوباره وارد شوید.', 'error'); return; }
  const oldPass = await promptDialog('رمز فعلی:', 'تغییر رمز', true);
  if (!oldPass) return;
  const newPass = await promptDialog('رمز جدید (حداقل ۴ کاراکتر):', 'تغییر رمز', true);
  if (!newPass) return;
  if (newPass.length < 4) { toast('رمز حداقل ۴ کاراکتر.', 'warn'); return; }
  const confirmPass = await promptDialog('تأیید رمز جدید:', 'تأیید', true);
  if (!confirmPass) return;
  if (newPass !== confirmPass) { toast('رمزها یکسان نیستند.', 'error'); return; }
  try {
    const result = await rpc('change_typist_password', {
      p_identifier: state.typistIdentifier, p_old_password: oldPass, p_new_password: newPass,
    });
    toast(result?.message || 'انجام شد.', result?.success ? 'success' : 'error');
  } catch (err) { toast('خطا: ' + err.message, 'error'); }
}

// ============================================================
// ۱۸. خروجی CSV
// ============================================================
function exportToCSV() {
  if (!state.reports.length) { toast('گزارشی برای خروجی نیست.', 'warn'); return; }
  const headers = ['ردیف','تاریخ','دوره','صفحات','کلمات','نرخ','مبلغ کل','وضعیت','توضیحات'];
  const rows = state.reports.map((r, i) => [i+1, r.shamsi_date, r.period, r.pages, r.words, r.rate_per_word, r.total_amount, r.is_settled ? 'تسویه' : 'در انتظار', r.description || '']);
  const csv = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tname = state.typist?.name || 'تایپیست';
  a.href = url;
  a.download = `گزارش_${tname.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('CSV دانلود شد.', 'success');
}

// ============================================================
// ۱۹. Events
// ============================================================
function bindEvents() {
  document.querySelectorAll('.login-tab[data-role]').forEach(tab => {
    tab.onclick = () => switchLoginTab(tab.dataset.role);
  });
  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.togglePass);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    };
  });
  document.getElementById('form-admin')?.addEventListener('submit', handleAdminLogin);
  document.getElementById('form-typist')?.addEventListener('submit', handleTypistLogin);
  document.getElementById('btn-logout')?.addEventListener('click', logout);

  // Dashboard
  document.getElementById('btn-dash-refresh')?.addEventListener('click', loadDashboard);
  document.getElementById('dash-search')?.addEventListener('input', (e) => filterDashboard(e.target.value));
  document.getElementById('btn-back-to-dash')?.addEventListener('click', showDashboardView);

  // Change password
  document.getElementById('btn-change-password')?.addEventListener('click', () => {
    if (state.role === 'admin') changeAdminPassword();
    else if (state.role === 'typist') changeTypistPassword();
  });

  // Reports
  document.getElementById('btn-export-excel')?.addEventListener('click', exportToCSV);
  document.getElementById('btn-open-report-modal')?.addEventListener('click', () => {
    if (state.role !== 'admin' || !state.typistId) { toast('ابتدا تایپیست انتخاب شود.', 'warn'); return; }
    resetReportForm(); openModal('modal-report');
  });
  document.getElementById('form-new-report')?.addEventListener('submit', handleSubmitReport);
  ['inp-words','inp-rate'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateReportPreview);
  });

  // Payments
  document.getElementById('btn-open-payment-modal')?.addEventListener('click', () => {
    if (state.role !== 'admin' || !state.typistId) { toast('ابتدا تایپیست انتخاب شود.', 'warn'); return; }
    resetPaymentForm(); openModal('modal-payment');
  });
  document.getElementById('form-new-payment')?.addEventListener('submit', handleSubmitPayment);

  // Modal close
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) { closeModal(closeBtn.dataset.close); return; }
    if (e.target.classList?.contains('modal') && e.target.id) {
      if (!['custom-confirm-overlay','custom-prompt-overlay'].includes(e.target.id)) closeModal(e.target.id);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
        if (m.id && !['custom-confirm-overlay','custom-prompt-overlay'].includes(m.id)) closeModal(m.id);
      });
    }
  });
}

// ============================================================
// ۲۰. Boot
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!window.db) {
    alert('خطا در اتصال به دیتابیس.');
    return;
  }
  bindEvents();
  initAllDatePickers();
  const session = Session.load();
  if (session) {
    state.sessionToken = session.token;
    if (session.role === 'admin') enterPanel('admin', null);
    else if (session.role === 'typist' && session.typistId) {
      state.typistIdentifier = session.typistIdentifier;
      enterPanel('typist', session.typistId);
    }
  }
});

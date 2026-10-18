'use strict';

// ============================================================
// ۱. پیکربندی
// ============================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const DEFAULT_ADMIN_PASSWORD = '123456';

if (!window.supabase) {
  console.error('Supabase SDK بارگذاری نشده است.');
} else {
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ============================================================
// ۲. وضعیت
// ============================================================
const state = {
  typistId: null,
  typist: null,
  reports: [],
  payments: [],
  editingReportId: null,
  editingPaymentId: null,
  role: null,
};

// ============================================================
// ۳. ابزار اعداد
// ============================================================
const SafeNum = {
  parse(val, fallback) {
    if (fallback === undefined) fallback = 0;
    if (val === null || val === undefined || val === '') return fallback;
    const cleaned = String(val)
      .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) & 0xf))
      .replace(/[,،\s]/g, '')
      .trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : fallback;
  },
  format(val, fallback) {
    if (fallback === undefined) fallback = '۰';
    const num = this.parse(val, null);
    if (num === null) return fallback;
    return num.toLocaleString('fa-IR');
  },
  toToman(val) {
    return this.format(val) + ' تومان';
  },
};

// ============================================================
// ۴. ابزار تاریخ
// ============================================================
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const faToEn = (s) => String(s).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
const enToFa = (s) => String(s).replace(/\d/g, (d) => FA_DIGITS[+d]);

function toShamsiDate(dateInput) {
  if (!dateInput) return '---';
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput).split('T')[0];
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  } catch {
    return String(dateInput).split('T')[0] || '---';
  }
}

function getShamsiParts(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(safe);
  const get = (t) => {
    const found = parts.find((p) => p.type === t);
    return found ? found.value : null;
  };
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
  };
}

function shamsiToGregorian(jy, jm, jd) {
  let jy2 = jy - 979;
  let jm2 = jm - 1;
  let jd2 = jd - 1;
  let jDayNo =
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    78 +
    jd2 +
    (jm2 < 7 ? (jm2 + 1) * 31 : (jm2 + 1) * 30 - 6);
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo = gDayNo % 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo = gDayNo % 36524;
    if (gDayNo >= 365) gDayNo++;
    else leap = false;
  }
  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo--;
    gy += Math.floor(gDayNo / 365);
    gDayNo = gDayNo % 365;
  }
  let gd = gDayNo + 1;
  const gMonthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  for (let i = 0; i < 12; i++) {
    if (gd <= gMonthDays[i]) { gm = i + 1; break; }
    gd -= gMonthDays[i];
  }
  return { gy, gm, gd };
}

function shamsiToISO(jy, jm, jd) {
  const g = shamsiToGregorian(jy, jm, jd);
  return g.gy + '-' + String(g.gm).padStart(2, '0') + '-' + String(g.gd).padStart(2, '0');
}

function todayShamsi() {
  return getShamsiParts(new Date());
}

function shamsiStringToParts(str) {
  const clean = faToEn(str).replace(/[\/\-\.]/g, '/');
  const m = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

// ============================================================
// ۵. Toast
// ============================================================
function toast(msg, type) {
  if (type === undefined) type = 'info';
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  el.setAttribute('role', 'status');
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

// ============================================================
// ۶. Date Picker
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
  let viewYear;
  let viewMonth;

  function refreshView() {
    if (selectedParts) {
      viewYear = selectedParts.year;
      viewMonth = selectedParts.month;
    } else {
      const t = todayShamsi();
      viewYear = t.year;
      viewMonth = t.month;
    }
  }

  function render() {
    const t = todayShamsi();
    const firstDow = getFirstDowOfMonth(viewYear, viewMonth);
    const daysInMonth = getDaysInShamsiMonth(viewYear, viewMonth);

    let html =
      '<div class="dp-header">' +
        '<button type="button" data-dp-nav="-1" aria-label="ماه قبل">‹</button>' +
        '<span class="dp-title">' + DP_MONTHS[viewMonth - 1] + ' ' + enToFa(viewYear) + '</span>' +
        '<button type="button" data-dp-nav="1" aria-label="ماه بعد">›</button>' +
      '</div>' +
      '<div class="dp-grid">' +
        DP_DOWS.map((d) => '<div class="dp-dow">' + d + '</div>').join('');

    for (let i = 0; i < firstDow; i++) {
      html += '<button type="button" class="dp-day empty" disabled></button>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = t.year === viewYear && t.month === viewMonth && t.day === d;
      const isSelected =
        selectedParts && selectedParts.year === viewYear &&
        selectedParts.month === viewMonth && selectedParts.day === d;
      html += '<button type="button" class="dp-day' +
        (isToday ? ' today' : '') +
        (isSelected ? ' selected' : '') +
        '" data-dp-day="' + d + '">' + enToFa(d) + '</button>';
    }
    html += '</div>';
    popup.innerHTML = html;

    popup.querySelectorAll('[data-dp-nav]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        viewMonth += +b.dataset.dpNav;
        if (viewMonth < 1) { viewMonth = 12; viewYear--; }
        if (viewMonth > 12) { viewMonth = 1; viewYear++; }
        render();
      });
    });

    popup.querySelectorAll('[data-dp-day]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const day = +b.dataset.dpDay;
        selectedParts = { year: viewYear, month: viewMonth, day };
        input.value =
          enToFa(viewYear) + '/' +
          enToFa(String(viewMonth).padStart(2, '0')) + '/' +
          enToFa(String(day).padStart(2, '0'));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        popup.classList.remove('open');
        render();
      });
    });
  }

  function open() {
    refreshView();
    render();
    popup.classList.add('open');
  }
  function close() {
    popup.classList.remove('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popup.classList.contains('open')) close();
    else open();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  if (!input.value) {
    const t = todayShamsi();
    input.value =
      enToFa(t.year) + '/' +
      enToFa(String(t.month).padStart(2, '0')) + '/' +
      enToFa(String(t.day).padStart(2, '0'));
  }
}

function getFirstDowOfMonth(jy, jm) {
  const g = shamsiToGregorian(jy, jm, 1);
  const d = new Date(g.gy, g.gm - 1, g.gd);
  const jsDow = d.getDay();
  const map = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0 };
  return map[jsDow];
}

function getDaysInShamsiMonth(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapShamsiYear(jy) ? 30 : 29;
}

function isLeapShamsiYear(jy) {
  const cyc = jy % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].indexOf(cyc) !== -1;
}

function initAllDatePickers() {
  document.querySelectorAll('[data-datepicker]').forEach(buildDatePicker);
}

// ============================================================
// ۷. لاگین
// ============================================================
function cleanInput(str) {
  return String(str === undefined || str === null ? '' : str).trim();
}

function showLoginAlert(msg, type) {
  if (type === undefined) type = 'error';
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
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> در حال بررسی...'
    : '<span>' + defaultLabel + '</span>';
}

function switchLoginTab(role) {
  const isAdmin = role === 'admin';
  const tabAdmin = document.getElementById('tab-admin');
  const tabTypist = document.getElementById('tab-typist');
  const formAdmin = document.getElementById('form-admin');
  const formTypist = document.getElementById('form-typist');
  if (!tabAdmin || !tabTypist || !formAdmin || !formTypist) return;

  tabAdmin.classList.toggle('active', isAdmin);
  tabTypist.classList.toggle('active', !isAdmin);
  formAdmin.classList.toggle('hidden', !isAdmin);
  formTypist.classList.toggle('hidden', isAdmin);
  hideLoginAlert();
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-admin-submit');
  const pass = cleanInput(document.getElementById('admin-password').value);
  if (!pass) { showLoginAlert('رمز عبور را وارد کنید.'); return; }

  setLoading(btn, true, 'ورود به پنل مدیریت');

  try {
    const res = await window.db
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_password')
      .maybeSingle();

    if (res.error) throw res.error;
    const validPassword = res.data && res.data.value ? res.data.value : DEFAULT_ADMIN_PASSWORD;

    if (pass === validPassword) {
      showLoginAlert('ورود موفق! در حال انتقال...', 'success');
      setTimeout(() => enterPanel('admin', null), 600);
    } else {
      showLoginAlert('رمز عبور نادرست است!');
    }
  } catch (err) {
    console.error('[Admin login]', err);
    showLoginAlert('خطا در برقراری ارتباط: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پنل مدیریت');
  }
}

async function handleTypistLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-typist-submit');
  const id = cleanInput(document.getElementById('typist-identifier').value)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

  if (!/^09\d{9}$/.test(id) && !/^\d{10}$/.test(id)) {
    showLoginAlert('کد ملی یا شماره همراه معتبر وارد کنید.');
    return;
  }

  setLoading(btn, true, 'ورود به پرتال تایپیست');

  try {
    const res = await window.db
      .from('typists')
      .select('id, name, phone, national_id, national_code')
      .or('phone.eq.' + id + ',national_id.eq.' + id + ',national_code.eq.' + id)
      .maybeSingle();

    if (res.error) throw res.error;

    if (res.data) {
      showLoginAlert('خوش آمدید، ' + res.data.name + '!', 'success');
      setTimeout(() => enterPanel('typist', res.data.id), 600);
    } else {
      showLoginAlert('کاربری با این مشخصات یافت نشد!');
    }
  } catch (err) {
    console.error('[Typist login]', err);
    showLoginAlert('خطا در بررسی کاربر: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پرتال تایپیست');
  }
}

// ============================================================
// ۸. ورود به پنل
// ============================================================
function enterPanel(role, typistId) {
  state.role = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('panel-screen').classList.add('visible');

  const userInfo = document.getElementById('user-info');
  userInfo.textContent = role === 'admin' ? 'نقش: مدیر سامانه' : 'نقش: تایپیست';

  if (role === 'typist' && typistId) {
    state.typistId = typistId;
    const sel = document.getElementById('typist-select');
    const refresh = document.getElementById('btn-refresh');
    if (sel) sel.style.display = 'none';
    if (refresh) refresh.style.display = 'none';
    selectTypist(typistId);
  } else {
    loadTypistsList();
  }
  initAllDatePickers();
}

function logout() {
  if (!confirm('آیا می‌خواهید خارج شوید؟')) return;
  state.typistId = null;
  state.typist = null;
  state.reports = [];
  state.payments = [];
  state.role = null;
  document.getElementById('panel-screen').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-password').value = '';
  document.getElementById('typist-identifier').value = '';
  hideLoginAlert();
}

// ============================================================
// ۹. بارگذاری لیست تایپیست‌ها
// ============================================================
async function loadTypistsList() {
  const select = document.getElementById('typist-select');
  if (!select) return;
  try {
    const res = await window.db
      .from('typists')
      .select('id, name')
      .order('name', { ascending: true });

    if (res.error) throw res.error;
    const data = res.data || [];

    if (data.length === 0) {
      select.innerHTML = '<option value="">هیچ تایپیستی وجود ندارد</option>';
      return;
    }

    let html = '<option value="">-- انتخاب تایپیست --</option>';
    data.forEach((t) => {
      html += '<option value="' + t.id + '">' + (t.name || 'بدون نام') + '</option>';
    });
    select.innerHTML = html;

    select.value = data[0].id;
    selectTypist(data[0].id);
  } catch (err) {
    console.error('خطا در بارگذاری تایپیست‌ها:', err);
    select.innerHTML = '<option value="">خطا</option>';
  }
}

// ============================================================
// ۱۰. انتخاب و واکشی اطلاعات
// ============================================================
async function selectTypist(typistId) {
  if (!typistId) return;
  state.typistId = typistId;

  try {
    const tRes = await window.db.from('typists').select('*').eq('id', typistId).single();
    if (tRes.error) throw tRes.error;
    const typist = tRes.data;
    state.typist = typist;

    document.getElementById('profile-name').textContent = typist.name || 'نامشخص';
    document.getElementById('profile-national-id').textContent =
      typist.national_id || typist.national_code || '---';
    document.getElementById('profile-phone').textContent = typist.phone || '---';

    const rate = typist.rate_per_word || typist.default_word_rate || 0;
    document.getElementById('profile-default-rate').textContent = SafeNum.toToman(rate);
    document.getElementById('inp-rate').value = rate;

    const rRes = await window.db
      .from('typist_reports')
      .select('*')
      .eq('typist_id', typistId)
      .order('created_at', { ascending: false });
    if (rRes.error) throw rRes.error;
    state.reports = (rRes.data || []).map((r) => normalizeReport(r, typist));

    const pRes = await window.db
      .from('payments')
      .select('*')
      .eq('person_id', typistId)
      .order('payment_date', { ascending: false });
    if (pRes.error) throw pRes.error;
    state.payments = pRes.data || [];

    renderReports();
    renderPayments();
    renderSummary();
  } catch (err) {
    console.error('[selectTypist]', err);
    toast('خطا در دریافت اطلاعات: ' + err.message, 'error');
  }
}

function normalizeReport(row, typist) {
  if (!typist) typist = {};
  const words = SafeNum.parse(row.words, 0);
  const pages = SafeNum.parse(row.pages, 0);
  const rate = SafeNum.parse(row.rate_per_word || row.rate || typist.rate_per_word || 0, 0);
  let total = SafeNum.parse(row.total_amount, 0);
  if (!total && words && rate) total = words * rate;
  return {
    id: row.id,
    typist_id: row.typist_id,
    period: row.period || row.period_number || 1,
    words: words,
    pages: pages,
    rate_per_word: rate,
    total_amount: total,
    description: row.description || 'بدون توضیحات',
    is_settled: !!row.is_settled,
    created_at: row.created_at,
    shamsi_date: toShamsiDate(row.created_at),
  };
}

// ============================================================
// ۱۱. رندر جدول‌ها
// ============================================================
function renderReports() {
  const tbody = document.getElementById('typist-reports-tbody');
  const badge = document.getElementById('reports-count-badge');
  if (badge) badge.textContent = SafeNum.format(state.reports.length) + ' ردیف';

  if (!state.reports.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">هیچ گزارشی ثبت نشده است.</td></tr>';
    return;
  }

  let html = '';
  state.reports.forEach((r, i) => {
    html += '<tr>' +
      '<td style="color:#94a3b8;font-family:monospace;">' + SafeNum.format(i + 1) + '</td>' +
      '<td style="font-weight:600;white-space:nowrap;">' + r.shamsi_date + '</td>' +
      '<td><span class="pill pill-indigo">دوره ' + SafeNum.format(r.period) + '</span></td>' +
      '<td>' + SafeNum.format(r.pages) + '</td>' +
      '<td style="font-weight:800;color:#4338ca;">' + SafeNum.format(r.words) + '</td>' +
      '<td>' + SafeNum.format(r.rate_per_word) + '</td>' +
      '<td class="amount">' + SafeNum.toToman(r.total_amount) + '</td>' +
      '<td>' + (r.is_settled
        ? '<span class="pill pill-green">تسویه شده</span>'
        : '<span class="pill pill-amber">در انتظار</span>') + '</td>' +
      '<td class="desc-cell" title="' + r.description + '">' + r.description + '</td>' +
      '<td>' +
        '<div class="row" style="justify-content:center;">' +
          '<button class="btn btn-outline btn-sm" data-edit-report="' + r.id + '">✏️</button>' +
          '<button class="btn btn-danger btn-sm" data-delete-report="' + r.id + '">🗑</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;

  tbody.querySelectorAll('[data-edit-report]').forEach((b) => {
    b.addEventListener('click', () => openEditReport(b.dataset.editReport));
  });
  tbody.querySelectorAll('[data-delete-report]').forEach((b) => {
    b.addEventListener('click', () => deleteReport(b.dataset.deleteReport));
  });
}

function renderPayments() {
  const tbody = document.getElementById('payments-tbody');

  if (!state.payments.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">هیچ پرداختی ثبت نشده است.</td></tr>';
    return;
  }

  let html = '';
  state.payments.forEach((p, i) => {
    html += '<tr>' +
      '<td style="color:#94a3b8;font-family:monospace;">' + SafeNum.format(i + 1) + '</td>' +
      '<td style="font-weight:600;">' + toShamsiDate(p.payment_date) + '</td>' +
      '<td class="amount">' + SafeNum.toToman(p.amount) + '</td>' +
      '<td>' + (p.method || '---') + '</td>' +
      '<td style="font-family:monospace;font-size:.75rem;color:#64748b;">' + (p.tracking_code || '---') + '</td>' +
      '<td class="desc-cell">' + (p.description || '---') + '</td>' +
      '<td>' +
        '<div class="row" style="justify-content:center;">' +
          '<button class="btn btn-outline btn-sm" data-edit-payment="' + p.id + '">✏️</button>' +
          '<button class="btn btn-danger btn-sm" data-delete-payment="' + p.id + '">🗑</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;

  tbody.querySelectorAll('[data-edit-payment]').forEach((b) => {
    b.addEventListener('click', () => openEditPayment(b.dataset.editPayment));
  });
  tbody.querySelectorAll('[data-delete-payment]').forEach((b) => {
    b.addEventListener('click', () => deletePayment(b.dataset.deletePayment));
  });
}

function renderSummary() {
  let totalWords = 0;
  let totalPages = 0;
  let totalPayable = 0;
  state.reports.forEach((r) => {
    totalWords += r.words;
    totalPages += r.pages;
    totalPayable += r.total_amount;
  });
  let totalPaid = 0;
  state.payments.forEach((p) => {
    totalPaid += SafeNum.parse(p.amount, 0);
  });
  const remaining = totalPayable - totalPaid;

  document.getElementById('sum-total-words').textContent = SafeNum.format(totalWords) + ' کلمه';
  document.getElementById('sum-total-pages').textContent = SafeNum.format(totalPages) + ' صفحه';
  document.getElementById('sum-total-payable').textContent = SafeNum.toToman(totalPayable);
  document.getElementById('sum-total-paid').textContent = SafeNum.toToman(totalPaid);

  const remEl = document.getElementById('sum-remaining-balance');
  remEl.textContent = SafeNum.toToman(remaining);
  remEl.style.color = remaining > 0 ? '#e11d48' : remaining === 0 ? '#059669' : '#2563eb';
}

// ============================================================
// ۱۲. مودال‌ها
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) { closeModal(closeBtn.dataset.close); return; }
  const modal = e.target.closest('.modal');
  if (modal && e.target === modal) closeModal(modal.id);
});

// ============================================================
// ۱۳. ثبت / ویرایش گزارش
// ============================================================
function resetReportForm() {
  state.editingReportId = null;
  document.getElementById('inp-report-id').value = '';
  document.getElementById('inp-period').value = 1;
  document.getElementById('inp-pages').value = 0;
  document.getElementById('inp-words').value = 0;
  document.getElementById('inp-rate').value = (state.typist && state.typist.rate_per_word) || 0;
  document.getElementById('inp-desc').value = '';
  const t = todayShamsi();
  document.getElementById('inp-date').value =
    enToFa(t.year) + '/' +
    enToFa(String(t.month).padStart(2, '0')) + '/' +
    enToFa(String(t.day).padStart(2, '0'));
  document.getElementById('modal-report-title').textContent = '➕ ثبت گزارش جدید';
  document.getElementById('btn-submit-report').textContent = 'ثبت در دیتابیس';
  updateReportPreview();
}

function updateReportPreview() {
  const w = SafeNum.parse(document.getElementById('inp-words').value, 0);
  const r = SafeNum.parse(document.getElementById('inp-rate').value, 0);
  document.getElementById('calculated-total-preview').textContent = SafeNum.toToman(w * r);
}

function openEditReport(id) {
  const r = state.reports.find((x) => String(x.id) === String(id));
  if (!r) return;

  state.editingReportId = r.id;
  document.getElementById('inp-report-id').value = r.id;
  document.getElementById('inp-period').value = r.period;
  document.getElementById('inp-pages').value = r.pages;
  document.getElementById('inp-words').value = r.words;
  document.getElementById('inp-rate').value = r.rate_per_word;
  document.getElementById('inp-desc').value =
    r.description === 'بدون توضیحات' ? '' : r.description;
  document.getElementById('inp-date').value = r.shamsi_date;
  document.getElementById('modal-report-title').textContent = '✏️ ویرایش گزارش';
  document.getElementById('btn-submit-report').textContent = 'ذخیره تغییرات';
  updateReportPreview();
  openModal('modal-report');
}

async function handleSubmitReport(e) {
  e.preventDefault();
  if (!state.typistId) { toast('ابتدا تایپیست را انتخاب کنید.', 'warn'); return; }

  const btn = document.getElementById('btn-submit-report');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  try {
    const words = SafeNum.parse(document.getElementById('inp-words').value, 0);
    const pages = SafeNum.parse(document.getElementById('inp-pages').value, 0);
    const rate = SafeNum.parse(document.getElementById('inp-rate').value, 0);
    const period = SafeNum.parse(document.getElementById('inp-period').value, 1);
    const desc = document.getElementById('inp-desc').value.trim();

    const parts = shamsiStringToParts(document.getElementById('inp-date').value);
    const isoDate = parts
      ? shamsiToISO(parts.year, parts.month, parts.day)
      : new Date().toISOString().slice(0, 10);

    const totalAmount = words * rate;

    const payload = {
      typist_id: state.typistId,
      words: words,
      pages: pages,
      rate: rate,
      rate_per_word: rate,
      total_amount: totalAmount,
      period: period,
      period_number: period,
      description: desc,
      is_settled: false,
      created_at: isoDate + 'T12:00:00.000Z',
    };

    let result;
    if (state.editingReportId) {
      result = await window.db
        .from('typist_reports')
        .update(payload)
        .eq('id', state.editingReportId);
    } else {
      result = await window.db.from('typist_reports').insert([payload]);
    }

    if (result.error) throw result.error;

    toast(state.editingReportId ? 'گزارش ویرایش شد.' : 'گزارش ثبت شد.', 'success');
    closeModal('modal-report');
    state.editingReportId = null;
    await selectTypist(state.typistId);
  } catch (err) {
    console.error('[handleSubmitReport]', err);
    toast('خطا در ذخیره گزارش: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = state.editingReportId ? 'ذخیره تغییرات' : 'ثبت در دیتابیس';
  }
}

async function deleteReport(id) {
  if (!confirm('آیا از حذف این گزارش مطمئن هستید؟')) return;
  try {
    const res = await window.db.from('typist_reports').delete().eq('id', id);
    if (res.error) throw res.error;
    toast('گزارش حذف شد.', 'success');
    await selectTypist(state.typistId);
  } catch (err) {
    console.error('[deleteReport]', err);
    toast('خطا در حذف گزارش: ' + err.message, 'error');
  }
}

// ============================================================
// ۱۴. ثبت / ویرایش پرداخت
// ============================================================
function resetPaymentForm() {
  state.editingPaymentId = null;
  document.getElementById('inp-pay-id').value = '';
  document.getElementById('inp-pay-amount').value = 0;
  document.getElementById('inp-pay-method').value = 'bank_transfer';
  document.getElementById('inp-pay-track').value = '';
  document.getElementById('inp-pay-desc').value = '';
  const t = todayShamsi();
  document.getElementById('inp-pay-date').value =
    enToFa(t.year) + '/' +
    enToFa(String(t.month).padStart(2, '0')) + '/' +
    enToFa(String(t.day).padStart(2, '0'));
  document.getElementById('modal-payment-title').textContent = '➕ ثبت پرداخت جدید';
  document.getElementById('btn-submit-payment').textContent = 'ثبت واریز';
}

function openEditPayment(id) {
  const p = state.payments.find((x) => String(x.id) === String(id));
  if (!p) return;

  state.editingPaymentId = p.id;
  document.getElementById('inp-pay-id').value = p.id;
  document.getElementById('inp-pay-amount').value = SafeNum.parse(p.amount, 0);
  document.getElementById('inp-pay-method').value = p.method || 'bank_transfer';
  document.getElementById('inp-pay-track').value = p.tracking_code || '';
  document.getElementById('inp-pay-desc').value = p.description || '';
  document.getElementById('inp-pay-date').value = toShamsiDate(p.payment_date);
  document.getElementById('modal-payment-title').textContent = '✏️ ویرایش پرداخت';
  document.getElementById('btn-submit-payment').textContent = 'ذخیره تغییرات';
  openModal('modal-payment');
}

async function handleSubmitPayment(e) {
  e.preventDefault();
  if (!state.typistId) { toast('ابتدا تایپیست را انتخاب کنید.', 'warn'); return; }

  const btn = document.getElementById('btn-submit-payment');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  try {
    const amount = SafeNum.parse(document.getElementById('inp-pay-amount').value, 0);
    const method = document.getElementById('inp-pay-method').value;
    const tracking = document.getElementById('inp-pay-track').value.trim();
    const desc = document.getElementById('inp-pay-desc').value.trim();

    if (amount <= 0) {
      toast('مبلغ باید بزرگ‌تر از صفر باشد.', 'warn');
      btn.disabled = false;
      btn.textContent = state.editingPaymentId ? 'ذخیره تغییرات' : 'ثبت واریز';
      return;
    }

    const parts = shamsiStringToParts(document.getElementById('inp-pay-date').value);
    const isoDate = parts
      ? shamsiToISO(parts.year, parts.month, parts.day)
      : new Date().toISOString().slice(0, 10);

    const payload = {
      person_id: state.typistId,
      amount: amount,
      payment_date: isoDate + 'T12:00:00.000Z',
      method: method,
      tracking_code: tracking || null,
      description: desc || null,
      status: 'completed',
    };

    let result;
    if (state.editingPaymentId) {
      result = await window.db
        .from('payments')
        .update(payload)
        .eq('id', state.editingPaymentId);
    } else {
      payload.created_at = new Date().toISOString();
      result = await window.db.from('payments').insert([payload]);
    }

    if (result.error) throw result.error;

    toast(state.editingPaymentId ? 'پرداخت ویرایش شد.' : 'پرداخت ثبت شد.', 'success');
    closeModal('modal-payment');
    state.editingPaymentId = null;
    await selectTypist(state.typistId);
  } catch (err) {
    console.error('[handleSubmitPayment]', err);
    toast('خطا در ذخیره پرداخت: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = state.editingPaymentId ? 'ذخیره تغییرات' : 'ثبت واریز';
  }
}

async function deletePayment(id) {
  if (!confirm('آیا از حذف این پرداخت مطمئن هستید؟')) return;
  try {
    const res = await window.db.from('payments').delete().eq('id', id);
    if (res.error) throw res.error;
    toast('پرداخت حذف شد.', 'success');
    await selectTypist(state.typistId);
  } catch (err) {
    console.error('[deletePayment]', err);
    toast('خطا در حذف پرداخت: ' + err.message, 'error');
  }
}

// ============================================================
// ۱۵. خروجی CSV
// ============================================================
function exportToCSV() {
  if (!state.reports.length) {
    toast('هیچ گزارشی برای خروجی وجود ندارد.', 'warn');
    return;
  }

  const headers = [
    'ردیف', 'تاریخ', 'دوره', 'صفحات', 'کلمات',
    'نرخ هر کلمه', 'مبلغ کل', 'وضعیت', 'توضیحات',
  ];

  const rows = state.reports.map((r, i) => [
    i + 1,
    r.shamsi_date,
    r.period,
    r.pages,
    r.words,
    r.rate_per_word,
    r.total_amount,
    r.is_settled ? 'تسویه شده' : 'در انتظار',
    '"' + String(r.description || '').replace(/"/g, '""') + '"',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const tname = (state.typist && state.typist.name) || 'تایپیست';
  a.href = url;
  a.download = 'گزارش_' + tname.replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// ۱۶. اتصال رویدادها
// ============================================================
function bindEvents() {
  document.querySelectorAll('.login-tab[data-role]').forEach((tab) => {
    tab.addEventListener('click', () => switchLoginTab(tab.dataset.role));
  });

  document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePass);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  const formAdmin = document.getElementById('form-admin');
  if (formAdmin) formAdmin.addEventListener('submit', handleAdminLogin);

  const formTypist = document.getElementById('form-typist');
  if (formTypist) formTypist.addEventListener('submit', handleTypistLogin);

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logout);

  const typistSelect = document.getElementById('typist-select');
  if (typistSelect) {
    typistSelect.addEventListener('change', (e) => {
      if (e.target.value) selectTypist(e.target.value);
    });
  }

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (state.typistId) selectTypist(state.typistId);
      else loadTypistsList();
    });
  }

  const btnExport = document.getElementById('btn-export-excel');
  if (btnExport) btnExport.addEventListener('click', exportToCSV);

  const btnOpenReport = document.getElementById('btn-open-report-modal');
  if (btnOpenReport) {
    btnOpenReport.addEventListener('click', () => {
      if (!state.typistId) { toast('ابتدا تایپیست را انتخاب کنید.', 'warn'); return; }
      resetReportForm();
      openModal('modal-report');
    });
  }

  const formReport = document.getElementById('form-new-report');
  if (formReport) formReport.addEventListener('submit', handleSubmitReport);

  ['inp-words', 'inp-rate'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateReportPreview);
  });

  const btnOpenPayment = document.getElementById('btn-open-payment-modal');
  if (btnOpenPayment) {
    btnOpenPayment.addEventListener('click', () => {
      if (!state.typistId) { toast('ابتدا تایپیست را انتخاب کنید.', 'warn'); return; }
      resetPaymentForm();
      openModal('modal-payment');
    });
  }

  const formPayment = document.getElementById('form-new-payment');
  if (formPayment) formPayment.addEventListener('submit', handleSubmitPayment);
}

// ============================================================
// ۱۷. راه‌اندازی اولیه
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!window.db) {
    console.error('اتصال به دیتابیس برقرار نشد.');
    return;
  }
  bindEvents();
  initAllDatePickers();
});

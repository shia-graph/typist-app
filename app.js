'use strict';

// ============================================================
// ۱. پیکربندی
// ============================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

if (!window.supabase) {
  console.error('Supabase SDK بارگذاری نشده است.');
} else {
  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const DEFAULT_ADMIN_PASSWORD = '123456';

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
  parse(val, fallback = 0) {
    if (val === null || val === undefined || val === '') return fallback;
    const cleaned = String(val)
      .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) & 0xf))
      .replace(/[,،\s]/g, '')
      .trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : fallback;
  },
  format(val, fallback = '۰') {
    const num = this.parse(val, null);
    if (num === null) return fallback;
    return num.toLocaleString('fa-IR');
  },
  toToman(val) {
    return `${this.format(val)} تومان`;
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

// استخراج اجزای شمسی از یک Date
function getShamsiParts(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(safe);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
  };
}

// تبدیل شمسی → میلادی (الگوریتم دقیق)
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
  const { gy, gm, gd } = shamsiToGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
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
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
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

  let viewYear, viewMonth;
  const selectedParts = input.value ? shamsiStringToParts(input.value) : null;

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

    let html = `
      <div class="dp-header">
        <button type="button" data-dp-nav="-1" aria-label="ماه قبل">‹</button>
        <span class="dp-title">${DP_MONTHS[viewMonth - 1]} ${enToFa(viewYear)}</span>
        <button type="button" data-dp-nav="1" aria-label="ماه بعد">›</button>
      </div>
      <div class="dp-grid">
        ${DP_DOWS.map((d) => `<div class="dp-dow">${d}</div>`).join('')}
    `;

    for (let i = 0; i < firstDow; i++) {
      html += `<button type="button" class="dp-day empty" disabled></button>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = t.year === viewYear && t.month === viewMonth && t.day === d;
      const isSelected =
        selectedParts && selectedParts.year === viewYear &&
        selectedParts.month === viewMonth && selectedParts.day === d;
      html += `<button type="button" class="dp-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-dp-day="${d}">${enToFa(d)}</button>`;
    }

    html += `</div>`;
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
        input.value = `${enToFa(viewYear)}/${enToFa(String(viewMonth).padStart(2, '0'))}/${enToFa(String(day).padStart(2, '0'))}`;
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
  function close() { popup.classList.remove('open'); }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.contains('open') ? close() : open();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  // مقدار اولیه
  if (!input.value) {
    const t = todayShamsi();
    input.value = `${enToFa(t.year)}/${enToFa(String(t.month).padStart(2, '0'))}/${enToFa(String(t.day).padStart(2, '0'))}`;
  }
}

function getFirstDowOfMonth(jy, jm) {
  // شمسی: ۱ فروردین معمولاً ...
  // محاسبه روز هفته اول ماه: با استفاده از Intl روی تاریخ میلادی معادل
  const { gy, gm, gd } = shamsiToGregorian(jy, jm, 1);
  const d = new Date(gy, gm - 1, gd);
  // 0=یکشنبه،1=دوشنبه,...
  // ما ش=۰، ی=۱، د=۲، س=۳، چ=۴، پ=۵، ج=۶
  const jsDow = d.getDay(); // 0=Sun
  const map = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0 };
  return map[jsDow];
}

function getDaysInShamsiMonth(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند: کبیسه؟
  const { gy } = shamsiToGregorian(jy, 12, 1);
  return isLeapShamsiYear(jy) ? 30 : 29;
}

function isLeapShamsiYear(jy) {
  // تقریب دقیق برای سال‌های ۱۳۰۰ تا ۱۵۰۰
  const cyc = jy % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(cyc);
}

function initAllDatePickers() {
  document.querySelectorAll('[data-datepicker]').forEach(buildDatePicker);
}

// ============================================================
// ۷. لاگین
// ============================================================
function cleanInput(str) {
  return String(str ?? '').trim();
}

function showLoginAlert(msg, type = 'error') {
  const box = document.getElementById('login-alert');
  box.textContent = msg;
  box.className = 'login-alert ' + (type === 'success' ? 'success' : 'error');
}

function hideLoginAlert() {
  document.getElementById('login-alert').className = 'login-alert hidden';
}

function setLoading(btn, loading, defaultLabel) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> در حال بررسی...'
    : `<span>${defaultLabel}</span>`;
}

function switchLoginTab(role) {
  const isAdmin = role === 'admin';
  const tabs = { admin: document.getElementById('tab-admin'), typist: document.getElementById('tab-typist') };
  const forms = { admin: document.getElementById('form-admin'), typist: document.getElementById('form-typist') };

  Object.entries(tabs).forEach(([k, el]) => {
    el.classList.toggle('active', k === role);
  });
  forms.admin.classList.toggle('hidden', !isAdmin);
  forms.typist.classList.toggle('hidden', isAdmin);
  hideLoginAlert();
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-admin-submit');
  const pass = cleanInput(document.getElementById('admin-password').value);
  if (!pass) { showLoginAlert('رمز عبور را وارد کنید.'); return; }

  setLoading(btn, true, 'ورود به پنل مدیریت');

  try {
    const { data, error } = await window.db
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_password')
      .maybeSingle();

    if (error) throw error;
    const validPassword = data?.value ?? DEFAULT_ADMIN_PASSWORD;

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
  const id = cleanInput(document.getElementById('typist-identifier').value).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0);

  if (!/^09\d{9}$/.test(id) && !/^\d{10}$/.test(id)) {
    showLoginAlert('کد ملی یا شماره همراه معتبر وارد کنید.');
    return;
  }

  setLoading(btn, true, 'ورود به پرتال تایپیست');

  try {
    const { data, error } = await window.db
      .from('typists')
      .select('id, name, phone, national_id, national_code')
      .or(`phone.eq.${id},national_id.eq.${id},national_code.eq.${id}`)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      showLoginAlert(`خوش آمدید، ${data.name}!`, 'success');
      setTimeout(() => enterPanel('typist', data.id), 600);
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
  const panel = document.getElementById('panel-screen');
  panel.classList.add('visible');

  const userInfo = document.getElementById('user-info');
  userInfo.textContent = role === 'admin' ? 'نقش: مدیر سامانه' : 'نقش: تایپیست';

  if (role === 'typist' && typistId) {
    state.typistId = typistId;
    // مخفی کردن انتخابگر تایپیست برای تایپیست
    document.getElementById('typist-select').style.display = 'none';
    document.getElementById('btn-refresh').style.display = 'none';
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
  try {
    const { data, error } = await window.db
      .from('typists')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      select.innerHTML = '<option value="">هیچ تایپیستی وجود ندارد</option>';
      return;
    }

    select.innerHTML = '<option value="">-- انتخاب تایپیست --</option>' +
      data.map((t) => `<option value="${t.id}">${t.name || 'بدون نام'}</option>`).join('');

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
    const { data: typist, error: tErr } = await window.db
      .from('typists').select('*').eq('id', typistId).single();
    if (tErr) throw tErr;
    state.typist = typist;

    document.getElementById('profile-name').textContent = typist.name || 'نامشخص';
    document.getElementById('profile-national-id').textContent =
      typist.national_id || typist.national_code || '---';
    document.getElementById('profile-phone').textContent = typist.phone || '---';

    const rate = typist.rate_per_word ?? typist.default_word_rate ?? 0;
    document.getElementById('profile-default-rate').textContent = SafeNum.toToman(rate);
    document.getElementById('inp-rate').value = rate;

    const { data: reports, error: rErr } = await window.db
      .from('typist_reports').select('*').eq('typist_id', typistId)
      .order('created_at', { ascending: false });
    if (rErr) throw rErr;
    state.reports = (reports || []).map((r) => normalizeReport(r, typist));

    const { data: payments, error: pErr } = await window.db
      .from('payments').select('*').eq('person_id', typistId)
      .order('payment_date', { ascending: false });
    if (pErr) throw pErr;
    state.payments = payments || [];

    renderReports();
    renderPayments();
    renderSummary();
  } catch (err) {
    console.error('[selectTypist]', err);
    toast('خطا در دریافت اطلاعات: ' + err.message, 'error');
  }
}

function normalizeReport(row, typist = {}) {
  const words = SafeNum.parse(row.words, 0);
  const pages = SafeNum.parse(row.pages, 0);
  const rate = SafeNum.parse(row.rate_per_word ?? row.rate ?? typist.rate_per_word ?? 0, 0);
  let total = SafeNum.parse(row.total_amount, 0);
  if (!total && words && rate) total = words * rate;
  return {
    id: row.id,
    typist_id: row.typist_id,
    period: row.period ?? row.period_number ?? 1,
    words, pages,
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
  document.getElementById('reports-count-badge').textContent = `${SafeNum.format(state.reports.length)} ردیف`;

  if (!state.reports.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">هیچ گزارشی ثبت نشده است.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.reports.map((r, i) => `
    <tr>
      <td style="color:#94a3b8;font-family:monospace;">${SafeNum.format(i + 1)}</td>
      <td style="font-weight:600;white-space:nowrap;">${r.shamsi_date}</td>
      <td><span class="pill pill-indigo">دوره ${SafeNum.format(r.period)}</span></td>
      <td>${SafeNum.format(r.pages)}</td>
      <td style="font-weight:800;color:#4338ca;">${SafeNum.format(r.words)}</td>
      <td>${SafeNum.format(r.rate_per_word)}</td>
      <td class="amount">${SafeNum.toToman(r.total_amount)}</td>
      <td>${r.is_settled ? '<span class="pill pill-green">تسویه شده</span>' : '<span class="pill pill-amber">در انتظار</span>'}</td>
      <td class="desc-cell" title="${r.description}">${r.description}</td>
      <td>
        <div class="row" style="justify-content:center;">
          <button class="btn btn-outline btn-sm" data-edit-report="${r.id}">✏️</button>
          <button class="btn btn-danger btn-sm" data-delete-report="${r.id}">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">هیچ پرداختی ثبت نشده است.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.payments.map((p, i) => `
    <tr>
      <td style="color:#94a3b8;font-family:monospace;">${SafeNum.format(i + 1)}</td>
      <td style="font-weight:600;">${toShamsiDate(p.payment_date)}</td>
      <td class="amount">${SafeNum.toToman(p.amount)}</td>
      <td>${p.method || '---'}</td>
      <td style="font-family:monospace;font-size:.75rem;color:#64748b;">${p.tracking_code || '---'}</td>
      <td class="desc-cell">${p.description || '---'}</td>
      <td>
        <div class="row" style="justify-content:center;">
          <button class="btn btn-outline btn-sm" data-edit-payment="${p.id}">✏️</button>
          <button class="btn btn-danger btn-sm" data-delete-payment="${p.id}">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-payment]').forEach((b) => {
    b.addEventListener('click', () => openEditPayment(b.dataset.editPayment));
  });
  tbody.querySelectorAll('[data-delete-payment]').forEach((b) => {
    b.addEventListener('click', () => deletePayment(b.dataset.deletePayment));
  });
}

function renderSummary() {
  const totalWords = state.reports.reduce((s, r) => s + r.words, 0);
  const totalPages = state.reports.reduce((s, r) => s + r.pages, 0);
  const totalPayable = state.reports.reduce((s, r) => s + r.total_amount, 0);
  const totalPaid = state.payments.reduce((s, p) => s + SafeNum.parse(p.amount, 0), 0);
  const remaining = totalPayable - totalPaid;

  document.getElementById('sum-total-words').textContent = `${SafeNum.format(totalWords)} کلمه`;
  document.getElementById('sum-total-pages').textContent = `${SafeNum.format(totalPages)} صفحه`;
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
  document.getElementById(id)?.classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
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
  document.getElementById('inp-rate').value = state.typist?.rate_per_word ?? 0;
  document.getElementById('inp-desc').value = '';
  const t = todayShamsi();
  document.getElementById('inp-date').value =
    `${enToFa(t.year)}/${enToFa(String(t.month).padStart(2, '0'))}/${enToFa(String(t.day).padStart(2, '0'))}`;
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
  document.getElementById('inp-desc').value = r.description === 'بدون توضیحات' ? '' : r.description;
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

    // تاریخ شمسی → میلادی ISO
    const parts = shamsiStringToParts(document.getElementById('inp-date').value);
    const isoDate = parts ? shamsiToISO(parts.year, parts

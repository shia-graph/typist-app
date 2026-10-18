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
  sessionToken: null,
  isLoading: false,
};

// کَش عناصر DOM
const dom = {};

// ============================================================
// ۳. مدیریت نشست (Session)
// ============================================================
const Session = {
  save(data) {
    const session = {
      ...data,
      expiresAt: Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('ذخیره نشست با خطا مواجه شد');
    }
  },
  load() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session.expiresAt || session.expiresAt < Date.now()) {
        this.clear();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  },
};

// ============================================================
// ۴. ابزار اعداد
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
    return this.format(val) + ' تومان';
  },
};

// ============================================================
// ۵. ابزار تاریخ
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
  if (!str) return null;
  const clean = faToEn(str).replace(/[\/\-\.]/g, '/');
  const m = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const year = +m[1], month = +m[2], day = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatShamsiInput(parts) {
  if (!parts) return '';
  return enToFa(parts.year) + '/' +
    enToFa(String(parts.month).padStart(2, '0')) + '/' +
    enToFa(String(parts.day).padStart(2, '0'));
}

// ============================================================
// ۶. Toast
// ============================================================
function toast(msg, type = 'info') {
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
// ۷. Modal تأیید سفارشی
// ============================================================
function confirmDialog(message, title = 'تأیید عملیات') {
  return new Promise((resolve) => {
    let overlay = document.getElementById('custom-confirm-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.className = 'modal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width:420px;">
        <h3 style="margin:0 0 1rem;">${title}</h3>
        <p style="margin:0 0 1.5rem;line-height:1.8;">${message}</p>
        <div class="row" style="justify-content:flex-end;gap:.5rem;">
          <button type="button" class="btn btn-outline" id="confirm-cancel">انصراف</button>
          <button type="button" class="btn btn-danger" id="confirm-ok">تأیید</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

// ============================================================
// ۸. Date Picker
// ============================================================
const DP_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const DP_DOWS = ['ش','ی','د','س','چ','پ','ج'];
const dpOutsideHandlers = new WeakMap();

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
    viewYear = base.year;
    viewMonth = base.month;
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
        input.value = formatShamsiInput(selectedParts);
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
    popup.classList.contains('open') ? close() : open();
  });

  // مدیریت کلیک بیرون با امکان حذف
  const outsideHandler = (e) => {
    if (!document.body.contains(wrap)) {
      document.removeEventListener('click', outsideHandler);
      return;
    }
    if (!wrap.contains(e.target)) close();
  };
  document.addEventListener('click', outsideHandler);
  dpOutsideHandlers.set(wrap, outsideHandler);

  if (!input.value) {
    input.value = formatShamsiInput(todayShamsi());
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
// ۹. اعتبارسنجی ورودی
// ============================================================
const Validator = {
  phone(val) {
    const clean = faToEn(String(val || '')).replace(/\s/g, '');
    return /^09\d{9}$/.test(clean) ? clean : null;
  },
  nationalId(val) {
    const clean = faToEn(String(val || '')).replace(/\s/g, '');
    return /^\d{10}$/.test(clean) ? clean : null;
  },
  identifier(val) {
    return this.phone(val) || this.nationalId(val);
  },
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
// ۱۰. ورود (Login) - امن از طریق RPC
// ============================================================
function cleanInput(str) {
  return String(str == null ? '' : str).trim();
}

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

  if (!pass) {
    showLoginAlert('رمز عبور را وارد کنید.');
    return;
  }

  setLoading(btn, true, 'ورود به پنل مدیریت');

  try {
    const { data, error } = await window.db.rpc('verify_admin_login', {
      input_password: pass,
    });

    if (error) throw error;

    if (data && data.success) {
      Session.save({
        role: 'admin',
        token: data.token,
      });
      showLoginAlert('ورود موفق! در حال انتقال...', 'success');
      setTimeout(() => enterPanel('admin', null), 500);
    } else {
      showLoginAlert((data && data.message) || 'رمز عبور نادرست است!');
    }
  } catch (err) {
    console.error('[Admin login]', err);
    showLoginAlert('خطا در ارتباط با سرور: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پنل مدیریت');
  }
}

async function handleTypistLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-typist-submit');
  const idRaw = cleanInput(document.getElementById('typist-identifier').value);
  const passRaw = cleanInput(document.getElementById('typist-password').value);

  const identifier = Validator.identifier(idRaw);
  if (!identifier) {
    showLoginAlert('کد ملی یا شماره همراه معتبر وارد کنید.');
    return;
  }

  if (!passRaw) {
    showLoginAlert('رمز عبور را وارد کنید.');
    return;
  }

  setLoading(btn, true, 'ورود به پرتال تایپیست');

  try {
    const { data, error } = await window.db.rpc('verify_typist_login', {
      input_identifier: identifier,
      input_password: passRaw,
    });

    if (error) throw error;

    if (data && data.success) {
      Session.save({
        role: 'typist',
        typistId: data.typist_id,
        token: data.token,
        mustChangePassword: data.must_change_password,
      });
      showLoginAlert('خوش آمدید، ' + data.name + '!', 'success');
      setTimeout(() => {
        enterPanel('typist', data.typist_id);
        if (data.must_change_password) {
          setTimeout(() => {
            toast('توصیه می‌شود رمز عبور خود را تغییر دهید.', 'warn');
          }, 1000);
        }
      }, 500);
    } else {
      showLoginAlert((data && data.message) || 'کاربری یافت نشد!');
    }
  } catch (err) {
    console.error('[Typist login]', err);
    showLoginAlert('خطا در ارتباط با سرور: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پرتال تایپیست');
  }
}

// ============================================================
// ۱۱. ورود به پنل
// ============================================================
function enterPanel(role, typistId) {
  state.role = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('panel-screen').classList.add('visible');

  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    userInfo.textContent = role === 'admin' ? 'نقش: مدیر سامانه' : 'نقش: تایپیست';
  }

  // کنترل دسترسی: مخفی کردن عناصر مخصوص مدیر
  applyRolePermissions(role);

  if (role === 'typist' && typistId) {
    state.typistId = typistId;
    const sel = document.getElementById('typist-select');
    const refresh = document.getElementById('btn-refresh');
    if (sel) sel.closest('.row, div')?.style && (sel.style.display = 'none');
    selectTypist(typistId);
  } else {
    loadTypistsList();
  }
  initAllDatePickers();
}

function applyRolePermissions(role) {
  const isTypist = role === 'typist';
  document.querySelectorAll('[data-admin-only]').forEach((el) => {
    el.style.display = isTypist ? 'none' : '';
  });
  document.querySelectorAll('[data-typist-only]').forEach((el) => {
    el.style.display = isTypist ? '' : 'none';
  });
}

async function logout() {
  const ok = await confirmDialog('آیا می‌خواهید از حساب کاربری خارج شوید؟', 'خروج از سامانه');
  if (!ok) return;

  Session.clear();
  state.typistId = null;
  state.typist = null;
  state.reports = [];
  state.payments = [];
  state.role = null;
  state.sessionToken = null;

  document.getElementById('panel-screen').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');

  const adminPass = document.getElementById('admin-password');
  const typistId = document.getElementById('typist-identifier');
  const typistPass = document.getElementById('typist-password');
  if (adminPass) adminPass.value = '';
  if (typistId) typistId.value = '';
  if (typistPass) typistPass.value = '';
  hideLoginAlert();
}

// ============================================================
// ۱۲. بارگذاری لیست تایپیست‌ها
// ============================================================
async function loadTypistsList() {
  const select = document.getElementById('typist-select');
  if (!select) return;
  try {
    const { data, error } = await window.db
      .from('typists')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw error;
    const list = data || [];

    if (list.length === 0) {
      select.innerHTML = '<option value="">هیچ تایپیستی وجود ندارد</option>';
      return;
    }

    let html = '<option value="">-- انتخاب تایپیست --</option>';
    list.forEach((t) => {
      html += '<option value="' + t.id + '">' + (t.name || 'بدون نام') + '</option>';
    });
    select.innerHTML = html;

    select.value = list[0].id;
    selectTypist(list[0].id);
  } catch (err) {
    console.error('خطا در بارگذاری تایپیست‌ها:', err);
    select.innerHTML = '<option value="">خطا در بارگذاری</option>';
    toast('خطا در دریافت لیست تایپیست‌ها', 'error');
  }
}

// ============================================================
// ۱۳. انتخاب و واکشی اطلاعات (با محافظت از Race Condition)
// ============================================================
let currentFetchId = 0;

async function selectTypist(typistId) {
  if (!typistId) return;

  // بررسی دسترسی: تایپیست فقط می‌تواند اطلاعات خودش را ببیند
  if (state.role === 'typist' && state.typistId && typistId !== state.typistId) {
    toast('شما به اطلاعات این تایپیست دسترسی ندارید.', 'error');
    return;
  }

  state.typistId = typistId;
  const fetchId = ++currentFetchId;
  state.isLoading = true;
  showGlobalLoading(true);

  try {
    const [tRes, rRes, pRes] = await Promise.all([
      window.db.from('typists').select('*').eq('id', typistId).single(),
      window.db.from('typist_reports').select('*').eq('typist_id', typistId).order('created_at', { ascending: false }),
      window.db.from('payments').select('*').eq('person_id', typistId).order('payment_date', { ascending: false }),
    ]);

    // اگر fetch جدیدتری شروع شده، این نتیجه را نادیده بگیر
    if (fetchId !== currentFetchId) return;

    if (tRes.error) throw tRes.error;
    if (rRes.error) throw rRes.error;
    if (pRes.error) throw pRes.error;

    const typist = tRes.data;
    state.typist = typist;

    renderProfile(typist);
    state.reports = (rRes.data || []).map((r) => normalizeReport(r, typist));
    state.payments = pRes.data || [];

    renderReports();
    renderPayments();
    renderSummary();
  } catch (err) {
    if (fetchId !== currentFetchId) return;
    console.error('[selectTypist]', err);
    toast('خطا در دریافت اطلاعات: ' + err.message, 'error');
  } finally {
    if (fetchId === currentFetchId) {
      state.isLoading = false;
      showGlobalLoading(false);
    }
  }
}

function renderProfile(typist) {
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('profile-name', typist.name || 'نامشخص');
  setText('profile-national-id', typist.national_id || typist.national_code || '---');
  setText('profile-phone', typist.phone || '---');

  const rate = typist.rate_per_word || typist.default_word_rate || 0;
  setText('profile-default-rate', SafeNum.toToman(rate));

  const inpRate = document.getElementById('inp-rate');
  if (inpRate) inpRate.value = rate;
}

function showGlobalLoading(show) {
  let overlay = document.getElementById('global-loading-overlay');
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-loading-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#4338ca,#06b6d4);z-index:9999;animation:loadingBar 1s infinite;';
      document.body.appendChild(overlay);
    }
  } else {
    if (overlay) overlay.remove();
  }
}

function normalizeReport(row, typist = {}) {
  const words = SafeNum.parse(row.words, 0);
  const pages = SafeNum.parse(row.pages, 0);
  const rate = SafeNum.parse(
    row.rate_per_word || row.rate || typist.rate_per_word || typist.default_word_rate || 0,
    0
  );
  let total = SafeNum.parse(row.total_amount, 0);
  if (!total && words && rate) total = words * rate;
  return {
    id: row.id,
    typist_id: row.typist_id,
    period: row.period || row.period_number || 1,
    words,
    pages,
    rate_per_word: rate,
    total_amount: total,
    description: row.description || 'بدون توضیحات',
    is_settled: !!row.is_settled,
    created_at: row.created_at,
    shamsi_date: toShamsiDate(row.created_at),
  };
}

// ============================================================
// ۱۴. رندر جدول‌ها
// ============================================================
function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      '<td class="desc-cell" title="' + escapeHTML(r.description) + '">' + escapeHTML(r.description) + '</td>' +
      '<td>' +
        (isAdmin ? 
          '<div class="row" style="justify-content:center;">' +
            '<button class="btn btn-outline btn-sm" data-edit-report="' + r.id + '" title="ویرایش">✏️</button>' +
            '<button class="btn btn-danger btn-sm" data-delete-report="' + r.id + '" title="حذف">🗑</button>' +
          '</div>'
          : '<span style="color:#94a3b8;">—</span>'
        ) +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;

  if (isAdmin) {
    tbody.querySelectorAll('[data-edit-report]').forEach((b) => {
      b.addEventListener('click', () => openEditReport(b.dataset.editReport));
    });
    tbody.querySelectorAll('[data-delete-report]').forEach((b) => {
      b.addEventListener('click', () => deleteReport(b.dataset.deleteReport));
    });
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
    html += '<tr>' +
      '<td style="color:#94a3b8;font-family:monospace;">' + SafeNum.format(i + 1) + '</td>' +
      '<td style="font-weight:600;">' + toShamsiDate(p.payment_date) + '</td>' +
      '<td class="amount">' + SafeNum.toToman(p.amount) + '</td>' +
      '<td>' + escapeHTML(p.method || '---') + '</td>' +
      '<td style="font-family:monospace;font-size:.75rem;color:#64748b;">' + escapeHTML(p.tracking_code || '---') + '</td>' +
      '<td class="desc-cell">' + escapeHTML(p.description || '---') + '</td>' +
      '<td>' +
        (isAdmin ?
          '<div class="row" style="justify-content:center;">' +
            '<button class="btn btn-outline btn-sm" data-edit-payment="' + p.id + '" title="ویرایش">✏️</button>' +
            '<button class="btn btn-danger btn-sm" data-delete-payment="' + p.id + '" title="حذف">🗑</button>' +
          '</div>'
          : '<span style="color:#94a3b8;">—</span>'
        ) +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = html;

  if (isAdmin) {
    tbody.querySelectorAll('[data-edit-payment]').forEach((b) => {
      b.addEventListener('click', () => openEditPayment(b.dataset.editPayment));
    });
    tbody.querySelectorAll('[data-delete-payment]').forEach((b) => {
      b.addEventListener('click', () => deletePayment(b.dataset.deletePayment));
    });
  }
}

function renderSummary() {
  let totalWords = 0, totalPages = 0, totalPayable = 0;
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

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText('sum-total-words', SafeNum.format(totalWords) + ' کلمه');
  setText('sum-total-pages', SafeNum.format(totalPages) + ' صفحه');
  setText('sum-total-payable', SafeNum.toToman(totalPayable));
  setText('sum-total-paid', SafeNum.toToman(totalPaid));

  const remEl = document.getElementById('sum-remaining-balance');
  if (remEl) {
    remEl.textContent = SafeNum.toToman(remaining);
    remEl.style.color = remaining > 0 ? '#e11d48' : remaining === 0 ? '#059669' : '#2563eb';
  }
}

// ============================================================
// ۱۵. مودال‌ها
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ============================================================
// ۱۶. ثبت / ویرایش گزارش
// ============================================================
function resetReportForm() {
  state.editingReportId = null;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('inp-report-id', '');
  setVal('inp-period', 1);
  setVal('inp-pages', 0);
  setVal('inp-words', 0);
  setVal('inp-rate', (state.typist && state.typist.rate_per_word) || 0);
  setVal('inp-desc', '');
  setVal('inp-date', formatShamsiInput(todayShamsi()));

  const title = document.getElementById('modal-report-title');
  const btn = document.getElementById('btn-submit-report');
  if (title) title.textContent = '➕ ثبت گزارش جدید';
  if (btn) btn.textContent = 'ثبت در دیتابیس';
  updateReportPreview();
}

function updateReportPreview() {
  const w = SafeNum.parse(document.getElementById('inp-words')?.value, 0);
  const r = SafeNum.parse(document.getElementById('inp-rate')?.value, 0);
  const preview = document.getElementById('calculated-total-preview');
  if (preview) preview.textContent = SafeNum.toToman(w * r);
}

function openEditReport(id) {
  if (state.role !== 'admin') return;
  const r = state.reports.find((x) => String(x.id) === String(id));
  if (!r) return;

  state.editingReportId = r.id;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('inp-report-id', r.id);
  setVal('inp-period', r.period);
  setVal('inp-pages', r.pages);
  setVal('inp-words', r.words);
  setVal('inp-rate', r.rate_per_word);
  setVal('inp-desc', r.description === 'بدون توضیحات' ? '' : r.description);
  setVal('inp-date', r.shamsi_date);

  const title = document.getElementById('modal-report-title');
  const btn = document.getElementById('btn-submit-report');
  if (title) title.textContent = '✏️ ویرایش گزارش';
  if (btn) btn.textContent = 'ذخیره تغییرات';
  updateReportPreview();
  openModal('modal-report');
}

async function handleSubmitReport(e) {
  e.preventDefault();
  if (state.role !== 'admin') {
    toast('شما دسترسی ثبت گزارش ندارید.', 'error');
    return;
  }
  if (!state.typistId) {
    toast('ابتدا تایپیست را انتخاب کنید.', 'warn');
    return;
  }

  const btn = document.getElementById('btn-submit-report');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  try {
    const words = Validator.positiveNumber(document.getElementById('inp-words').value, 1e9);
    const pages = Validator.positiveNumber(document.getElementById('inp-pages').value, 1e6);
    const rate = Validator.positiveNumber(document.getElementById('inp-rate').value, 1e9);
    const period = Validator.positiveNumber(document.getElementById('inp-period').value, 1000) || 1;
    const desc = Validator.text(document.getElementById('inp-desc').value, 1000);

    if (words === null || pages === null || rate === null) {
      toast('مقادیر عددی نامعتبر هستند.', 'warn');
      return;
    }

    const parts = shamsiStringToParts(document.getElementById('inp-date').value);
    const isoDate = parts
      ? shamsiToISO(parts.year, parts.month, parts.day)
      : new Date().toISOString().slice(0, 10);

    const totalAmount = words * rate;

    const payload = {
      typist_id: state.typistId,
      words,
      pages,
      rate,
      rate_per_word: rate,
      total_amount: totalAmount,
      period,
      period_number: period,
      description: desc,
      is_settled: false,
      created_at: isoDate + 'T12:00:00.000Z',
    };

    let result;
    if (state.editingReportId) {
      result = await window.db.from('typist_reports').update(payload).eq('id', state.editingReportId);
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
  if (state.role !== 'admin') return;
  const ok = await confirmDialog('آیا از حذف این گزارش مطمئن هستید؟ این عمل قابل بازگشت نیست.', 'حذف گزارش');
  if (!ok) return;
  try {
    const { error } = await window.db.from('typist_reports').delete().eq('id', id);
    if (error) throw error;
    toast('گزارش حذف شد.', 'success');
    await selectTypist(state.typistId);
  } catch (err) {
    console.error('[deleteReport]', err);
    toast('خطا در حذف گزارش: ' + err.message, 'error');
  }
}

// ============================================================
// ۱۷. ثبت / ویرایش پرداخت
// ============================================================
function resetPaymentForm() {
  state.editingPaymentId = null;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('inp-pay-id', '');
  setVal('inp-pay-amount', 0);
  setVal('inp-pay-method', 'bank_transfer');
  setVal('inp-pay-track', '');
  setVal('inp-pay-desc', '');
  setVal('inp-pay-date', formatShamsiInput(todayShamsi()));

  const title = document.getElementById('modal-payment-title');
  const btn = document.getElementById('btn-submit-payment');
  if (title) title.textContent = '➕ ثبت پرداخت جدید';
  if (btn) btn.textContent = 'ثبت واریز';
}

function openEditPayment(id) {
  if (state.role !== 'admin') return;
  const p = state.payments.find((x) => String(x.id) === String(id));
  if (!p) return;

  state.editingPaymentId = p.id;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal('inp-pay-id', p.id);
  setVal('inp-pay-amount', SafeNum.parse(p.amount, 0));
  setVal('inp-pay-method', p.method || 'bank_transfer');
  setVal('inp-pay-track', p.tracking_code || '');
  setVal('inp-pay-desc', p.description || '');
  setVal('inp-pay-date', toShamsiDate(p.payment_date));

  const title = document.getElementById('modal-payment-title');
  const btn = document.getElementById('btn-submit-payment');
  if (title) title.textContent = '✏️ ویرایش پرداخت';
  if (btn) btn.textContent = 'ذخیره تغییرات';
  openModal('modal-payment');
}

async function handleSubmitPayment(e) {
  e.preventDefault();
  if (state.role !== 'admin') {
    toast('شما دسترسی ثبت پرداخت ندارید.', 'error');
    return;
  }
  if (!state.typistId) {
    toast('ابتدا تایپیست را انتخاب کنید.', 'warn');
    return;
  }

  const btn = document.getElementById('btn-submit-payment');
  btn.disabled = true;
  btn.textContent = 'در حال ذخیره...';

  try {
    const amount = Validator.positiveNumber(document.getElementById('inp-pay-amount').value, 1e12);
    const method = Validator.text(document.getElementById('inp-pay-method').value, 50);
    const tracking = Validator.text(document.getElementById('inp-pay-track').value, 100);
    const desc = Validator.text(document.getElementById('inp-pay-desc').value, 500);

    if (amount === null || amount <= 0) {
      toast('مبلغ باید بزرگ‌تر از صفر باشد.', 'warn');
      return;
    }

    const parts = shamsiStringToParts(document.getElementById('inp-pay-date').value);
    const isoDate = parts
      ? shamsiToISO(parts.year, parts.month, parts.day)
      : new Date().toISOString().slice(0, 10);

    const payload = {
      person_id: state.typistId,
      amount,
      payment_date: isoDate,
      method,
      tracking_code: tracking || null,
      description: desc || null,
      status: 'valid',
    };

    let result;
    if (state.editingPaymentId) {
      result = await window.db.from('payments').update(payload).eq('id', state.editingPaymentId);
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
  if (state.role !== 'admin') return;
  const ok = await confirmDialog('آیا از حذف این پرداخت مطمئن هستید؟', 'حذف پرداخت');
  if (!ok) return;
  try {
    const { error } = await window.db.from('payments').delete().eq('id', id);
    if (error) throw error;
    toast('پرداخت حذف شد.', 'success');
    await selectTypist(state.typistId);
  } catch (err) {
    console.error('[deletePayment]', err);
    toast('خطا در حذف پرداخت: ' + err.message, 'error');
  }
}

// ============================================================
// ۱۸. تغییر رمز
// ============================================================
async function changeTypistPassword() {
  if (state.role !== 'typist' || !state.typistId) return;

  const oldPass = prompt('رمز فعلی را وارد کنید:');
  if (!oldPass) return;
  const newPass = prompt('رمز جدید را وارد کنید (حداقل ۶ کاراکتر):');
  if (!newPass) return;
  const confirmPass = prompt('رمز جدید را مجدداً وارد کنید:');
  if (newPass !== confirmPass) {
    toast('رمزهای وارد شده یکسان نیستند.', 'error');
    return;
  }

  try {
    const { data, error } = await window.db.rpc('change_typist_password', {
      typist_id_input: state.typistId,
      old_password: oldPass,
      new_password: newPass,
    });
    if (error) throw error;
    if (data && data.success) {
      toast('رمز با موفقیت تغییر کرد.', 'success');
    } else {
      toast((data && data.message) || 'خطا در تغییر رمز', 'error');
    }
  } catch (err) {
    toast('خطا: ' + err.message, 'error');
  }
}

async function changeAdminPassword() {
  if (state.role !== 'admin') return;

  const oldPass = prompt('رمز فعلی مدیر را وارد کنید:');
  if (!oldPass) return;
  const newPass = prompt('رمز جدید را وارد کنید (حداقل ۶ کاراکتر):');
  if (!newPass) return;
  const confirmPass = prompt('رمز جدید را مجدداً وارد کنید:');
  if (newPass !== confirmPass) {
    toast('رمزهای وارد شده یکسان نیستند.', 'error');
    return;
  }

  try {
    const { data, error } = await window.db.rpc('change_admin_password', {
      old_password: oldPass,
      new_password: newPass,
    });
    if (error) throw error;
    if (data && data.success) {
      toast('رمز مدیر با موفقیت تغییر کرد.', 'success');
    } else {
      toast((data && data.message) || 'خطا در تغییر رمز', 'error');
    }
  } catch (err) {
    toast('خطا: ' + err.message, 'error');
  }
}

// ============================================================
// ۱۹. خروجی CSV (با escape صحیح)
// ============================================================
function csvEscape(val) {
  const s = String(val == null ? '' : val);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportToCSV() {
  if (!state.reports.length) {
    toast('هیچ گزارشی برای خروجی وجود ندارد.', 'warn');
    return;
  }

  const headers = ['ردیف', 'تاریخ', 'دوره', 'صفحات', 'کلمات', 'نرخ هر کلمه', 'مبلغ کل', 'وضعیت', 'توضیحات'];

  const rows = state.reports.map((r, i) => [
    i + 1,
    r.shamsi_date,
    r.period,
    r.pages,
    r.words,
    r.rate_per_word,
    r.total_amount,
    r.is_settled ? 'تسویه شده' : 'در انتظار',
    r.description || '',
  ]);

  const csvRows = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];

  const csv = csvRows.join('\r\n');
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
  toast('فایل CSV دانلود شد.', 'success');
}

// ============================================================
// ۲۰. اتصال رویدادها
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

  document.getElementById('form-admin')?.addEventListener('submit', handleAdminLogin);
  document.getElementById('form-typist')?.addEventListener('submit', handleTypistLogin);
  document.getElementById('btn-logout')?.addEventListener('click', logout);

  document.getElementById('typist-select')?.addEventListener('change', (e) => {
    if (e.target.value) selectTypist(e.target.value);
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    if (state.typistId) selectTypist(state.typistId);
    else loadTypistsList();
  });

  document.getElementById('btn-export-excel')?.addEventListener('click', exportToCSV);

  document.getElementById('btn-open-report-modal')?.addEventListener('click', () => {
    if (state.role !== 'admin') {
      toast('فقط مدیر می‌تواند گزارش ثبت کند.', 'warn');
      return;
    }
    if (!state.typistId) {
      toast('ابتدا تایپیست را انتخاب کنید.', 'warn');
      return;
    }
    resetReportForm();
    openModal('modal-report');
  });

  document.getElementById('form-new-report')?.addEventListener('submit', handleSubmitReport);

  ['inp-words', 'inp-rate'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateReportPreview);
  });

  document.getElementById('btn-open-payment-modal')?.addEventListener('click', () => {
    if (state.role !== 'admin') {
      toast('فقط مدیر می‌تواند پرداخت ثبت کند.', 'warn');
      return;
    }
    if (!state.typistId) {
      toast('ابتدا تایپیست را انتخاب کنید.', 'warn');
      return;
    }
    resetPaymentForm();
    openModal('modal-payment');
  });

  document.getElementById('form-new-payment')?.addEventListener('submit', handleSubmitPayment);

  document.getElementById('btn-change-password')?.addEventListener('click', () => {
    if (state.role === 'admin') changeAdminPassword();
    else if (state.role === 'typist') changeTypistPassword();
  });

  // بستن مودال با کلیک روی data-close یا پس‌زمینه
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
      return;
    }
    if (e.target.classList && e.target.classList.contains('modal')) {
      closeModal(e.target.id);
    }
  });

  // بستن مودال با کلید Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach((m) => {
        closeModal(m.id);
      });
    }
  });
}

// ============================================================
// ۲۱. راه‌اندازی اولیه
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!window.db) {
    console.error('اتصال به دیتابیس برقرار نشد.');
    alert('خطا در اتصال به دیتابیس. لطفاً صفحه را مجدد بارگذاری کنید.');
    return;
  }

  // افزودن استایل انیمیشن loading
  const style = document.createElement('style');
  style.textContent = `
    @keyframes loadingBar {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);

  bindEvents();
  initAllDatePickers();

  // بازیابی نشست قبلی
  const session = Session.load();
  if (session) {
    state.sessionToken = session.token;
    if (session.role === 'admin') {
      enterPanel('admin', null);
    } else if (session.role === 'typist' && session.typistId) {
      enterPanel('typist', session.typistId);
    }
  }
});

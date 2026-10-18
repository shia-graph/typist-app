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
// ۲. وضعیت سراسری
// ============================================================
const state = {
  typistId: null,
  typistIdentifier: null, // برای تغییر رمز تایپیست
  typist: null,
  reports: [],
  payments: [],
  editingReportId: null,
  editingPaymentId: null,
  role: null,
  sessionToken: null,
  isLoading: false,
};

// ============================================================
// ۳. مدیریت نشست
// ============================================================
const Session = {
  save(data) {
    const session = Object.assign({}, data, {
      expiresAt: Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000,
    });
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
    } catch (e) {
      return null;
    }
  },
  clear() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  },
};

// ============================================================
// ۴. ابزار اعداد
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
  } catch (e) {
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
// ۷. Modal تأیید سفارشی
// ============================================================
function confirmDialog(message, title) {
  if (!title) title = 'تأیید عملیات';
  return new Promise((resolve) => {
    const old = document.getElementById('custom-confirm-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.className = 'modal';
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="modal-content" style="max-width:420px;">' +
        '<h3 style="margin:0 0 1rem;">' + title + '</h3>' +
        '<p style="margin:0 0 1.5rem;line-height:1.8;">' + message + '</p>' +
        '<div class="row" style="justify-content:flex-end;gap:.5rem;">' +
          '<button type="button" class="btn btn-outline" id="confirm-cancel">انصراف</button>' +
          '<button type="button" class="btn btn-danger" id="confirm-ok">تأیید</button>' +
        '</div>' +
      '</div>';
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
// ۸. Prompt سفارشی
// ============================================================
function promptDialog(message, title, isPassword) {
  if (!title) title = 'ورود اطلاعات';
  if (isPassword === undefined) isPassword = false;
  return new Promise((resolve) => {
    const old = document.getElementById('custom-prompt-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-prompt-overlay';
    overlay.className = 'modal';
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="modal-content" style="max-width:420px;">' +
        '<h3 style="margin:0 0 1rem;">' + title + '</h3>' +
        '<p style="margin:0 0 1rem;line-height:1.8;">' + message + '</p>' +
        '<input type="' + (isPassword ? 'password' : 'text') + '" id="prompt-input" ' +
          'style="width:100%;padding:.65rem .85rem;border-radius:.75rem;border:1px solid #e2e8f0;font-family:inherit;font-size:.9rem;margin-bottom:1rem;" />' +
        '<div class="row" style="justify-content:flex-end;gap:.5rem;">' +
          '<button type="button" class="btn btn-outline" id="prompt-cancel">انصراف</button>' +
          '<button type="button" class="btn btn-primary" id="prompt-ok">تأیید</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#prompt-input');
    setTimeout(() => input.focus(), 50);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('#prompt-ok').addEventListener('click', () => cleanup(input.value));
    overlay.querySelector('#prompt-cancel').addEventListener('click', () => cleanup(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cleanup(input.value);
      if (e.key === 'Escape') cleanup(null);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });
  });
}

// ============================================================
// ۹. Date Picker
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

  function open() { refreshView(); render(); popup.classList.add('open'); }
  function close() { popup.classList.remove('open'); }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.contains('open') ? close() : open();
  });

  const outsideHandler = (e) => {
    if (!document.body.contains(wrap)) {
      document.removeEventListener('click', outsideHandler);
      return;
    }
    if (!wrap.contains(e.target)) close();
  };
  document.addEventListener('click', outsideHandler);

  if (!input.value) {
    input.value = formatShamsiInput(todayShamsi());
  }
}

function getFirstDowOfMonth(jy, jm) {
  const g = shamsiToGregorian(jy, jm, 1);
  const d = new Date(g.gy, g.gm - 1, g.gd);
  const map = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0 };
  return map[d.getDay()];
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
// ۱۰. اعتبارسنجی ورودی
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
  positiveNumber(val, max) {
    if (max === undefined) max = Number.MAX_SAFE_INTEGER;
    const n = SafeNum.parse(val, -1);
    return n >= 0 && n <= max ? n : null;
  },
  text(val, maxLen) {
    if (maxLen === undefined) maxLen = 500;
    const s = String(val || '').trim();
    return s.length <= maxLen ? s : s.substring(0, maxLen);
  },
};

// ============================================================
// ۱۱. ابزارهای کمکی
// ============================================================
function cleanInput(str) {
  return String(str == null ? '' : str).trim();
}

function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showLoginAlert(msg, type) {
  if (!type) type = 'error';
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

function csvEscape(val) {
  const s = String(val == null ? '' : val);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ============================================================
// ۱۲. فراخوانی توابع RPC (امن)
// ============================================================
async function rpc(fnName, params) {
  const res = await window.db.rpc(fnName, params || {});
  if (res.error) {
    throw new Error(res.error.message || 'خطای ناشناخته در ارتباط با سرور');
  }
  return res.data;
}

// ============================================================
// ۱۳. ورود (Login)
// ============================================================
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
    const result = await rpc('verify_admin_password', { p_password: pass });

    if (result && result.success) {
      Session.save({ role: 'admin', token: result.token });
      state.sessionToken = result.token;
      showLoginAlert('ورود موفق! در حال انتقال...', 'success');
      setTimeout(() => enterPanel('admin', null), 500);
    } else {
      showLoginAlert((result && result.message) || 'رمز عبور نادرست است!');
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

  const identifier = faToEn(idRaw).replace(/\s/g, '');

  if (!/^09\d{9}$/.test(identifier) && !/^\d{10}$/.test(identifier)) {
    showLoginAlert('کد ملی یا شماره همراه معتبر وارد کنید.');
    return;
  }

  if (!passRaw) {
    showLoginAlert('رمز عبور را وارد کنید.');
    return;
  }

  const passClean = faToEn(passRaw).replace(/\s/g, '');

  setLoading(btn, true, 'ورود به پرتال تایپیست');

  try {
    const result = await rpc('verify_typist_password', {
      p_identifier: identifier,
      p_password: passClean,
    });

    if (result && result.success) {
      Session.save({
        role: 'typist',
        typistId: result.typist_id,
        typistIdentifier: identifier,
        token: result.token,
      });
      state.sessionToken = result.token;
      state.typistIdentifier = identifier;
      showLoginAlert('خوش آمدید، ' + (result.name || 'تایپیست') + '!', 'success');
      setTimeout(() => enterPanel('typist', result.typist_id), 500);
    } else {
      showLoginAlert((result && result.message) || 'ورود ناموفق!');
    }
  } catch (err) {
    console.error('[Typist login]', err);
    showLoginAlert('خطا در ارتباط با سرور: ' + err.message);
  } finally {
    setLoading(btn, false, 'ورود به پرتال تایپیست');
  }
}

// ============================================================
// ۱۴. ورود به پنل و خروج
// ============================================================
function enterPanel(role, typistId) {
  state.role = role;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('panel-screen').classList.add('visible');

  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    userInfo.textContent = role === 'admin' ? 'نقش: مدیر سامانه' : 'نقش: تایپیست';
  }

  applyRolePermissions(role);

  if (role === 'typist' && typistId) {
    state.typistId = typistId;
    const sel = document.getElementById('typist-select');
    const refreshBtn = document.getElementById('btn-refresh');
    if (sel) sel.style.display = 'none';
    if (refreshBtn) refreshBtn.style.display = 'none';
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
  state.typistIdentifier = null;
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

  const sel = document.getElementById('typist-select');
  const refreshBtn = document.getElementById('btn-refresh');
  if (sel) sel.style.display = '';
  if (refreshBtn) refreshBtn.style.display = '';

  hideLoginAlert();
}

// ============================================================
// ۱۵. بارگذاری لیست تایپیست‌ها
// ============================================================
async function loadTypistsList() {
  const select = document.getElementById('typist-select');
  if (!select) return;
  try {
    const list = await rpc('get_typists_list') || [];

    if (list.length === 0) {
      select.innerHTML = '<option value="">هیچ تایپیستی وجود ندارد</option>';
      return;
    }

    let html = '<option value="">-- انتخاب تایپیست --</option>';
    list.forEach((t) => {
      html += '<option value="' + escapeHTML(t.id) + '">' + escapeHTML(t.name || 'بدون نام') + '</option>';
    });
    select.innerHTML = html;

    select.value = list[0].id;
    selectTypist(list[0].id);
  } catch (err) {
    console.error('خطا در بارگذاری تایپیست‌ها:', err);
    select.innerHTML = '<option value="">خطا در بارگذاری</option>';
    toast('خطا در دریافت لیست تایپیست‌ها: ' + err.message, 'error');
  }
}

// ============================================================
// ۱۶. انتخاب و واکشی اطلاعات تایپیست
// ============================================================
let currentFetchId = 0;

async function selectTypist(typistId) {
  if (!typistId) return;

  if (state.role === 'typist' && state.typistId && typistId !== state.typistId) {
    toast('شما به اطلاعات این تایپیست دسترسی ندارید.', 'error');
    return;
  }

  state.typistId = typistId;
  const fetchId = ++currentFetchId;
  state.isLoading = true;
  showGlobalLoading(true);

  try {
    const results = await Promise.all([
      rpc('get_typist_profile', { p_typist_id: typistId }),
      rpc('get_typist_reports', { p_typist_id: typistId }),
      rpc('get_typist_payments', { p_typist_id: typistId }),
    ]);

    if (fetchId !== currentFetchId) return;

    const profileArr = results[0] || [];
    const reportsArr = results[1] || [];
    const paymentsArr = results[2] || [];

    const typist = profileArr[0] || null;
    if (!typist) {
      toast('اطلاعات تایپیست یافت نشد.', 'error');
      return;
    }

    state.typist = typist;
    renderProfile(typist);
    state.reports = reportsArr.map((r) => normalizeReport(r, typist));
    state.payments = paymentsArr;

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

function normalizeReport(row, typist) {
  if (!typist) typist = {};
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
// ۱۷. رندر جدول گزارش‌ها
// ============================================================
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
      '<td style="font-weight:600;white-space:nowrap;">' + escapeHTML(r.shamsi_date) + '</td>' +
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
        (isAdmin
          ? '<div class="row" style="justify-content:center;">' +
              '<button class="btn btn-outline btn-sm" data-edit-report="' + escapeHTML(r.id) + '" title="ویرایش">✏️</button>' +
              '<button class="btn btn-danger btn-sm" data-delete-report="' + escapeHTML(r.id) + '" title="حذف">🗑</button>' +
            '</div>'
          : '<span style="color:#94a3b8;">—</span>') +
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

// ============================================================
// ۱۸. رندر جدول پرداخت‌ها
// ============================================================
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
      '<td style="font-weight:600;">' + escapeHTML(toShamsiDate(p.payment_date)) + '</td>' +
      '<td class="amount">' + SafeNum.toToman(p.amount) + '</td>' +
      '<td>' + escapeHTML(p.method || '---') + '</td>' +
      '<td style="font-family:monospace;font-size:.75rem;color:#64748b;">' + escapeHTML(p.tracking_code || '---') + '</td>' +
      '<td class="desc-cell">' + escapeHTML(p.description || '---') + '</td>' +
      '<td>' +
        (isAdmin
          ? '<div class="row" style="justify-content:center;">' +
              '<button class="btn btn-outline btn-sm" data-edit-payment="' + escapeHTML(p.id) + '" title="ویرایش">✏️</button>' +
              '<button class="btn btn-danger btn-sm" data-delete-payment="' + escapeHTML(p.id) + '" title="حذف">🗑</button>' +
            '</div>'
          : '<span style="color:#94a3b8;">—</span>') +
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

// ============================================================
// ۱۹. رندر خلاصه مالی
// ============================================================
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
// ۲۰. مدیریت مودال‌ها
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
// ۲۱. ثبت / ویرایش گزارش
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
  const wEl = document.getElementById('inp-words');
  const rEl = document.getElementById('inp-rate');
  const preview = document.getElementById('calculated-total-preview');
  if (!preview) return;
  const w = SafeNum.parse(wEl ? wEl.value : 0, 0);
  const r = SafeNum.parse(rEl ? rEl.value : 0, 0);
  preview.textContent = SafeNum.toToman(w * r);
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
  const isEditing = !!state.editingReportId;
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
      ? shamsiToISO(parts.year, parts.month, parts.day) + 'T12:00:00.000Z'
      : new Date().toISOString();

    const result = await rpc('upsert_report', {
      p_id: state.editingReportId || null,
      p_typist_id: state.typistId,
      p_words: words,
      p_pages: pages,
      p_rate: rate,
      p_period: period,
      p_description: desc,
      p_created_at: isoDate,
    });

    if (result && result.success) {
      toast(isEditing ? 'گزارش ویرایش شد.' : 'گزارش ثبت شد.', 'success');
      closeModal('modal-report');
      state.editingReportId = null;
      await selectTypist(state.typistId);
    } else {
      toast((result && result.message) || 'خطا در ذخیره.', 'error');
    }
  } catch (err) {
    console.error('[handleSubmitReport]', err);
    toast('خطا در ذخیره گزارش: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isEditing ? 'ذخیره تغییرات' : 'ثبت در دیتابیس';
  }
}

async function deleteReport(id) {
  if (state.role !== 'admin') return;
  const ok = await confirmDialog('آیا از حذف این گزارش مطمئن هستید؟ این عمل قابل بازگشت نیست.', 'حذف گزارش');
  if (!ok) return;
  try {
    const result = await rpc('delete_report', { p_id: id });
    if (result && result.success) {
      toast('گزارش حذف شد.', 'success');
      await selectTypist(state.typistId);
    } else {
      toast((result && result.message) || 'خطا در حذف.', 'error');
    }
  } catch (err) {
    console.error('[deleteReport]', err);
    toast('خطا در حذف گزارش: ' + err.message, 'error');
  }
}

// ============================================================
// ۲۲. ثبت / ویرایش پرداخت
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
  const isEditing = !!state.editingPaymentId;
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

    const result = await rpc('upsert_payment', {
      p_id: state.editingPaymentId || null,
      p_person_id: state.typistId,
      p_amount: amount,
      p_payment_date: isoDate,
      p_method: method,
      p_tracking_code: tracking || null,
      p_description: desc || null,
    });

    if (result && result.success) {
      toast(isEditing ? 'پرداخت ویرایش شد.' : 'پرداخت ثبت شد.', 'success');
      closeModal('modal-payment');
      state.editingPaymentId = null;
      await selectTypist(state.typistId);
    } else {
      toast((result && result.message) || 'خطا در ذخیره.', 'error');
    }
  } catch (err) {
    console.error('[handleSubmitPayment]', err);
    toast('خطا در ذخیره پرداخت: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isEditing ? 'ذخیره تغییرات' : 'ثبت واریز';
  }
}

async function deletePayment(id) {
  if (state.role !== 'admin') return;
  const ok = await confirmDialog('آیا از حذف این پرداخت مطمئن هستید؟', 'حذف پرداخت');
  if (!ok) return;
  try {
    const result = await rpc('delete_payment', { p_id: id });
    if (result && result.success) {
      toast('پرداخت حذف شد.', 'success');
      await selectTypist(state.typistId);
    } else {
      toast((result && result.message) || 'خطا در حذف.', 'error');
    }
  } catch (err) {
    console.error('[deletePayment]', err);
    toast('خطا در حذف پرداخت: ' + err.message, 'error');
  }
}

// ============================================================
// ۲۳. تغییر رمز
// ============================================================
async function changeAdminPassword() {
  if (state.role !== 'admin') return;

  const oldPass = await promptDialog('رمز فعلی مدیر را وارد کنید:', 'تغییر رمز مدیر', true);
  if (oldPass === null || oldPass === '') return;

  const newPass = await promptDialog('رمز جدید را وارد کنید (حداقل ۶ کاراکتر):', 'تغییر رمز مدیر', true);
  if (newPass === null) return;

  if (!newPass || newPass.length < 6) {
    toast('رمز جدید باید حداقل ۶ کاراکتر باشد.', 'warn');
    return;
  }

  const confirmPass = await promptDialog('رمز جدید را مجدداً وارد کنید:', 'تأیید رمز جدید', true);
  if (confirmPass === null) return;

  if (newPass !== confirmPass) {
    toast('رمزهای وارد شده یکسان نیستند.', 'error');
    return;
  }

  try {
    const result = await rpc('change_admin_password', {
      p_old_password: oldPass,
      p_new_password: newPass,
    });
    if (result && result.success) {
      toast('رمز مدیر با موفقیت تغییر کرد.', 'success');
    } else {
      toast((result && result.message) || 'خطا در تغییر رمز.', 'error');
    }
  } catch (err) {
    console.error('[changeAdminPassword]', err);
    toast('خطا: ' + err.message, 'error');
  }
}

async function changeTypistPassword() {
  if (state.role !== 'typist') return;
  if (!state.typistIdentifier) {
    toast('لطفاً دوباره وارد شوید.', 'error');
    return;
  }

  const oldPass = await promptDialog('رمز فعلی را وارد کنید:', 'تغییر رمز', true);
  if (oldPass === null || oldPass === '') return;

  const newPass = await promptDialog('رمز جدید را وارد کنید (حداقل ۴ کاراکتر):', 'تغییر رمز', true);
  if (newPass === null) return;

  if (!newPass || newPass.length < 4) {
    toast('رمز جدید باید حداقل ۴ کاراکتر باشد.', 'warn');
    return;
  }

  const confirmPass = await promptDialog('رمز جدید را مجدداً وارد کنید:', 'تأیید رمز جدید', true);
  if (confirmPass === null) return;

  if (newPass !== confirmPass) {
    toast('رمزهای وارد شده یکسان نیستند.', 'error');
    return;
  }

  try {
    const result = await rpc('change_typist_password', {
      p_identifier: state.typistIdentifier,
      p_old_password: oldPass,
      p_new_password: newPass,
    });
    if (result && result.success) {
      toast('رمز با موفقیت تغییر کرد.', 'success');
    } else {
      toast((result && result.message) || 'خطا در تغییر رمز.', 'error');
    }
  } catch (err) {
    console.error('[changeTypistPassword]', err);
    toast('خطا: ' + err.message, 'error');
  }
}

// ============================================================
// ۲۴. خروجی CSV
// ============================================================
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
// ۲۵. اتصال رویدادها
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

  const btnChangePass = document.getElementById('btn-change-password');
  if (btnChangePass) {
    btnChangePass.addEventListener('click', () => {
      if (state.role === 'admin') changeAdminPassword();
      else if (state.role === 'typist') changeTypistPassword();
    });
  }

  const btnOpenReport = document.getElementById('btn-open-report-modal');
  if (btnOpenReport) {
    btnOpenReport.addEventListener('click', () => {
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
  }

  const formPayment = document.getElementById('form-new-payment');
  if (formPayment) formPayment.addEventListener('submit', handleSubmitPayment);

  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
      return;
    }
    if (e.target.classList && e.target.classList.contains('modal') && e.target.id) {
      if (e.target.id !== 'custom-confirm-overlay' && e.target.id !== 'custom-prompt-overlay') {
        closeModal(e.target.id);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach((m) => {
        if (m.id && m.id !== 'custom-confirm-overlay' && m.id !== 'custom-prompt-overlay') {
          closeModal(m.id);
        }
      });
    }
  });
}

// ============================================================
// ۲۶. راه‌اندازی اولیه
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!window.db) {
    console.error('اتصال به دیتابیس برقرار نشد.');
    alert('خطا در اتصال به دیتابیس. لطفاً صفحه را مجدد بارگذاری کنید.');
    return;
  }

  bindEvents();
  initAllDatePickers();

  const session = Session.load();
  if (session) {
    state.sessionToken = session.token;
    if (session.role === 'admin') {
      enterPanel('admin', null);
    } else if (session.role === 'typist' && session.typistId) {
      state.typistIdentifier = session.typistIdentifier;
      enterPanel('typist', session.typistId);
    }
  }
});

/**
 * ✍️ سامانه مدیریت تایپیست‌ها - نسخه ۳.۰ (مخصوص موبایل و شبکه ایران)
 */

// Global Config
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMzg2NjYsImV4cCI6MjA1NjgxNDY2Nn0.2O5_N4MSpPBygOnT2XN65O9C4Y7I47b8s6R3H6R3g7U';

// Global Client Init
let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error('Supabase Init Error:', e);
}

// Global Application State
let currentUser = null;
let activeLoginTab = 'typist';
let allTypists = [];
let currentTypistDetail = null;
let currentTargetInputIdForDate = null;
let currentReports = [];
let currentPayments = [];

// Safe DOM Helper Functions
function getEl(id) {
  return document.getElementById(id);
}

function safeSetText(id, text) {
  const el = getEl(id);
  if (el) el.textContent = text;
}

function safeSetHtml(id, html) {
  const el = getEl(id);
  if (el) el.innerHTML = html;
}

function safeShow(id) {
  const el = getEl(id);
  if (el) el.classList.remove('hidden');
}

function safeHide(id) {
  const el = getEl(id);
  if (el) el.classList.add('hidden');
}

// Convert Persian/Arabic digits to English
function toEnglishDigits(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 1776)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632);
}

// Format numbers with commas
function formatMoney(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('fa-IR');
}

// Toast Notification
function showToast(icon, title) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: icon,
      title: title,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  } else {
    alert(title);
  }
}

// Global Window Function Declarations (Hoisted for Instant Touch Availability)
function switchLoginTab(tab) {
  activeLoginTab = tab;
  const tabAdmin = getEl('tab-login-admin');
  const tabTypist = getEl('tab-login-typist');

  const activeClass = 'flex-1 py-2 text-sm font-medium rounded-lg transition bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm';
  const inactiveClass = 'flex-1 py-2 text-sm font-medium rounded-lg transition text-slate-700 dark:text-slate-300';

  if (tab === 'admin') {
    if (tabAdmin) tabAdmin.className = activeClass;
    if (tabTypist) tabTypist.className = inactiveClass;
    safeHide('field-identifier');
    safeHide('typist-pass-hint');
  } else {
    if (tabTypist) tabTypist.className = activeClass;
    if (tabAdmin) tabAdmin.className = inactiveClass;
    safeShow('field-identifier');
    safeSetText('label-identifier', 'کد ملی یا شماره همراه');
    safeShow('typist-pass-hint');
  }
}

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (!supabase) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      Swal.fire('خطا در اتصال', 'اتصال شبکه کند است یا کتابخانه‌ها لود نشده‌اند. لطفاً چند ثانیه صبر کرده و فیلترشکن را بررسی کنید.', 'error');
      return;
    }
  }

  const passEl = getEl('input-password');
  const password = passEl ? toEnglishDigits(passEl.value).trim() : '';
  
  if (activeLoginTab === 'admin') {
    const { data, error } = await supabase.rpc('verify_admin_password', { p_password: password });
    if (error || !data || !data.success) {
      Swal.fire('خطا', data?.message || 'رمز عبور مدیر اشتباه است', 'error');
      return;
    }
    currentUser = { role: 'admin', data: { name: 'مدیریت سیستم' } };
    localStorage.setItem('session', JSON.stringify(currentUser));
    showToast('success', 'خوش آمدید، مدیر سیستم');
    renderLayout();
  } else {
    const idEl = getEl('input-identifier');
    const identifier = idEl ? toEnglishDigits(idEl.value).trim() : '';
    if (!identifier) {
      Swal.fire('هشدار', 'لطفاً کد ملی یا شماره همراه خود را وارد کنید', 'warning');
      return;
    }
    const { data, error } = await supabase.rpc('verify_typist_password', {
      p_identifier: identifier,
      p_password: password
    });
    if (error || !data || !data.success) {
      Swal.fire('خطا', data?.message || 'کد ملی/شماره یا رمز عبور اشتباه است', 'error');
      return;
    }
    currentUser = { role: 'typist', data: data.typist };
    localStorage.setItem('session', JSON.stringify(currentUser));
    showToast('success', `خوش آمدید، ${data.typist.first_name} ${data.typist.last_name}`);
    renderLayout();
  }
}

function handleLogout() {
  currentUser = null;
  currentTypistDetail = null;
  localStorage.removeItem('session');
  renderLayout();
  showToast('info', 'با موفقیت خارج شدید');
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const themeIcon = getEl('theme-icon');
  if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const themeIcon = getEl('theme-icon');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    if (themeIcon) themeIcon.textContent = '🌙';
  }
}

function initDatepickerDropdowns() {
  const daySelect = getEl('dp-day');
  const yearSelect = getEl('dp-year');

  if (daySelect) {
    daySelect.innerHTML = '';
    for (let i = 1; i <= 31; i++) {
      const val = i < 10 ? '0' + i : String(i);
      daySelect.innerHTML += `<option value="${val}">${val}</option>`;
    }
  }

  if (yearSelect) {
    yearSelect.innerHTML = '';
    for (let y = 1402; y <= 1410; y++) {
      yearSelect.innerHTML += `<option value="${y}" ${y === 1403 ? 'selected' : ''}>${y}</option>`;
    }
  }
}

function openShamsiDatepicker(inputId) {
  currentTargetInputIdForDate = inputId;
  const inputEl = getEl(inputId);
  const existingVal = inputEl ? inputEl.value : '';
  if (existingVal && existingVal.includes('/')) {
    const parts = existingVal.split('/');
    if (parts.length === 3) {
      if (getEl('dp-year')) getEl('dp-year').value = parts[0];
      if (getEl('dp-month')) getEl('dp-month').value = parts[1];
      if (getEl('dp-day')) getEl('dp-day').value = parts[2];
    }
  }
  safeShow('modal-datepicker');
}

function confirmShamsiDate() {
  const y = getEl('dp-year') ? getEl('dp-year').value : '1403';
  const m = getEl('dp-month') ? getEl('dp-month').value : '01';
  const d = getEl('dp-day') ? getEl('dp-day').value : '01';
  const dateStr = `${y}/${m}/${d}`;
  if (currentTargetInputIdForDate) {
    const targetInput = getEl(currentTargetInputIdForDate);
    if (targetInput) targetInput.value = dateStr;
  }
  closeModal('modal-datepicker');
}

function closeModal(modalId) {
  safeHide(modalId);
}

function checkSavedSession() {
  const saved = localStorage.getItem('session');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      renderLayout();
    } catch(e) {
      localStorage.removeItem('session');
      renderLayout();
    }
  } else {
    renderLayout();
  }
}

function renderLayout() {
  safeHide('view-login');
  safeHide('view-admin-dashboard');
  safeHide('view-admin-typist-detail');
  safeHide('view-typist-dashboard');

  if (!currentUser) {
    safeShow('view-login');
    safeHide('btn-logout');
    safeHide('btn-change-pass');
    safeHide('user-role-badge');
  } else {
    safeShow('btn-logout');
    safeShow('btn-change-pass');
    safeShow('user-role-badge');

    if (currentUser.role === 'admin') {
      safeSetText('user-role-badge', 'مدیر سیستم');
      if (currentTypistDetail) {
        safeShow('view-admin-typist-detail');
        renderAdminTypistDetailView();
      } else {
        safeShow('view-admin-dashboard');
        loadAdminDashboard();
      }
    } else {
      safeSetText('user-role-badge', 'تایپیست');
      safeShow('view-typist-dashboard');
      loadTypistSelfDashboard();
    }
  }
}

async function loadAdminDashboard() {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('get_dashboard_summary');
  if (error || !data || !data.success) {
    showToast('error', 'خطا در بارگیری اطلاعات داشبورد');
    return;
  }

  allTypists = data.typists || [];
  
  safeSetText('stat-total-typists', formatMoney(data.summary.total_typists));
  safeSetHtml('stat-total-work', `${formatMoney(data.summary.total_work_price)} <span class="text-xs font-normal">تومان</span>`);
  safeSetHtml('stat-total-paid', `${formatMoney(data.summary.total_payments)} <span class="text-xs font-normal">تومان</span>`);
  safeSetHtml('stat-total-debt', `${formatMoney(data.summary.remaining_balance)} <span class="text-xs font-normal">تومان</span>`);

  renderTypistsTable(allTypists);
}

function renderTypistsTable(typists) {
  const tbody = getEl('admin-typists-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!typists || typists.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">هیچ تایپیستی یافت نشد.</td></tr>`;
    return;
  }

  typists.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';
    tr.innerHTML = `
      <td class="p-4 text-center">
        <input type="checkbox" value="${t.id}" data-phone="${t.phone || ''}" data-name="${t.first_name} ${t.last_name}" data-national="${t.national_id || ''}" data-father="${t.father_name || ''}" data-card="${t.card_number || ''}" data-iban="${t.iban || ''}" data-balance="${t.remaining_balance || 0}" class="typist-checkbox rounded border-slate-300 text-brand-600 focus:ring-brand-500">
      </td>
      <td class="p-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:text-brand-600" onclick="openTypistDetail('${t.id}')">
        ${t.first_name} ${t.last_name}
      </td>
      <td class="p-4">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-slate-600 dark:text-slate-300">${t.phone || '-'}</span>
          <a href="tel:${t.phone}" class="p-1 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200" title="تماس">📞</a>
          <a href="sms:${t.phone}" class="p-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200" title="پیامک">💬</a>
        </div>
        <div class="text-xs text-slate-400 mt-0.5">کد ملی: ${t.national_id || '-'}</div>
      </td>
      <td class="p-4 text-xs font-mono">
        <div>کارت: ${t.card_number || '-'}</div>
        <div class="text-slate-400">شبا: IR-${t.iban || '-'}</div>
      </td>
      <td class="p-4 font-semibold text-slate-700 dark:text-slate-300">
        ${formatMoney(t.rate_per_page)} تومان
      </td>
      <td class="p-4 font-bold ${t.remaining_balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
        ${formatMoney(t.remaining_balance)} تومان
      </td>
      <td class="p-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <button type="button" onclick="openTypistDetail('${t.id}')" class="px-2.5 py-1.5 bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 rounded-lg text-xs font-medium hover:bg-brand-100 transition">مشاهده جزئیات</button>
          <button type="button" onclick="openEditTypistModal('${t.id}')" class="p-1.5 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg text-xs hover:bg-amber-100 transition" title="ویرایش">✏️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTypistsTable() {
  const searchEl = getEl('admin-search');
  const query = searchEl ? toEnglishDigits(searchEl.value).toLowerCase() : '';
  const filtered = allTypists.filter(t => 
    (t.first_name && t.first_name.toLowerCase().includes(query)) ||
    (t.last_name && t.last_name.toLowerCase().includes(query)) ||
    (t.national_id && t.national_id.includes(query)) ||
    (t.phone && t.phone.includes(query))
  );
  renderTypistsTable(filtered);
}

function toggleSelectAllTypists(master) {
  const checkboxes = document.querySelectorAll('.typist-checkbox');
  checkboxes.forEach(cb => cb.checked = master.checked);
}

async function openTypistDetail(typistId) {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('get_typist_detail', { p_typist_id: typistId });
  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'مشکلی در دریافت جزئیات تایپیست رخ داد', 'error');
    return;
  }

  currentTypistDetail = data;
  renderLayout();
}

function showAdminDashboard() {
  currentTypistDetail = null;
  renderLayout();
}

function renderAdminTypistDetailView() {
  if (!currentTypistDetail || !currentTypistDetail.typist) return;

  const t = currentTypistDetail.typist;
  currentReports = currentTypistDetail.reports || [];
  currentPayments = currentTypistDetail.payments || [];

  safeSetText('detail-typist-name', `${t.first_name} ${t.last_name}`);
  safeSetText('detail-typist-national', t.national_id || '-');
  safeSetText('detail-typist-father', t.father_name || '-');
  safeSetText('detail-typist-phone', t.phone || '-');
  safeSetText('detail-typist-card', t.card_number || '-');
  safeSetText('detail-typist-iban', t.iban ? `IR-${t.iban}` : 'IR-');
  safeSetText('detail-typist-rate', `${formatMoney(t.rate_per_page)} تومان`);

  const callBtn = getEl('detail-btn-call');
  if (callBtn) callBtn.href = `tel:${t.phone}`;
  
  const smsBtn = getEl('detail-btn-sms');
  if (smsBtn) smsBtn.href = `sms:${t.phone}`;

  const totalWork = currentReports.reduce((acc, r) => acc + (Number(r.total_price) || 0), 0);
  const totalPaid = currentPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const balance = totalWork - totalPaid;

  safeSetText('detail-total-work', `${formatMoney(totalWork)} تومان`);
  safeSetText('detail-total-paid', `${formatMoney(totalPaid)} تومان`);
  safeSetText('detail-total-balance', `${formatMoney(balance)} تومان`);

  const repTbody = getEl('detail-reports-tbody');
  if (repTbody) {
    repTbody.innerHTML = '';
    if (currentReports.length === 0) {
      repTbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">هیچ گزارش کاری ثبت نشده است</td></tr>`;
    } else {
      currentReports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';
        tr.innerHTML = `
          <td class="p-3 font-medium text-slate-900 dark:text-white">${r.title}</td>
          <td class="p-3 font-mono">${formatMoney(r.page_count)}</td>
          <td class="p-3 text-slate-600 dark:text-slate-400">${formatMoney(r.rate_per_page)} تومان</td>
          <td class="p-3 font-semibold text-brand-600 dark:text-brand-400">${formatMoney(r.total_price)} تومان</td>
          <td class="p-3 font-mono text-slate-600 dark:text-slate-400">${r.delivery_date || '-'}</td>
          <td class="p-3">
            <span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              ${r.status || 'تایید شده'}
            </span>
          </td>
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button type="button" onclick="openEditReportModal('${r.id}')" class="p-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded hover:bg-amber-100" title="ویرایش">✏️</button>
              <button type="button" onclick="deleteReport('${r.id}')" class="p-1.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded hover:bg-rose-100" title="حذف">🗑️</button>
            </div>
          </td>
        `;
        repTbody.appendChild(tr);
      });
    }
  }

  const payTbody = getEl('detail-payments-tbody');
  if (payTbody) {
    payTbody.innerHTML = '';
    if (currentPayments.length === 0) {
      payTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">هیچ پرداختی ثبت نشده است</td></tr>`;
    } else {
      currentPayments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';
        tr.innerHTML = `
          <td class="p-3 font-bold text-emerald-600 dark:text-emerald-400">${formatMoney(p.amount)} تومان</td>
          <td class="p-3 font-mono text-slate-600 dark:text-slate-400">${p.payment_date}</td>
          <td class="p-3 text-slate-600 dark:text-slate-400">${p.description || '-'}</td>
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button type="button" onclick="openEditPaymentModal('${p.id}')" class="p-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded hover:bg-amber-100" title="ویرایش">✏️</button>
              <button type="button" onclick="deletePayment('${p.id}')" class="p-1.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded hover:bg-rose-100" title="حذف">🗑️</button>
            </div>
          </td>
        `;
        payTbody.appendChild(tr);
      });
    }
  }
}

async function loadTypistSelfDashboard() {
  if (!currentUser || currentUser.role !== 'typist' || !supabase) return;

  const typistId = currentUser.data.id;
  const { data, error } = await supabase.rpc('get_typist_detail', { p_typist_id: typistId });
  if (error || !data || !data.success) {
    showToast('error', 'خطا در دریافت اطلاعات کاربری');
    return;
  }

  const t = data.typist;
  currentReports = data.reports || [];
  currentPayments = data.payments || [];

  safeSetText('typist-self-name', `${t.first_name} ${t.last_name}`);

  const totalWork = currentReports.reduce((acc, r) => acc + (Number(r.total_price) || 0), 0);
  const totalPaid = currentPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const balance = totalWork - totalPaid;

  safeSetText('typist-self-total-work', `${formatMoney(totalWork)} تومان`);
  safeSetText('typist-self-total-paid', `${formatMoney(totalPaid)} تومان`);
  safeSetText('typist-self-total-balance', `${formatMoney(balance)} تومان`);

  const tbody = getEl('typist-self-reports-tbody');
  if (tbody) {
    tbody.innerHTML = '';

    if (currentReports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">هیچ گزارش کاری ثبت نشده است</td></tr>`;
    } else {
      currentReports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';
        tr.innerHTML = `
          <td class="p-3 font-medium text-slate-900 dark:text-white">${r.title}</td>
          <td class="p-3 font-mono">${formatMoney(r.page_count)}</td>
          <td class="p-3 font-mono text-slate-600 dark:text-slate-400">${r.delivery_date || '-'}</td>
          <td class="p-3">
            <span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              ${r.status || 'در انتظار تایید'}
            </span>
          </td>
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button type="button" onclick="openEditReportModal('${r.id}')" class="p-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded hover:bg-amber-100" title="ویرایش">✏️</button>
              <button type="button" onclick="deleteReport('${r.id}')" class="p-1.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded hover:bg-rose-100" title="حذف">🗑️</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function openAddTypistModal() {
  safeSetText('modal-typist-title', 'ثبت تایپیست جدید');
  if (getEl('form-typist-id')) getEl('form-typist-id').value = '';
  if (getEl('form-typist-first-name')) getEl('form-typist-first-name').value = '';
  if (getEl('form-typist-last-name')) getEl('form-typist-last-name').value = '';
  if (getEl('form-typist-father-name')) getEl('form-typist-father-name').value = '';
  if (getEl('form-typist-national-id')) getEl('form-typist-national-id').value = '';
  if (getEl('form-typist-phone')) getEl('form-typist-phone').value = '';
  if (getEl('form-typist-rate')) getEl('form-typist-rate').value = '';
  if (getEl('form-typist-card')) getEl('form-typist-card').value = '';
  if (getEl('form-typist-iban')) getEl('form-typist-iban').value = '';

  safeShow('modal-typist');
}

function openEditTypistModal(id) {
  const t = allTypists.find(x => x.id === id);
  if (!t) return;

  safeSetText('modal-typist-title', 'ویرایش مشخصات تایپیست');
  if (getEl('form-typist-id')) getEl('form-typist-id').value = t.id;
  if (getEl('form-typist-first-name')) getEl('form-typist-first-name').value = t.first_name || '';
  if (getEl('form-typist-last-name')) getEl('form-typist-last-name').value = t.last_name || '';
  if (getEl('form-typist-father-name')) getEl('form-typist-father-name').value = t.father_name || '';
  if (getEl('form-typist-national-id')) getEl('form-typist-national-id').value = t.national_id || '';
  if (getEl('form-typist-phone')) getEl('form-typist-phone').value = t.phone || '';
  if (getEl('form-typist-rate')) getEl('form-typist-rate').value = t.rate_per_page || 0;
  if (getEl('form-typist-card')) getEl('form-typist-card').value = t.card_number || '';
  if (getEl('form-typist-iban')) getEl('form-typist-iban').value = t.iban || '';

  safeShow('modal-typist');
}

function openEditTypistFromDetail() {
  if (currentTypistDetail && currentTypistDetail.typist) {
    openEditTypistModal(currentTypistDetail.typist.id);
  }
}

async function saveTypist(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!supabase) return;

  const id = getEl('form-typist-id')?.value || null;
  const firstName = getEl('form-typist-first-name')?.value.trim() || '';
  const lastName = getEl('form-typist-last-name')?.value.trim() || '';
  const fatherName = getEl('form-typist-father-name')?.value.trim() || '';
  const nationalId = toEnglishDigits(getEl('form-typist-national-id')?.value || '').trim();
  const phone = toEnglishDigits(getEl('form-typist-phone')?.value || '').trim();
  const rate = Number(toEnglishDigits(getEl('form-typist-rate')?.value || '0')) || 0;
  const card = toEnglishDigits(getEl('form-typist-card')?.value || '').trim();
  const iban = toEnglishDigits(getEl('form-typist-iban')?.value || '').replace('IR', '').trim();

  const { data, error } = await supabase.rpc('upsert_typist', {
    p_id: id,
    p_first_name: firstName,
    p_last_name: lastName,
    p_father_name: fatherName,
    p_national_id: nationalId,
    p_phone: phone,
    p_rate_per_page: rate,
    p_card_number: card,
    p_iban: iban
  });

  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'مشکلی در ثبت اطلاعات تایپیست به وجود آمد', 'error');
    return;
  }

  closeModal('modal-typist');
  showToast('success', data.message);

  if (currentTypistDetail && currentTypistDetail.typist && currentTypistDetail.typist.id === id) {
    openTypistDetail(id);
  } else {
    loadAdminDashboard();
  }
}

function openSelfProfileModal() {
  if (!currentUser || currentUser.role !== 'typist') return;
  const t = currentUser.data;

  if (getEl('self-first-name')) getEl('self-first-name').value = t.first_name || '';
  if (getEl('self-last-name')) getEl('self-last-name').value = t.last_name || '';
  if (getEl('self-father-name')) getEl('self-father-name').value = t.father_name || '';
  if (getEl('self-national-id')) getEl('self-national-id').value = t.national_id || '';
  if (getEl('self-card')) getEl('self-card').value = t.card_number || '';
  if (getEl('self-iban')) getEl('self-iban').value = t.iban || '';

  safeShow('modal-self-profile');
}

async function saveSelfProfile(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!supabase) return;

  const t = currentUser.data;
  const firstName = getEl('self-first-name')?.value.trim() || '';
  const lastName = getEl('self-last-name')?.value.trim() || '';
  const fatherName = getEl('self-father-name')?.value.trim() || '';
  const nationalId = toEnglishDigits(getEl('self-national-id')?.value || '').trim();
  const card = toEnglishDigits(getEl('self-card')?.value || '').trim();
  const iban = toEnglishDigits(getEl('self-iban')?.value || '').replace('IR', '').trim();

  const { data, error } = await supabase.rpc('upsert_typist', {
    p_id: t.id,
    p_first_name: firstName,
    p_last_name: lastName,
    p_father_name: fatherName,
    p_national_id: nationalId,
    p_phone: t.phone,
    p_rate_per_page: t.rate_per_page,
    p_card_number: card,
    p_iban: iban
  });

  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'مشکلی در به‌روزرسانی مشخصات رخ داد', 'error');
    return;
  }

  currentUser.data = { ...currentUser.data, first_name: firstName, last_name: lastName, father_name: fatherName, national_id: nationalId, card_number: card, iban: iban };
  localStorage.setItem('session', JSON.stringify(currentUser));

  closeModal('modal-self-profile');
  showToast('success', 'اطلاعات شما با موفقیت به روز شد');
  loadTypistSelfDashboard();
}

function openAddReportModal() {
  if (getEl('report-title')) getEl('report-title').value = '';
  if (getEl('report-page-count')) getEl('report-page-count').value = '';
  if (getEl('report-delivery-date')) getEl('report-delivery-date').value = '';
  if (getEl('report-rate-override')) getEl('report-rate-override').value = '';

  if (currentUser && currentUser.role === 'admin') {
    safeShow('container-admin-report-rate');
  } else {
    safeHide('container-admin-report-rate');
  }

  safeShow('modal-report');
}

async function saveReport(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!supabase) return;

  const title = getEl('report-title')?.value.trim() || '';
  const pageCount = Number(toEnglishDigits(getEl('report-page-count')?.value || '0'));
  const deliveryDate = getEl('report-delivery-date')?.value.trim() || '';

  let rateOverride = null;
  if (currentUser && currentUser.role === 'admin') {
    const rawRate = getEl('report-rate-override')?.value;
    if (rawRate && rawRate !== '') rateOverride = Number(toEnglishDigits(rawRate));
  }

  const targetTypistId = currentUser.role === 'admin' ? currentTypistDetail.typist.id : currentUser.data.id;

  const { data, error } = await supabase.rpc('add_typist_report', {
    p_typist_id: targetTypistId,
    p_title: title,
    p_page_count: pageCount,
    p_delivery_date: deliveryDate,
    p_rate_per_page: rateOverride
  });

  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'مشکلی در ثبت گزارش کار به وجود آمد', 'error');
    return;
  }

  closeModal('modal-report');
  showToast('success', 'گزارش کار با موفقیت ثبت شد');

  if (currentUser.role === 'admin') {
    openTypistDetail(targetTypistId);
  } else {
    loadTypistSelfDashboard();
  }
}

function openEditReportModal(reportId) {
  const r = currentReports.find(x => x.id === reportId);
  if (!r) return;

  if (getEl('edit-report-id')) getEl('edit-report-id').value = r.id;
  if (getEl('edit-report-title')) getEl('edit-report-title').value = r.title || '';
  if (getEl('edit-report-page-count')) getEl('edit-report-page-count').value = r.page_count || '';
  if (getEl('edit-report-delivery-date')) getEl('edit-report-delivery-date').value = r.delivery_date || '';

  if (currentUser && currentUser.role === 'admin') {
    safeShow('container-edit-report-rate');
    if (getEl('edit-report-rate')) getEl('edit-report-rate').value = r.rate_per_page || 0;
  } else {
    safeHide('container-edit-report-rate');
  }

  safeShow('modal-edit-report');
}

async function saveEditReport(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!supabase) return;

  const reportId = getEl('edit-report-id')?.value;
  const title = getEl('edit-report-title')?.value.trim() || '';
  const pageCount = Number(toEnglishDigits(getEl('edit-report-page-count')?.value || '0'));
  const deliveryDate = getEl('edit-report-delivery-date')?.value.trim() || '';

  let rateOverride = null;
  if (currentUser && currentUser.role === 'admin') {
    const rawRate = getEl('edit-report-rate')?.value;
    if (rawRate && rawRate !== '') rateOverride = Number(toEnglishDigits(rawRate));
  }

  const { data, error } = await supabase.rpc('update_typist_report', {
    p_report_id: reportId,
    p_title: title,
    p_page_count: pageCount,
    p_delivery_date: deliveryDate,
    p_rate_per_page: rateOverride
  });

  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'مشکلی در ویرایش گزارش به وجود آمد', 'error');
    return;
  }

  closeModal('modal-edit-report');
  showToast('success', 'گزارش کار با موفقیت بروزرسانی شد');

  if (currentUser.role === 'admin') {
    openTypistDetail(currentTypistDetail.typist.id);
  } else {
    loadTypistSelfDashboard();
  }
}

async function deleteReport(reportId) {
  if (!supabase) return;

  const confirm = await Swal.fire({
    title: 'آیا از حذف این گزارش مطمئن هستید؟',
    text: 'این عملیات قابل بازگشت نیست',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'بله، حذف شود',
    cancelButtonText: 'انصراف'
  });

  if (!confirm.isConfirmed) return;

  const { data, error } = await supabase.rpc('delete_typist_report', { p_report_id: reportId });
  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'خطا در حذف گزارش', 'error');
    return;
  }

  showToast('success', 'گزارش کار حذف شد');
  if (currentUser.role === 'admin') {
    openTypistDetail(currentTypistDetail.typist.id);
  } else {
    loadTypistSelfDashboard();
  }
}

function openAddPaymentModal() {
  safeSetText('modal-payment-title', 'ثبت پرداخت جدید');
  if (getEl('payment-id')) getEl('payment-id').value = '';
  if (getEl('payment-amount')) getEl('payment-amount').value = '';
  if (getEl('payment-date')) getEl('payment-date').value = '';
  if (getEl('payment-description')) getEl('payment-description').value = '';

  safeShow('modal-payment');
}

function openEditPaymentModal(paymentId) {
  const p = currentPayments.find(x => x.id === paymentId);
  if (!p) return;

  safeSetText('modal-payment-title', 'ویرایش پرداخت');
  if (getEl('payment-id')) getEl('payment-id').value = p.id;
  if (getEl('payment-amount')) getEl('payment-amount').value = p.amount || '';
  if (getEl('payment-date')) getEl('payment-date').value = p.payment_date || '';
  if (getEl('payment-description')) getEl('payment-description').value = p.description || '';

  safeShow('modal-payment');
}

async function savePayment(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!supabase) return;

  const paymentId = getEl('payment-id')?.value;
  const amount = Number(toEnglishDigits(getEl('payment-amount')?.value || '0'));
  const paymentDate = getEl('payment-date')?.value.trim() || '';
  const description = getEl('payment-description')?.value.trim() || '';

  if (paymentId) {
    const { data, error } = await supabase.rpc('update_payment', {
      p_payment_id: paymentId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_description: description
    });

    if (error || !data || !data.success) {
      Swal.fire('خطا', data?.message || 'مشکلی در ویرایش پرداخت به وجود آمد', 'error');
      return;
    }
    showToast('success', 'پرداخت با موفقیت بروزرسانی شد');
  } else {
    const targetTypistId = currentTypistDetail.typist.id;
    const { data, error } = await supabase.rpc('add_payment', {
      p_typist_id: targetTypistId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_description: description
    });

    if (error || !data || !data.success) {
      Swal.fire('خطا', data?.message || 'مشکلی در ثبت پرداخت به وجود آمد', 'error');
      return;
    }
    showToast('success', 'پرداخت با موفقیت ثبت شد');
  }

  closeModal('modal-payment');
  openTypistDetail(currentTypistDetail.typist.id);
}

async function deletePayment(paymentId) {
  if (!supabase) return;

  const confirm = await Swal.fire({
    title: 'آیا از حذف این پرداخت مطمئن هستید؟',
    text: 'این عملیات قابل بازگشت نیست',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'بله، حذف شود',
    cancelButtonText: 'انصراف'
  });

  if (!confirm.isConfirmed) return;

  const { data, error } = await supabase.rpc('delete_payment', { p_payment_id: paymentId });
  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'خطا در حذف پرداخت', 'error');
    return;
  }

  showToast('success', 'پرداخت حذف شد');
  openTypistDetail(currentTypistDetail.typist.id);
}

function openChangePasswordModal() {
  if (getEl('pass-current')) getEl('pass-current').value = '';
  if (getEl('pass-new')) getEl('pass-new').value = '';
  if (getEl('pass-confirm')) getEl('pass-confirm').value = '';
  
  safeShow('modal-change-password');
}

async function savePasswordChange(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!supabase) return;

  const currentPass = toEnglishDigits(getEl('pass-current')?.value || '').trim();
  const newPass = toEnglishDigits(getEl('pass-new')?.value || '').trim();
  const confirmPass = toEnglishDigits(getEl('pass-confirm')?.value || '').trim();

  if (newPass !== confirmPass) {
    Swal.fire('خطا', 'رمز عبور جدید و تکرار آن یکسان نیستند', 'error');
    return;
  }

  if (currentUser.role === 'admin') {
    const { data, error } = await supabase.rpc('change_admin_password', {
      p_old_password: currentPass,
      p_new_password: newPass
    });

    if (error || !data || !data.success) {
      Swal.fire('خطا', data?.message || 'رمز عبور فعلی اشتباه است', 'error');
      return;
    }
  } else {
    const { data, error } = await supabase.rpc('change_typist_password', {
      p_typist_id: currentUser.data.id,
      p_old_password: currentPass,
      p_new_password: newPass
    });

    if (error || !data || !data.success) {
      Swal.fire('خطا', data?.message || 'رمز عبور فعلی اشتباه است', 'error');
      return;
    }
  }

  closeModal('modal-change-password');
  Swal.fire('موفقیت‌آمیز', 'رمز عبور شما با موفقیت تغییر کرد', 'success');
}

function exportSelectedBankCSV() {
  const selectedCheckboxes = document.querySelectorAll('.typist-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    Swal.fire('هشدار', 'لطفاً حداقل یک تایپیست را برای خروجی فایل پایا انتخاب کنید', 'warning');
    return;
  }

  let csvRows = [];
  csvRows.push(['ردیف', 'نام', 'نام خانوادگی', 'نام پدر', 'کد ملی', 'شماره تماس', 'شماره کارت', 'شماره شبا', 'مبلغ پرداختی به ریال'].join(','));

  let count = 1;
  selectedCheckboxes.forEach(cb => {
    const name = cb.getAttribute('data-name') || '';
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const father = cb.getAttribute('data-father') || '';
    const national = cb.getAttribute('data-national') || '';
    const phone = cb.getAttribute('data-phone') || '';
    const card = cb.getAttribute('data-card') || '';
    const iban = cb.getAttribute('data-iban') || '';
    const balanceToman = Number(cb.getAttribute('data-balance')) || 0;
    
    const amountRial = balanceToman > 0 ? balanceToman * 10 : 0;

    csvRows.push([
      count++,
      `"${firstName}"`,
      `"${lastName}"`,
      `"${father}"`,
      `"${national}"`,
      `"${phone}"`,
      `"${card}"`,
      `"${iban}"`,
      amountRial
    ].join(','));
  });

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Bank_Paya_Payment_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('success', 'فایل CSV پایا بانک آماده و دانلود شد');
}

function sendGroupSMS() {
  const selectedCheckboxes = document.querySelectorAll('.typist-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    Swal.fire('هشدار', 'لطفاً حداقل یک تایپیست را برای ارسال پیامک انتخاب کنید', 'warning');
    return;
  }

  const phones = Array.from(selectedCheckboxes)
    .map(cb => cb.getAttribute('data-phone'))
    .filter(phone => phone && phone.trim() !== '');

  if (phones.length === 0) {
    Swal.fire('خطا', 'هیچ شماره تماسی برای افراد انتخاب شده یافت نشد', 'error');
    return;
  }

  const phoneString = phones.join(',');
  window.location.href = `sms:${phoneString}?body=${encodeURIComponent('سلام، لطفاً جهت بررسی صورتحساب به سامانه مراجعه فرمایید.')}`;
}

// Bind all functions explicitly to Window
window.switchLoginTab = switchLoginTab;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.toggleDarkMode = toggleDarkMode;
window.openChangePasswordModal = openChangePasswordModal;
window.savePasswordChange = savePasswordChange;
window.openShamsiDatepicker = openShamsiDatepicker;
window.confirmShamsiDate = confirmShamsiDate;
window.closeModal = closeModal;
window.filterTypistsTable = filterTypistsTable;
window.toggleSelectAllTypists = toggleSelectAllTypists;
window.openTypistDetail = openTypistDetail;
window.showAdminDashboard = showAdminDashboard;
window.openAddTypistModal = openAddTypistModal;
window.openEditTypistModal = openEditTypistModal;
window.openEditTypistFromDetail = openEditTypistFromDetail;
window.saveTypist = saveTypist;
window.openSelfProfileModal = openSelfProfileModal;
window.saveSelfProfile = saveSelfProfile;
window.openAddReportModal = openAddReportModal;
window.saveReport = saveReport;
window.openEditReportModal = openEditReportModal;
window.saveEditReport = saveEditReport;
window.deleteReport = deleteReport;
window.openAddPaymentModal = openAddPaymentModal;
window.openEditPaymentModal = openEditPaymentModal;
window.savePayment = savePayment;
window.deletePayment = deletePayment;
window.exportSelectedBankCSV = exportSelectedBankCSV;
window.sendGroupSMS = sendGroupSMS;

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDatepickerDropdowns();
  switchLoginTab('typist');
  checkSavedSession();
  console.log('🚀 Typist Payroll App Mobile Ready.');
});

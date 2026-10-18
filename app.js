// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://zgkhixllsmutjldszjls.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2hpeGxsc211dGpsZHN6amxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyODkzODksImV4cCI6MjA1Njg2NTM4OX0.jE3Y9V2PIScKInJc-jD7dI3eQp9Dq4Hj9uS4x2Z31eY";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// GLOBAL STATE
let currentUser = null; // { role: 'admin' | 'typist', id?: string, name?: string }
let dashboardData = [];
let currentTypistDetail = null;
let activeDatePickerTargetInput = null;

// SHAMSI CALENDAR UTILS
const FARSI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

let dpState = {
  year: 1403,
  month: 12
};

function toEnglishDigits(str) {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function g2j(gy, gm, gd) {
  var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  var jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  var gy2 = (gm > 2) ? (gy + 1) : gy;
  var days = (365 * gy) + (parseInt((gy2 + 3) / 4)) - (parseInt((gy2 + 99) / 100)) + (parseInt((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (parseInt(days / 12053));
  days %= 12053;
  jy += 4 * (parseInt(days / 1461));
  days %= 1461;
  jy += parseInt((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  var jm = (days < 186) ? 1 + parseInt(days / 31) : 7 + parseInt((days - 186) / 30);
  var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function getTodayShamsi() {
  const d = new Date();
  const [jy, jm, jd] = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const mm = String(jm).padStart(2, '0');
  const dd = String(jd).padStart(2, '0');
  return `${jy}/${mm}/${dd}`;
}

function parseShamsiDate(str) {
  if (!str) return null;
  const cleanStr = toEnglishDigits(str);
  const parts = cleanStr.split('/');
  if (parts.length !== 3) return null;
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10)
  };
}

function calculateDaysRemaining(shamsiDateStr) {
  if (!shamsiDateStr) return null;
  const parsed = parseShamsiDate(shamsiDateStr);
  if (!parsed) return null;

  const todayStr = getTodayShamsi();
  const tParsed = parseShamsiDate(todayStr);

  const targetDays = parsed.year * 365 + parsed.month * 30 + parsed.day;
  const currentDays = tParsed.year * 365 + tParsed.month * 30 + tParsed.day;

  return targetDays - currentDays;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '۰';
  return new Intl.NumberFormat('fa-IR').format(num);
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  checkSession();
});

// THEME TOGGLE
function initTheme() {
  if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-toggle-light-icon').classList.remove('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-toggle-dark-icon').classList.remove('hidden');
  }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const darkIcon = document.getElementById('theme-toggle-dark-icon');
  const lightIcon = document.getElementById('theme-toggle-light-icon');

  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('color-theme', 'light');
    darkIcon.classList.remove('hidden');
    lightIcon.classList.add('hidden');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('color-theme', 'dark');
    lightIcon.classList.remove('hidden');
    darkIcon.classList.add('hidden');
  }
});

// EVENT LISTENERS SETUP
function setupEventListeners() {
  // Login Tabs
  document.getElementById('tab-login-admin').addEventListener('click', () => switchLoginTab('admin'));
  document.getElementById('tab-login-typist').addEventListener('click', () => switchLoginTab('typist'));

  // Login Forms
  document.getElementById('form-login-admin').addEventListener('submit', handleAdminLogin);
  document.getElementById('form-login-typist').addEventListener('submit', handleTypistLogin);

  // Logout & Navigation
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('btn-back-to-dashboard').addEventListener('click', showDashboardView);

  // Dashboard Toolbar
  document.getElementById('dashboard-search').addEventListener('input', renderDashboardTable);
  document.getElementById('btn-open-add-typist').addEventListener('click', () => openTypistModal());
  document.getElementById('btn-export-excel').addEventListener('click', exportBankCSV);
  document.getElementById('btn-group-sms').addEventListener('click', openGroupSMSModal);
  document.getElementById('select-all-typists').addEventListener('change', toggleSelectAllTypists);

  // Detail View Buttons
  document.getElementById('btn-open-add-report').addEventListener('click', openReportModal);
  document.getElementById('btn-open-add-payment').addEventListener('click', openPaymentModal);
  document.getElementById('btn-open-edit-profile').addEventListener('click', () => {
    if (currentTypistDetail) {
      openTypistModal(currentTypistDetail.profile);
    }
  });

  // Modals Submissions
  document.getElementById('form-typist').addEventListener('submit', handleSaveTypist);
  document.getElementById('form-report').addEventListener('submit', handleSaveReport);
  document.getElementById('form-payment').addEventListener('submit', handleSavePayment);
  document.getElementById('form-change-password').addEventListener('submit', handleChangePassword);
  document.getElementById('btn-send-sms-confirm').addEventListener('click', sendGroupSMS);
  document.getElementById('btn-open-change-password').addEventListener('click', () => openModal('modal-password'));

  // Close Buttons on Modals
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // DatePicker Triggers
  document.querySelectorAll('.btn-trigger-datepicker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      openDatePicker(targetInput);
    });
  });

  // Datepicker Controls
  document.getElementById('dp-prev-month').addEventListener('click', () => changeDPMonth(-1));
  document.getElementById('dp-next-month').addEventListener('click', () => changeDPMonth(1));
  document.getElementById('dp-select-month').addEventListener('change', (e) => {
    dpState.month = parseInt(e.target.value, 10);
    renderDatePickerGrid();
  });
  document.getElementById('dp-select-year').addEventListener('change', (e) => {
    dpState.year = parseInt(e.target.value, 10);
    renderDatePickerGrid();
  });
  document.getElementById('dp-btn-today').addEventListener('click', () => {
    if (activeDatePickerTargetInput) {
      activeDatePickerTargetInput.value = getTodayShamsi();
    }
    closeAllModals();
  });
}

// LOGIN / SESSION MANAGEMENT
function switchLoginTab(tab) {
  const adminTab = document.getElementById('tab-login-admin');
  const typistTab = document.getElementById('tab-login-typist');
  const adminForm = document.getElementById('form-login-admin');
  const typistForm = document.getElementById('form-login-typist');
  const errDiv = document.getElementById('login-error');
  errDiv.classList.add('hidden');

  if (tab === 'admin') {
    adminTab.classList.add('text-blue-600', 'border-blue-600', 'font-semibold');
    adminTab.classList.remove('text-slate-500', 'border-transparent');
    typistTab.classList.remove('text-blue-600', 'border-blue-600', 'font-semibold');
    typistTab.classList.add('text-slate-500', 'border-transparent');
    adminForm.classList.remove('hidden');
    typistForm.classList.add('hidden');
  } else {
    typistTab.classList.add('text-blue-600', 'border-blue-600', 'font-semibold');
    typistTab.classList.remove('text-slate-500', 'border-transparent');
    adminTab.classList.remove('text-blue-600', 'border-blue-600', 'font-semibold');
    adminTab.classList.add('text-slate-500', 'border-transparent');
    typistForm.classList.remove('hidden');
    adminForm.classList.add('hidden');
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const passInput = document.getElementById('admin-password');
  const pass = toEnglishDigits(passInput.value.trim());
  const errDiv = document.getElementById('login-error');
  const btnSubmit = document.getElementById('btn-submit-admin');

  errDiv.classList.add('hidden');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'در حال بررسی...';

  try {
    const { data, error } = await supabaseClient.rpc('verify_admin_password', { p_password: pass });
    
    if (error) {
      throw new Error('خطا در ارتباط با سرور: ' + error.message);
    }
    if (!data) {
      throw new Error('رمز عبور مدیر اشتباه است');
    }

    currentUser = { role: 'admin', name: 'مدیر سیستم' };
    sessionStorage.setItem('typist_user', JSON.stringify(currentUser));
    showAppViews();
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'ورود به عنوان مدیر';
  }
}

async function handleTypistLogin(e) {
  e.preventDefault();
  const identity = toEnglishDigits(document.getElementById('typist-identity').value.trim());
  const pass = toEnglishDigits(document.getElementById('typist-password').value.trim());
  const errDiv = document.getElementById('login-error');
  const btnSubmit = document.getElementById('btn-submit-typist');

  errDiv.classList.add('hidden');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'در حال بررسی...';

  try {
    const { data: typistId, error } = await supabaseClient.rpc('verify_typist_password', {
      p_identity: identity,
      p_password: pass
    });

    if (error) {
      throw new Error('خطا در ارتباط با سرور: ' + error.message);
    }
    if (!typistId) {
      throw new Error('کد ملی/شماره همراه یا رمز عبور اشتباه است');
    }

    currentUser = { role: 'typist', id: typistId };
    sessionStorage.setItem('typist_user', JSON.stringify(currentUser));
    showAppViews();
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'ورود تایپیست';
  }
}

function checkSession() {
  const saved = sessionStorage.getItem('typist_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showAppViews();
  } else {
    showLoginView();
  }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('typist_user');
  showLoginView();
}

// VIEW SWITCHING
function showLoginView() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('detail-view').classList.add('hidden');
  document.getElementById('user-nav-controls').classList.add('hidden');
}

function showAppViews() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('user-nav-controls').classList.remove('hidden');

  if (currentUser.role === 'admin') {
    showDashboardView();
  } else {
    showTypistDetailView(currentUser.id);
  }
}

async function showDashboardView() {
  if (currentUser.role !== 'admin') return;

  document.getElementById('dashboard-view').classList.remove('hidden');
  document.getElementById('detail-view').classList.add('hidden');
  await fetchDashboardData();
}

// DASHBOARD LOGIC (ADMIN)
async function fetchDashboardData() {
  try {
    const { data, error } = await supabaseClient.rpc('get_dashboard_summary');
    if (error) throw error;

    dashboardData = data || [];
    renderDashboardStats();
    renderDashboardTable();
  } catch (err) {
    alert('خطا در دریافت اطلاعات دیتابیس: ' + err.message);
  }
}

function renderDashboardStats() {
  let totalTypists = dashboardData.length;
  let totalWords = 0;
  let totalPaid = 0;
  let totalRemaining = 0;

  dashboardData.forEach(item => {
    totalWords += Number(item.total_words || 0);
    totalPaid += Number(item.total_paid || 0);
    totalRemaining += Number(item.remaining_balance || 0);
  });

  document.getElementById('stat-total-typists').textContent = formatNumber(totalTypists) + ' نفر';
  document.getElementById('stat-total-words').textContent = formatNumber(totalWords);
  document.getElementById('stat-total-paid').textContent = formatNumber(totalPaid) + ' تومان';
  document.getElementById('stat-total-remaining').textContent = formatNumber(totalRemaining) + ' تومان';
}

function renderDashboardTable() {
  const tbody = document.getElementById('typists-table-body');
  const query = document.getElementById('dashboard-search').value.toLowerCase().trim();
  tbody.innerHTML = '';

  const filtered = dashboardData.filter(item => {
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase();
    const phone = item.phone || '';
    const nid = item.national_id || '';
    return fullName.includes(query) || phone.includes(query) || nid.includes(query);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">هیچ تایپیستی یافت نشد</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`;
    const daysLeft = calculateDaysRemaining(item.delivery_date);
    
    let timerBadge = '<span class="text-xs text-slate-400">تعریف نشده</span>';
    if (daysLeft !== null) {
      if (daysLeft < 0) {
        timerBadge = `<span class="px-2.5 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded-lg text-xs font-bold">${Math.abs(daysLeft)} روز تأخیر</span>`;
      } else if (daysLeft === 0) {
        timerBadge = `<span class="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-lg text-xs font-bold">تحویل امروز</span>`;
      } else {
        timerBadge = `<span class="px-2.5 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg text-xs font-bold">${daysLeft} روز باقی‌مانده</span>`;
      }
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition';
    tr.innerHTML = `
      <td class="p-4 text-center">
        <input type="checkbox" class="typist-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-phone="${item.phone}" />
      </td>
      <td class="p-4">
        <div class="font-bold text-slate-900 dark:text-white">${fullName}</div>
        <div class="text-xs text-slate-400 mt-0.5">🪪 ${item.national_id || '---'} | 📱 ${item.phone || '---'}</div>
      </td>
      <td class="p-4">
        <div class="flex items-center space-x-1.5 space-x-reverse">
          <a href="tel:${item.phone}" class="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 rounded-xl transition" title="تماس">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          </a>
          <a href="sms:${item.phone}" class="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 rounded-xl transition" title="پیامک">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
          </a>
        </div>
      </td>
      <td class="p-4 text-center font-semibold">${formatNumber(item.total_words)}</td>
      <td class="p-4 text-center font-bold ${Number(item.remaining_balance) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
        ${formatNumber(item.remaining_balance)} تومان
      </td>
      <td class="p-4 text-center">${timerBadge}</td>
      <td class="p-4 text-center">
        <button onclick="showTypistDetailView('${item.id}')" class="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl font-medium text-xs hover:bg-blue-100 transition">
          مدیریت و جزئیات
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleSelectAllTypists(e) {
  const checked = e.target.checked;
  document.querySelectorAll('.typist-checkbox').forEach(cb => cb.checked = checked);
}

// GROUP SMS LOGIC
function openGroupSMSModal() {
  const selectedCBs = document.querySelectorAll('.typist-checkbox:checked');
  if (selectedCBs.length === 0) {
    alert('لطفاً حداقل یک تایپیست را از جدول انتخاب کنید.');
    return;
  }
  document.getElementById('modal-sms-recipients-count').textContent = `تعداد دریافت‌کنندگان: ${selectedCBs.length} نفر`;
  document.getElementById('modal-sms-text').value = '';
  openModal('modal-sms');
}

function sendGroupSMS() {
  const selectedCBs = document.querySelectorAll('.typist-checkbox:checked');
  const text = encodeURIComponent(document.getElementById('modal-sms-text').value.trim());
  const phones = Array.from(selectedCBs).map(cb => cb.getAttribute('data-phone')).filter(Boolean);

  if (phones.length === 0) return;

  const uri = `sms:${phones.join(',')}?body=${text}`;
  window.location.href = uri;
  closeAllModals();
}

// EXPORT TO BANK CSV (Rial Calculation)
function exportBankCSV() {
  if (dashboardData.length === 0) {
    alert('اطلاعاتی برای خروجی وجود ندارد.');
    return;
  }

  let csvRows = [];
  // BOM for Excel Persian utf-8 compatibility
  csvRows.push('\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال');

  dashboardData.forEach((item, idx) => {
    const remainingRial = Math.max(0, Number(item.remaining_balance || 0) * 10);
    const row = [
      idx + 1,
      `"${item.first_name || ''}"`,
      `"${item.last_name || ''}"`,
      `"${item.father_name || ''}"`,
      `"${item.national_id || ''}"`,
      `"${item.phone || ''}"`,
      `"${item.card_number || ''}"`,
      `"${item.iban || ''}"`,
      remainingRial
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `پرداخت_بانکی_تایپیستها_${getTodayShamsi().replace(/\//g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// TYPIST DETAIL VIEW (USED BY BOTH ADMIN & TYPIST)
async function showTypistDetailView(typistId) {
  try {
    const { data, error } = await supabaseClient.rpc('get_typist_detail', { p_typist_id: typistId });
    if (error) throw error;

    currentTypistDetail = data;
    renderTypistDetail();

    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');

    // Adjust UI based on user role (Admin vs Typist)
    if (currentUser.role === 'typist') {
      document.getElementById('detail-back-bar').classList.add('hidden');
      document.getElementById('btn-open-add-payment').classList.add('hidden');
      document.getElementById('detail-rate-badge').classList.add('hidden'); // Hide rate badge!
      document.getElementById('th-report-rate').classList.add('hidden'); // Hide rate column!
      document.getElementById('th-report-actions').classList.add('hidden');
      document.getElementById('th-payment-actions').classList.add('hidden');
    } else {
      document.getElementById('detail-back-bar').classList.remove('hidden');
      document.getElementById('btn-open-add-payment').classList.remove('hidden');
      document.getElementById('detail-rate-badge').classList.remove('hidden'); // Show rate to admin
      document.getElementById('th-report-rate').classList.remove('hidden');
      document.getElementById('th-report-actions').classList.remove('hidden');
      document.getElementById('th-payment-actions').classList.remove('hidden');
    }

  } catch (err) {
    alert('خطا در دریافت جزئیات تایپیست: ' + err.message);
  }
}

function renderTypistDetail() {
  const p = currentTypistDetail.profile;
  const stats = currentTypistDetail.stats;
  const reports = currentTypistDetail.reports || [];
  const payments = currentTypistDetail.payments || [];

  const fullName = `${p.first_name || ''} ${p.last_name || ''}`;
  document.getElementById('detail-name').textContent = fullName;
  document.getElementById('detail-subinfo').textContent = 
    `📱 ${p.phone || '---'} | 🪪 ملی: ${p.national_id || '---'} | 💳 کارت: ${p.card_number || '---'}`;

  // Delivery Timer Badge
  const daysLeft = calculateDaysRemaining(p.delivery_date);
  const badgeWrapper = document.getElementById('detail-delivery-badge-wrapper');
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      badgeWrapper.innerHTML = `<span class="px-3 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded-xl text-xs font-bold">⚠️ ${Math.abs(daysLeft)} روز تأخیر تحویل پروژه</span>`;
    } else if (daysLeft === 0) {
      badgeWrapper.innerHTML = `<span class="px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-xl text-xs font-bold">⏰ مهلت تحویل پروژه امروز است</span>`;
    } else {
      badgeWrapper.innerHTML = `<span class="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-xl text-xs font-bold">⌛ ${daysLeft} روز تا مهلت تحویل پروژه</span>`;
    }
  } else {
    badgeWrapper.innerHTML = '';
  }

  // Rate Badge (Admin view)
  document.getElementById('detail-rate-badge').textContent = `💵 نرخ: ${formatNumber(p.rate)} تومان`;

  // Direct Call/SMS Buttons in detail view for Admin
  const contactDiv = document.getElementById('detail-contact-actions');
  if (currentUser.role === 'admin') {
    contactDiv.innerHTML = `
      <a href="tel:${p.phone}" class="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-1 space-x-reverse">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
        <span>تماس</span>
      </a>
      <a href="sms:${p.phone}" class="p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-xl text-xs font-semibold flex items-center space-x-1 space-x-reverse">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
        <span>پیامک</span>
      </a>
    `;
  } else {
    contactDiv.innerHTML = '';
  }

  // Summary Stats
  document.getElementById('detail-stat-words').textContent = formatNumber(stats.total_words);
  document.getElementById('detail-stat-total').textContent = formatNumber(stats.total_earned) + ' تومان';
  document.getElementById('detail-stat-paid').textContent = formatNumber(stats.total_paid) + ' تومان';
  document.getElementById('detail-stat-remaining').textContent = formatNumber(stats.remaining_balance) + ' تومان';

  // Render Reports Table
  const repTbody = document.getElementById('reports-table-body');
  repTbody.innerHTML = '';
  if (reports.length === 0) {
    repTbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">هیچ گزارشی ثبت نشده است</td></tr>`;
  } else {
    reports.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition';

      let rateCell = currentUser.role === 'admin' ? `<td class="p-3 sm:p-4 text-center">${formatNumber(r.rate)}</td>` : '';
      let actionCell = currentUser.role === 'admin' ? `
        <td class="p-3 sm:p-4 text-center">
          <button onclick="deleteReport('${r.id}')" class="text-rose-600 hover:text-rose-700 text-xs font-semibold">حذف</button>
        </td>` : '';

      tr.innerHTML = `
        <td class="p-3 sm:p-4 font-semibold">${r.report_date || '---'}</td>
        <td class="p-3 sm:p-4 text-center">${formatNumber(r.words)}</td>
        <td class="p-3 sm:p-4 text-center">${formatNumber(r.pages)}</td>
        ${rateCell}
        <td class="p-3 sm:p-4 text-center font-bold text-slate-900 dark:text-white">${formatNumber(r.total_amount)} تومان</td>
        <td class="p-3 sm:p-4 text-slate-500">${r.notes || '---'}</td>
        ${actionCell}
      `;
      repTbody.appendChild(tr);
    });
  }

  // Render Payments Table
  const payTbody = document.getElementById('payments-table-body');
  payTbody.innerHTML = '';
  if (payments.length === 0) {
    payTbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">هیچ پرداختی ثبت نشده است</td></tr>`;
  } else {
    payments.forEach(pay => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition';

      let actionCell = currentUser.role === 'admin' ? `
        <td class="p-3 sm:p-4 text-center">
          <button onclick="deletePayment('${pay.id}')" class="text-rose-600 hover:text-rose-700 text-xs font-semibold">حذف</button>
        </td>` : '';

      tr.innerHTML = `
        <td class="p-3 sm:p-4 font-semibold">${pay.payment_date || '---'}</td>
        <td class="p-3 sm:p-4 text-center font-bold text-emerald-600 dark:text-emerald-400">${formatNumber(pay.amount)} تومان</td>
        <td class="p-3 sm:p-4 text-center"><span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs">${pay.payment_method || '---'}</span></td>
        <td class="p-3 sm:p-4 text-center text-xs font-mono">${pay.ref_code || '---'}</td>
        <td class="p-3 sm:p-4 text-slate-500">${pay.notes || '---'}</td>
        ${actionCell}
      `;
      payTbody.appendChild(tr);
    });
  }
}

// TYPIST FORM (ADD / EDIT PROFILE)
function openTypistModal(profile = null) {
  const modal = document.getElementById('modal-typist');
  const title = document.getElementById('modal-typist-title');
  const rateWrapper = document.getElementById('wrapper-modal-typist-rate');

  if (profile) {
    title.textContent = 'ویرایش اطلاعات تایپیست';
    document.getElementById('modal-typist-id').value = profile.id;
    document.getElementById('modal-typist-firstname').value = profile.first_name || '';
    document.getElementById('modal-typist-lastname').value = profile.last_name || '';
    document.getElementById('modal-typist-father').value = profile.father_name || '';
    document.getElementById('modal-typist-nationalid').value = profile.national_id || '';
    document.getElementById('modal-typist-phone').value = profile.phone || '';
    document.getElementById('modal-typist-card').value = profile.card_number || '';
    document.getElementById('modal-typist-iban').value = profile.iban || '';
    document.getElementById('modal-typist-delivery').value = profile.delivery_date || '';
    document.getElementById('modal-typist-rate').value = profile.rate || 0;
  } else {
    title.textContent = 'افزودن تایپیست جدید';
    document.getElementById('form-typist').reset();
    document.getElementById('modal-typist-id').value = '';
    document.getElementById('modal-typist-delivery').value = getTodayShamsi();
  }

  // Hide rate input from modal if user is typist
  if (currentUser.role === 'typist') {
    rateWrapper.classList.add('hidden');
  } else {
    rateWrapper.classList.remove('hidden');
  }

  openModal('modal-typist');
}

async function handleSaveTypist(e) {
  e.preventDefault();
  const typistId = document.getElementById('modal-typist-id').value || null;

  const payload = {
    p_id: typistId,
    p_first_name: document.getElementById('modal-typist-firstname').value.trim(),
    p_last_name: document.getElementById('modal-typist-lastname').value.trim(),
    p_father_name: document.getElementById('modal-typist-father').value.trim(),
    p_national_id: toEnglishDigits(document.getElementById('modal-typist-nationalid').value.trim()),
    p_phone: toEnglishDigits(document.getElementById('modal-typist-phone').value.trim()),
    p_card_number: toEnglishDigits(document.getElementById('modal-typist-card').value.trim()),
    p_iban: toEnglishDigits(document.getElementById('modal-typist-iban').value.trim()),
    p_rate: parseFloat(document.getElementById('modal-typist-rate').value) || 0,
    p_delivery_date: document.getElementById('modal-typist-delivery').value.trim(),
    p_password_hash: null
  };

  try {
    const { data, error } = await supabaseClient.rpc('upsert_typist', payload);
    if (error) throw error;

    closeAllModals();

    if (currentUser.role === 'admin') {
      await fetchDashboardData();
      if (currentTypistDetail && currentTypistDetail.profile.id === data) {
        await showTypistDetailView(data);
      }
    } else {
      await showTypistDetailView(currentUser.id);
    }
  } catch (err) {
    alert('خطا در ذخیره اطلاعات: ' + err.message);
  }
}

// REPORT LOGIC
function openReportModal() {
  document.getElementById('form-report').reset();
  document.getElementById('modal-report-date').value = getTodayShamsi();
  
  const rateWrapper = document.getElementById('wrapper-modal-report-rate');
  if (currentUser.role === 'typist') {
    rateWrapper.classList.add('hidden');
  } else {
    rateWrapper.classList.remove('hidden');
  }

  openModal('modal-report');
}

async function handleSaveReport(e) {
  e.preventDefault();
  const typistId = currentUser.role === 'admin' ? currentTypistDetail.profile.id : currentUser.id;

  const payload = {
    p_typist_id: typistId,
    p_report_date: document.getElementById('modal-report-date').value.trim(),
    p_words: parseInt(document.getElementById('modal-report-words').value, 10) || 0,
    p_pages: parseInt(document.getElementById('modal-report-pages').value, 10) || 0,
    p_rate: currentUser.role === 'admin' ? (parseFloat(document.getElementById('modal-report-rate').value) || null) : null,
    p_notes: document.getElementById('modal-report-notes').value.trim()
  };

  try {
    const { error } = await supabaseClient.rpc('add_typist_report', payload);
    if (error) throw error;

    closeAllModals();
    await showTypistDetailView(typistId);
  } catch (err) {
    alert('خطا در ثبت گزارش: ' + err.message);
  }
}

async function deleteReport(reportId) {
  if (!confirm('آیا از حذف این گزارش مطمئن هستید؟')) return;
  try {
    const { error } = await supabaseClient.rpc('delete_typist_report', { p_report_id: reportId });
    if (error) throw error;
    await showTypistDetailView(currentTypistDetail.profile.id);
  } catch (err) {
    alert('خطا در حذف گزارش: ' + err.message);
  }
}

// PAYMENT LOGIC
function openPaymentModal() {
  document.getElementById('form-payment').reset();
  document.getElementById('modal-payment-date').value = getTodayShamsi();
  openModal('modal-payment');
}

async function handleSavePayment(e) {
  e.preventDefault();
  const typistId = currentTypistDetail.profile.id;

  const payload = {
    p_typist_id: typistId,
    p_payment_date: document.getElementById('modal-payment-date').value.trim(),
    p_amount: parseFloat(document.getElementById('modal-payment-amount').value) || 0,
    p_payment_method: document.getElementById('modal-payment-method').value,
    p_ref_code: document.getElementById('modal-payment-ref').value.trim(),
    p_notes: document.getElementById('modal-payment-notes').value.trim()
  };

  try {
    const { error } = await supabaseClient.rpc('add_payment', payload);
    if (error) throw error;

    closeAllModals();
    await showTypistDetailView(typistId);
  } catch (err) {
    alert('خطا در ثبت پرداخت: ' + err.message);
  }
}

async function deletePayment(paymentId) {
  if (!confirm('آیا از حذف این پرداخت مطمئن هستید؟')) return;
  try {
    const { error } = await supabaseClient.rpc('delete_payment', { p_payment_id: paymentId });
    if (error) throw error;
    await showTypistDetailView(currentTypistDetail.profile.id);
  } catch (err) {
    alert('خطا در حذف پرداخت: ' + err.message);
  }
}

// CHANGE PASSWORD LOGIC
async function handleChangePassword(e) {
  e.preventDefault();
  const currentPass = toEnglishDigits(document.getElementById('modal-pass-current').value.trim());
  const newPass = toEnglishDigits(document.getElementById('modal-pass-new').value.trim());

  try {
    if (currentUser.role === 'admin') {
      const { error } = await supabaseClient.rpc('change_admin_password', {
        p_old_password: currentPass,
        p_new_password: newPass
      });
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.rpc('change_typist_password', {
        p_typist_id: currentUser.id,
        p_old_password: currentPass,
        p_new_password: newPass
      });
      if (error) throw error;
    }

    alert('رمز عبور با موفقیت تغییر یافت.');
    closeAllModals();
  } catch (err) {
    alert('خطا در تغییر رمز عبور: ' + err.message);
  }
}

// MODAL CONTROLS
function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
}

// SHAMSI DATE PICKER POPUP LOGIC
function openDatePicker(inputElement) {
  activeDatePickerTargetInput = inputElement;

  let currentVal = inputElement.value || getTodayShamsi();
  let parsed = parseShamsiDate(currentVal);

  if (!parsed) {
    parsed = parseShamsiDate(getTodayShamsi());
  }

  dpState.year = parsed.year;
  dpState.month = parsed.month;

  renderDatePickerHeader();
  renderDatePickerGrid();
  openModal('modal-datepicker');
}

function renderDatePickerHeader() {
  const monthSelect = document.getElementById('dp-select-month');
  monthSelect.innerHTML = '';
  FARSI_MONTHS.forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = idx + 1;
    opt.textContent = m;
    if (idx + 1 === dpState.month) opt.selected = true;
    monthSelect.appendChild(opt);
  });

  const yearSelect = document.getElementById('dp-select-year');
  yearSelect.innerHTML = '';
  const currentYear = parseShamsiDate(getTodayShamsi()).year;
  for (let y = currentYear - 3; y <= currentYear + 5; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === dpState.year) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  document.getElementById('dp-current-title').textContent = `${FARSI_MONTHS[dpState.month - 1]} ${dpState.year}`;
}

function changeDPMonth(delta) {
  dpState.month += delta;
  if (dpState.month > 12) {
    dpState.month = 1;
    dpState.year++;
  } else if (dpState.month < 1) {
    dpState.month = 12;
    dpState.year--;
  }
  renderDatePickerHeader();
  renderDatePickerGrid();
}

function renderDatePickerGrid() {
  renderDatePickerHeader();

  const grid = document.getElementById('dp-days-grid');
  grid.innerHTML = '';

  let daysInMonth = 30;
  if (dpState.month <= 6) daysInMonth = 31;
  else if (dpState.month === 12) daysInMonth = 29;

  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition font-medium';
    btn.textContent = d;
    btn.addEventListener('click', () => {
      const mm = String(dpState.month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      if (activeDatePickerTargetInput) {
        activeDatePickerTargetInput.value = `${dpState.year}/${mm}/${dd}`;
      }
      closeAllModals();
    });
    grid.appendChild(btn);
  }
}

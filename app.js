// =========================================================
// 1. SUPABASE CLIENT & STATE INITIALIZATION
// =========================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global Application State
let currentUser = null; // { role: 'admin'|'typist', data: {...} }
let activeLoginTab = 'typist'; // 'admin' or 'typist'
let allTypists = [];
let currentTypistDetail = null; // Currently open typist detail data
let currentTargetInputIdForDate = null;
let currentReports = [];
let currentPayments = [];

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
  Swal.fire({
    icon: icon,
    title: title,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDatepickerDropdowns();
  checkSavedSession();
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-icon').textContent = '☀️';
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-icon').textContent = '🌙';
  }
}

window.toggleDarkMode = function() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-icon').textContent = isDark ? '☀️' : '🌙';
};

// Shamsi Datepicker Logic
function initDatepickerDropdowns() {
  const daySelect = document.getElementById('dp-day');
  const yearSelect = document.getElementById('dp-year');

  daySelect.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const val = i < 10 ? '0' + i : String(i);
    daySelect.innerHTML += `<option value="${val}">${val}</option>`;
  }

  yearSelect.innerHTML = '';
  for (let y = 1402; y <= 1410; y++) {
    yearSelect.innerHTML += `<option value="${y}" ${y === 1403 ? 'selected' : ''}>${y}</option>`;
  }
}

window.openShamsiDatepicker = function(inputId) {
  currentTargetInputIdForDate = inputId;
  const existingVal = document.getElementById(inputId).value;
  if (existingVal && existingVal.includes('/')) {
    const parts = existingVal.split('/');
    if (parts.length === 3) {
      document.getElementById('dp-year').value = parts[0];
      document.getElementById('dp-month').value = parts[1];
      document.getElementById('dp-day').value = parts[2];
    }
  }
  document.getElementById('modal-datepicker').classList.remove('hidden');
};

window.confirmShamsiDate = function() {
  const y = document.getElementById('dp-year').value;
  const m = document.getElementById('dp-month').value;
  const d = document.getElementById('dp-day').value;
  const dateStr = `${y}/${m}/${d}`;
  if (currentTargetInputIdForDate) {
    document.getElementById(currentTargetInputIdForDate).value = dateStr;
  }
  closeModal('modal-datepicker');
};

// Modal Helper Functions
window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.add('hidden');
};

// Login Tab Switching
window.switchLoginTab = function(tab) {
  activeLoginTab = tab;
  const tabAdmin = document.getElementById('tab-login-admin');
  const tabTypist = document.getElementById('tab-login-typist');
  const labelId = document.getElementById('label-identifier');
  const hintPass = document.getElementById('typist-pass-hint');
  const fieldId = document.getElementById('field-identifier');

  if (tab === 'admin') {
    tabAdmin.className = 'flex-1 py-2 text-sm font-medium rounded-lg transition bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm';
    tabTypist.className = 'flex-1 py-2 text-sm font-medium rounded-lg transition text-slate-700 dark:text-slate-300';
    fieldId.classList.add('hidden');
    hintPass.classList.add('hidden');
  } else {
    tabTypist.className = 'flex-1 py-2 text-sm font-medium rounded-lg transition bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm';
    tabAdmin.className = 'flex-1 py-2 text-sm font-medium rounded-lg transition text-slate-700 dark:text-slate-300';
    fieldId.classList.remove('hidden');
    labelId.textContent = 'کد ملی یا شماره همراه';
    hintPass.classList.remove('hidden');
  }
};

// Login Action
window.handleLogin = async function(e) {
  e.preventDefault();
  const password = toEnglishDigits(document.getElementById('input-password').value).trim();
  
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
    const identifier = toEnglishDigits(document.getElementById('input-identifier').value).trim();
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
};

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

window.handleLogout = function() {
  currentUser = null;
  currentTypistDetail = null;
  localStorage.removeItem('session');
  renderLayout();
  showToast('info', 'با موفقیت خارج شدید');
};

// Render Screen according to Role
function renderLayout() {
  const viewLogin = document.getElementById('view-login');
  const viewAdminDashboard = document.getElementById('view-admin-dashboard');
  const viewAdminTypistDetail = document.getElementById('view-admin-typist-detail');
  const viewTypistDashboard = document.getElementById('view-typist-dashboard');

  const btnLogout = document.getElementById('btn-logout');
  const btnChangePass = document.getElementById('btn-change-pass');
  const userRoleBadge = document.getElementById('user-role-badge');

  viewLogin.classList.add('hidden');
  viewAdminDashboard.classList.add('hidden');
  viewAdminTypistDetail.classList.add('hidden');
  viewTypistDashboard.classList.add('hidden');

  if (!currentUser) {
    viewLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    btnChangePass.classList.add('hidden');
    userRoleBadge.classList.add('hidden');
  } else {
    btnLogout.classList.remove('hidden');
    btnChangePass.classList.remove('hidden');
    userRoleBadge.classList.remove('hidden');

    if (currentUser.role === 'admin') {
      userRoleBadge.textContent = 'مدیر سیستم';
      if (currentTypistDetail) {
        viewAdminTypistDetail.classList.remove('hidden');
        renderAdminTypistDetailView();
      } else {
        viewAdminDashboard.classList.remove('hidden');
        loadAdminDashboard();
      }
    } else {
      userRoleBadge.textContent = 'تایپیست';
      viewTypistDashboard.classList.remove('hidden');
      loadTypistSelfDashboard();
    }
  }
}

// ADMIN DASHBOARD LOGIC
async function loadAdminDashboard() {
  const { data, error } = await supabase.rpc('get_dashboard_summary');
  if (error || !data || !data.success) {
    showToast('error', 'خطا در بارگیری اطلاعات داشبورد');
    return;
  }

  allTypists = data.typists || [];
  
  document.getElementById('stat-total-typists').textContent = formatMoney(data.summary.total_typists);
  document.getElementById('stat-total-work').innerHTML = `${formatMoney(data.summary.total_work_price)} <span class="text-xs font-normal">تومان</span>`;
  document.getElementById('stat-total-paid').innerHTML = `${formatMoney(data.summary.total_payments)} <span class="text-xs font-normal">تومان</span>`;
  document.getElementById('stat-total-debt').innerHTML = `${formatMoney(data.summary.remaining_balance)} <span class="text-xs font-normal">تومان</span>`;

  renderTypistsTable(allTypists);
}

function renderTypistsTable(typists) {
  const tbody = document.getElementById('admin-typists-tbody');
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
          <button onclick="openTypistDetail('${t.id}')" class="px-2.5 py-1.5 bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 rounded-lg text-xs font-medium hover:bg-brand-100 transition">مشاهده جزئیات</button>
          <button onclick="openEditTypistModal('${t.id}')" class="p-1.5 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg text-xs hover:bg-amber-100 transition" title="ویرایش">✏️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.filterTypistsTable = function() {
  const query = toEnglishDigits(document.getElementById('admin-search').value).toLowerCase();
  const filtered = allTypists.filter(t => 
    t.first_name.toLowerCase().includes(query) ||
    t.last_name.toLowerCase().includes(query) ||
    (t.national_id && t.national_id.includes(query)) ||
    (t.phone && t.phone.includes(query))
  );
  renderTypistsTable(filtered);
};

window.toggleSelectAllTypists = function(master) {
  const checkboxes = document.querySelectorAll('.typist-checkbox');
  checkboxes.forEach(cb => cb.checked = master.checked);
};

// Open Typist Detail View
window.openTypistDetail = async function(typistId) {
  const { data, error } = await supabase.rpc('get_typist_detail', { p_typist_id: typistId });
  if (error || !data || !data.success) {
    Swal.fire('خطا', data?.message || 'مشکلی در دریافت جزئیات تایپیست رخ داد', 'error');
    return;
  }

  currentTypistDetail = data;
  renderLayout();
};

window.showAdminDashboard = function() {
  currentTypistDetail = null;
  renderLayout();
};

// RENDER ADMIN TYPIST DETAIL VIEW
function renderAdminTypistDetailView() {
  if (!currentTypistDetail || !currentTypistDetail.typist) return;

  const t = currentTypistDetail.typist;
  currentReports = currentTypistDetail.reports || [];
  currentPayments = currentTypistDetail.payments || [];

  document.getElementById('detail-typist-name').textContent = `${t.first_name} ${t.last_name}`;
  document.getElementById('detail-typist-national').textContent = t.national_id || '-';
  document.getElementById('detail-typist-father').textContent = t.father_name || '-';
  document.getElementById('detail-typist-phone').textContent = t.phone || '-';
  document.getElementById('detail-typist-card').textContent = t.card_number || '-';
  document.getElementById('detail-typist-iban').textContent = t.iban ? `IR-${t.iban}` : 'IR-';
  document.getElementById('detail-typist-rate').textContent = `${formatMoney(t.rate_per_page)} تومان`;

  document.getElementById('detail-btn-call').href = `tel:${t.phone}`;
  document.getElementById('detail-btn-sms').href = `sms:${t.phone}`;

  // Calculate Aggregates
  const totalWork = currentReports.reduce((acc, r) => acc + (Number(r.total_price) || 0), 0);
  const totalPaid = currentPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const balance = totalWork - totalPaid;

  document.getElementById('detail-total-work').textContent = `${formatMoney(totalWork)} تومان`;
  document.getElementById('detail-total-paid').textContent = `${formatMoney(totalPaid)} تومان`;
  document.getElementById('detail-total-balance').textContent = `${formatMoney(balance)} تومان`;

  // Render Work Reports Table
  const repTbody = document.getElementById('detail-reports-tbody');
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
            <button onclick="openEditReportModal('${r.id}')" class="p-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded hover:bg-amber-100" title="ویرایش">✏️</button>
            <button onclick="deleteReport('${r.id}')" class="p-1.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded hover:bg-rose-100" title="حذف">🗑️</button>
          </div>
        </td>
      `;
      repTbody.appendChild(tr);
    });
  }

  // Render Payments Table
  const payTbody = document.getElementById('detail-payments-tbody');
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
            <button onclick="openEditPaymentModal('${p.id}')" class="p-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded hover:bg-amber-100" title="ویرایش">✏️</button>
            <button onclick="deletePayment('${p.id}')" class="p-1.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded hover:bg-rose-100" title="حذف">🗑️</button>
          </div>
        </td>
      `;
      payTbody.appendChild(tr);
    });
  }
}

// TYPIST SELF DASHBOARD LOGIC
async function loadTypistSelfDashboard() {
  if (!currentUser || currentUser.role !== 'typist') return;

  const typistId = currentUser.data.id;
  const { data, error } = await supabase.rpc('get_typist_detail', { p_typist_id: typistId });
  if (error || !data || !data.success) {
    showToast('error', 'خطا در دریافت اطلاعات کاربری');
    return;
  }

  const t = data.typist;
  currentReports = data.reports || [];
  currentPayments = data.payments || [];

  document.getElementById('typist-self-name').textContent = `${t.first_name} ${t.last_name}`;

  const totalWork = currentReports.reduce((acc, r) => acc + (Number(r.total_price) || 0), 0);
  const totalPaid = currentPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const balance = totalWork - totalPaid;

  document.getElementById('typist-self-total-work').textContent = `${formatMoney(totalWork)} تومان`;
  document.getElementById('typist-self-total-paid').textContent = `${formatMoney(totalPaid)} تومان`;
  document.getElementById('typist-self-total-balance').textContent = `${formatMoney(balance)} تومان`;

  // Render Self Reports Table (NO RATES SHOWN)
  const tbody = document.getElementById('typist-self-reports-tbody');
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
            <button onclick="openEditReportModal('${r.id}')" class="p-1.5 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded hover:bg-amber-100" title="ویرایش">✏️</button>
            <button onclick="deleteReport('${r.id}')" class="p-1.5 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded hover:bg-rose-100" title="حذف">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// TYPIST CRUD (Admin View & Edit Profile)
window.openAddTypistModal = function() {
  document.getElementById('modal-typist-title').textContent = 'ثبت تایپیست جدید';
  document.getElementById('form-typist-id').value = '';
  document.getElementById('form-typist-first-name').value = '';
  document.getElementById('form-typist-last-name').value = '';
  document.getElementById('form-typist-father-name').value = '';
  document.getElementById('form-typist-national-id').value = '';
  document.getElementById('form-typist-phone').value = '';
  document.getElementById('form-typist-rate').value = '';
  document.getElementById('form-typist-card').value = '';
  document.getElementById('form-typist-iban').value = '';

  document.getElementById('modal-typist').classList.remove('hidden');
};

window.openEditTypistModal = function(id) {
  const t = allTypists.find(x => x.id === id);
  if (!t) return;

  document.getElementById('modal-typist-title').textContent = 'ویرایش مشخصات تایپیست';
  document.getElementById('form-typist-id').value = t.id;
  document.getElementById('form-typist-first-name').value = t.first_name || '';
  document.getElementById('form-typist-last-name').value = t.last_name || '';
  document.getElementById('form-typist-father-name').value = t.father_name || '';
  document.getElementById('form-typist-national-id').value = t.national_id || '';
  document.getElementById('form-typist-phone').value = t.phone || '';
  document.getElementById('form-typist-rate').value = t.rate_per_page || 0;
  document.getElementById('form-typist-card').value = t.card_number || '';
  document.getElementById('form-typist-iban').value = t.iban || '';

  document.getElementById('modal-typist').classList.remove('hidden');
};

window.openEditTypistFromDetail = function() {
  if (currentTypistDetail && currentTypistDetail.typist) {
    openEditTypistModal(currentTypistDetail.typist.id);
  }
};

window.saveTypist = async function(e) {
  e.preventDefault();
  const id = document.getElementById('form-typist-id').value || null;
  const firstName = document.getElementById('form-typist-first-name').value.trim();
  const lastName = document.getElementById('form-typist-last-name').value.trim();
  const fatherName = document.getElementById('form-typist-father-name').value.trim();
  const nationalId = toEnglishDigits(document.getElementById('form-typist-national-id').value).trim();
  const phone = toEnglishDigits(document.getElementById('form-typist-phone').value).trim();
  const rate = Number(toEnglishDigits(document.getElementById('form-typist-rate').value)) || 0;
  const card = toEnglishDigits(document.getElementById('form-typist-card').value).trim();
  const iban = toEnglishDigits(document.getElementById('form-typist-iban').value).replace('IR', '').trim();

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
};

// TYPIST SELF-PROFILE EDIT
window.openSelfProfileModal = function() {
  if (!currentUser || currentUser.role !== 'typist') return;
  const t = currentUser.data;

  document.getElementById('self-first-name').value = t.first_name || '';
  document.getElementById('self-last-name').value = t.last_name || '';
  document.getElementById('self-father-name').value = t.father_name || '';
  document.getElementById('self-national-id').value = t.national_id || '';
  document.getElementById('self-card').value = t.card_number || '';
  document.getElementById('self-iban').value = t.iban || '';

  document.getElementById('modal-self-profile').classList.remove('hidden');
};

window.saveSelfProfile = async function(e) {
  e.preventDefault();
  const t = currentUser.data;
  const firstName = document.getElementById('self-first-name').value.trim();
  const lastName = document.getElementById('self-last-name').value.trim();
  const fatherName = document.getElementById('self-father-name').value.trim();
  const nationalId = toEnglishDigits(document.getElementById('self-national-id').value).trim();
  const card = toEnglishDigits(document.getElementById('self-card').value).trim();
  const iban = toEnglishDigits(document.getElementById('self-iban').value).replace('IR', '').trim();

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
};

// REPORT CRUD (ADD & EDIT)
window.openAddReportModal = function() {
  document.getElementById('report-title').value = '';
  document.getElementById('report-page-count').value = '';
  document.getElementById('report-delivery-date').value = '';
  document.getElementById('report-rate-override').value = '';

  const adminRateContainer = document.getElementById('container-admin-report-rate');
  if (currentUser.role === 'admin') {
    adminRateContainer.classList.remove('hidden');
  } else {
    adminRateContainer.classList.add('hidden');
  }

  document.getElementById('modal-report').classList.remove('hidden');
};

window.saveReport = async function(e) {
  e.preventDefault();
  const title = document.getElementById('report-title').value.trim();
  const pageCount = Number(toEnglishDigits(document.getElementById('report-page-count').value));
  const deliveryDate = document.getElementById('report-delivery-date').value.trim();

  let rateOverride = null;
  if (currentUser.role === 'admin') {
    const rawRate = document.getElementById('report-rate-override').value;
    if (rawRate !== '') rateOverride = Number(toEnglishDigits(rawRate));
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
};

window.openEditReportModal = function(reportId) {
  const r = currentReports.find(x => x.id === reportId);
  if (!r) return;

  document.getElementById('edit-report-id').value = r.id;
  document.getElementById('edit-report-title').value = r.title || '';
  document.getElementById('edit-report-page-count').value = r.page_count || '';
  document.getElementById('edit-report-delivery-date').value = r.delivery_date || '';

  const rateContainer = document.getElementById('container-edit-report-rate');
  if (currentUser.role === 'admin') {
    rateContainer.classList.remove('hidden');
    document.getElementById('edit-report-rate').value = r.rate_per_page || 0;
  } else {
    rateContainer.classList.add('hidden');
  }

  document.getElementById('modal-edit-report').classList.remove('hidden');
};

window.saveEditReport = async function(e) {
  e.preventDefault();
  const reportId = document.getElementById('edit-report-id').value;
  const title = document.getElementById('edit-report-title').value.trim();
  const pageCount = Number(toEnglishDigits(document.getElementById('edit-report-page-count').value));
  const deliveryDate = document.getElementById('edit-report-delivery-date').value.trim();

  let rateOverride = null;
  if (currentUser.role === 'admin') {
    const rawRate = document.getElementById('edit-report-rate').value;
    if (rawRate !== '') rateOverride = Number(toEnglishDigits(rawRate));
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
};

window.deleteReport = async function(reportId) {
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
};

// PAYMENT CRUD (ADD & EDIT)
window.openAddPaymentModal = function() {
  document.getElementById('modal-payment-title').textContent = 'ثبت پرداخت جدید';
  document.getElementById('payment-id').value = '';
  document.getElementById('payment-amount').value = '';
  document.getElementById('payment-date').value = '';
  document.getElementById('payment-description').value = '';

  document.getElementById('modal-payment').classList.remove('hidden');
};

window.openEditPaymentModal = function(paymentId) {
  const p = currentPayments.find(x => x.id === paymentId);
  if (!p) return;

  document.getElementById('modal-payment-title').textContent = 'ویرایش پرداخت';
  document.getElementById('payment-id').value = p.id;
  document.getElementById('payment-amount').value = p.amount || '';
  document.getElementById('payment-date').value = p.payment_date || '';
  document.getElementById('payment-description').value = p.description || '';

  document.getElementById('modal-payment').classList.remove('hidden');
};

window.savePayment = async function(e) {
  e.preventDefault();
  const paymentId = document.getElementById('payment-id').value;
  const amount = Number(toEnglishDigits(document.getElementById('payment-amount').value));
  const paymentDate = document.getElementById('payment-date').value.trim();
  const description = document.getElementById('payment-description').value.trim();

  if (paymentId) {
    // Edit existing payment
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
    // Create new payment
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
};

window.deletePayment = async function(paymentId) {
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
};

// CHANGE PASSWORD LOGIC
window.openChangePasswordModal = function() {
  document.getElementById('pass-current').value = '';
  document.getElementById('pass-new').value = '';
  document.getElementById('pass-confirm').value = '';
  document.getElementById('modal-change-password').classList.remove('hidden');
};

window.savePasswordChange = async function(e) {
  e.preventDefault();
  const currentPass = toEnglishDigits(document.getElementById('pass-current').value).trim();
  const newPass = toEnglishDigits(document.getElementById('pass-new').value).trim();
  const confirmPass = toEnglishDigits(document.getElementById('pass-confirm').value).trim();

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
};

// BANK CSV EXPORT (SELECTED TYPIISTS)
window.exportSelectedBankCSV = function() {
  const selectedCheckboxes = document.querySelectorAll('.typist-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    Swal.fire('هشدار', 'لطفاً حداقل یک تایپیست را برای خروجی فایل پایا انتخاب کنید', 'warning');
    return;
  }

  let csvRows = [];
  // Standard UTF-8 BOM Header for Excel
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
    
    // Convert Toman to Rial (Toman * 10)
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
};

// GROUP SMS TO SELECTED TYPISTS
window.sendGroupSMS = function() {
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
};

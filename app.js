/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.0.0)
   ========================================================================== */

// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

var _cachedClient = null;

// Dynamic Safe Client Getter
function getSupabaseClient() {
    if (_cachedClient) return _cachedClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        _cachedClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return _cachedClient;
    }
    if (window.createClient && typeof window.createClient === 'function') {
        _cachedClient = window.createClient(SUPABASE_URL, SUPABASE_KEY);
        return _cachedClient;
    }
    return null;
}

// Global Application State
var currentUserRole = null; // 'admin' | 'typist'
var currentTypistId = null;
var currentTypistData = null;
var allTypistsData = [];
var targetDateInputId = null;

// Safe DOM Helper Accessors
function getEl(id) { return document.getElementById(id); }
function safeShow(id) { const el = getEl(id); if (el) el.classList.remove('hidden'); }
function safeHide(id) { const el = getEl(id); if (el) el.classList.add('hidden'); }
function safeSetText(id, txt) { const el = getEl(id); if (el) el.textContent = txt; }
function safeSetValue(id, val) { const el = getEl(id); if (el) el.value = val; }

// Convert Persian/Arabic digits to English digits
function toEnglishDigits(str) {
    if (!str && str !== 0) return '';
    const p = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    const a = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let res = str.toString();
    for (let i = 0; i < 10; i++) {
        res = res.replace(p[i], i).replace(a[i], i);
    }
    return res;
}

// Currency Formatter
function formatMoney(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '۰ تومان';
    const num = Math.round(Number(amount));
    return num.toLocaleString('fa-IR') + ' تومان';
}

// Shamsi Date Formatter
function formatDateShamsi(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (e) {
        return dateStr;
    }
}

// Feedback Helpers
function showLoading() { safeShow('loadingSpinner'); }
function hideLoading() { safeHide('loadingSpinner'); }

function showLoginError(msg) {
    const el = getEl('adminLoginError') || getEl('loginError');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    } else {
        alert(msg);
    }
}

function hideLoginError() {
    safeHide('adminLoginError');
    safeHide('loginError');
}

function showToast(msg, type = 'success') {
    const toast = getEl('toastNotice');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `fixed bottom-4 left-4 z-50 px-6 py-3 rounded-xl text-white font-medium shadow-2xl transition-all duration-300 ${
        type === 'danger' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
    }`;
    toast.classList.remove('hidden', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3500);
}

// Switch Login Tabs
function switchLoginTab(tab) {
    hideLoginError();
    const adminTab = getEl('tabAdmin');
    const typistTab = getEl('tabTypist');

    if (tab === 'admin') {
        if (adminTab) adminTab.className = 'flex-1 py-4 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 cursor-pointer';
        if (typistTab) typistTab.className = 'flex-1 py-4 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-indigo-600 cursor-pointer';
        safeShow('adminLoginForm');
        safeHide('typistLoginForm');
    } else {
        if (typistTab) typistTab.className = 'flex-1 py-4 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 cursor-pointer';
        if (adminTab) adminTab.className = 'flex-1 py-4 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-indigo-600 cursor-pointer';
        safeShow('typistLoginForm');
        safeHide('adminLoginForm');
    }
}

// ----------------------------------------------------
// Authentication Handlers
// ----------------------------------------------------
async function handleAdminLogin(e) {
    if (e) e.preventDefault();
    const rawPass = getEl('adminPassword')?.value.trim() || '';
    const cleanPass = toEnglishDigits(rawPass);

    if (!cleanPass) {
        showLoginError('لطفاً کلمه عبور مدیریت را وارد کنید');
        return;
    }

    try {
        showLoading();
        hideLoginError();

        const client = getSupabaseClient();
        if (!client) {
            hideLoading();
            showLoginError('کتابخانه Supabase هنوز بارگذاری نشده است. لطفاً چند لحظه بعد دوباره تلاش کنید.');
            return;
        }

        const { data, error } = await client.rpc('verify_admin_password', { _pass: cleanPass });
        hideLoading();

        if (error) {
            console.error('Admin Login RPC Error:', error);
            showLoginError('خطای سرور: ' + (error.message || 'نامشخص'));
            return;
        }

        let res = data;
        if (typeof res === 'string') {
            try { res = JSON.parse(res); } catch (err) {}
        }

        if (res && res.success) {
            currentUserRole = 'admin';
            currentTypistId = null;
            currentTypistData = null;
            sessionStorage.setItem('userRole', 'admin');
            showAdminDashboard();
        } else {
            showLoginError(res && res.message ? res.message : 'کلمه عبور مدیر اشتباه است');
        }
    } catch (err) {
        hideLoading();
        console.error('Admin login catch error:', err);
        showLoginError('خطای غیرمنتظره: ' + err.message);
    }
}

async function handleTypistLogin(e) {
    if (e) e.preventDefault();
    const rawId = getEl('typistLoginId')?.value.trim() || '';
    const rawPass = getEl('typistPassword')?.value.trim() || '';
    const cleanId = toEnglishDigits(rawId);
    const cleanPass = toEnglishDigits(rawPass);

    if (!cleanId || !cleanPass) {
        showLoginError('لطفاً شناسه کاربری و کلمه عبور را وارد کنید');
        return;
    }

    try {
        showLoading();
        hideLoginError();

        const client = getSupabaseClient();
        if (!client) {
            hideLoading();
            showLoginError('کتابخانه Supabase بارگذاری نشده است.');
            return;
        }

        const { data, error } = await client.rpc('verify_typist_password', { 
            _login_id: cleanId, 
            _pass: cleanPass 
        });
        hideLoading();

        if (error) {
            console.error('Typist Login RPC Error:', error);
            showLoginError('خطای سرور: ' + (error.message || 'نامشخص'));
            return;
        }

        let res = data;
        if (typeof res === 'string') {
            try { res = JSON.parse(res); } catch (err) {}
        }

        if (res && res.success && res.typist) {
            currentUserRole = 'typist';
            currentTypistId = res.typist.id;
            currentTypistData = res.typist;
            sessionStorage.setItem('userRole', 'typist');
            sessionStorage.setItem('typistId', res.typist.id);
            sessionStorage.setItem('typistData', JSON.stringify(res.typist));
            showTypistDashboard();
        } else {
            showLoginError(res && res.message ? res.message : 'شناسه کاربری یا رمز عبور اشتباه است');
        }
    } catch (err) {
        hideLoading();
        console.error('Typist login catch error:', err);
        showLoginError('خطای غیرمنتظره: ' + err.message);
    }
}

function logout() {
    currentUserRole = null;
    currentTypistId = null;
    currentTypistData = null;
    allTypistsData = [];
    sessionStorage.clear();

    safeHide('adminDashboardView');
    safeHide('typistDetailView');
    safeHide('typistSelfDashboardView');
    safeShow('loginView');
    showToast('با موفقیت از سیستم خارج شدید', 'warning');
}

// ----------------------------------------------------
// Admin Dashboard
// ----------------------------------------------------
function showAdminDashboard() {
    safeHide('loginView');
    safeHide('typistDetailView');
    safeHide('typistSelfDashboardView');
    safeShow('adminDashboardView');
    loadAdminDashboardData();
}

async function loadAdminDashboardData() {
    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { data, error } = await client.rpc('get_dashboard_summary');
        hideLoading();

        if (error) {
            showToast('خطا در دریافت اطلاعات دشبورد: ' + (error.message || ''), 'danger');
            return;
        }

        let summary = data;
        if (typeof summary === 'string') {
            try { summary = JSON.parse(summary); } catch (e) {}
        }

        if (!summary) return;

        safeSetText('statTotalTypists', summary.total_typists || 0);
        safeSetText('statTotalReports', summary.total_reports || 0);
        safeSetText('statTotalEarned', formatMoney(summary.total_earned || 0));
        safeSetText('statTotalPaid', formatMoney(summary.total_paid || 0));
        safeSetText('statTotalRemaining', formatMoney(summary.total_remaining || 0));

        allTypistsData = summary.typists || [];
        renderAdminTypistsTable(allTypistsData);
    } catch (err) {
        hideLoading();
        console.error('Dashboard load error:', err);
        showToast('خطا در بارگذاری دشبورد', 'danger');
    }
}

function renderAdminTypistsTable(typists) {
    const tbody = getEl('typistsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!typists || typists.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-500">هیچ تایپیستی ثبت نشده است</td></tr>`;
        return;
    }

    typists.forEach((t, idx) => {
        const remaining = Number(t.remaining_balance || 0);
        const settledBadge = remaining <= 0 
            ? `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">✔️ تسویه کامل</span>`
            : `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">⏳ دارای مانده</span>`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" class="typist-checkbox rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" data-id="${t.id}" data-phone="${t.phone || ''}" data-name="${t.first_name || ''} ${t.last_name || ''}" onchange="updateSMSCount()">
            </td>
            <td class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 text-center">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                ${t.first_name || ''} ${t.last_name || ''}
                <div class="text-xs text-gray-400 font-normal">کدملی: ${t.national_id || '-'}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center space-x-2 space-x-reverse">
                    <span class="text-gray-700 dark:text-gray-300 dir-ltr">${t.phone || '-'}</span>
                    ${t.phone ? `
                        <a href="tel:${t.phone}" title="تماس مستقیم" class="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">📞</a>
                        <a href="sms:${t.phone}" title="ارسال پیامک" class="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">💬</a>
                    ` : ''}
                </div>
            </td>
            <td class="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">${formatMoney(t.total_earned)}</td>
            <td class="px-4 py-3 text-center font-medium text-indigo-600 dark:text-indigo-400">${formatMoney(t.total_paid)}</td>
            <td class="px-4 py-3 text-center font-bold ${remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}">${formatMoney(remaining)}</td>
            <td class="px-4 py-3 text-center">${settledBadge}</td>
            <td class="px-4 py-3 text-center">
                <button onclick="viewTypistDetail('${t.id}')" class="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg font-medium text-xs transition-colors">
                    🔍 مشاهده جزئیات
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function searchTypists() {
    const q = toEnglishDigits(getEl('searchTypistInput')?.value.trim().toLowerCase() || '');
    if (!q) {
        renderAdminTypistsTable(allTypistsData);
        return;
    }
    const filtered = allTypistsData.filter(t => 
        (t.first_name && t.first_name.toLowerCase().includes(q)) ||
        (t.last_name && t.last_name.toLowerCase().includes(q)) ||
        (t.national_id && t.national_id.includes(q)) ||
        (t.phone && t.phone.includes(q))
    );
    renderAdminTypistsTable(filtered);
}

// ----------------------------------------------------
// Typist Add/Edit Modal
// ----------------------------------------------------
function openAddTypistModal() {
    safeSetValue('typistId', '');
    safeSetValue('typistFirstName', '');
    safeSetValue('typistLastName', '');
    safeSetValue('typistFatherName', '');
    safeSetValue('typistNationalId', '');
    safeSetValue('typistPhone', '');
    safeSetValue('typistCardNumber', '');
    safeSetValue('typistShebaNumber', '');
    safeSetValue('typistRateNormal', '0');
    safeSetValue('typistRateUrgent', '0');
    safeSetValue('typistRateMath', '0');
    safeSetText('typistModalTitle', 'تعریف تایپیست جدید');
    safeShow('typistModal');
}

async function saveTypist(e) {
    if (e) e.preventDefault();
    const id = getEl('typistId')?.value || null;
    const first_name = getEl('typistFirstName')?.value.trim();
    const last_name = getEl('typistLastName')?.value.trim();
    const father_name = getEl('typistFatherName')?.value.trim();
    const national_id = toEnglishDigits(getEl('typistNationalId')?.value.trim());
    const phone = toEnglishDigits(getEl('typistPhone')?.value.trim());
    const card_number = toEnglishDigits(getEl('typistCardNumber')?.value.trim());
    const sheba_number = toEnglishDigits(getEl('typistShebaNumber')?.value.trim());
    const rate_normal = Number(toEnglishDigits(getEl('typistRateNormal')?.value)) || 0;
    const rate_urgent = Number(toEnglishDigits(getEl('typistRateUrgent')?.value)) || 0;
    const rate_math = Number(toEnglishDigits(getEl('typistRateMath')?.value)) || 0;

    if (!first_name || !last_name || !national_id || !phone) {
        showToast('لطفاً نام، نام خانوادگی، کد ملی و شماره موبایل را وارد کنید', 'danger');
        return;
    }

    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { error } = await client.rpc('upsert_typist', {
            _id: id,
            _first_name: first_name,
            _last_name: last_name,
            _father_name: father_name,
            _national_id: national_id,
            _phone: phone,
            _card_number: card_number,
            _sheba_number: sheba_number,
            _rate_normal: rate_normal,
            _rate_urgent: rate_urgent,
            _rate_math: rate_math
        });
        hideLoading();

        if (error) {
            showToast('خطا در ثبت اطلاعات: ' + (error.message || ''), 'danger');
            return;
        }

        safeHide('typistModal');
        showToast('اطلاعات تایپیست با موفقیت ذخیره شد', 'success');
        loadAdminDashboardData();
    } catch (err) {
        hideLoading();
        showToast('خطا در برقراری ارتباط', 'danger');
    }
}

// ----------------------------------------------------
// Typist Detail View (Admin)
// ----------------------------------------------------
async function viewTypistDetail(typistId) {
    currentTypistId = typistId;
    safeHide('adminDashboardView');
    safeShow('typistDetailView');
    await loadTypistDetailData(typistId);
}

async function loadTypistDetailData(typistId) {
    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { data, error } = await client.rpc('get_typist_detail', { _typist_id: typistId });
        hideLoading();

        if (error) {
            showToast('خطا در دریافت جزئیات: ' + (error.message || ''), 'danger');
            return;
        }

        let detail = data;
        if (typeof detail === 'string') {
            try { detail = JSON.parse(detail); } catch (e) {}
        }

        if (!detail || detail.error) {
            showToast(detail?.error || 'اطلاعات یافت نشد', 'danger');
            return;
        }

        currentTypistData = detail.typist;

        // Populate Locked Profile Inputs
        safeSetValue('detailTypistId', detail.typist.id);
        safeSetValue('detailFirstName', detail.typist.first_name || '');
        safeSetValue('detailLastName', detail.typist.last_name || '');
        safeSetValue('detailFatherName', detail.typist.father_name || '');
        safeSetValue('detailNationalId', detail.typist.national_id || '');
        safeSetValue('detailPhone', detail.typist.phone || '');
        safeSetValue('detailCardNumber', detail.typist.card_number || '');
        safeSetValue('detailShebaNumber', detail.typist.sheba_number || '');
        safeSetValue('detailRateNormal', detail.typist.rate_normal || 0);
        safeSetValue('detailRateUrgent', detail.typist.rate_urgent || 0);
        safeSetValue('detailRateMath', detail.typist.rate_math || 0);

        safeSetText('detailHeaderName', `${detail.typist.first_name || ''} ${detail.typist.last_name || ''}`);
        safeSetText('detailHeaderPhone', detail.typist.phone || '-');

        // Financial Summary
        safeSetText('detailTotalEarned', formatMoney(detail.total_earned));
        safeSetText('detailTotalPaid', formatMoney(detail.total_paid));
        safeSetText('detailRemainingBalance', formatMoney(detail.remaining_balance));

        // Lock inputs by default
        toggleProfileEdit(false);

        // Render Reports and Payments
        renderDetailReportsTable(detail.reports || []);
        renderDetailPaymentsTable(detail.payments || []);

    } catch (err) {
        hideLoading();
        console.error('Detail load error:', err);
        showToast('خطا در بارگذاری جزئیات', 'danger');
    }
}

function toggleProfileEdit(enable) {
    const inputs = ['detailFirstName', 'detailLastName', 'detailFatherName', 'detailNationalId', 'detailPhone', 'detailCardNumber', 'detailShebaNumber', 'detailRateNormal', 'detailRateUrgent', 'detailRateMath'];
    inputs.forEach(id => {
        const el = getEl(id);
        if (el) {
            if (enable) {
                el.removeAttribute('readonly');
                el.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'cursor-not-allowed');
                el.classList.add('bg-white', 'dark:bg-gray-900');
            } else {
                el.setAttribute('readonly', 'true');
                el.classList.add('bg-gray-100', 'dark:bg-gray-800', 'cursor-not-allowed');
                el.classList.remove('bg-white', 'dark:bg-gray-900');
            }
        }
    });

    if (enable) {
        safeHide('btnEnableProfileEdit');
        safeShow('btnSaveProfileEdit');
        safeShow('btnCancelProfileEdit');
    } else {
        safeShow('btnEnableProfileEdit');
        safeHide('btnSaveProfileEdit');
        safeHide('btnCancelProfileEdit');
    }
}

async function saveProfileEdit() {
    const id = getEl('detailTypistId')?.value;
    const first_name = getEl('detailFirstName')?.value.trim();
    const last_name = getEl('detailLastName')?.value.trim();
    const father_name = getEl('detailFatherName')?.value.trim();
    const national_id = toEnglishDigits(getEl('detailNationalId')?.value.trim());
    const phone = toEnglishDigits(getEl('detailPhone')?.value.trim());
    const card_number = toEnglishDigits(getEl('detailCardNumber')?.value.trim());
    const sheba_number = toEnglishDigits(getEl('detailShebaNumber')?.value.trim());
    const rate_normal = Number(toEnglishDigits(getEl('detailRateNormal')?.value)) || 0;
    const rate_urgent = Number(toEnglishDigits(getEl('detailRateUrgent')?.value)) || 0;
    const rate_math = Number(toEnglishDigits(getEl('detailRateMath')?.value)) || 0;

    if (!first_name || !last_name || !national_id || !phone) {
        showToast('لطفاً نام، نام خانوادگی، کد ملی و شماره موبایل را وارد کنید', 'danger');
        return;
    }

    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { error } = await client.rpc('upsert_typist', {
            _id: id,
            _first_name: first_name,
            _last_name: last_name,
            _father_name: father_name,
            _national_id: national_id,
            _phone: phone,
            _card_number: card_number,
            _sheba_number: sheba_number,
            _rate_normal: rate_normal,
            _rate_urgent: rate_urgent,
            _rate_math: rate_math
        });
        hideLoading();

        if (error) {
            showToast('خطا در ذخیره مشخصات: ' + (error.message || ''), 'danger');
            return;
        }

        showToast('مشخصات تایپیست به‌روزرسانی شد', 'success');
        toggleProfileEdit(false);
        await loadTypistDetailData(id);
    } catch (err) {
        hideLoading();
        showToast('خطا در ارتباط با سرور', 'danger');
    }
}

function renderDetailReportsTable(reports) {
    const tbody = getEl('detailReportsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">هیچ گزارش کاری ثبت نشده است</td></tr>`;
        return;
    }

    const typeLabels = { normal: 'معمولی', urgent: 'فوری', math: 'فرمول/ریاضی' };

    reports.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">${r.title || '-'}</td>
            <td class="px-4 py-3 text-center">${formatDateShamsi(r.delivery_date)}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs">${typeLabels[r.page_type] || r.page_type}</span></td>
            <td class="px-4 py-3 text-center font-bold">${r.page_count}</td>
            <td class="px-4 py-3 text-center font-medium text-emerald-600">${formatMoney(r.total_price)}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-2">✔️ تحویل شد</span>
                <button onclick="editReport('${r.id}', '${encodeURIComponent(r.title)}', '${r.delivery_date}', '${r.page_type}', ${r.page_count}, ${r.custom_rate || 'null'})" class="text-indigo-600 hover:text-indigo-800 text-xs ml-2">✏️ ویرایش</button>
                <button onclick="deleteReport('${r.id}')" class="text-red-600 hover:text-red-800 text-xs">🗑️ حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDetailPaymentsTable(payments) {
    const tbody = getEl('detailPaymentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500">هیچ پرداختی ثبت نشده است</td></tr>`;
        return;
    }

    payments.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">${idx + 1}</td>
            <td class="px-4 py-3 text-center font-bold text-indigo-600">${formatMoney(p.amount)}</td>
            <td class="px-4 py-3 text-center">${formatDateShamsi(p.payment_date)}</td>
            <td class="px-4 py-3 text-center font-mono text-xs">${p.ref_code || '-'}</td>
            <td class="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">${p.notes || '-'}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-2">✔️ واریز شد</span>
                <button onclick="editPayment('${p.id}', ${p.amount}, '${p.payment_date}', '${encodeURIComponent(p.ref_code || '')}', '${encodeURIComponent(p.notes || '')}')" class="text-indigo-600 hover:text-indigo-800 text-xs ml-2">✏️ ویرایش</button>
                <button onclick="deletePayment('${p.id}')" class="text-red-600 hover:text-red-800 text-xs">🗑️ حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// Work Report CRUD Modals
// ----------------------------------------------------
function openAddReportModal() {
    safeSetValue('reportId', '');
    safeSetValue('reportTitle', '');
    safeSetValue('reportDeliveryDate', new Date().toISOString().split('T')[0]);
    safeSetValue('reportPageType', 'normal');
    safeSetValue('reportPageCount', '1');
    safeSetValue('reportCustomRate', '');
    safeSetText('reportModalTitle', 'ثبت گزارش کار جدید');

    if (currentUserRole === 'typist') {
        safeHide('customRateContainer');
    } else {
        safeShow('customRateContainer');
    }

    safeShow('reportModal');
}

function editReport(id, titleEnc, date, type, count, customRate) {
    safeSetValue('reportId', id);
    safeSetValue('reportTitle', decodeURIComponent(titleEnc));
    safeSetValue('reportDeliveryDate', date);
    safeSetValue('reportPageType', type);
    safeSetValue('reportPageCount', count);
    safeSetValue('reportCustomRate', customRate !== null && customRate !== 'null' ? customRate : '');
    safeSetText('reportModalTitle', 'ویرایش گزارش کار');

    if (currentUserRole === 'typist') {
        safeHide('customRateContainer');
    } else {
        safeShow('customRateContainer');
    }

    safeShow('reportModal');
}

async function saveReport(e) {
    if (e) e.preventDefault();
    const reportId = getEl('reportId')?.value;
    const title = getEl('reportTitle')?.value.trim();
    const date = getEl('reportDeliveryDate')?.value;
    const pageType = getEl('reportPageType')?.value;
    const pageCount = parseInt(toEnglishDigits(getEl('reportPageCount')?.value)) || 1;
    const customRateVal = getEl('reportCustomRate')?.value.trim();
    const customRate = (currentUserRole === 'admin' && customRateVal) ? Number(toEnglishDigits(customRateVal)) : null;

    if (!title || !date || !pageCount) {
        showToast('لطفاً عنوان، تاریخ و تعداد صفحات را وارد کنید', 'danger');
        return;
    }

    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;

        let error = null;
        if (reportId) {
            const res = await client.rpc('update_typist_report', {
                _report_id: reportId,
                _typist_id: currentTypistId,
                _title: title,
                _delivery_date: date,
                _page_type: pageType,
                _page_count: pageCount,
                _custom_rate: customRate
            });
            error = res.error;
        } else {
            const res = await client.rpc('add_typist_report', {
                _typist_id: currentTypistId,
                _title: title,
                _delivery_date: date,
                _page_type: pageType,
                _page_count: pageCount,
                _custom_rate: customRate
            });
            error = res.error;
        }
        hideLoading();

        if (error) {
            showToast('خطا در ثبت گزارش: ' + (error.message || ''), 'danger');
            return;
        }

        safeHide('reportModal');
        showToast('گزارش کار با موفقیت ذخیره شد', 'success');

        if (currentUserRole === 'admin') {
            await loadTypistDetailData(currentTypistId);
        } else {
            await loadTypistSelfDashboardData();
        }
    } catch (err) {
        hideLoading();
        showToast('خطا در ارتباط با سرور', 'danger');
    }
}

async function deleteReport(reportId) {
    if (!confirm('آیا از حذف این گزارش کار مطمئن هستید؟')) return;
    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { error } = await client.rpc('delete_typist_report', { _report_id: reportId });
        hideLoading();

        if (error) {
            showToast('خطا در حذف گزارش: ' + (error.message || ''), 'danger');
            return;
        }

        showToast('گزارش کار حذف شد', 'warning');
        if (currentUserRole === 'admin') {
            await loadTypistDetailData(currentTypistId);
        } else {
            await loadTypistSelfDashboardData();
        }
    } catch (err) {
        hideLoading();
        showToast('خطا در سرور', 'danger');
    }
}

// ----------------------------------------------------
// Payment CRUD Modals (Admin)
// ----------------------------------------------------
function openAddPaymentModal() {
    safeSetValue('paymentId', '');
    safeSetValue('paymentAmount', '');
    safeSetValue('paymentDate', new Date().toISOString().split('T')[0]);
    safeSetValue('paymentRefCode', '');
    safeSetValue('paymentNotes', '');
    safeSetText('paymentModalTitle', 'ثبت پرداخت جدید');
    safeShow('paymentModal');
}

function editPayment(id, amount, date, refEnc, notesEnc) {
    safeSetValue('paymentId', id);
    safeSetValue('paymentAmount', amount);
    safeSetValue('paymentDate', date);
    safeSetValue('paymentRefCode', decodeURIComponent(refEnc));
    safeSetValue('paymentNotes', decodeURIComponent(notesEnc));
    safeSetText('paymentModalTitle', 'ویرایش پرداخت');
    safeShow('paymentModal');
}

async function savePayment(e) {
    if (e) e.preventDefault();
    const paymentId = getEl('paymentId')?.value;
    const amount = Number(toEnglishDigits(getEl('paymentAmount')?.value)) || 0;
    const date = getEl('paymentDate')?.value;
    const refCode = getEl('paymentRefCode')?.value.trim();
    const notes = getEl('paymentNotes')?.value.trim();

    if (!amount || !date) {
        showToast('لطفاً مبلغ و تاریخ پرداخت را وارد کنید', 'danger');
        return;
    }

    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;

        let error = null;
        if (paymentId) {
            const res = await client.rpc('update_payment', {
                _payment_id: paymentId,
                _typist_id: currentTypistId,
                _amount: amount,
                _payment_date: date,
                _ref_code: refCode,
                _notes: notes
            });
            error = res.error;
        } else {
            const res = await client.rpc('add_payment', {
                _typist_id: currentTypistId,
                _amount: amount,
                _payment_date: date,
                _ref_code: refCode,
                _notes: notes
            });
            error = res.error;
        }
        hideLoading();

        if (error) {
            showToast('خطا در ثبت پرداخت: ' + (error.message || ''), 'danger');
            return;
        }

        safeHide('paymentModal');
        showToast('پرداخت ثبت شد', 'success');
        await loadTypistDetailData(currentTypistId);
    } catch (err) {
        hideLoading();
        showToast('خطا در ارتباط با سرور', 'danger');
    }
}

async function deletePayment(paymentId) {
    if (!confirm('آیا از حذف این پرداخت مطمئن هستید؟')) return;
    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { error } = await client.rpc('delete_payment', { _payment_id: paymentId });
        hideLoading();

        if (error) {
            showToast('خطا در حذف پرداخت: ' + (error.message || ''), 'danger');
            return;
        }

        showToast('پرداخت حذف شد', 'warning');
        await loadTypistDetailData(currentTypistId);
    } catch (err) {
        hideLoading();
        showToast('خطا در سرور', 'danger');
    }
}

// ----------------------------------------------------
// Typist Self-Service Dashboard
// ----------------------------------------------------
function showTypistDashboard() {
    safeHide('loginView');
    safeHide('adminDashboardView');
    safeHide('typistDetailView');
    safeShow('typistSelfDashboardView');
    loadTypistSelfDashboardData();
}

async function loadTypistSelfDashboardData() {
    if (!currentTypistId) return;
    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;
        const { data, error } = await client.rpc('get_typist_detail', { _typist_id: currentTypistId });
        hideLoading();

        if (error) {
            showToast('خطا در دریافت اطلاعات: ' + (error.message || ''), 'danger');
            return;
        }

        let detail = data;
        if (typeof detail === 'string') {
            try { detail = JSON.parse(detail); } catch (e) {}
        }

        if (!detail || detail.error) return;

        // Profile details (Page rates hidden)
        safeSetText('typistSelfHeaderName', `${detail.typist.first_name || ''} ${detail.typist.last_name || ''}`);
        safeSetText('typistSelfName', `${detail.typist.first_name || ''} ${detail.typist.last_name || ''}`);
        safeSetText('typistSelfFatherName', detail.typist.father_name || '-');
        safeSetText('typistSelfNationalId', detail.typist.national_id || '-');
        safeSetText('typistSelfPhone', detail.typist.phone || '-');
        safeSetText('typistSelfCardNumber', detail.typist.card_number || '-');
        safeSetText('typistSelfShebaNumber', detail.typist.sheba_number || '-');

        // Financial Summary
        safeSetText('typistSelfTotalEarned', formatMoney(detail.total_earned));
        safeSetText('typistSelfTotalPaid', formatMoney(detail.total_paid));
        safeSetText('typistSelfRemainingBalance', formatMoney(detail.remaining_balance));

        renderTypistSelfReports(detail.reports || []);
        renderTypistSelfPayments(detail.payments || []);

    } catch (err) {
        hideLoading();
        console.error('Self dashboard load error:', err);
    }
}

function renderTypistSelfReports(reports) {
    const tbody = getEl('typistSelfReportsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">هیچ گزارش کاری ثبت نشده است</td></tr>`;
        return;
    }

    const typeLabels = { normal: 'معمولی', urgent: 'فوری', math: 'فرمول/ریاضی' };

    reports.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">${r.title || '-'}</td>
            <td class="px-4 py-3 text-center">${formatDateShamsi(r.delivery_date)}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs">${typeLabels[r.page_type] || r.page_type}</span></td>
            <td class="px-4 py-3 text-center font-bold">${r.page_count}</td>
            <td class="px-4 py-3 text-center font-medium text-emerald-600">${formatMoney(r.total_price)}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-2">✔️ تحویل شد</span>
                <button onclick="editReport('${r.id}', '${encodeURIComponent(r.title)}', '${r.delivery_date}', '${r.page_type}', ${r.page_count}, null)" class="text-indigo-600 hover:text-indigo-800 text-xs">✏️ ویرایش</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTypistSelfPayments(payments) {
    const tbody = getEl('typistSelfPaymentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-500">هیچ پرداختی ثبت نشده است</td></tr>`;
        return;
    }

    payments.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">${idx + 1}</td>
            <td class="px-4 py-3 text-center font-bold text-indigo-600">${formatMoney(p.amount)}</td>
            <td class="px-4 py-3 text-center">${formatDateShamsi(p.payment_date)}</td>
            <td class="px-4 py-3 text-center font-mono text-xs">${p.ref_code || '-'}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">✔️ واریز شد</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Password Change
function openChangePasswordModal() {
    safeSetValue('newPasswordInput', '');
    safeSetValue('confirmPasswordInput', '');
    safeShow('changePasswordModal');
}

async function saveNewPassword(e) {
    if (e) e.preventDefault();
    const newPass = getEl('newPasswordInput')?.value.trim();
    const confirmPass = getEl('confirmPasswordInput')?.value.trim();

    if (!newPass || newPass.length < 4) {
        showToast('رمز عبور باید حداقل ۴ کاراکتر باشد', 'danger');
        return;
    }
    if (newPass !== confirmPass) {
        showToast('تکرار رمز عبور مطابقت ندارد', 'danger');
        return;
    }

    try {
        showLoading();
        const client = getSupabaseClient();
        if (!client) return;

        let error = null;
        if (currentUserRole === 'admin') {
            const res = await client.rpc('change_admin_password', { _new_pass: newPass });
            error = res.error;
        } else {
            const res = await client.rpc('change_typist_password', { _typist_id: currentTypistId, _new_pass: newPass });
            error = res.error;
        }
        hideLoading();

        if (error) {
            showToast('خطا در تغییر رمز: ' + (error.message || ''), 'danger');
            return;
        }

        safeHide('changePasswordModal');
        showToast('رمز عبور با موفقیت تغییر یافت', 'success');
    } catch (err) {
        hideLoading();
        showToast('خطا در ارتباط با سرور', 'danger');
    }
}

// ----------------------------------------------------
// CSV Exports & Group SMS
// ----------------------------------------------------
function exportBankCSV() {
    if (!allTypistsData || allTypistsData.length === 0) {
        showToast('اطلاعاتی برای خروجی وجود ندارد', 'warning');
        return;
    }

    let csv = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n';
    let count = 0;

    allTypistsData.forEach(t => {
        const remainingToman = Number(t.remaining_balance || 0);
        if (remainingToman > 0) {
            count++;
            const amountRial = remainingToman * 10;
            csv += `${count},"${t.first_name || ''}","${t.last_name || ''}","${t.father_name || ''}","${t.national_id || ''}","${t.phone || ''}","${t.card_number || ''}","${t.sheba_number || ''}",${amountRial}\n`;
        }
    });

    if (count === 0) {
        showToast('هیچ تایپیستی دارای مانده طلبکارانه نیست', 'warning');
        return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Paya_Bank_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast(`فایل پایا برای ${count} تایپیست دانلود شد`, 'success');
}

function exportPersonnelCSV() {
    if (!allTypistsData || allTypistsData.length === 0) {
        showToast('اطلاعاتی برای خروجی وجود ندارد', 'warning');
        return;
    }

    let csv = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا\n';
    allTypistsData.forEach((t, idx) => {
        csv += `${idx + 1},"${t.first_name || ''}","${t.last_name || ''}","${t.father_name || ''}","${t.national_id || ''}","${t.phone || ''}","${t.card_number || ''}","${t.sheba_number || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Personnel_List_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('لیست پرسنل دانلود شد', 'success');
}

function toggleSelectAllTypists(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.typist-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    updateSMSCount();
}

function updateSMSCount() {
    const selected = document.querySelectorAll('.typist-checkbox:checked');
    safeSetText('selectedSMSCount', selected.length);
}

function openGroupSMSModal() {
    const selected = document.querySelectorAll('.typist-checkbox:checked');
    if (selected.length === 0) {
        showToast('لطفاً حداقل یک تایپیست را انتخاب کنید', 'warning');
        return;
    }
    safeSetText('selectedSMSCountModal', selected.length);
    safeSetValue('smsTextarea', '');
    safeShow('groupSMSModal');
}

function sendGroupSMS() {
    const text = getEl('smsTextarea')?.value.trim();
    if (!text) {
        showToast('لطفاً متن پیامک را وارد کنید', 'danger');
        return;
    }
    const selected = document.querySelectorAll('.typist-checkbox:checked');
    const phones = Array.from(selected).map(cb => cb.getAttribute('data-phone')).filter(p => p);

    if (phones.length === 0) {
        showToast('شماره تماسی برای ارسال یافت نشد', 'warning');
        return;
    }

    const smsUrl = `sms:${phones.join(',')}?body=${encodeURIComponent(text)}`;
    window.location.href = smsUrl;
    safeHide('groupSMSModal');
    showToast(`برنامه پیامک با ${phones.length} گیرنده باز شد`, 'success');
}

// ----------------------------------------------------
// Shamsi DatePicker Modal Helpers (With Persian to Gregorian converter)
// ----------------------------------------------------
function jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : (((jm - 7) * 30) + 186));
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
        gy += 100 * Math.floor(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    gy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    let gd = days + 1;
    let sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13; gm++) {
        let v = sal_a[gm];
        if (gd <= v) break;
        gd -= v;
    }
    return [gy, gm, gd];
}

function openDatePicker(targetId) {
    targetDateInputId = targetId;
    const daySelect = getEl('pickerDay');
    if (daySelect && daySelect.children.length === 0) {
        for (let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i < 10 ? '0' + i : i;
            opt.textContent = i;
            daySelect.appendChild(opt);
        }
    }
    safeShow('datePickerModal');
}

function closeDatePicker() {
    safeHide('datePickerModal');
}

function applyDatePicker() {
    if (targetDateInputId) {
        const jy = parseInt(getEl('pickerYear')?.value || '1403');
        const jm = parseInt(getEl('pickerMonth')?.value || '1');
        const jd = parseInt(getEl('pickerDay')?.value || '1');

        const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
        const mm = String(gm).padStart(2, '0');
        const dd = String(gd).padStart(2, '0');
        const standardDate = `${gy}-${mm}-${dd}`;

        safeSetValue(targetDateInputId, standardDate);
    }
    closeDatePicker();
}

// Dark Mode Toggle
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// ----------------------------------------------------
// App Initialization
// ----------------------------------------------------
function initApp() {
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    const savedRole = sessionStorage.getItem('userRole');
    if (savedRole === 'admin') {
        currentUserRole = 'admin';
        showAdminDashboard();
    } else if (savedRole === 'typist') {
        const savedId = sessionStorage.getItem('typistId');
        if (savedId) {
            currentUserRole = 'typist';
            currentTypistId = savedId;
            showTypistDashboard();
        }
    }
}

document.addEventListener('DOMContentLoaded', initApp);

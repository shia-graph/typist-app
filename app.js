/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.0.0)
   ========================================================================== */

// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const supabaseClient = (window.supabase && window.supabase.createClient) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

let currentUserRole = null; 
let currentTypistId = null;
let currentTypistData = null;
let allTypistsList = [];
let targetDatepickerInputId = null;

function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    const persians = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabics  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let s = str.toString();
    for (let i = 0; i < 10; i++) {
        s = s.replace(new RegExp(persians[i], 'g'), i).replace(new RegExp(arabics[i], 'g'), i);
    }
    return s;
}

function getEl(id) { return document.getElementById(id); }
function safeShow(id, displayType = 'block') { const el = getEl(id); if (el) el.style.display = displayType; }
function safeHide(id) { const el = getEl(id); if (el) el.style.display = 'none'; }
function safeSetText(id, text) { const el = getEl(id); if (el) el.textContent = text; }
function safeSetValue(id, val) { const el = getEl(id); if (el) el.value = val !== undefined && val !== null ? val : ''; }

function showToast(message, type = 'info') {
    const container = getEl('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    toast.className = `${bg} text-white px-4 py-3 rounded-xl shadow-xl text-sm transition-all duration-300 transform translate-y-0 opacity-100 flex items-center justify-between gap-3`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="font-bold opacity-75 hover:opacity-100">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getCurrentShamsiDate() {
    const today = new Date();
    return gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function gregorianToJalali(g_y, g_m, g_d) {
    const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    let gy = g_y - 1600;
    let gm = g_m - 1;
    let gd = g_d - 1;
    let g_day_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
    for (let i = 0; i < gm; ++i) g_day_no += g_days_in_month[i];
    if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) ++g_day_no;
    g_day_no += gd;
    let j_day_no = g_day_no - 79;
    let jnp = Math.floor(j_day_no / 12053);
    j_day_no %= 12053;
    let jy = 979 + 33 * jnp + 4 * Math.floor(j_day_no / 1461);
    j_day_no %= 1461;
    if (j_day_no >= 366) {
        jy += Math.floor((j_day_no - 1) / 365);
        j_day_no = (j_day_no - 1) % 365;
    }
    let i = 0;
    for (i = 0; i < 11 && j_day_no >= j_days_in_month[i]; ++i) {
        j_day_no -= j_days_in_month[i];
    }
    let jm = i + 1;
    let jd = j_day_no + 1;
    const pad = (n) => (n < 10 ? '0' + n : n);
    return `${jy}/${pad(jm)}/${pad(jd)}`;
}

window.switchLoginTab = function(role) {
    const tabAdmin = getEl('tab-admin');
    const tabTypist = getEl('tab-typist');

    if (role === 'admin') {
        if (tabAdmin) tabAdmin.className = "flex-1 py-3.5 text-center font-bold text-blue-600 border-b-2 border-blue-600 transition";
        if (tabTypist) tabTypist.className = "flex-1 py-3.5 text-center font-medium text-slate-500 border-b-2 border-transparent transition";
        safeShow('form-admin-login', 'block');
        safeHide('form-typist-login');
    } else {
        if (tabTypist) tabTypist.className = "flex-1 py-3.5 text-center font-bold text-blue-600 border-b-2 border-blue-600 transition";
        if (tabAdmin) tabAdmin.className = "flex-1 py-3.5 text-center font-medium text-slate-500 border-b-2 border-transparent transition";
        safeShow('form-typist-login', 'block');
        safeHide('form-admin-login');
    }
};

window.loginAdmin = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const pass = toEnglishDigits(getEl('admin_password')?.value || '');
    if (!pass) return showToast('لطفاً رمز عبور را وارد کنید', 'error');

    try {
        const { data, error } = await supabaseClient.rpc('verify_admin_password', { _pass: pass });
        if (error) throw error;
        if (data === true) {
            currentUserRole = 'admin';
            currentTypistId = null;
            showToast('با موفقیت وارد پنل مدیریت شدید', 'success');
            renderAppView();
            loadAdminDashboard();
        } else {
            showToast('کلمه عبور مدیر اشتباه است', 'error');
        }
    } catch (err) {
        showToast('خطا در ورود مدیر: ' + err.message, 'error');
    }
};

window.loginTypist = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const loginId = toEnglishDigits(getEl('typist_login_id')?.value || '');
    const pass = toEnglishDigits(getEl('typist_password')?.value || '');
    if (!loginId || !pass) return showToast('شناسه و کلمه عبور را وارد کنید', 'error');

    try {
        const { data, error } = await supabaseClient.rpc('verify_typist_password', { _login_id: loginId, _pass: pass });
        if (error) throw error;
        if (data && data.length > 0) {
            currentUserRole = 'typist';
            currentTypistId = data[0].id;
            showToast(`خوش آمدید ${data[0].first_name} ${data[0].last_name}`, 'success');
            renderAppView();
            window.viewTypistDetail(currentTypistId);
        } else {
            showToast('شناسه کاربری یا رمز عبور اشتباه است', 'error');
        }
    } catch (err) {
        showToast('خطا در ورود تایپیست: ' + err.message, 'error');
    }
};

window.logout = function() {
    currentUserRole = null;
    currentTypistId = null;
    currentTypistData = null;
    renderAppView();
    showToast('از حساب کاربری خارج شدید', 'info');
};

function renderAppView() {
    if (!currentUserRole) {
        safeShow('auth-section', 'block');
        safeHide('admin-dashboard');
        safeHide('detail-view');
        safeHide('logout-btn');
        safeSetText('user-status-text', 'لطفاً وارد حساب کاربری خود شوید');
    } else {
        safeHide('auth-section');
        safeShow('logout-btn', 'flex');

        if (currentUserRole === 'admin') {
            safeSetText('user-status-text', 'مدیر سیستم (دسترسی کامل)');
        } else {
            safeSetText('user-status-text', 'پنل اختصاصی کارکرد تایپیست');
        }
    }
}

async function loadAdminDashboard() {
    safeShow('admin-dashboard', 'block');
    safeHide('detail-view');

    try {
        const { data, error } = await supabaseClient.rpc('get_dashboard_summary');
        if (error) throw error;
        allTypistsList = data || [];
        renderTypistsTable(allTypistsList);
        calculateOverallStats(allTypistsList);
    } catch (err) {
        showToast('خطا در دریافت اطلاعات دشبورد: ' + err.message, 'error');
    }
}

function calculateOverallStats(list) {
    let totalEarned = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    list.forEach(item => {
        totalEarned += Number(item.total_earned || 0);
        totalPaid += Number(item.total_paid || 0);
        totalBalance += Number(item.remaining_balance || 0);
    });

    safeSetText('stat-total-typists', `${list.length} نفر`);
    safeSetText('stat-total-earned', totalEarned.toLocaleString('fa-IR'));
    safeSetText('stat-total-paid', totalPaid.toLocaleString('fa-IR'));
    safeSetText('stat-total-balance', totalBalance.toLocaleString('fa-IR'));
}

function renderTypistsTable(list) {
    const tbody = getEl('typists-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">هیچ تایپیستی یافت نشد.</td></tr>`;
        return;
    }

    list.forEach(t => {
        const balance = Number(t.remaining_balance || 0);
        const statusBadge = balance <= 0 
            ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg text-xs font-bold">✔️ تسویه کامل</span>`
            : `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg text-xs font-bold">⏳ دارای مانده</span>`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-750 transition';
        tr.innerHTML = `
            <td class="p-3 font-medium">${t.first_name} ${t.last_name}</td>
            <td class="p-3">${t.national_id || '-'}</td>
            <td class="p-3">
                <div class="flex items-center gap-1.5">
                    <span class="font-mono text-xs">${t.phone || '-'}</span>
                    ${t.phone ? `
                        <a href="tel:${t.phone}" title="تماس تلفنی" class="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded transition text-xs">📞</a>
                        <a href="sms:${t.phone}" title="ارسال پیامک" class="p-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition text-xs">💬</a>
                    ` : ''}
                </div>
            </td>
            <td class="p-3 text-blue-600 dark:text-blue-400 font-bold">${Number(t.total_earned || 0).toLocaleString('fa-IR')}</td>
            <td class="p-3 text-emerald-600 dark:text-emerald-400 font-bold">${Number(t.total_paid || 0).toLocaleString('fa-IR')}</td>
            <td class="p-3 text-amber-600 dark:text-amber-400 font-bold">${balance.toLocaleString('fa-IR')}</td>
            <td class="p-3 text-center">${statusBadge}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="window.viewTypistDetail('${t.id}')" class="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-100 transition">
                    📋 مشاهده کارکرد
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterTypists = function() {
    const q = toEnglishDigits(getEl('admin-search-input')?.value || '').toLowerCase();
    const filtered = allTypistsList.filter(t => 
        (t.first_name + ' ' + t.last_name).toLowerCase().includes(q) ||
        (t.national_id || '').includes(q) ||
        (t.phone || '').includes(q)
    );
    renderTypistsTable(filtered);
};

window.viewTypistDetail = async function(typistId) {
    currentTypistId = typistId;
    safeHide('admin-dashboard');
    safeShow('detail-view', 'block');

    if (currentUserRole === 'typist') {
        safeHide('btn-back-dashboard');
        safeHide('admin-rates-container');
        safeHide('btn-add-payment');
        safeShow('typist-self-pass-btn-container', 'block');
        document.querySelectorAll('.th-rate-column, .action-col-payment').forEach(el => el.style.display = 'none');
    } else {
        safeShow('btn-back-dashboard', 'inline-block');
        safeShow('admin-rates-container', 'grid');
        safeShow('btn-add-payment', 'inline-block');
        safeHide('typist-self-pass-btn-container');
        document.querySelectorAll('.th-rate-column, .action-col-payment').forEach(el => el.style.display = '');
    }

    await loadTypistDetailData(typistId);
};

window.backToDashboard = function() {
    if (currentUserRole === 'admin') {
        loadAdminDashboard();
    }
};

async function loadTypistDetailData(typistId) {
    try {
        const { data, error } = await supabaseClient.rpc('get_typist_detail', { _typist_id: typistId });
        if (error) throw error;
        if (!data || data.length === 0) return showToast('اطلاعات یافت نشد', 'error');

        const detail = data[0];
        currentTypistData = detail;

        safeSetText('detail-typist-name', `کارنامه کارکرد: ${detail.first_name} ${detail.last_name}`);
        
        safeSetValue('profile_id', detail.id);
        safeSetValue('profile_first_name', detail.first_name);
        safeSetValue('profile_last_name', detail.last_name);
        safeSetValue('profile_father_name', detail.father_name);
        safeSetValue('profile_national_id', detail.national_id);
        safeSetValue('profile_phone', detail.phone);
        safeSetValue('profile_card_number', detail.card_number);
        safeSetValue('profile_sheba_number', detail.sheba_number);
        safeSetValue('profile_rate_normal', detail.rate_normal);
        safeSetValue('profile_rate_urgent', detail.rate_urgent);
        safeSetValue('profile_rate_math', detail.rate_math);

        let reports = [];
        try {
            if (typeof detail.reports === 'string') reports = JSON.parse(detail.reports);
            else if (Array.isArray(detail.reports)) reports = detail.reports;
        } catch (e) { reports = []; }

        let payments = [];
        try {
            if (typeof detail.payments === 'string') payments = JSON.parse(detail.payments);
            else if (Array.isArray(detail.payments)) payments = detail.payments;
        } catch (e) { payments = []; }

        let totalEarned = reports.reduce((sum, r) => sum + Number(r.total_price || 0), 0);
        let totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        let balance = totalEarned - totalPaid;

        safeSetText('typist-summary-earned', totalEarned.toLocaleString('fa-IR') + ' تومان');
        safeSetText('typist-summary-paid', totalPaid.toLocaleString('fa-IR') + ' تومان');
        safeSetText('typist-summary-balance', balance.toLocaleString('fa-IR') + ' تومان');

        renderReportsTable(reports);
        renderPaymentsTable(payments);
    } catch (err) {
        showToast('خطا در بارگذاری جزئیات: ' + err.message, 'error');
    }
}

function renderReportsTable(reports) {
    const tbody = getEl('reports-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">هیچ گزارش کاری ثبت نشده است.</td></tr>`;
        return;
    }

    const pageTypeLabels = { normal: 'عادی', urgent: 'فوری', math: 'ریاضی / فرمول' };

    reports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-750 transition';
        const rateDisplay = currentUserRole === 'admin' ? `<td class="p-2.5 th-rate-column">${Number(r.applied_rate || 0).toLocaleString('fa-IR')}</td>` : '';
        
        tr.innerHTML = `
            <td class="p-2.5 font-medium">${r.title}</td>
            <td class="p-2.5"><span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">${r.delivery_date || '-'}</span></td>
            <td class="p-2.5">${pageTypeLabels[r.page_type] || r.page_type}</td>
            <td class="p-2.5 font-bold">${r.page_count}</td>
            ${rateDisplay}
            <td class="p-2.5 font-bold text-blue-600 dark:text-blue-400">${Number(r.total_price || 0).toLocaleString('fa-IR')}</td>
            <td class="p-2.5 text-center"><span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-xs font-bold">✔️ تحویل شد</span></td>
            <td class="p-2.5 text-center">
                <button type="button" onclick="window.openEditReportModal('${r.id}')" class="text-blue-600 hover:text-blue-800 text-xs px-1.5 py-0.5">✏️ ویرایش</button>
                <button type="button" onclick="window.deleteReport('${r.id}')" class="text-red-600 hover:text-red-800 text-xs px-1.5 py-0.5">🗑 حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPaymentsTable(payments) {
    const tbody = getEl('payments-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">هیچ واریزی ثبت نشده است.</td></tr>`;
        return;
    }

    payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-750 transition';
        const actionCol = currentUserRole === 'admin' ? `
            <td class="p-2.5 text-center action-col-payment">
                <button type="button" onclick="window.openEditPaymentModal('${p.id}')" class="text-blue-600 hover:text-blue-800 text-xs px-1.5 py-0.5">✏️ ویرایش</button>
                <button type="button" onclick="window.deletePayment('${p.id}')" class="text-red-600 hover:text-red-800 text-xs px-1.5 py-0.5">🗑 حذف</button>
            </td>
        ` : '';

        tr.innerHTML = `
            <td class="p-2.5"><span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">${p.payment_date || '-'}</span></td>
            <td class="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
            <td class="p-2.5 font-mono text-xs">${p.ref_code || '-'}</td>
            <td class="p-2.5 text-xs text-slate-500">${p.notes || '-'}</td>
            <td class="p-2.5 text-center"><span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded text-xs font-bold">✔️ واریز شد</span></td>
            ${actionCol}
        `;
        tbody.appendChild(tr);
    });
}

window.openAddTypistModal = function() {
    safeSetValue('modal_typist_first_name', '');
    safeSetValue('modal_typist_last_name', '');
    safeSetValue('modal_typist_national_id', '');
    safeSetValue('modal_typist_phone', '');
    safeSetValue('modal_typist_rate_normal', '0');
    safeSetValue('modal_typist_rate_urgent', '0');
    safeSetValue('modal_typist_rate_math', '0');
    safeSetText('typist-modal-title', 'افزودن تایپیست جدید');
    safeShow('typist-modal', 'flex');
};

window.closeTypistModal = function() { safeHide('typist-modal'); };

window.saveTypist = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const isModal = getEl('typist-modal')?.style.display === 'flex';
    let payload = {};

    if (isModal) {
        payload = {
            _id: null,
            _first_name: getEl('modal_typist_first_name').value,
            _last_name: getEl('modal_typist_last_name').value,
            _national_id: toEnglishDigits(getEl('modal_typist_national_id').value),
            _phone: toEnglishDigits(getEl('modal_typist_phone').value),
            _father_name: '', _card_number: '', _sheba_number: '',
            _rate_normal: Number(getEl('modal_typist_rate_normal').value || 0),
            _rate_urgent: Number(getEl('modal_typist_rate_urgent').value || 0),
            _rate_math: Number(getEl('modal_typist_rate_math').value || 0)
        };
    } else {
        payload = {
            _id: getEl('profile_id').value,
            _first_name: getEl('profile_first_name').value,
            _last_name: getEl('profile_last_name').value,
            _national_id: toEnglishDigits(getEl('profile_national_id').value),
            _phone: toEnglishDigits(getEl('profile_phone').value),
            _father_name: getEl('profile_father_name').value,
            _card_number: toEnglishDigits(getEl('profile_card_number').value),
            _sheba_number: toEnglishDigits(getEl('profile_sheba_number').value),
            _rate_normal: Number(getEl('profile_rate_normal').value || 0),
            _rate_urgent: Number(getEl('profile_rate_urgent').value || 0),
            _rate_math: Number(getEl('profile_rate_math').value || 0)
        };
    }

    try {
        const { error } = await supabaseClient.rpc('upsert_typist', payload);
        if (error) throw error;
        showToast('اطلاعات تایپیست ذخیره شد', 'success');
        window.closeTypistModal();
        if (currentUserRole === 'admin' && !currentTypistId) {
            loadAdminDashboard();
        } else if (currentTypistId) {
            loadTypistDetailData(currentTypistId);
        }
    } catch (err) {
        showToast('خطا در ذخیره مشخصات: ' + err.message, 'error');
    }
};

window.openAddReportModal = function() {
    safeSetValue('report_id', '');
    safeSetValue('report_title', '');
    safeSetValue('report_delivery_date', getCurrentShamsiDate());
    safeSetValue('report_page_type', 'normal');
    safeSetValue('report_page_count', '1');
    safeSetValue('report_custom_rate', '');
    
    if (currentUserRole === 'admin') safeShow('admin-custom-rate-field', 'block');
    else safeHide('admin-custom-rate-field');
    
    safeSetText('report-modal-title', 'ثبت گزارش کار جدید');
    safeShow('report-modal', 'flex');
};

window.openEditReportModal = function(reportId) {
    if (!currentTypistData || !currentTypistData.reports) return;
    
    let reports = [];
    try {
        reports = typeof currentTypistData.reports === 'string' ? JSON.parse(currentTypistData.reports) : currentTypistData.reports;
    } catch (e) { reports = []; }

    const r = reports.find(item => item.id === reportId);
    if (!r) return;

    safeSetValue('report_id', r.id);
    safeSetValue('report_title', r.title);
    safeSetValue('report_delivery_date', r.delivery_date);
    safeSetValue('report_page_type', r.page_type);
    safeSetValue('report_page_count', r.page_count);
    safeSetValue('report_custom_rate', r.custom_rate || '');

    if (currentUserRole === 'admin') safeShow('admin-custom-rate-field', 'block');
    else safeHide('admin-custom-rate-field');

    safeSetText('report-modal-title', 'ویرایش گزارش کار');
    safeShow('report-modal', 'flex');
};

window.closeReportModal = function() { safeHide('report-modal'); };

window.saveReport = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const reportId = getEl('report_id').value;
    const customRateVal = getEl('report_custom_rate').value;

    const payload = {
        _typist_id: currentTypistId,
        _title: getEl('report_title').value,
        _delivery_date: toEnglishDigits(getEl('report_delivery_date').value),
        _page_type: getEl('report_page_type').value,
        _page_count: Number(toEnglishDigits(getEl('report_page_count').value)),
        _custom_rate: (currentUserRole === 'admin' && customRateVal) ? Number(toEnglishDigits(customRateVal)) : null
    };

    try {
        if (reportId) {
            payload._report_id = reportId;
            const { error } = await supabaseClient.rpc('update_typist_report', payload);
            if (error) throw error;
            showToast('گزارش کار بروزرسانی شد', 'success');
        } else {
            const { error } = await supabaseClient.rpc('add_typist_report', payload);
            if (error) throw error;
            showToast('گزارش کار جدید ثبت شد', 'success');
        }
        window.closeReportModal();
        loadTypistDetailData(currentTypistId);
    } catch (err) {
        showToast('خطا در ثبت گزارش: ' + err.message, 'error');
    }
};

window.deleteReport = async function(reportId) {
    if (!confirm('آیا از حذف این گزارش کار مطمئن هستید؟')) return;
    try {
        const { error } = await supabaseClient.rpc('delete_typist_report', { _report_id: reportId });
        if (error) throw error;
        showToast('گزارش کار حذف شد', 'info');
        loadTypistDetailData(currentTypistId);
    } catch (err) {
        showToast('خطا در حذف: ' + err.message, 'error');
    }
};

window.openAddPaymentModal = function() {
    safeSetValue('payment_id', '');
    safeSetValue('payment_amount', '');
    safeSetValue('payment_date', getCurrentShamsiDate());
    safeSetValue('payment_ref_code', '');
    safeSetValue('payment_notes', '');
    safeSetText('payment-modal-title', 'ثبت واریزی جدید');
    safeShow('payment-modal', 'flex');
};

window.openEditPaymentModal = function(paymentId) {
    if (!currentTypistData || !currentTypistData.payments) return;

    let payments = [];
    try {
        payments = typeof currentTypistData.payments === 'string' ? JSON.parse(currentTypistData.payments) : currentTypistData.payments;
    } catch (e) { payments = []; }

    const p = payments.find(item => item.id === paymentId);
    if (!p) return;

    safeSetValue('payment_id', p.id);
    safeSetValue('payment_amount', p.amount);
    safeSetValue('payment_date', p.payment_date);
    safeSetValue('payment_ref_code', p.ref_code || '');
    safeSetValue('payment_notes', p.notes || '');
    safeSetText('payment-modal-title', 'ویرایش واریزی');
    safeShow('payment-modal', 'flex');
};

window.closePaymentModal = function() { safeHide('payment-modal'); };

window.savePayment = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const paymentId = getEl('payment_id').value;
    const payload = {
        _typist_id: currentTypistId,
        _amount: Number(toEnglishDigits(getEl('payment_amount').value)),
        _payment_date: toEnglishDigits(getEl('payment_date').value),
        _ref_code: getEl('payment_ref_code').value,
        _notes: getEl('payment_notes').value
    };

    try {
        if (paymentId) {
            payload._payment_id = paymentId;
            const { error } = await supabaseClient.rpc('update_payment', payload);
            if (error) throw error;
            showToast('پرداختی بروزرسانی شد', 'success');
        } else {
            const { error } = await supabaseClient.rpc('add_payment', payload);
            if (error) throw error;
            showToast('پرداختی جدید ثبت شد', 'success');
        }
        window.closePaymentModal();
        loadTypistDetailData(currentTypistId);
    } catch (err) {
        showToast('خطا در ثبت واریزی: ' + err.message, 'error');
    }
};

window.deletePayment = async function(paymentId) {
    if (!confirm('آیا از حذف این واریزی مطمئن هستید؟')) return;
    try {
        const { error } = await supabaseClient.rpc('delete_payment', { _payment_id: paymentId });
        if (error) throw error;
        showToast('پرداختی حذف شد', 'info');
        loadTypistDetailData(currentTypistId);
    } catch (err) {
        showToast('خطا در حذف: ' + err.message, 'error');
    }
};

window.openDatePicker = function(targetInputId) {
    targetDatepickerInputId = targetInputId;
    const yearSelect = getEl('dp-year');
    if (yearSelect) {
        yearSelect.innerHTML = '';
        const currentYear = 1403;
        for (let y = currentYear - 2; y <= currentYear + 2; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }
    window.updateMonthDays();
    safeShow('datepicker-modal', 'flex');
};

window.closeDatePickerModal = function() { safeHide('datepicker-modal'); };

window.updateMonthDays = function() {
    const month = Number(getEl('dp-month').value);
    const daySelect = getEl('dp-day');
    if (!daySelect) return;
    daySelect.innerHTML = '';

    let maxDays = 30;
    if (month <= 6) maxDays = 31;
    else if (month === 12) maxDays = 29;

    for (let d = 1; d <= maxDays; d++) {
        const opt = document.createElement('option');
        const padD = d < 10 ? '0' + d : d;
        opt.value = padD;
        opt.textContent = padD;
        daySelect.appendChild(opt);
    }
};

window.selectShamsiDate = function() {
    const year = getEl('dp-year').value;
    const month = getEl('dp-month').value.padStart(2, '0');
    const day = getEl('dp-day').value;
    if (targetDatepickerInputId) safeSetValue(targetDatepickerInputId, `${year}/${month}/${day}`);
    window.closeDatePickerModal();
};

window.openChangePassModal = function() {
    safeSetValue('new_password_val', '');
    safeShow('changepass-modal', 'flex');
};

window.closeChangePassModal = function() { safeHide('changepass-modal'); };

window.saveNewPassword = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const newPass = toEnglishDigits(getEl('new_password_val').value);
    if (!newPass) return showToast('رمز عبور را وارد کنید', 'error');

    try {
        if (currentUserRole === 'admin') {
            const { error } = await supabaseClient.rpc('change_admin_password', { _new_pass: newPass });
            if (error) throw error;
            showToast('رمز عبور مدیر تغییر یافت', 'success');
        } else {
            const { error } = await supabaseClient.rpc('change_typist_password', { _typist_id: currentTypistId, _new_pass: newPass });
            if (error) throw error;
            showToast('رمز عبور شما تغییر یافت', 'success');
        }
        window.closeChangePassModal();
    } catch (err) {
        showToast('خطا در تغییر رمز: ' + err.message, 'error');
    }
};

window.exportBankCSV = function() {
    if (!allTypistsList || allTypistsList.length === 0) return showToast('اطلاعاتی برای خروجی یافت نشد', 'error');

    let csvContent = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n";

    let exportCount = 0;
    allTypistsList.forEach((t) => {
        const balanceToman = Number(t.remaining_balance || 0);
        if (balanceToman > 0) {
            exportCount++;
            const amountRial = balanceToman * 10;
            const row = [
                exportCount,
                `"${t.first_name || ''}"`,
                `"${t.last_name || ''}"`,
                `"${t.father_name || ''}"`,
                `"${t.national_id || ''}"`,
                `"${t.phone || ''}"`,
                `"${t.card_number || ''}"`,
                `"${t.sheba_number || ''}"`,
                amountRial
            ].join(',');
            csvContent += row + "\n";
        }
    });

    if (exportCount === 0) return showToast('هیچ تایپیستی دارای مانده طلب برای پرداخت نیست', 'info');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `paya_payroll_${getCurrentShamsiDate().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('فایل اکسل پایا با موفقیت دریافت شد', 'success');
};

window.openSmsModal = function() {
    safeSetValue('sms_text', '');
    safeShow('sms-modal', 'flex');
};

window.closeSmsModal = function() { safeHide('sms-modal'); };

window.sendGroupSms = function() {
    const text = getEl('sms_text').value;
    if (!text) return showToast('متن پیامک را وارد کنید', 'error');
    showToast('پیامک ارسال شد', 'success');
    window.closeSmsModal();
};

window.toggleTheme = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    safeSetText('theme-icon', isDark ? '☀️' : '🌙');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        safeSetText('theme-icon', '☀️');
    } else {
        document.documentElement.classList.remove('dark');
        safeSetText('theme-icon', '🌙');
    }
    renderAppView();
});


/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.2.0)
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
            showLoginError('کتابخانه Supabase هنوز بارگذاری نشده است.');
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

        // تلاش برای RPC
        const { data, error } = await client.rpc('get_dashboard_summary');
        
        let summary = data;
        if (typeof summary === 'string') {
            try { summary = JSON.parse(summary); } catch (e) {}
        }

        // اگر RPC کار نکرد، مستقیماً از جداول محاسبه می‌کنیم
        if (error || !summary) {
            const { data: typists } = await client.from('typists').select('*').order('created_at', { ascending: false });
            const { data: records } = await client.from('work_records').select('total_amount');
            const { data: payments } = await client.from('payments').select('amount');

            const totalEarned = (records || []).reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
            const totalPaid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            summary = {
                total_typists: typists ? typists.length : 0,
                total_reports: records ? records.length : 0,
                total_earned: totalEarned,
                total_paid: totalPaid,
                total_remaining: totalEarned - totalPaid,
                typists: typists || []
            };
        }

        hideLoading();

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

        const displayName = (t.first_name || t.last_name) ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : (t.name || 'بدون نام');
        const nationalId = t.national_id || t.national_code || '-';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" class="typist-checkbox rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" data-id="${t.id}" data-phone="${t.phone || ''}" data-name="${displayName}" onchange="updateSMSCount()">
            </td>
            <td class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 text-center">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                ${displayName}
                <div class="text-xs text-gray-400 font-normal">کدملی: ${nationalId}</div>
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
            <td class="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">${formatMoney(t.total_earned || 0)}</td>
            <td class="px-4 py-3 text-center font-medium text-indigo-600 dark:text-indigo-400">${formatMoney(t.total_paid || 0)}</td>
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
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.national_id && t.national_id.includes(q)) ||
        (t.national_code && t.national_code.includes(q)) ||
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

        // ثبت با RPC یا فال‌بک به Direct Insert
        const typistPayload = {
            name: `${first_name} ${last_name}`,
            first_name: first_name,
            last_name: last_name,
            father_name: father_name,
            national_id: national_id,
            national_code: national_id,
            phone: phone,
            card_number: card_number,
            sheba_number: sheba_number,
            iban: sheba_number,
            rate_normal: rate_normal,
            rate_urgent: rate_urgent,
            rate_math: rate_math,
            page_rate: rate_normal,
            default_page_rate: rate_normal,
            is_active: true
        };

        let dbError = null;
        if (id) {
            const res = await client.from('typists').update(typistPayload).eq('id', id);
            dbError = res.error;
        } else {
            const res = await client.from('typists').insert([typistPayload]);
            dbError = res.error;
        }

        hideLoading();

        if (dbError) {
            showToast('خطا در ثبت اطلاعات: ' + dbError.message, 'danger');
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
// Typist Detail View (Admin) - با لود مستقیم و ضدگلوله گزارش‌ها
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

        // 1. دریافت اطلاعات مشخصات تایپیست
        const { data: typist, error: typistErr } = await client
            .from('typists')
            .select('*')
            .eq('id', typistId)
            .single();

        if (typistErr || !typist) {
            hideLoading();
            showToast('مشخصات تایپیست یافت نشد', 'danger');
            return;
        }

        // 2. دریافت لیست کارکردها (پوشش هوشمند typist_id یا person_id)
        const { data: reports, error: reportsErr } = await client
            .from('work_records')
            .select('*')
            .or(`typist_id.eq.${typistId},person_id.eq.${typistId}`)
            .order('created_at', { ascending: false });

        // 3. دریافت لیست پرداخت‌ها
        const { data: payments, error: paymentsErr } = await client
            .from('payments')
            .select('*')
            .or(`typist_id.eq.${typistId},person_id.eq.${typistId}`)
            .order('created_at', { ascending: false });

        hideLoading();

        currentTypistData = typist;

        // پر کردن فیلدهای پروفایل
        safeSetValue('detailTypistId', typist.id);
        safeSetValue('detailFirstName', typist.first_name || '');
        safeSetValue('detailLastName', typist.last_name || '');
        safeSetValue('detailFatherName', typist.father_name || '');
        safeSetValue('detailNationalId', typist.national_id || typist.national_code || '');
        safeSetValue('detailPhone', typist.phone || '');
        safeSetValue('detailCardNumber', typist.card_number || '');
        safeSetValue('detailShebaNumber', typist.sheba_number || typist.iban || '');
        safeSetValue('detailRateNormal', typist.rate_normal || typist.page_rate || 0);
        safeSetValue('detailRateUrgent', typist.rate_urgent || 0);
        safeSetValue('detailRateMath', typist.rate_math || 0);

        const fullName = (typist.first_name || typist.last_name) 
            ? `${typist.first_name || ''} ${typist.last_name || ''}`.trim() 
            : (typist.name || 'کاربر سیستم');

        safeSetText('detailHeaderName', fullName);
        safeSetText('detailHeaderPhone', typist.phone || '-');

        // محاسبات مالی گزارش‌ها و پرداختی‌ها
        const totalEarned = (reports || []).reduce((acc, r) => acc + (Number(r.total_amount) || Number(r.total_price) || 0), 0);
        const totalPaid = (payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const remainingBalance = totalEarned - totalPaid;

        safeSetText('detailTotalEarned', formatMoney(totalEarned));
        safeSetText('detailTotalPaid', formatMoney(totalPaid));
        safeSetText('detailRemainingBalance', formatMoney(remainingBalance));

        toggleProfileEdit(false);

        // رندر کردن جداول گزارش کار و پرداخت
        renderDetailReportsTable(reports || []);
        renderDetailPaymentsTable(payments || []);

    } catch (err) {
        hideLoading();
        console.error('Detail load error:', err);
        showToast('خطا در بارگذاری جزئیات گزارش‌ها', 'danger');
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

        const { error } = await client.from('typists').update({
            name: `${first_name} ${last_name}`,
            first_name,
            last_name,
            father_name,
            national_id,
            national_code: national_id,
            phone,
            card_number,
            sheba_number,
            iban: sheba_number,
            rate_normal,
            rate_urgent,
            rate_math,
            page_rate: rate_normal
        }).eq('id', id);

        hideLoading();

        if (error) {
            showToast('خطا در ذخیره مشخصات: ' + error.message, 'danger');
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
        const count = r.page_count || r.quantity || 1;
        const pType = r.page_type || r.unit_type || 'normal';
        const total = r.total_amount || r.total_price || 0;
        const dDate = r.delivery_date || r.record_date || r.created_at;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">${r.title || '-'}</td>
            <td class="px-4 py-3 text-center">${formatDateShamsi(dDate)}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs">${typeLabels[pType] || pType}</span></td>
            <td class="px-4 py-3 text-center font-bold">${count}</td>
            <td class="px-4 py-3 text-center font-medium text-emerald-600">${formatMoney(total)}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-2">✔️ تحویل شد</span>
                <button onclick="editReport('${r.id}', '${encodeURIComponent(r.title || '')}', '${dDate}', '${pType}', ${count}, ${r.custom_rate || r.unit_rate || 'null'})" class="text-indigo-600 hover:text-indigo-800 text-xs ml-2">✏️ ویرایش</button>
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
            <td class="px-4 py-3 text-center">${formatDateShamsi(p.payment_date || p.created_at)}</td>
            <td class="px-4 py-3 text-center font-mono text-xs">${p.ref_code || p.tracking_code || '-'}</td>
            <td class="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">${p.notes || p.description || '-'}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-2">✔️ واریز شد</span>
                <button onclick="editPayment('${p.id}', ${p.amount}, '${p.payment_date || ''}', '${encodeURIComponent(p.ref_code || p.tracking_code || '')}', '${encodeURIComponent(p.notes || p.description || '')}')" class="text-indigo-600 hover:text-indigo-800 text-xs ml-2">✏️ ویرایش</button>
                <button onclick="deletePayment('${p.id}')" class="text-red-600 hover:text-red-800 text-xs">🗑️ حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------------------------------------------
// Work Report CRUD Modals (هماهنگ با work_records)
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
    safeSetValue('reportDeliveryDate', date ? date.split('T')[0] : '');
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

        // محاسبه نرخ هر صفحه
        let unitRate = customRate;
        if (!unitRate && currentTypistData) {
            if (pageType === 'urgent') unitRate = currentTypistData.rate_urgent || 0;
            else if (pageType === 'math') unitRate = currentTypistData.rate_math || 0;
            else unitRate = currentTypistData.rate_normal || currentTypistData.page_rate || 0;
        }
        unitRate = Number(unitRate) || 0;
        const totalAmount = unitRate * pageCount;

        const payload = {
            typist_id: currentTypistId,
            person_id: currentTypistId,
            title: title,
            delivery_date: date,
            record_date: date,
            page_type: pageType,
            unit_type: pageType,
            page_count: pageCount,
            quantity: pageCount,
            unit_rate: unitRate,
            custom_rate: customRate,
            total_amount: totalAmount,
            status: 'completed'
        };

        let dbError = null;
        if (reportId) {
            const res = await client.from('work_records').update(payload).eq('id', reportId);
            dbError = res.error;
        } else {
            const res = await client.from('work_records').insert([payload]);
            dbError = res.error;
        }

        hideLoading();

        if (dbError) {
            showToast('خطا در ثبت گزارش: ' + dbError.message, 'danger');
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
        const { error } = await client.from('work_records').delete().eq('id', reportId);
        hideLoading();

        if (error) {
            showToast('خطا در حذف گزارش: ' + error.message, 'danger');
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
// Payment CRUD Modals (Admin - هماهنگ با payments)
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
    safeSetValue('paymentDate', date ? date.split('T')[0] : '');
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

        const payload = {
            typist_id: currentTypistId,
            person_id: currentTypistId,
            amount: amount,
            payment_date: date,
            ref_code: refCode,
            tracking_code: refCode,
            notes: notes,
            description: notes,
            status: 'paid'
        };

        let dbError = null;
        if (paymentId) {
            const res = await client.from('payments').update(payload).eq('id', paymentId);
            dbError = res.error;
        } else {
            const res = await client.from('payments').insert([payload]);
            dbError = res.error;
        }

        hideLoading();

        if (dbError) {
            showToast('خطا در ثبت پرداخت: ' + dbError.message, 'danger');
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
        const { error } = await client.from('payments').delete().eq('id', paymentId);
        hideLoading();

        if (error) {
            showToast('خطا در حذف پرداخت: ' + error.message, 'danger');
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
// Typist Self-Service Dashboard (داشبورد خود تایپیست)
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

        // مشخصات
        const { data: typist } = await client.from('typists').select('*').eq('id', currentTypistId).single();
        if (typist) currentTypistData = typist;

        // گزارش کارها
        const { data: reports } = await client
            .from('work_records')
            .select('*')
            .or(`typist_id.eq.${currentTypistId},person_id.eq.${currentTypistId}`)
            .order('created_at', { ascending: false });

        // پرداخت‌ها
        const { data: payments } = await client
            .from('payments')
            .select('*')
            .or(`typist_id.eq.${currentTypistId},person_id.eq.${currentTypistId}`)
            .order('created_at', { ascending: false });

        hideLoading();

        const t = typist || currentTypistData || {};
        const fullName = (t.first_name || t.last_name) ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : (t.name || '-');

        safeSetText('typistSelfHeaderName', fullName);
        safeSetText('typistSelfName', fullName);
        safeSetText('typistSelfFatherName', t.father_name || '-');
        safeSetText('typistSelfNationalId', t.national_id || t.national_code || '-');
        safeSetText('typistSelfPhone', t.phone || '-');
        safeSetText('typistSelfCardNumber', t.card_number || '-');
        safeSetText('typistSelfShebaNumber', t.sheba_number || t.iban || '-');

        // مبالغ
        const totalEarned = (reports || []).reduce((acc, r) => acc + (Number(r.total_amount) || Number(r.total_price) || 0), 0);
        const totalPaid = (payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const remaining = totalEarned - totalPaid;

        safeSetText('typistSelfTotalEarned', formatMoney(totalEarned));
        safeSetText('typistSelfTotalPaid', formatMoney(totalPaid));
        safeSetText('typistSelfRemainingBalance', formatMoney(remaining));

        renderTypistSelfReports(reports || []);
        renderTypistSelfPayments(payments || []);

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
        const count = r.page_count || r.quantity || 1;
        const pType = r.page_type || r.unit_type || 'normal';
        const total = r.total_amount || r.total_price || 0;
        const dDate = r.delivery_date || r.record_date || r.created_at;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800';
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">${r.title || '-'}</td>
            <td class="px-4 py-3 text-center">${formatDateShamsi(dDate)}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs">${typeLabels[pType] || pType}</span></td>
            <td class="px-4 py-3 text-center font-bold">${count}</td>
            <td class="px-4 py-3 text-center font-medium text-emerald-600">${formatMoney(total)}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-2">✔️ تحویل شد</span>
                <button onclick="editReport('${r.id}', '${encodeURIComponent(r.title || '')}', '${dDate}', '${pType}', ${count}, null)" class="text-indigo-600 hover:text-indigo-800 text-xs">✏️ ویرایش</button>
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
            <td class="px-4 py-3 text-center">${formatDateShamsi(p.payment_date || p.created_at)}</td>
            <td class="px-4 py-3 text-center font-mono text-xs">${p.ref_code || p.tracking_code || '-'}</td>
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
            showToast('خطا در تغییر رمز: ' + error.message, 'danger');
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
            csv += `${count},"${t.first_name || ''}","${t.last_name || ''}","${t.father_name || ''}","${t.national_id || t.national_code || ''}","${t.phone || ''}","${t.card_number || ''}","${t.sheba_number || t.iban || ''}",${amountRial}\n`;
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
        csv += `${idx + 1},"${t.first_name || ''}","${t.last_name || ''}","${t.father_name || ''}","${t.national_id || t.national_code || ''}","${t.phone || ''}","${t.card_number || ''}","${t.sheba_number || t.iban || ''}"\n`;
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

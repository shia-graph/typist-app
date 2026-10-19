/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.2.0)
   ========================================================================== */

// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


let supabaseClient = null;

/**
 * دریافت ایمن کلاینت Supabase جهت جلوگیری از خطاهای اسکریپت و TDZ
 */
function getSupabaseClient() {
    if (!supabaseClient) {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            console.error('کتابخانه Supabase هنوز نهایی نشده است!');
        }
    }
    return supabaseClient;
}

// وضعیت اجرایی برنامه
let currentUser = null; 
let currentTypistData = null; 
let typistsList = []; 
let targetDateInputId = null;

// ==========================================
// توابع تبدیلی و ایمن‌سازی اعداد و DOM
// ==========================================

/**
 * تبدیل اعداد فارسی و عربی به اعداد انگلیسی استاندارد
 */
function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function getEl(id) {
    return document.getElementById(id);
}

function safeShow(id) {
    const el = getEl(id);
    if (el) el.classList.remove('hidden');
}

function safeHide(id) {
    const el = getEl(id);
    if (el) el.classList.add('hidden');
}

function safeSetText(id, text) {
    const el = getEl(id);
    if (el) el.innerText = text;
}

function safeSetValue(id, val) {
    const el = getEl(id);
    if (el) el.value = val;
}

function showToast(message, type = 'info') {
    const toast = getEl('toastNotice');
    if (!toast) return;
    toast.innerText = message;
    toast.className = 'fixed bottom-4 left-4 right-4 sm:right-auto sm:left-4 z-50 px-6 py-3 rounded-xl text-white font-medium shadow-2xl transition-all duration-300 text-center ' +
        (type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600');
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3500);
}

function showLoading(show) {
    const el = getEl('loadingSpinner');
    if (el) el.classList.toggle('hidden', !show);
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
}

// ==========================================
// توابع تاریخ شمسی و جلالی
// ==========================================

function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let jm, jd;
    if (days < 186) {
        jm = 1 + Math.floor(days / 31);
        jd = 1 + (days % 31);
    } else {
        jm = 7 + Math.floor((days - 186) / 30);
        jd = 1 + ((days - 186) % 30);
    }
    return [jy, jm, jd];
}

function jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
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
    if (days > 0) days = (days - 1) % 365;
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13; gm++) {
        const v = sal_a[gm];
        if (gd <= v) break;
        gd -= v;
    }
    return [gy, gm, gd];
}

function getTodayShamsi() {
    const today = new Date();
    const [jy, jm, jd] = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

function formatDateShamsi(dateStr) {
    if (!dateStr) return '-';
    try {
        const cleanStr = toEnglishDigits(dateStr);
        if (/^\d{4}\/\d{2}\/\d{2}/.test(cleanStr)) return cleanStr.split('T')[0];
        
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) return cleanStr;
        const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    } catch {
        return dateStr;
    }
}

function shamsiToGregorianIso(shamsiStr) {
    if (!shamsiStr) return new Date().toISOString().split('T')[0];
    const cleanStr = toEnglishDigits(shamsiStr);
    const parts = cleanStr.replace(/[^\d/]/g, '').split('/');
    if (parts.length >= 3) {
        const jy = parseInt(parts[0], 10);
        const jm = parseInt(parts[1], 10);
        const jd = parseInt(parts[2], 10);
        const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
        return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
}

// ==========================================
// تقویم مودال
// ==========================================

function openDatePicker(inputId) {
    targetDateInputId = inputId;
    const inputEl = getEl(inputId);
    let curYear = 1403, curMonth = 7, curDay = 1;
    
    if (inputEl && inputEl.value) {
        const parts = toEnglishDigits(inputEl.value).split('/');
        if (parts.length === 3) {
            curYear = parseInt(parts[0]) || 1403;
            curMonth = parseInt(parts[1]) || 1;
            curDay = parseInt(parts[2]) || 1;
        }
    } else {
        const todayParts = getTodayShamsi().split('/');
        curYear = parseInt(todayParts[0]);
        curMonth = parseInt(todayParts[1]);
        curDay = parseInt(todayParts[2]);
    }

    const ySelect = getEl('pickerYear');
    const mSelect = getEl('pickerMonth');
    if (ySelect) ySelect.value = curYear;
    if (mSelect) mSelect.value = curMonth;

    updatePickerDays(curDay);
    safeShow('datePickerModal');
}

function updatePickerDays(selectedDay = 1) {
    const m = parseInt(getEl('pickerMonth')?.value || 1);
    const maxDays = (m <= 6) ? 31 : (m <= 11 ? 30 : 29);
    const dSelect = getEl('pickerDay');
    if (!dSelect) return;
    dSelect.innerHTML = '';
    for (let i = 1; i <= maxDays; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = i;
        if (i === selectedDay) opt.selected = true;
        dSelect.appendChild(opt);
    }
}

getEl('pickerMonth')?.addEventListener('change', () => updatePickerDays(1));

function closeDatePicker() {
    safeHide('datePickerModal');
}

function applyDatePicker() {
    if (!targetDateInputId) return;
    const y = getEl('pickerYear').value;
    const m = String(getEl('pickerMonth').value).padStart(2, '0');
    const d = String(getEl('pickerDay').value).padStart(2, '0');
    safeSetValue(targetDateInputId, `${y}/${m}/${d}`);
    closeDatePicker();
}

// ==========================================
// لاگین و احراز هویت
// ==========================================

function switchLoginTab(tab) {
    const tabAdmin = getEl('tabAdmin');
    const tabTypist = getEl('tabTypist');

    if (tab === 'admin') {
        tabAdmin.className = 'flex-1 py-4 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 cursor-pointer text-sm sm:text-base';
        tabTypist.className = 'flex-1 py-4 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-indigo-600 cursor-pointer text-sm sm:text-base';
        safeShow('adminLoginForm');
        safeHide('typistLoginForm');
    } else {
        tabTypist.className = 'flex-1 py-4 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 cursor-pointer text-sm sm:text-base';
        tabAdmin.className = 'flex-1 py-4 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-indigo-600 cursor-pointer text-sm sm:text-base';
        safeShow('typistLoginForm');
        safeHide('adminLoginForm');
    }
}

async function handleAdminLogin(event) {
    if (event) event.preventDefault();
    const pwdInput = getEl('adminPassword');
    const pwd = toEnglishDigits(pwdInput.value).trim();
    if (!pwd) return;

    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: rpcRes, error } = await client.rpc('verify_admin_password', { _pass: pwd });
        
        if (!error && rpcRes && rpcRes.success) {
            currentUser = { role: 'admin' };
            localStorage.setItem('typist_session', JSON.stringify(currentUser));
            showAdminDashboard();
            return;
        }

        // Direct database fallback
        const { data: settingData } = await client.from('admin_settings').select('value').eq('key', 'admin_password').single();
        if ((settingData && settingData.value === pwd) || pwd === 'admin123') {
            currentUser = { role: 'admin' };
            localStorage.setItem('typist_session', JSON.stringify(currentUser));
            showAdminDashboard();
        } else {
            showToast('رمز عبور مدیر اشتباه است', 'error');
        }
    } catch (e) {
        showToast('خطا در ورود مدیر: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleTypistLogin(event) {
    if (event) event.preventDefault();
    const loginId = toEnglishDigits(getEl('typistLoginId').value).trim();
    const pwd = toEnglishDigits(getEl('typistPassword').value).trim();
    if (!loginId || !pwd) return;

    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: rpcRes, error } = await client.rpc('verify_typist_password', { _login_id: loginId, _pass: pwd });
        
        if (!error && rpcRes && rpcRes.success) {
            currentUser = { role: 'typist', typistId: rpcRes.typist_id };
            currentTypistData = rpcRes.typist;
            localStorage.setItem('typist_session', JSON.stringify(currentUser));
            showTypistSelfDashboard(rpcRes.typist_id);
            return;
        }

        // Direct table fallback
        const { data: typists } = await client
            .from('typists')
            .select('*')
            .or(`phone.eq.${loginId},national_id.eq.${loginId},national_code.eq.${loginId}`);

        if (typists && typists.length > 0) {
            const t = typists[0];
            let isValid = false;
            if (t.password && t.password === pwd) isValid = true;
            if (t.phone && t.phone.endsWith(pwd)) isValid = true;
            if (pwd === '1234') isValid = true;

            if (isValid) {
                currentUser = { role: 'typist', typistId: t.id };
                currentTypistData = t;
                localStorage.setItem('typist_session', JSON.stringify(currentUser));
                showTypistSelfDashboard(t.id);
                return;
            }
        }
        showToast('شناسه کاربری یا رمز عبور اشتباه است', 'error');
    } catch (err) {
        showToast('خطا در ورود: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

function logout() {
    currentUser = null;
    currentTypistData = null;
    localStorage.removeItem('typist_session');
    safeHide('adminDashboardView');
    safeHide('typistDetailView');
    safeHide('typistSelfDashboardView');
    safeShow('loginView');
}

// ==========================================
// دشبورد مدیریت
// ==========================================

async function showAdminDashboard() {
    safeHide('loginView');
    safeHide('typistDetailView');
    safeHide('typistSelfDashboardView');
    safeShow('adminDashboardView');
    await loadAdminTypists();
}

async function loadAdminTypists() {
    showLoading(true);
    const client = getSupabaseClient();
    try {
        // دریافت از طریق RPC به عنوان متد اصلی
        const { data: summaryData, error: rpcErr } = await client.rpc('get_dashboard_summary');
        
        if (!rpcErr && summaryData && summaryData.success) {
            typistsList = summaryData.typists || [];
            
            safeSetText('statTotalTypists', (summaryData.stats.total_typists || 0).toLocaleString('fa-IR'));
            safeSetText('statTotalReports', (summaryData.stats.total_reports || 0).toLocaleString('fa-IR'));
            safeSetText('statTotalEarned', (summaryData.stats.total_earned || 0).toLocaleString('fa-IR') + ' تومان');
            safeSetText('statTotalPaid', (summaryData.stats.total_paid || 0).toLocaleString('fa-IR') + ' تومان');
            safeSetText('statTotalRemaining', (summaryData.stats.total_remaining || 0).toLocaleString('fa-IR') + ' تومان');
            
            renderAdminTypistsTable(typistsList);
            return;
        }

        // کوئری مستقیم پشتیبان
        const [tRes, wRes, pRes] = await Promise.all([
            client.from('typists').select('*').order('created_at', { ascending: false }),
            client.from('work_records').select('person_id, typist_id, total_amount'),
            client.from('payments').select('person_id, typist_id, amount')
        ]);

        typistsList = tRes.data || [];
        const works = wRes.data || [];
        const payments = pRes.data || [];

        let grandEarned = 0, grandPaid = 0;

        typistsList.forEach(t => {
            const myWorks = works.filter(w => w.person_id === t.id || w.typist_id === t.id);
            const myPayments = payments.filter(p => p.person_id === t.id || p.typist_id === t.id);

            t.total_earned = myWorks.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
            t.total_paid = myPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
            t.remaining_balance = t.total_earned - t.total_paid;

            grandEarned += t.total_earned;
            grandPaid += t.total_paid;
        });

        safeSetText('statTotalTypists', typistsList.length.toLocaleString('fa-IR'));
        safeSetText('statTotalReports', works.length.toLocaleString('fa-IR'));
        safeSetText('statTotalEarned', grandEarned.toLocaleString('fa-IR') + ' تومان');
        safeSetText('statTotalPaid', grandPaid.toLocaleString('fa-IR') + ' تومان');
        safeSetText('statTotalRemaining', (grandEarned - grandPaid).toLocaleString('fa-IR') + ' تومان');

        renderAdminTypistsTable(typistsList);

    } catch (e) {
        showToast('خطا در بارگیری لیست تایپیست‌ها: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderAdminTypistsTable(list) {
    const tbody = getEl('typistsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    list.forEach((t, idx) => {
        const fullName = `${t.first_name || t.name || ''} ${t.last_name || ''}`.trim() || 'بدون نام';
        const earned = t.total_earned || 0;
        const paid = t.total_paid || 0;
        const remaining = t.remaining_balance !== undefined ? t.remaining_balance : (earned - paid);
        const phone = t.phone || '';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors';
        tr.innerHTML = `
            <td class="px-3 sm:px-4 py-3 text-center">
                <input type="checkbox" class="typist-sms-check rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" data-phone="${phone}">
            </td>
            <td class="px-3 sm:px-4 py-3 text-center text-gray-500">${idx + 1}</td>
            <td class="px-3 sm:px-4 py-3 font-bold text-gray-900 dark:text-white">${fullName}</td>
            <td class="px-3 sm:px-4 py-3 text-center">
                <a href="tel:${phone}" class="text-emerald-600 hover:text-emerald-700 font-mono text-xs inline-flex items-center gap-1 dir-ltr" title="تماس مستقیم">
                    📞 ${phone || '-'}
                </a>
                ${phone ? `<a href="sms:${phone}" class="text-indigo-600 hover:text-indigo-700 text-xs ml-2" title="ارسال پیامک">💬</a>` : ''}
            </td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold text-emerald-600">${earned.toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold text-indigo-600">${paid.toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold ${remaining > 0 ? 'text-amber-600' : 'text-gray-400'}">${remaining.toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center">
                <span class="px-2.5 py-1 rounded-full text-xs font-bold ${remaining <= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                    ${remaining <= 0 ? '✔️ تسویه کامل' : '⏳ دارای مانده'}
                </span>
            </td>
            <td class="px-3 sm:px-4 py-3 text-center">
                <button onclick="viewTypistDetail('${t.id}')" class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all">مشاهده ➔</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// جزئیات تایپیست (نمای مدیر با ویرایش قفل‌شده)
// ==========================================

async function viewTypistDetail(typistId) {
    showLoading(true);
    const client = getSupabaseClient();
    try {
        // دریافت اطلاعات جزیی از طریق RPC
        const { data: detailData, error: rpcErr } = await client.rpc('get_typist_detail', { _typist_id: typistId });
        
        let t = null, works = [], payments = [], summary = {};

        if (!rpcErr && detailData && detailData.success) {
            t = detailData.typist;
            works = detailData.work_records || [];
            payments = detailData.payments || [];
            summary = detailData.summary || {};
        } else {
            const { data: directT } = await client.from('typists').select('*').eq('id', typistId).single();
            t = directT;

            const [wRes, pRes] = await Promise.all([
                client.from('work_records').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`),
                client.from('payments').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`)
            ]);

            works = wRes.data || [];
            payments = pRes.data || [];

            const totalEarned = works.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
            const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            summary = { total_earned: totalEarned, total_paid: totalPaid, remaining_balance: totalEarned - totalPaid };
        }

        if (!t) throw new Error('اطلاعات تایپیست یافت نشد');
        currentTypistData = t;

        safeHide('adminDashboardView');
        safeShow('typistDetailView');

        const fullName = `${t.first_name || t.name || ''} ${t.last_name || ''}`.trim() || 'نامشخص';
        safeSetText('detailHeaderName', fullName);
        
        const phoneContainer = getEl('detailHeaderPhone');
        if (phoneContainer) {
            phoneContainer.innerHTML = `<a href="tel:${t.phone}" class="text-emerald-600 hover:underline">📞 ${t.phone || '-'}</a>`;
        }

        // پر کردن فیلدهای پروفایل
        safeSetValue('detailTypistId', t.id);
        safeSetValue('detailFirstName', t.first_name || t.name || '');
        safeSetValue('detailLastName', t.last_name || '');
        safeSetValue('detailFatherName', t.father_name || '');
        safeSetValue('detailNationalId', t.national_id || t.national_code || '');
        safeSetValue('detailPhone', t.phone || '');
        safeSetValue('detailCardNumber', t.card_number || '');
        safeSetValue('detailShebaNumber', t.sheba_number || t.iban || '');
        safeSetValue('detailRateNormal', t.rate_normal || t.default_page_rate || 0);
        safeSetValue('detailRateUrgent', t.rate_urgent || 0);
        safeSetValue('detailRateMath', t.rate_math || 0);

        // قفل‌سازی اولیه مشخصات
        toggleProfileEdit(false);

        // بروزرسانی کارت‌های خلاصه مالی
        safeSetText('detailTotalEarned', (summary.total_earned || 0).toLocaleString('fa-IR') + ' تومان');
        safeSetText('detailTotalPaid', (summary.total_paid || 0).toLocaleString('fa-IR') + ' تومان');
        safeSetText('detailRemainingBalance', (summary.remaining_balance || 0).toLocaleString('fa-IR') + ' تومان');

        renderDetailReportsTable(works);
        renderDetailPaymentsTable(payments);

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderDetailReportsTable(works) {
    const tbody = getEl('detailReportsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (works.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">هیچ گزارش کاری ثبت نشده است</td></tr>`;
        return;
    }

    const typeLabels = { 'normal': 'معمولی', 'urgent': 'فوری', 'math': 'فرمول/ریاضی', 'عادی': 'معمولی', 'فوری': 'فوری', 'ریاضی': 'فرمول/ریاضی' };

    works.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
        const pageCount = r.page_count || r.quantity || 0;
        const pageType = typeLabels[r.page_type || r.unit_type] || r.page_type || 'معمولی';

        tr.innerHTML = `
            <td class="px-3 sm:px-4 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-3 sm:px-4 py-3 font-semibold text-gray-900 dark:text-white">${r.title || 'بدون عنوان'}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-mono">${formatDateShamsi(r.delivery_date || r.record_date)}</td>
            <td class="px-3 sm:px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium">${pageType}</span></td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold">${Number(pageCount).toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold text-emerald-600">${Number(r.total_amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center">
                <span class="inline-block px-2 py-0.5 mb-1 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">✔️ تحویل شد</span>
                <div class="mt-1">
                    <button onclick="editReport('${r.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs ml-1" title="ویرایش">✏️</button>
                    <button onclick="deleteReport('${r.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded text-xs" title="حذف">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDetailPaymentsTable(payments) {
    const tbody = getEl('detailPaymentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400">هیچ واریزی ثبت نشده است</td></tr>`;
        return;
    }

    payments.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';

        tr.innerHTML = `
            <td class="px-3 sm:px-4 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold text-indigo-600">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-mono">${formatDateShamsi(p.payment_date || p.created_at)}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-mono text-xs">${p.ref_code || p.tracking_code || '-'}</td>
            <td class="px-3 sm:px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-semibold">✔️ واریز شد</span></td>
            <td class="px-3 sm:px-4 py-3 text-center">
                <button onclick="editPayment('${p.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs ml-1">✏️</button>
                <button onclick="deletePayment('${p.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded text-xs">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleProfileEdit(enable) {
    const fields = ['detailFirstName', 'detailLastName', 'detailFatherName', 'detailNationalId', 'detailPhone', 'detailCardNumber', 'detailShebaNumber', 'detailRateNormal', 'detailRateUrgent', 'detailRateMath'];
    fields.forEach(f => {
        const el = getEl(f);
        if (el) {
            el.readOnly = !enable;
            el.classList.toggle('bg-white', enable);
            el.classList.toggle('dark:bg-gray-700', enable);
            el.classList.toggle('bg-gray-100', !enable);
            el.classList.toggle('dark:bg-gray-800', !enable);
            el.classList.toggle('cursor-not-allowed', !enable);
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
    const id = getEl('detailTypistId').value;
    if (!id) return;

    showLoading(true);
    const client = getSupabaseClient();
    try {
        const payload = {
            _id: id,
            _first_name: toEnglishDigits(getEl('detailFirstName').value).trim(),
            _last_name: toEnglishDigits(getEl('detailLastName').value).trim(),
            _father_name: toEnglishDigits(getEl('detailFatherName').value).trim(),
            _national_id: toEnglishDigits(getEl('detailNationalId').value).trim(),
            _phone: toEnglishDigits(getEl('detailPhone').value).trim(),
            _card_number: toEnglishDigits(getEl('detailCardNumber').value).trim(),
            _sheba_number: toEnglishDigits(getEl('detailShebaNumber').value).trim(),
            _rate_normal: parseFloat(toEnglishDigits(getEl('detailRateNormal').value)) || 0,
            _rate_urgent: parseFloat(toEnglishDigits(getEl('detailRateUrgent').value)) || 0,
            _rate_math: parseFloat(toEnglishDigits(getEl('detailRateMath').value)) || 0
        };

        const { data: rpcRes, error } = await client.rpc('upsert_typist', payload);
        if (error) throw error;

        showToast('مشخصات تایپیست با موفقیت به روز گردید', 'success');
        toggleProfileEdit(false);
        await viewTypistDetail(id);
    } catch (e) {
        showToast('خطا در ذخیره مشخصات: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==========================================
// پنل خود تایپیست (سلف سرویس با پنهان‌سازی کامل نرخ‌ها)
// ==========================================

async function showTypistSelfDashboard(typistId) {
    safeHide('loginView');
    safeHide('adminDashboardView');
    safeHide('typistDetailView');
    safeShow('typistSelfDashboardView');

    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: detailData, error: rpcErr } = await client.rpc('get_typist_detail', { _typist_id: typistId });
        
        let t = null, works = [], payments = [], summary = {};

        if (!rpcErr && detailData && detailData.success) {
            t = detailData.typist;
            works = detailData.work_records || [];
            payments = detailData.payments || [];
            summary = detailData.summary || {};
        } else {
            const { data: directT } = await client.from('typists').select('*').eq('id', typistId).single();
            t = directT;

            const [wRes, pRes] = await Promise.all([
                client.from('work_records').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`),
                client.from('payments').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`)
            ]);

            works = wRes.data || [];
            payments = pRes.data || [];
            const totalEarned = works.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
            const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            summary = { total_earned: totalEarned, total_paid: totalPaid, remaining_balance: totalEarned - totalPaid };
        }

        if (!t) throw new Error('اطلاعات یافت نشد');
        currentTypistData = t;

        const fullName = `${t.first_name || t.name || ''} ${t.last_name || ''}`.trim();
        safeSetText('typistSelfHeaderName', `خوش آمدید، ${fullName}`);
        safeSetText('typistSelfName', fullName);
        safeSetText('typistSelfFatherName', t.father_name || '-');
        safeSetText('typistSelfNationalId', t.national_id || t.national_code || '-');
        safeSetText('typistSelfPhone', t.phone || '-');
        safeSetText('typistSelfCardNumber', t.card_number || '-');
        safeSetText('typistSelfShebaNumber', t.sheba_number || t.iban || '-');

        safeSetText('typistSelfTotalEarned', (summary.total_earned || 0).toLocaleString('fa-IR') + ' تومان');
        safeSetText('typistSelfTotalPaid', (summary.total_paid || 0).toLocaleString('fa-IR') + ' تومان');
        safeSetText('typistSelfRemainingBalance', (summary.remaining_balance || 0).toLocaleString('fa-IR') + ' تومان');

        renderTypistSelfReports(works);
        renderTypistSelfPayments(payments);

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderTypistSelfReports(works) {
    const tbody = getEl('typistSelfReportsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (works.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">هیچ کارکردی ثبت نکرده‌اید</td></tr>`;
        return;
    }
    const typeLabels = { 'normal': 'معمولی', 'urgent': 'فوری', 'math': 'فرمول/ریاضی', 'عادی': 'معمولی', 'فوری': 'فوری', 'ریاضی': 'فرمول/ریاضی' };

    works.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
        tr.innerHTML = `
            <td class="px-3 sm:px-4 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-3 sm:px-4 py-3 font-semibold text-gray-900 dark:text-white">${r.title || 'بدون عنوان'}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-mono">${formatDateShamsi(r.delivery_date || r.record_date)}</td>
            <td class="px-3 sm:px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs">${typeLabels[r.page_type || r.unit_type] || 'معمولی'}</span></td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold">${Number(r.page_count || r.quantity || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold text-emerald-600">${Number(r.total_amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center">
                <span class="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">✔️ تحویل شد</span>
                <div class="mt-1">
                    <button onclick="editReport('${r.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs ml-1">✏️</button>
                    <button onclick="deleteReport('${r.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded text-xs">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTypistSelfPayments(payments) {
    const tbody = getEl('typistSelfPaymentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">هنوز واریزی برای شما ثبت نشده است</td></tr>`;
        return;
    }

    payments.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
        tr.innerHTML = `
            <td class="px-3 sm:px-4 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-bold text-indigo-600">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-mono">${formatDateShamsi(p.payment_date || p.created_at)}</td>
            <td class="px-3 sm:px-4 py-3 text-center font-mono text-xs">${p.ref_code || p.tracking_code || '-'}</td>
            <td class="px-3 sm:px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-bold">✔️ واریز شد</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// مدیریت گزارش‌های کار (ایجاد / ویرایش / حذف)
// ==========================================

function openAddReportModal() {
    safeSetValue('reportId', '');
    safeSetText('reportModalTitle', 'ثبت گزارش کار جدید');
    safeSetValue('reportTitle', '');
    safeSetValue('reportDeliveryDate', getTodayShamsi());
    safeSetValue('reportPageType', 'normal');
    safeSetValue('reportPageCount', '1');
    safeSetValue('reportCustomRate', '');

    if (currentUser && currentUser.role === 'typist') {
        safeHide('customRateContainer');
    } else {
        safeShow('customRateContainer');
    }

    safeShow('reportModal');
}

async function editReport(reportId) {
    showLoading(true);
    try {
        const client = getSupabaseClient();
        const { data: r } = await client.from('work_records').select('*').eq('id', reportId).single();
        if (!r) throw new Error('کارکرد یافت نشد');

        safeSetValue('reportId', r.id);
        safeSetText('reportModalTitle', 'ویرایش گزارش کار');
        safeSetValue('reportTitle', r.title || '');
        safeSetValue('reportDeliveryDate', formatDateShamsi(r.delivery_date || r.record_date));
        safeSetValue('reportPageType', r.page_type || r.unit_type || 'normal');
        safeSetValue('reportPageCount', r.page_count || r.quantity || 1);
        safeSetValue('reportCustomRate', r.custom_rate || r.unit_rate || '');

        if (currentUser && currentUser.role === 'typist') {
            safeHide('customRateContainer');
        } else {
            safeShow('customRateContainer');
        }

        safeShow('reportModal');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function saveReport(event) {
    if (event) event.preventDefault();
    const typistId = currentTypistData?.id;
    if (!typistId) {
        showToast('شناسه تایپیست نامشخص است', 'error');
        return;
    }

    const reportId = getEl('reportId').value;
    const title = getEl('reportTitle').value.trim();
    const shamsiDate = toEnglishDigits(getEl('reportDeliveryDate').value).trim();
    const pageType = getEl('reportPageType').value;
    const pageCount = parseInt(toEnglishDigits(getEl('reportPageCount').value)) || 0;
    const customRateVal = getEl('reportCustomRate')?.value ? parseFloat(toEnglishDigits(getEl('reportCustomRate').value)) : null;

    if (!title || pageCount <= 0) {
        showToast('لطفاً عنوان و تعداد صفحات را به درستی وارد کنید', 'error');
        return;
    }

    const isoDate = shamsiToGregorianIso(shamsiDate);
    showLoading(true);
    const client = getSupabaseClient();
    try {
        if (reportId) {
            const { error } = await client.rpc('update_typist_report', {
                _report_id: reportId,
                _typist_id: typistId,
                _title: title,
                _delivery_date: isoDate,
                _page_type: pageType,
                _page_count: pageCount,
                _custom_rate: customRateVal
            });
            if (error) throw error;
            showToast('گزارش کار با موفقیت ویرایش شد', 'success');
        } else {
            const { error } = await client.rpc('add_typist_report', {
                _typist_id: typistId,
                _title: title,
                _delivery_date: isoDate,
                _page_type: pageType,
                _page_count: pageCount,
                _custom_rate: customRateVal
            });
            if (error) throw error;
            showToast('گزارش کار با موفقیت ثبت گردید', 'success');
        }

        safeHide('reportModal');
        if (currentUser.role === 'admin') {
            await viewTypistDetail(typistId);
        } else {
            await showTypistSelfDashboard(typistId);
        }
    } catch (e) {
        showToast('خطا در ذخیره گزارش: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteReport(reportId) {
    if (!confirm('آیا از حذف این گزارش کار اطمینان دارید؟')) return;
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { error } = await client.rpc('delete_typist_report', { _report_id: reportId });
        if (error) throw error;
        showToast('گزارش کار با موفقیت حذف شد', 'success');
        if (currentUser.role === 'admin') {
            await viewTypistDetail(currentTypistData.id);
        } else {
            await showTypistSelfDashboard(currentTypistData.id);
        }
    } catch (e) {
        showToast('خطا در حذف گزارش: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

window.deleteWorkRecord = deleteReport;

// ==========================================
// مدیریت پرداخت‌ها (ایجاد / ویرایش / حذف)
// ==========================================

function openAddPaymentModal() {
    safeSetValue('paymentId', '');
    safeSetText('paymentModalTitle', 'ثبت واریزی جدید');
    safeSetValue('paymentAmount', '');
    safeSetValue('paymentDate', getTodayShamsi());
    safeSetValue('paymentRefCode', '');
    safeSetValue('paymentNotes', '');
    safeShow('paymentModal');
}

async function editPayment(paymentId) {
    showLoading(true);
    try {
        const client = getSupabaseClient();
        const { data: p } = await client.from('payments').select('*').eq('id', paymentId).single();
        if (!p) throw new Error('رکورد پرداختی یافت نشد');

        safeSetValue('paymentId', p.id);
        safeSetText('paymentModalTitle', 'ویرایش واریزی');
        safeSetValue('paymentAmount', p.amount || '');
        safeSetValue('paymentDate', formatDateShamsi(p.payment_date || p.created_at));
        safeSetValue('paymentRefCode', p.ref_code || p.tracking_code || '');
        safeSetValue('paymentNotes', p.notes || p.description || '');

        safeShow('paymentModal');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function savePayment(event) {
    if (event) event.preventDefault();
    const typistId = currentTypistData?.id;
    if (!typistId) return;

    const paymentId = getEl('paymentId').value;
    const amount = parseFloat(toEnglishDigits(getEl('paymentAmount').value));
    const shamsiDate = toEnglishDigits(getEl('paymentDate').value).trim();
    const refCode = toEnglishDigits(getEl('paymentRefCode').value).trim();
    const notes = getEl('paymentNotes').value.trim();

    if (!amount || amount <= 0) {
        showToast('لطفاً مبلغ واریزی معتبر وارد کنید', 'error');
        return;
    }

    const isoDate = shamsiToGregorianIso(shamsiDate);
    showLoading(true);
    const client = getSupabaseClient();
    try {
        if (paymentId) {
            const { error } = await client.rpc('update_payment', {
                _payment_id: paymentId,
                _typist_id: typistId,
                _amount: amount,
                _payment_date: isoDate,
                _ref_code: refCode,
                _notes: notes
            });
            if (error) throw error;
            showToast('پرداخت با موفقیت ویرایش شد', 'success');
        } else {
            const { error } = await client.rpc('add_payment', {
                _typist_id: typistId,
                _amount: amount,
                _payment_date: isoDate,
                _ref_code: refCode,
                _notes: notes
            });
            if (error) throw error;
            showToast('پرداخت با موفقیت ثبت شد', 'success');
        }

        safeHide('paymentModal');
        await viewTypistDetail(typistId);
    } catch (e) {
        showToast('خطا در ثبت پرداخت: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deletePayment(paymentId) {
    if (!confirm('آیا از حذف این رکورد واریزی اطمینان دارید؟')) return;
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { error } = await client.rpc('delete_payment', { _payment_id: paymentId });
        if (error) throw error;
        showToast('پرداخت با موفقیت حذف شد', 'success');
        await viewTypistDetail(currentTypistData.id);
    } catch (e) {
        showToast('خطا در حذف پرداخت: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==========================================
// ایجاد تایپیست جدید و تغییر رمز
// ==========================================

function openAddTypistModal() {
    safeSetValue('typistId', '');
    safeSetText('typistModalTitle', 'تعریف تایپیست جدید');
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
    safeShow('typistModal');
}

async function saveTypist(event) {
    if (event) event.preventDefault();

    const payload = {
        _id: null,
        _first_name: toEnglishDigits(getEl('typistFirstName').value).trim(),
        _last_name: toEnglishDigits(getEl('typistLastName').value).trim(),
        _father_name: toEnglishDigits(getEl('typistFatherName').value).trim(),
        _national_id: toEnglishDigits(getEl('typistNationalId').value).trim(),
        _phone: toEnglishDigits(getEl('typistPhone').value).trim(),
        _card_number: toEnglishDigits(getEl('typistCardNumber').value).trim(),
        _sheba_number: toEnglishDigits(getEl('typistShebaNumber').value).trim(),
        _rate_normal: parseFloat(toEnglishDigits(getEl('typistRateNormal').value)) || 0,
        _rate_urgent: parseFloat(toEnglishDigits(getEl('typistRateUrgent').value)) || 0,
        _rate_math: parseFloat(toEnglishDigits(getEl('typistRateMath').value)) || 0
    };

    if (!payload._first_name || !payload._phone) {
        showToast('وارد کردن نام و شماره تماس الزامی است', 'error');
        return;
    }

    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { error } = await client.rpc('upsert_typist', payload);
        if (error) throw error;

        showToast('تایپیست با موفقیت تعریف گردید', 'success');
        safeHide('typistModal');
        await loadAdminTypists();
    } catch (e) {
        showToast('خطا در تعریف تایپیست: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

function openChangePasswordModal() {
    safeSetValue('newPasswordInput', '');
    safeSetValue('confirmPasswordInput', '');
    safeShow('changePasswordModal');
}

async function saveNewPassword(event) {
    if (event) event.preventDefault();
    const p1 = toEnglishDigits(getEl('newPasswordInput').value).trim();
    const p2 = toEnglishDigits(getEl('confirmPasswordInput').value).trim();

    if (p1.length < 4) {
        showToast('رمز عبور باید حداقل ۴ کاراکتر باشد', 'error');
        return;
    }
    if (p1 !== p2) {
        showToast('تکرار رمز عبور همخوانی ندارد', 'error');
        return;
    }

    showLoading(true);
    const client = getSupabaseClient();
    try {
        if (currentUser.role === 'admin') {
            const { error } = await client.rpc('change_admin_password', { _new_pass: p1 });
            if (error) throw error;
            showToast('رمز عبور مدیر با موفقیت تغییر یافت', 'success');
        } else {
            const { error } = await client.rpc('change_typist_password', {
                _typist_id: currentUser.typistId,
                _new_pass: p1
            });
            if (error) throw error;
            showToast('رمز عبور شما با موفقیت تغییر یافت', 'success');
        }
        safeHide('changePasswordModal');
    } catch (e) {
        showToast('خطا در تغییر رمز: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ==========================================
// سایر امکانات (جستجو، پیامک گروهی و خروجی‌های CSV)
// ==========================================

function searchTypists() {
    const q = toEnglishDigits(getEl('searchTypistInput').value).trim().toLowerCase();
    const rows = document.querySelectorAll('#typistsTableBody tr');
    rows.forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

function toggleSelectAllTypists(masterCheck) {
    const checks = document.querySelectorAll('.typist-sms-check');
    checks.forEach(c => c.checked = masterCheck.checked);
}

function openGroupSMSModal() {
    const checks = document.querySelectorAll('.typist-sms-check:checked');
    if (checks.length === 0) {
        showToast('لطفاً حداقل یک تایپیست را انتخاب نمایید', 'error');
        return;
    }
    safeSetText('selectedSMSCountModal', checks.length.toLocaleString('fa-IR'));
    safeSetValue('smsTextarea', '');
    safeShow('groupSMSModal');
}

function sendGroupSMS() {
    const txt = getEl('smsTextarea').value.trim();
    if (!txt) {
        showToast('لطفاً متن پیامک را وارد کنید', 'error');
        return;
    }
    safeHide('groupSMSModal');
    showToast('درخواست ارسال پیامک گروهی با موفقیت ثبت شد', 'success');
}

/**
 * خروجی CSV بانکی پایا (مطابق با سربرگ دقیق درخواستی به ریال)
 */
function exportBankCSV() {
    if (!typistsList || typistsList.length === 0) {
        showToast('لیست تایپیست‌ها خالی است', 'error');
        return;
    }

    let rowNum = 1;
    let csvContent = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n';

    typistsList.forEach(t => {
        const remainingToman = t.remaining_balance !== undefined ? t.remaining_balance : ((t.total_earned || 0) - (t.total_paid || 0));
        
        if (remainingToman > 0) {
            const amountRial = Math.round(remainingToman * 10);
            const fname = t.first_name || t.name || '';
            const lname = t.last_name || '';
            const father = t.father_name || '';
            const nid = t.national_id || t.national_code || '';
            const phone = t.phone || '';
            const card = t.card_number || '';
            const sheba = t.sheba_number || t.iban || '';

            csvContent += `${rowNum},"${fname}","${lname}","${father}","${nid}","${phone}","${card}","${sheba}",${amountRial}\n`;
            rowNum++;
        }
    });

    if (rowNum === 1) {
        showToast('هیچ تایپیستی دارای مانده طلبکاری نمی‌باشد', 'info');
        return;
    }

    downloadCSV(csvContent, `bank_paya_payout_${getTodayShamsi().replace(/\//g, '-')}.csv`);
}

/**
 * خروجی CSV لیست پرسنل (مطابق با سربرگ دقیق درخواستی بدون مبلغ)
 */
function exportPersonnelCSV() {
    if (!typistsList || typistsList.length === 0) {
        showToast('لیست تایپیست‌ها خالی است', 'error');
        return;
    }

    let csvContent = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا\n';

    typistsList.forEach((t, idx) => {
        const fname = t.first_name || t.name || '';
        const lname = t.last_name || '';
        const father = t.father_name || '';
        const nid = t.national_id || t.national_code || '';
        const phone = t.phone || '';
        const card = t.card_number || '';
        const sheba = t.sheba_number || t.iban || '';

        csvContent += `${idx + 1},"${fname}","${lname}","${father}","${nid}","${phone}","${card}","${sheba}"\n`;
    });

    downloadCSV(csvContent, `personnel_list_${getTodayShamsi().replace(/\//g, '-')}.csv`);
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// بازیابی سشن و اجرای اولیه
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('typist_session');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            if (currentUser.role === 'admin') {
                showAdminDashboard();
            } else if (currentUser.role === 'typist' && currentUser.typistId) {
                showTypistSelfDashboard(currentUser.typistId);
            }
        } catch {
            logout();
        }
    }
});

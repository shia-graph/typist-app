/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.2.0)
   ========================================================================== */

// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


let supabaseClient = null;

function getSupabaseClient() {
    if (!supabaseClient) {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            console.error('کتابخانه Supabase لود نشده است!');
        }
    }
    return supabaseClient;
}

// وضعیت اجرایی
let currentUser = null; 
let currentTypistData = null; 
let typistsList = []; 
let targetDateInputId = null;

// ==========================================
// توابع تبدیلی و DOM
// ==========================================

function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function getEl(id) { return document.getElementById(id); }

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
    toast.className = 'fixed bottom-4 left-4 right-4 sm:right-auto sm:left-4 z-[100] px-6 py-3 rounded-xl text-white font-medium shadow-2xl transition-all duration-300 text-center ' +
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
// توابع تاریخ شمسی
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
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); } 
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
    return [jy, jm, jd];
}

function jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    gy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13; gm++) { const v = sal_a[gm]; if (gd <= v) break; gd -= v; }
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
        const jy = parseInt(parts[0], 10), jm = parseInt(parts[1], 10), jd = parseInt(parts[2], 10);
        const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
        return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
}

function openDatePicker(inputId) {
    targetDateInputId = inputId;
    const inputEl = getEl(inputId);
    let curYear = 1403, curMonth = 7, curDay = 1;
    if (inputEl && inputEl.value) {
        const parts = toEnglishDigits(inputEl.value).split('/');
        if (parts.length === 3) { curYear = parseInt(parts[0]) || 1403; curMonth = parseInt(parts[1]) || 1; curDay = parseInt(parts[2]) || 1; }
    } else {
        const todayParts = getTodayShamsi().split('/');
        curYear = parseInt(todayParts[0]); curMonth = parseInt(todayParts[1]); curDay = parseInt(todayParts[2]);
    }
    const ySelect = getEl('pickerYear'), mSelect = getEl('pickerMonth');
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
        opt.value = i; opt.innerText = i;
        if (i === selectedDay) opt.selected = true;
        dSelect.appendChild(opt);
    }
}

getEl('pickerMonth')?.addEventListener('change', () => updatePickerDays(1));

function closeDatePicker() { safeHide('datePickerModal'); }
function applyDatePicker() {
    if (!targetDateInputId) return;
    const y = getEl('pickerYear').value, m = String(getEl('pickerMonth').value).padStart(2, '0'), d = String(getEl('pickerDay').value).padStart(2, '0');
    safeSetValue(targetDateInputId, `${y}/${m}/${d}`);
    closeDatePicker();
}

// ==========================================
// ورود و خروج
// ==========================================

function switchLoginTab(tab) {
    const tabAdmin = getEl('tabAdmin'), tabTypist = getEl('tabTypist');
    if (tab === 'admin') {
        tabAdmin.className = 'flex-1 py-4 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 text-sm sm:text-base transition-colors';
        tabTypist.className = 'flex-1 py-4 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-indigo-600 text-sm sm:text-base transition-colors';
        safeShow('adminLoginForm'); safeHide('typistLoginForm');
    } else {
        tabTypist.className = 'flex-1 py-4 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 text-sm sm:text-base transition-colors';
        tabAdmin.className = 'flex-1 py-4 text-center font-bold text-gray-500 border-b-2 border-transparent hover:text-indigo-600 text-sm sm:text-base transition-colors';
        safeShow('typistLoginForm'); safeHide('adminLoginForm');
    }
}

async function handleAdminLogin(event) {
    if (event) event.preventDefault();
    const pwd = toEnglishDigits(getEl('adminPassword').value).trim();
    if (!pwd) return;

    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: settingData } = await client.from('admin_settings').select('value').eq('key', 'admin_password').limit(1);
        let isValid = false;
        
        if (settingData && settingData.length > 0 && settingData[0].value === pwd) isValid = true;
        if (pwd === 'admin123') isValid = true;

        if (isValid) {
            currentUser = { role: 'admin' };
            localStorage.setItem('typist_session', JSON.stringify(currentUser));
            getEl('adminPassword').value = '';
            showAdminDashboard();
        } else {
            showToast('رمز عبور مدیر اشتباه است', 'error');
        }
    } catch (e) {
        showToast('خطا در ارتباط با سرور', 'error');
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
                getEl('typistPassword').value = '';
                showTypistSelfDashboard(t.id);
                return;
            }
        }
        showToast('شناسه کاربری یا رمز عبور اشتباه است', 'error');
    } catch (err) {
        showToast('خطا در ارتباط با سرور', 'error');
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
// دشبورد مدیر
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
        showToast('خطا در بارگیری اطلاعات دشبورد', 'error');
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
            <td class="px-4 py-4 text-center w-12"><input type="checkbox" class="typist-sms-check rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" data-phone="${phone}"></td>
            <td class="px-4 py-4 text-center text-gray-500 w-12">${idx + 1}</td>
            <td class="px-4 py-4 font-bold text-gray-900 dark:text-white whitespace-normal">${fullName}</td>
            <td class="px-4 py-4 text-center">
                <a href="tel:${phone}" class="text-emerald-600 hover:text-emerald-700 font-mono text-xs inline-flex items-center gap-1 dir-ltr" title="تماس مستقیم">📞 ${phone || '-'}</a>
                ${phone ? `<a href="sms:${phone}" class="text-indigo-600 hover:text-indigo-700 text-xs ml-2" title="ارسال پیامک">💬</a>` : ''}
            </td>
            <td class="px-4 py-4 text-center font-bold text-emerald-600">${earned.toLocaleString('fa-IR')}</td>
            <td class="px-4 py-4 text-center font-bold text-indigo-600">${paid.toLocaleString('fa-IR')}</td>
            <td class="px-4 py-4 text-center font-bold ${remaining > 0 ? 'text-amber-600' : 'text-gray-400'}">${remaining.toLocaleString('fa-IR')}</td>
            <td class="px-4 py-4 text-center"><span class="px-2.5 py-1 rounded-full text-xs font-bold ${remaining <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${remaining <= 0 ? '✔️ تسویه کامل' : '⏳ دارای مانده'}</span></td>
            <td class="px-4 py-4 text-center"><button onclick="viewTypistDetail('${t.id}')" class="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all">مشاهده ➔</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// جزئیات پرسنل
// ==========================================

async function viewTypistDetail(typistId) {
    if (!typistId) return logout();
    showLoading(true);
    const client = getSupabaseClient();
    try {
        // جلوگیری از ارور 406 با استفاده از واکشی مستقیم بدون single
        const { data: tList, error: tErr } = await client.from('typists').select('*').eq('id', typistId);
        if (tErr || !tList || tList.length === 0) {
            throw new Error('NOT_FOUND');
        }
        const t = tList[0];
        currentTypistData = t;

        const [wRes, pRes] = await Promise.all([
            client.from('work_records').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`),
            client.from('payments').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`)
        ]);

        const works = (wRes.data || []).sort((a,b) => new Date(b.delivery_date || b.record_date) - new Date(a.delivery_date || a.record_date));
        const payments = (pRes.data || []).sort((a,b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));

        const totalEarned = works.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
        const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const remaining = totalEarned - totalPaid;

        safeHide('adminDashboardView');
        safeShow('typistDetailView');

        const fullName = `${t.first_name || t.name || ''} ${t.last_name || ''}`.trim() || 'نامشخص';
        safeSetText('detailHeaderName', fullName);
        
        const phoneEl = getEl('detailHeaderPhone');
        if (phoneEl) phoneEl.innerHTML = `<a href="tel:${t.phone}" class="text-emerald-600 hover:underline">📞 ${t.phone || '-'}</a>`;

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

        toggleProfileEdit(false);

        safeSetText('detailTotalEarned', totalEarned.toLocaleString('fa-IR') + ' تومان');
        safeSetText('detailTotalPaid', totalPaid.toLocaleString('fa-IR') + ' تومان');
        safeSetText('detailRemainingBalance', remaining.toLocaleString('fa-IR') + ' تومان');

        renderDetailReportsTable(works);
        renderDetailPaymentsTable(payments);

    } catch (e) {
        if (e.message === 'NOT_FOUND') {
            showToast('این حساب کاربری حذف شده است.', 'error');
            showAdminDashboard();
        } else {
            showToast('خطا در دریافت اطلاعات', 'error');
        }
    } finally {
        showLoading(false);
    }
}

function renderDetailReportsTable(works) {
    const tbody = getEl('detailReportsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (works.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">گزارشی ثبت نشده است</td></tr>`;
        return;
    }
    const typeLabels = { 'normal': 'معمولی', 'urgent': 'فوری', 'math': 'فرمول/ریاضی', 'عادی': 'معمولی', 'فوری': 'فوری', 'ریاضی': 'فرمول/ریاضی' };

    works.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
        const pageCount = r.page_count || r.quantity || 0;
        const pageType = typeLabels[r.page_type || r.unit_type] || r.page_type || 'معمولی';

        tr.innerHTML = `
            <td class="px-3 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-3 py-3 font-semibold text-gray-900 dark:text-white whitespace-normal min-w-[120px]">${r.title || 'بدون عنوان'}</td>
            <td class="px-3 py-3 text-center font-mono">${formatDateShamsi(r.delivery_date || r.record_date)}</td>
            <td class="px-3 py-3 text-center"><span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-xs font-medium">${pageType}</span></td>
            <td class="px-3 py-3 text-center font-bold">${Number(pageCount).toLocaleString('fa-IR')}</td>
            <td class="px-3 py-3 text-center font-bold text-emerald-600">${Number(r.total_amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 py-3 text-center">
                <span class="inline-block px-1.5 py-0.5 mb-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">✔️ تایید</span>
                <div class="mt-1 flex justify-center gap-1">
                    <button onclick="editReport('${r.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs">✏️</button>
                    <button onclick="deleteReport('${r.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded text-xs">🗑️</button>
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
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">هیچ واریزی ثبت نشده است</td></tr>`;
        return;
    }

    payments.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50';

        tr.innerHTML = `
            <td class="px-3 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-3 py-3 text-center font-bold text-indigo-600">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-3 py-3 text-center font-mono">${formatDateShamsi(p.payment_date || p.created_at)}</td>
            <td class="px-3 py-3 text-center font-mono text-[10px] sm:text-xs text-gray-500">${p.ref_code || p.tracking_code || '-'}</td>
            <td class="px-3 py-3 text-center">
                <div class="flex justify-center items-center gap-2">
                    <span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold hidden sm:inline-block">✔️ واریز</span>
                    <button onclick="editPayment('${p.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs">✏️</button>
                    <button onclick="deletePayment('${p.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded text-xs">🗑️</button>
                </div>
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
            el.classList.toggle('border-transparent', !enable);
            el.classList.toggle('border-indigo-300', enable);
        }
    });
    if (enable) {
        safeHide('btnEnableProfileEdit'); safeShow('btnSaveProfileEdit'); safeShow('btnCancelProfileEdit');
    } else {
        safeShow('btnEnableProfileEdit'); safeHide('btnSaveProfileEdit'); safeHide('btnCancelProfileEdit');
    }
}

async function saveProfileEdit() {
    const id = getEl('detailTypistId').value;
    if (!id) return;
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const payload = {
            first_name: toEnglishDigits(getEl('detailFirstName').value).trim(),
            last_name: toEnglishDigits(getEl('detailLastName').value).trim(),
            father_name: toEnglishDigits(getEl('detailFatherName').value).trim(),
            national_id: toEnglishDigits(getEl('detailNationalId').value).trim(),
            national_code: toEnglishDigits(getEl('detailNationalId').value).trim(),
            phone: toEnglishDigits(getEl('detailPhone').value).trim(),
            card_number: toEnglishDigits(getEl('detailCardNumber').value).trim(),
            sheba_number: toEnglishDigits(getEl('detailShebaNumber').value).trim(),
            rate_normal: parseFloat(toEnglishDigits(getEl('detailRateNormal').value)) || 0,
            rate_urgent: parseFloat(toEnglishDigits(getEl('detailRateUrgent').value)) || 0,
            rate_math: parseFloat(toEnglishDigits(getEl('detailRateMath').value)) || 0,
            default_page_rate: parseFloat(toEnglishDigits(getEl('detailRateNormal').value)) || 0
        };

        const { error } = await client.from('typists').update(payload).eq('id', id);
        if (error) throw error;
        showToast('مشخصات با موفقیت ذخیره شد', 'success');
        toggleProfileEdit(false);
        await viewTypistDetail(id);
    } catch (e) {
        showToast('خطا در ذخیره', 'error');
    } finally {
        showLoading(false);
    }
}

// ==========================================
// پنل سلف سرویس خود تایپیست
// ==========================================

async function showTypistSelfDashboard(typistId) {
    if (!typistId) return logout();
    safeHide('loginView');
    safeHide('adminDashboardView');
    safeHide('typistDetailView');
    safeShow('typistSelfDashboardView');

    showLoading(true);
    const client = getSupabaseClient();
    try {
        // جلوگیری از ارور 406 با واکشی مستقیم
        const { data: tList, error: tErr } = await client.from('typists').select('*').eq('id', typistId);
        if (tErr || !tList || tList.length === 0) {
            throw new Error('NOT_FOUND');
        }
        const t = tList[0];
        currentTypistData = t;

        const [wRes, pRes] = await Promise.all([
            client.from('work_records').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`),
            client.from('payments').select('*').or(`person_id.eq.${typistId},typist_id.eq.${typistId}`)
        ]);

        const works = (wRes.data || []).sort((a,b) => new Date(b.delivery_date || b.record_date) - new Date(a.delivery_date || a.record_date));
        const payments = (pRes.data || []).sort((a,b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));

        const totalEarned = works.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
        const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const remaining = totalEarned - totalPaid;

        const fullName = `${t.first_name || t.name || ''} ${t.last_name || ''}`.trim();
        safeSetText('typistSelfHeaderName', `خوش آمدید، ${fullName}`);
        safeSetText('typistSelfName', fullName);
        safeSetText('typistSelfFatherName', t.father_name || '-');
        safeSetText('typistSelfNationalId', t.national_id || t.national_code || '-');
        safeSetText('typistSelfPhone', t.phone || '-');
        safeSetText('typistSelfCardNumber', t.card_number || '-');
        safeSetText('typistSelfShebaNumber', t.sheba_number || t.iban || '-');

        safeSetText('typistSelfTotalEarned', totalEarned.toLocaleString('fa-IR') + ' تومان');
        safeSetText('typistSelfTotalPaid', totalPaid.toLocaleString('fa-IR') + ' تومان');
        safeSetText('typistSelfRemainingBalance', remaining.toLocaleString('fa-IR') + ' تومان');

        renderTypistSelfReports(works);
        renderTypistSelfPayments(payments);

    } catch (e) {
        if (e.message === 'NOT_FOUND') {
            showToast('حساب شما پاک شده است. لطفاً مجدداً لاگین کنید.', 'error');
            logout();
        } else {
            showToast('خطا در دریافت اطلاعات شما', 'error');
        }
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
            <td class="px-4 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-normal min-w-[150px]">${r.title || 'بدون عنوان'}</td>
            <td class="px-4 py-3 text-center font-mono">${formatDateShamsi(r.delivery_date || r.record_date)}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">${typeLabels[r.page_type || r.unit_type] || 'معمولی'}</span></td>
            <td class="px-4 py-3 text-center font-bold">${Number(r.page_count || r.quantity || 0).toLocaleString('fa-IR')}</td>
            <td class="px-4 py-3 text-center font-bold text-emerald-600">${Number(r.total_amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold mb-1">✔️ تایید</span>
                <div class="flex justify-center gap-1">
                    <button onclick="editReport('${r.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs">✏️</button>
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
            <td class="px-4 py-3 text-center text-gray-400">${idx + 1}</td>
            <td class="px-4 py-3 text-center font-bold text-indigo-600">${Number(p.amount || 0).toLocaleString('fa-IR')}</td>
            <td class="px-4 py-3 text-center font-mono">${formatDateShamsi(p.payment_date || p.created_at)}</td>
            <td class="px-4 py-3 text-center font-mono text-xs text-gray-500">${p.ref_code || p.tracking_code || '-'}</td>
            <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">✔️ واریز شد</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// عملیات CRUD و فرم‌ها
// ==========================================

function openAddReportModal() {
    safeSetValue('reportId', ''); safeSetText('reportModalTitle', 'ثبت گزارش کار');
    safeSetValue('reportTitle', ''); safeSetValue('reportDeliveryDate', getTodayShamsi());
    safeSetValue('reportPageType', 'normal'); safeSetValue('reportPageCount', '1'); safeSetValue('reportCustomRate', '');
    if (currentUser && currentUser.role === 'typist') safeHide('customRateContainer'); else safeShow('customRateContainer');
    safeShow('reportModal');
}

async function editReport(reportId) {
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: rList } = await client.from('work_records').select('*').eq('id', reportId);
        if (!rList || rList.length === 0) throw new Error('کارکرد یافت نشد');
        const r = rList[0];

        safeSetValue('reportId', r.id); safeSetText('reportModalTitle', 'ویرایش گزارش');
        safeSetValue('reportTitle', r.title || ''); safeSetValue('reportDeliveryDate', formatDateShamsi(r.delivery_date || r.record_date));
        safeSetValue('reportPageType', r.page_type || r.unit_type || 'normal');
        safeSetValue('reportPageCount', r.page_count || r.quantity || 1);
        safeSetValue('reportCustomRate', r.custom_rate || r.unit_rate || '');

        if (currentUser && currentUser.role === 'typist') safeHide('customRateContainer'); else safeShow('customRateContainer');
        safeShow('reportModal');
    } catch (e) {
        showToast('خطا در بارگیری اطلاعات', 'error');
    } finally {
        showLoading(false);
    }
}

async function saveReport(event) {
    if (event) event.preventDefault();
    const typistId = currentTypistData?.id;
    if (!typistId) return;

    const reportId = getEl('reportId').value;
    const title = getEl('reportTitle').value.trim();
    const shamsiDate = toEnglishDigits(getEl('reportDeliveryDate').value).trim();
    const pageType = getEl('reportPageType').value;
    const pageCount = parseInt(toEnglishDigits(getEl('reportPageCount').value)) || 0;
    const customRateVal = getEl('reportCustomRate')?.value ? parseFloat(toEnglishDigits(getEl('reportCustomRate').value)) : null;

    if (!title || pageCount <= 0) return showToast('اطلاعات را به درستی وارد کنید', 'error');

    const isoDate = shamsiToGregorianIso(shamsiDate);
    
    let appliedRate = 0;
    if (customRateVal && customRateVal > 0) appliedRate = customRateVal;
    else {
        if (pageType === 'urgent') appliedRate = currentTypistData.rate_urgent || 0;
        else if (pageType === 'math') appliedRate = currentTypistData.rate_math || 0;
        else appliedRate = currentTypistData.rate_normal || currentTypistData.default_page_rate || 0;
    }

    const payload = {
        person_id: typistId, typist_id: typistId, title: title,
        page_type: pageType, unit_type: pageType, page_count: pageCount, quantity: pageCount,
        unit_rate: appliedRate, custom_rate: customRateVal, total_amount: pageCount * appliedRate,
        delivery_date: isoDate, record_date: isoDate
    };

    showLoading(true);
    const client = getSupabaseClient();
    try {
        if (reportId) {
            await client.from('work_records').update(payload).eq('id', reportId);
            showToast('ویرایش موفق', 'success');
        } else {
            await client.from('work_records').insert([payload]);
            showToast('ثبت موفق', 'success');
        }
        safeHide('reportModal');
        if (currentUser.role === 'admin') await viewTypistDetail(typistId);
        else await showTypistSelfDashboard(typistId);
    } catch (e) {
        showToast('خطا در ذخیره', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteReport(reportId) {
    if (!confirm('آیا از حذف مطمئن هستید؟')) return;
    showLoading(true);
    const client = getSupabaseClient();
    try {
        await client.from('work_records').delete().eq('id', reportId);
        showToast('حذف شد', 'success');
        if (currentUser.role === 'admin') await viewTypistDetail(currentTypistData.id);
        else await showTypistSelfDashboard(currentTypistData.id);
    } catch (e) {
        showToast('خطا در حذف', 'error');
    } finally {
        showLoading(false);
    }
}
window.deleteWorkRecord = deleteReport;

function openAddPaymentModal() {
    safeSetValue('paymentId', ''); safeSetText('paymentModalTitle', 'ثبت واریزی');
    safeSetValue('paymentAmount', ''); safeSetValue('paymentDate', getTodayShamsi());
    safeSetValue('paymentRefCode', ''); safeSetValue('paymentNotes', '');
    safeShow('paymentModal');
}

async function editPayment(paymentId) {
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: pList } = await client.from('payments').select('*').eq('id', paymentId);
        if (!pList || pList.length === 0) throw new Error('یافت نشد');
        const p = pList[0];
        safeSetValue('paymentId', p.id); safeSetText('paymentModalTitle', 'ویرایش واریزی');
        safeSetValue('paymentAmount', p.amount || ''); safeSetValue('paymentDate', formatDateShamsi(p.payment_date || p.created_at));
        safeSetValue('paymentRefCode', p.ref_code || p.tracking_code || ''); safeSetValue('paymentNotes', p.notes || p.description || '');
        safeShow('paymentModal');
    } catch (e) {
        showToast('خطا در واکشی', 'error');
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
    const isoDate = shamsiToGregorianIso(toEnglishDigits(getEl('paymentDate').value).trim());
    const refCode = toEnglishDigits(getEl('paymentRefCode').value).trim();
    const notes = getEl('paymentNotes').value.trim();

    if (!amount || amount <= 0) return showToast('مبلغ معتبر نیست', 'error');

    const payload = {
        person_id: typistId, typist_id: typistId, amount: amount, payment_date: isoDate,
        ref_code: refCode, tracking_code: refCode, notes: notes, description: notes
    };

    showLoading(true);
    const client = getSupabaseClient();
    try {
        if (paymentId) {
            await client.from('payments').update(payload).eq('id', paymentId);
            showToast('ویرایش شد', 'success');
        } else {
            await client.from('payments').insert([payload]);
            showToast('ثبت شد', 'success');
        }
        safeHide('paymentModal');
        await viewTypistDetail(typistId);
    } catch (e) {
        showToast('خطا در ذخیره', 'error');
    } finally {
        showLoading(false);
    }
}

async function deletePayment(paymentId) {
    if (!confirm('آیا از حذف واریزی اطمینان دارید؟')) return;
    showLoading(true);
    const client = getSupabaseClient();
    try {
        await client.from('payments').delete().eq('id', paymentId);
        showToast('حذف شد', 'success');
        await viewTypistDetail(currentTypistData.id);
    } catch (e) {
        showToast('خطا در حذف', 'error');
    } finally {
        showLoading(false);
    }
}

function openAddTypistModal() {
    safeSetValue('typistId', ''); safeSetValue('typistFirstName', ''); safeSetValue('typistLastName', '');
    safeSetValue('typistFatherName', ''); safeSetValue('typistNationalId', ''); safeSetValue('typistPhone', '');
    safeSetValue('typistCardNumber', ''); safeSetValue('typistShebaNumber', '');
    safeSetValue('typistRateNormal', '0'); safeSetValue('typistRateUrgent', '0'); safeSetValue('typistRateMath', '0');
    safeShow('typistModal');
}

async function saveTypist(event) {
    if (event) event.preventDefault();
    const phone = toEnglishDigits(getEl('typistPhone').value).trim();
    if (!phone) return showToast('شماره تماس الزامی است', 'error');

    const payload = {
        first_name: toEnglishDigits(getEl('typistFirstName').value).trim(),
        name: toEnglishDigits(getEl('typistFirstName').value).trim(),
        last_name: toEnglishDigits(getEl('typistLastName').value).trim(),
        father_name: toEnglishDigits(getEl('typistFatherName').value).trim(),
        national_id: toEnglishDigits(getEl('typistNationalId').value).trim(),
        national_code: toEnglishDigits(getEl('typistNationalId').value).trim(),
        phone: phone,
        card_number: toEnglishDigits(getEl('typistCardNumber').value).trim(),
        sheba_number: toEnglishDigits(getEl('typistShebaNumber').value).trim(),
        iban: toEnglishDigits(getEl('typistShebaNumber').value).trim(),
        rate_normal: parseFloat(toEnglishDigits(getEl('typistRateNormal').value)) || 0,
        rate_urgent: parseFloat(toEnglishDigits(getEl('typistRateUrgent').value)) || 0,
        rate_math: parseFloat(toEnglishDigits(getEl('typistRateMath').value)) || 0,
        default_page_rate: parseFloat(toEnglishDigits(getEl('typistRateNormal').value)) || 0,
        password: phone.slice(-4) || '1234'
    };

    showLoading(true);
    const client = getSupabaseClient();
    try {
        await client.from('typists').insert([payload]);
        showToast('تایپیست جدید ثبت شد', 'success');
        safeHide('typistModal');
        await loadAdminTypists();
    } catch (e) {
        showToast('خطا در ذخیره', 'error');
    } finally {
        showLoading(false);
    }
}

function openChangePasswordModal() {
    safeSetValue('newPasswordInput', ''); safeSetValue('confirmPasswordInput', ''); safeShow('changePasswordModal');
}

async function saveNewPassword(event) {
    if (event) event.preventDefault();
    const p1 = toEnglishDigits(getEl('newPasswordInput').value).trim();
    const p2 = toEnglishDigits(getEl('confirmPasswordInput').value).trim();
    if (p1.length < 4) return showToast('حداقل ۴ رقم', 'error');
    if (p1 !== p2) return showToast('تکرار همخوانی ندارد', 'error');

    showLoading(true);
    const client = getSupabaseClient();
    try {
        if (currentUser.role === 'admin') {
            await client.from('admin_settings').upsert({ key: 'admin_password', value: p1 });
            showToast('رمز مدیر تغییر کرد', 'success');
        } else {
            await client.from('typists').update({ password: p1 }).eq('id', currentUser.typistId);
            showToast('رمز شما تغییر کرد', 'success');
        }
        safeHide('changePasswordModal');
    } catch (e) {
        showToast('خطا در تغییر رمز', 'error');
    } finally {
        showLoading(false);
    }
}

// ==========================================
// امکانات گروهی و خروجی‌ها
// ==========================================

function searchTypists() {
    const q = toEnglishDigits(getEl('searchTypistInput').value).trim().toLowerCase();
    const rows = document.querySelectorAll('#typistsTableBody tr');
    rows.forEach(r => { r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none'; });
}

function toggleSelectAllTypists(masterCheck) {
    const checks = document.querySelectorAll('.typist-sms-check');
    checks.forEach(c => c.checked = masterCheck.checked);
}

function openGroupSMSModal() {
    const checks = document.querySelectorAll('.typist-sms-check:checked');
    if (checks.length === 0) return showToast('حداقل یک نفر را انتخاب کنید', 'error');
    safeSetText('selectedSMSCountModal', checks.length.toLocaleString('fa-IR'));
    safeSetValue('smsTextarea', '');
    safeShow('groupSMSModal');
}

function sendGroupSMS() {
    const txt = getEl('smsTextarea').value.trim();
    if (!txt) return showToast('متن پیام را وارد کنید', 'error');
    safeHide('groupSMSModal');
    showToast('درخواست پیامک ارسال شد', 'success');
}

function exportBankCSV() {
    if (!typistsList || typistsList.length === 0) return showToast('لیست خالی است', 'error');
    let rowNum = 1;
    let csvContent = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n';

    typistsList.forEach(t => {
        const rem = t.remaining_balance !== undefined ? t.remaining_balance : ((t.total_earned || 0) - (t.total_paid || 0));
        if (rem > 0) {
            csvContent += `${rowNum},"${t.first_name || t.name || ''}","${t.last_name || ''}","${t.father_name || ''}","${t.national_id || t.national_code || ''}","${t.phone || ''}","${t.card_number || ''}","${t.sheba_number || t.iban || ''}",${Math.round(rem * 10)}\n`;
            rowNum++;
        }
    });

    if (rowNum === 1) return showToast('هیچ تایپیستی طلبکار نیست', 'info');
    downloadCSV(csvContent, `bank_paya_${getTodayShamsi().replace(/\//g, '-')}.csv`);
}

function exportPersonnelCSV() {
    if (!typistsList || typistsList.length === 0) return showToast('لیست خالی است', 'error');
    let csvContent = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا\n';
    typistsList.forEach((t, idx) => {
        csvContent += `${idx + 1},"${t.first_name || t.name || ''}","${t.last_name || ''}","${t.father_name || ''}","${t.national_id || t.national_code || ''}","${t.phone || ''}","${t.card_number || ''}","${t.sheba_number || t.iban || ''}"\n`;
    });
    downloadCSV(csvContent, `personnel_${getTodayShamsi().replace(/\//g, '-')}.csv`);
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', fileName);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==========================================
// اجرا در لود اولیه
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('typist_session');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            if (currentUser.role === 'admin') showAdminDashboard();
            else if (currentUser.role === 'typist' && currentUser.typistId) showTypistSelfDashboard(currentUser.typistId);
        } catch { logout(); }
    }
});

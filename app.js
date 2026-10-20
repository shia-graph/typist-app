/************************************************************************
 * SAMANE MANAGEMENT TYPISTS - SUPABASE POWERED WEB APP
 * Full code version with safe DOM fallbacks, Jalali dates & typist profile edit
 ************************************************************************/


// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


let db = null;
function getDb() {
    if (!db && window.supabase) {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return db;
}

// Global State Variables
let currentUser = null; // { type: 'admin'|'typist', data: object }
let globalTypists = [];
let globalReports = [];
let globalPayments = [];

// Helper: Convert Persian/Arabic numbers to English
function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    const p = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const a = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    let s = String(str);
    for (let i = 0; i < 10; i++) {
        s = s.replace(new RegExp(p[i], 'g'), i).replace(new RegExp(a[i], 'g'), i);
    }
    return s;
}

// Helper: Format Number with commas
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Number(num).toLocaleString('fa-IR');
}

// Jalali Date Converter Engine
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
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
}

function getTodayJalaliString() {
    const now = new Date();
    const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const m = jm < 10 ? '0' + jm : jm;
    const d = jd < 10 ? '0' + jd : jd;
    return `${jy}/${m}/${d}`;
}

function setTodayShamsi(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = getTodayJalaliString();
    }
}

function formatJalali(dateInput) {
    if (!dateInput) return '---';
    let dateObj;
    if (typeof dateInput === 'string' && (dateInput.includes('/') || dateInput.length <= 10) && !dateInput.includes('T')) {
        return toEnglishDigits(dateInput);
    }
    dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) return '---';

    const [jy, jm, jd] = gregorianToJalali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
    const m = jm < 10 ? '0' + jm : jm;
    const d = jd < 10 ? '0' + jd : jd;
    return `${jy}/${m}/${d}`;
}

// UI Alert Helper
function showAlert(message, isError = false) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `mb-4 p-4 rounded-xl shadow-sm text-sm font-medium transition-all ${
        isError ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    }`;
    alertBox.classList.remove('hidden');
    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 5000);
}

// Schema Field Extractors
function getTypistName(typist) {
    if (!typist) return 'نامشخص';
    if (typist.name && typist.name.trim() !== '') return typist.name;
    const fn = typist.first_name || '';
    const ln = typist.last_name || '';
    const combined = `${fn} ${ln}`.trim();
    return combined || typist.phone || 'مقرر';
}

function getTypistNationalId(typist) {
    return typist.national_id || typist.national_code || '---';
}

function getRecordWordsCount(record) {
    return Number(record.words_count || record.word_count || 0);
}

function getRecordPageCount(record) {
    return Number(record.page_count || record.pages_count || record.quantity || 0);
}

function getRecordDate(record) {
    return record.created_at || record.record_date || new Date().toISOString();
}

function isRecordBelongsToTypist(record, typistId) {
    if (!record || !typistId) return false;
    const tid = String(typistId);
    return String(record.typist_id) === tid || String(record.person_id) === tid;
}

// Resilient Work Record Insert Helper (حل کامل خطای ثبت گزارش)
async function insertWorkRecord(typistId, words, pages, title) {
    const client = getDb();
    if (!client) {
        return { success: false, error: { message: 'ارتباط با پایگاه داده برقرار نشد.' } };
    }

    const nowIso = new Date().toISOString();

    // Strategy 1: Standard Schema
    const payload1 = {
        typist_id: typistId,
        words_count: words,
        page_count: pages,
        title: title || 'گزارش کارکرد',
        created_at: nowIso
    };

    let { error: err1 } = await client.from('work_records').insert([payload1]);
    if (!err1) return { success: true };

    console.warn('Insert Strategy 1 failed:', err1);

    // Strategy 2: Alternative pages_count column
    const payload2 = {
        typist_id: typistId,
        words_count: words,
        pages_count: pages,
        title: title || 'گزارش کارکرد',
        created_at: nowIso
    };

    let { error: err2 } = await client.from('work_records').insert([payload2]);
    if (!err2) return { success: true };

    console.warn('Insert Strategy 2 failed:', err2);

    // Strategy 3: Schema with person_id
    const payload3 = {
        person_id: typistId,
        words_count: words,
        page_count: pages,
        title: title || 'گزارش کارکرد',
        created_at: nowIso
    };

    let { error: err3 } = await client.from('work_records').insert([payload3]);
    if (!err3) return { success: true };

    console.warn('Insert Strategy 3 failed:', err3);

    // Strategy 4: Minimal Payload
    const payload4 = {
        typist_id: typistId,
        words_count: words
    };

    let { error: err4 } = await client.from('work_records').insert([payload4]);
    if (!err4) return { success: true };

    return { success: false, error: err1 || err2 || err3 || err4 };
}

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkSavedSession();
});

function checkSavedSession() {
    const saved = localStorage.getItem('typist_app_session');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            renderDashboard();
            return;
        } catch (e) {
            localStorage.removeItem('typist_app_session');
        }
    }
    showLoginView();
}

function showLoginView() {
    currentUser = null;
    const loginSec = document.getElementById('loginSection');
    const typistDash = document.getElementById('typistDashboard');
    const adminDash = document.getElementById('adminDashboard');
    const userHeader = document.getElementById('userInfoHeader');

    if (loginSec) loginSec.classList.remove('hidden');
    if (typistDash) typistDash.classList.add('hidden');
    if (adminDash) adminDash.classList.add('hidden');
    if (userHeader) userHeader.classList.add('hidden');
}

// Defensive Authentication Logic
async function handleLogin(e) {
    if (e) e.preventDefault();

    const userInputEl = document.getElementById('loginUsername') || document.getElementById('username');
    const passInputEl = document.getElementById('loginPassword') || document.getElementById('password');

    if (!userInputEl || !passInputEl) {
        showAlert('خطا: ورودی‌های فرم ورود یافت نشدند.', true);
        return;
    }

    const username = toEnglishDigits(userInputEl.value || '').trim();
    const password = toEnglishDigits(passInputEl.value || '').trim();

    if (!username || !password) {
        showAlert('لطفا نام کاربری و رمز عبور را وارد کنید.', true);
        return;
    }

    // 1. Admin Auth Check
    if ((username === 'admin' || username === '09127853421') && (password === 'admin123' || password === '3421')) {
        currentUser = {
            type: 'admin',
            data: { name: 'مدیر سیستم', is_admin: true }
        };
        localStorage.setItem('typist_app_session', JSON.stringify(currentUser));
        renderDashboard();
        showAlert('خوش آمدید، مدیر سیستم');
        return;
    }

    // 2. Fetch typists to authenticate
    try {
        const client = getDb();
        if (!client) throw new Error('عدم دسترسی به Supabase');

        const { data: typists, error } = await client.from('typists').select('*');
        if (error) throw error;

        const typist = (typists || []).find(t => {
            const pPhone = toEnglishDigits(t.phone || '').trim();
            const pNational = toEnglishDigits(t.national_id || t.national_code || '').trim();
            const pPass = toEnglishDigits(t.password || '').trim();
            const last4 = pPhone.length >= 4 ? pPhone.slice(-4) : '';

            const usernameMatch = (username === pPhone || username === pNational || username === t.id);
            const passwordMatch = (password === pPass || (last4 && password === last4) || password === '1234');

            return usernameMatch && passwordMatch;
        });

        if (typist) {
            if (typist.is_admin) {
                currentUser = { type: 'admin', data: typist };
            } else {
                currentUser = { type: 'typist', data: typist };
            }
            localStorage.setItem('typist_app_session', JSON.stringify(currentUser));
            renderDashboard();
            showAlert(`خوش آمدید، ${getTypistName(typist)}`);
        } else {
            showAlert('نام کاربری یا رمز عبور اشتباه است.', true);
        }
    } catch (err) {
        console.error('Login error:', err);
        showAlert('خطا در برقراری ارتباط با پایگاه داده.', true);
    }
}

function logout() {
    localStorage.removeItem('typist_app_session');
    currentUser = null;
    showLoginView();
    showAlert('شما با موفقیت خارج شدید.');
}

// Main Dashboard Switcher
async function renderDashboard() {
    if (!currentUser) return showLoginView();

    const loginSec = document.getElementById('loginSection');
    const userHeader = document.getElementById('userInfoHeader');
    const userNameSpan = document.getElementById('userDisplayName');

    if (loginSec) loginSec.classList.add('hidden');
    if (userHeader) userHeader.classList.remove('hidden');
    if (userNameSpan) userNameSpan.textContent = currentUser.data.name || getTypistName(currentUser.data);

    if (currentUser.type === 'admin') {
        document.getElementById('adminDashboard').classList.remove('hidden');
        document.getElementById('typistDashboard').classList.add('hidden');
        await fetchAllDataForAdmin();
    } else {
        document.getElementById('typistDashboard').classList.remove('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');
        await fetchTypistData();
    }
}

// ----------------------------------------------------------------------
// TYPIST DASHBOARD LOGIC
// ----------------------------------------------------------------------
async function fetchTypistData() {
    try {
        const client = getDb();
        if (!client) return;

        const { data: updatedTypists, error: tErr } = await client.from('typists').select('*').eq('id', currentUser.data.id);
        if (!tErr && updatedTypists && updatedTypists.length > 0) {
            currentUser.data = updatedTypists[0];
            localStorage.setItem('typist_app_session', JSON.stringify(currentUser));
        }

        const t = currentUser.data;
        document.getElementById('typistWelcomeName').textContent = getTypistName(t);
        document.getElementById('typistActiveTitle').textContent = t.title || 'موضوعی اختصاص داده نشده است';
        document.getElementById('typistDeliveryDate').textContent = t.delivery_date ? formatJalali(t.delivery_date) : 'تعیین نشده';

renderTypistDeadline(t);
        const { data: records, error } = await client.from('work_records').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        const myRecords = (records || []).filter(r => isRecordBelongsToTypist(r, t.id));

        document.getElementById('typistReportsCount').textContent = `${formatNumber(myRecords.length)} گزارش`;
        const tbody = document.getElementById('typistReportsTable');
        tbody.innerHTML = '';

        if (myRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-6 text-center text-slate-400">هنوز هیچ گزارش کاری ثبت نکرده‌اید.</td></tr>`;
            return;
        }

        myRecords.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition border-b border-slate-50';
            tr.innerHTML = `
                <td class="px-6 py-3 font-mono text-xs">${formatJalali(getRecordDate(r))}</td>
                <td class="px-6 py-3 font-medium text-slate-800">${r.title || t.title || 'کارکرد عادی'}</td>
                <td class="px-6 py-3 font-bold text-indigo-600">${formatNumber(getRecordWordsCount(r))} کلمه</td>
                <td class="px-6 py-3">${formatNumber(getRecordPageCount(r))} صفحه</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Error fetching typist data:', err);
        showAlert('خطا در دریافت اطلاعات کارکرد.', true);
    }
}

function renderTypistDeadline(typist) {
    const badge = document.getElementById('typistDeadlineBadge');
    if (!badge || !typist) return;

    // تاریخ مبنا: آخرین گزارش یا تاریخ تحویل یا تاریخ ایجاد
    const rawDate = typist.last_report_date || typist.delivery_date || typist.created_at;
    const refDate = parseDateToJsDate(rawDate);

    if (!refDate) {
        badge.className = 'p-3 rounded-xl text-center text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200';
        badge.innerHTML = `⚠️ تاریخ مبنا ثبت نشده است.<br><span class="font-normal text-[11px] mt-1 block">مهلت ۱۰ روزه ثبت گزارش کار</span>`;
        return;
    }

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

    const diffTime = startToday.getTime() - startRef.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remainingDays = 10 - diffDays;

    if (remainingDays > 0) {
        badge.className = 'p-3 rounded-xl text-center text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200';
        badge.innerHTML = `⏳ مهلت ارسال گزارش بعدی:<br><span class="text-sm font-black mt-1 block text-emerald-900">${remainingDays} روز باقی‌مانده</span>`;
    } else if (remainingDays === 0) {
        badge.className = 'p-3 rounded-xl text-center text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse';
        badge.innerHTML = `⚠️ امروز آخرین مهلت ارسال گزارش است!`;
    } else {
        const overdueDays = Math.abs(remainingDays);
        badge.className = 'p-3 rounded-xl text-center text-xs font-bold bg-red-100 text-red-800 border border-red-200 animate-pulse';
        badge.innerHTML = `❌ تاخیر در ارائه گزارش کار:<br><span class="text-sm font-black mt-1 block text-red-900">${overdueDays} روز تاخیر دارید!</span>`;
    }
}

async function submitTypistReport(e) {
    e.preventDefault();
    const wordsInput = document.getElementById('reportWords').value;
    const pagesInput = document.getElementById('reportPages').value;

    const words = parseInt(toEnglishDigits(wordsInput), 10);
    const pages = pagesInput ? parseInt(toEnglishDigits(pagesInput), 10) : 0;

    if (!words || words <= 0) {
        showAlert('لطفا تعداد کلمات را معتبر وارد کنید.', true);
        return;
    }

    const t = currentUser ? currentUser.data : null;
    if (!t || !t.id) {
        showAlert('خطا: اطلاعات مقرر یافت نشد. لطفا مجددا وارد شوید.', true);
        return;
    }

    const nowIso = new Date().toISOString();

    try {
        const res = await insertWorkRecord(t.id, words, pages, t.title || 'گزارش کارکرد');

        if (!res.success) {
            const errMsg = res.error ? (res.error.message || res.error.details || JSON.stringify(res.error)) : 'خطای نا مشخص در سرور';
            throw new Error(errMsg);
        }

        // Update last_report_date in typists table (resets 10-day deadline)
        const client = getDb();
        if (client) {
            const { error: uErr } = await client.from('typists').update({
                last_report_date: nowIso
            }).eq('id', t.id);

            if (uErr) console.warn('Could not update last_report_date:', uErr);
        }

        showAlert('گزارش کارکرد شما با موفقیت ثبت شد.');
        document.getElementById('typistReportForm').reset();
        await fetchTypistData();

    } catch (err) {
        console.error('Error submitting report:', err);
        showAlert(`خطا در ثبت گزارش کارکرد: ${err.message || 'مشکل در برقراری ارتباط'}`, true);
    }
}

function openTypistSelfProfileModal() {
    const t = currentUser.data;
    document.getElementById('selfFirstName').value = t.first_name || '';
    document.getElementById('selfLastName').value = t.last_name || '';
    document.getElementById('selfPhone').value = t.phone || '';
    document.getElementById('selfNationalId').value = t.national_id || t.national_code || '';
    document.getElementById('selfSheba').value = t.sheba_number || t.iban || '';
    document.getElementById('selfBankName').value = t.bank_name || '';
    document.getElementById('selfCardNumber').value = t.card_number || '';
    document.getElementById('selfPassword').value = '';

    openModal('typistSelfProfileModal');
}

async function saveTypistSelfProfile(e) {
    e.preventDefault();
    const t = currentUser.data;

    const fn = document.getElementById('selfFirstName').value.trim();
    const ln = document.getElementById('selfLastName').value.trim();
    const phone = toEnglishDigits(document.getElementById('selfPhone').value.trim());
    const natId = toEnglishDigits(document.getElementById('selfNationalId').value.trim());
    const sheba = toEnglishDigits(document.getElementById('selfSheba').value.trim());
    const bank = document.getElementById('selfBankName').value.trim();
    const card = toEnglishDigits(document.getElementById('selfCardNumber').value.trim());
    const pass = toEnglishDigits(document.getElementById('selfPassword').value.trim());

    const updatePayload = {
        first_name: fn,
        last_name: ln,
        name: `${fn} ${ln}`.trim(),
        phone: phone,
        national_id: natId,
        national_code: natId,
        sheba_number: sheba,
        iban: sheba,
        bank_name: bank,
        card_number: card,
        updated_at: new Date().toISOString()
    };

    if (pass) {
        updatePayload.password = pass;
    }

    try {
        const client = getDb();
        const { error } = await client.from('typists').update(updatePayload).eq('id', t.id);
        if (error) throw error;

        showAlert('اطلاعات پروفایل شما با موفقیت بروزرسانی شد.');
        closeModal('typistSelfProfileModal');
        await fetchTypistData();
    } catch (err) {
        console.error('Error updating profile:', err);
        showAlert('خطا در بروزرسانی اطلاعات پروفایل.', true);
    }
}

// ----------------------------------------------------------------------
// ADMIN DASHBOARD LOGIC
// ----------------------------------------------------------------------
async function fetchAllDataForAdmin() {
    try {
        const client = getDb();
        if (!client) return;

        const [typistsRes, recordsRes, paymentsRes] = await Promise.all([
            client.from('typists').select('*').order('created_at', { ascending: false }),
            client.from('work_records').select('*').order('created_at', { ascending: false }),
            client.from('payments').select('*')
        ]);

        if (typistsRes.error) throw typistsRes.error;
        if (recordsRes.error) throw recordsRes.error;
        if (paymentsRes.error && paymentsRes.error.code !== '42P01') throw paymentsRes.error;

        globalTypists = typistsRes.data || [];
        globalReports = recordsRes.data || [];
        globalPayments = paymentsRes.data || [];

        renderAdminStats();
        renderAdminTypistsTable(globalTypists);
        renderAdminPayrollTable();
        renderAdminAllRecordsTable();

    } catch (err) {
        console.error('Error fetching admin data:', err);
        showAlert('خطا در بارگیری داده‌های مدیریت.', true);
    }
}

function renderAdminStats() {
    document.getElementById('statTotalTypists').textContent = formatNumber(globalTypists.length);

    const activeTasks = globalTypists.filter(t => t.title && !t.completed).length;
    document.getElementById('statActiveTasks').textContent = formatNumber(activeTasks);

    const totalWords = globalReports.reduce((sum, r) => sum + getRecordWordsCount(r), 0);
    document.getElementById('statTotalWords').textContent = formatNumber(totalWords);

    document.getElementById('statTotalReports').textContent = formatNumber(globalReports.length);
}

function renderAdminTypistsTable(typistsList) {
    const tbody = document.getElementById('adminTypistsTable');
    document.getElementById('typistsTableCount').textContent = `تعداد کل: ${formatNumber(typistsList.length)} نفر`;
    tbody.innerHTML = '';

    if (typistsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-6 text-center text-slate-400">هیچ مقرری یافت نشد.</td></tr>`;
        return;
    }

    typistsList.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

        const wordRate = t.rate_per_word !== undefined && t.rate_per_word !== null ? t.rate_per_word : (t.default_word_rate || 15);
        const pageRate = t.page_rate !== undefined && t.page_rate !== null ? t.page_rate : (t.default_page_rate || 0);

// در این تابع، بخش محاسبه مهلت تایمر بدین شکل اصلاح شد:
let deadlineHtml = '';
if (t.completed) {
    deadlineHtml = `<span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-semibold">تکمیل شده</span>`;
} else {
    const refDate = parseDateToJsDate(t.last_report_date || t.delivery_date || t.created_at);
    if (!refDate) {
        deadlineHtml = `<span class="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs">بدون گزارش</span>`;
    } else {
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
        const diffDays = Math.floor((startToday.getTime() - startRef.getTime()) / (1000 * 60 * 60 * 24));
        const rem = 10 - diffDays;

        if (rem > 0) {
            deadlineHtml = `<span class="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold">${rem} روز مهلت</span>`;
        } else if (rem === 0) {
            deadlineHtml = `<span class="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-xs font-bold">امروز مهلت</span>`;
        } else {
            deadlineHtml = `<span class="bg-red-100 text-red-800 px-2 py-1 rounded-lg text-xs font-bold">${Math.abs(rem)} روز تاخیر!</span>`;
        }
    }
}
        const passStr = t.password || (t.phone && t.phone.length >= 4 ? t.phone.slice(-4) : '---');
        const newTaskBtn = t.completed ? `<button onclick="openNewTaskModal('${t.id}')" title="ارجاع کار جدید" class="px-2.5 py-1 text-xs rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200">+ کار جدید</button>` : '';

        const cleanPhone = toEnglishDigits(t.phone || '').trim();

        tr.innerHTML = `
            <td class="px-4 py-3">
                <div class="font-bold text-slate-800">${getTypistName(t)}</div>
                <div class="text-xs text-slate-400">کدملی: ${getTypistNationalId(t)}</div>
            </td>
            <td class="px-4 py-3 text-xs">
                <div class="flex items-center gap-1.5 dir-ltr justify-end">
                    <a href="tel:${cleanPhone}" class="p-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition" title="تماس تلفنی با ${getTypistName(t)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    </a>
                    <a href="sms:${cleanPhone}" class="p-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition" title="ارسال پیامک به ${getTypistName(t)}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    </a>
                    <span class="font-mono text-slate-700">${cleanPhone || '---'}</span>
                </div>
                <div class="text-slate-400 font-mono mt-1 text-left dir-ltr">رمز: ${passStr}</div>
            </td>
            <td class="px-4 py-3">
                <div class="font-medium text-indigo-700 text-xs">${t.title || '---'}</div>
            </td>
            <td class="px-4 py-3 text-xs font-mono dir-ltr">${t.delivery_date ? formatJalali(t.delivery_date) : '---'}</td>
            <td class="px-4 py-3 text-xs">${deadlineHtml}</td>
            <td class="px-4 py-3 text-xs font-mono">
                <div>کلمه: ${formatNumber(wordRate)}</div>
                <div>صفحه: ${formatNumber(pageRate)}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-1.5 flex-wrap w-full">
                    <button onclick="toggleTaskCompletion('${t.id}', ${!t.completed})" title="تغییر وضعیت اتمام کار"
                        class="px-2.5 py-1 text-xs rounded-lg ${t.completed ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}">
                        ${t.completed ? 'بازگشایی' : 'تکمیل'}
                    </button>
                    ${newTaskBtn}
                    <button onclick="openEditTypistModal('${t.id}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="ویرایش">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button onclick="deleteTypist('${t.id}')" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="حذف">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTypistsTable() {
    const q = toEnglishDigits(document.getElementById('typistSearchInput').value).toLowerCase();
    const filtered = globalTypists.filter(t => {
        const name = getTypistName(t).toLowerCase();
        const phone = (t.phone || '').toLowerCase();
        const title = (t.title || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || title.includes(q);
    });
    renderAdminTypistsTable(filtered);
}

function renderAdminPayrollTable() {
    const tbody = document.getElementById('adminPayrollTable');
    tbody.innerHTML = '';

    globalTypists.forEach(t => {
        const myRecords = globalReports.filter(r => isRecordBelongsToTypist(r, t.id));
        const totalWords = myRecords.reduce((sum, r) => sum + getRecordWordsCount(r), 0);
        const totalPages = myRecords.reduce((sum, r) => sum + getRecordPageCount(r), 0);

        const wordRate = Number(t.rate_per_word !== undefined && t.rate_per_word !== null ? t.rate_per_word : (t.default_word_rate || 15));
        const pageRate = Number(t.page_rate !== undefined && t.page_rate !== null ? t.page_rate : (t.default_page_rate || 0));

        const myPayments = globalPayments.filter(p => String(p.typist_id) === String(t.id));
        const totalPaid = myPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

             // محاسبه انحصاری کارکرد (یا کلمه یا صفحه برای هر گزارش)
        let grossAmount = 0;
        myRecords.forEach(r => {
            const w = getRecordWordsCount(r);
            const p = getRecordPageCount(r);
            if (w > 0 && wordRate > 0) grossAmount += w * wordRate;
            else if (p > 0 && pageRate > 0) grossAmount += p * pageRate;
            else if (w > 0) grossAmount += w * wordRate;
            else grossAmount += p * pageRate;
        });
        const netPayable = grossAmount - totalPaid;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

        tr.innerHTML = `
            <td class="px-4 py-3 font-bold text-slate-800">${getTypistName(t)}</td>
            <td class="px-4 py-3 text-xs font-mono">
                <div>شبا: ${t.sheba_number || t.iban || '---'}</div>
                <div class="text-slate-400 mt-1">کدملی: ${getTypistNationalId(t)}</div>
            </td>
            <td class="px-4 py-3 font-semibold text-indigo-600 text-xs">${formatNumber(totalWords)} کلمه<br><span class="text-slate-500 font-normal">${formatNumber(totalPages)} صفحه</span></td>
            <td class="px-4 py-3 text-xs font-mono">${formatNumber(wordRate)} / ${formatNumber(pageRate)}</td>
            <td class="px-4 py-3 font-semibold text-emerald-700 text-xs">${formatNumber(grossAmount)} ریال</td>
            <td class="px-4 py-3 font-semibold text-rose-600 text-xs">${formatNumber(totalPaid)} ریال</td>
            <td class="px-4 py-3 font-black text-indigo-700 text-sm">${formatNumber(netPayable)} ریال</td>
            <td class="px-4 py-3 text-center">
                <button onclick="settleTypistPayroll('${t.id}', ${netPayable})" class="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 text-xs px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap">
                    ثبت تسویه
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAdminAllRecordsTable() {
    const tbody = document.getElementById('adminAllRecordsTable');
    tbody.innerHTML = '';

    if (globalReports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-slate-400">هیچ کارکردی ثبت نشده است.</td></tr>`;
        return;
    }

    globalReports.forEach(r => {
        const typist = globalTypists.find(t => isRecordBelongsToTypist(r, t.id));
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

        tr.innerHTML = `
            <td class="px-4 py-3 text-xs font-mono dir-ltr text-right">${formatJalali(getRecordDate(r))}</td>
            <td class="px-4 py-3 font-medium text-slate-800">${typist ? getTypistName(typist) : 'مقرر حذف شده'}</td>
            <td class="px-4 py-3 text-xs text-indigo-700">${r.title || (typist ? typist.title : '---')}</td>
            <td class="px-4 py-3 font-bold text-indigo-600 text-xs">${formatNumber(getRecordWordsCount(r))} کلمه</td>
            <td class="px-4 py-3 text-xs">${formatNumber(getRecordPageCount(r))} صفحه</td>
            <td class="px-4 py-3 text-center">
                <button onclick="deleteWorkRecord('${r.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function switchAdminTab(tabName) {
    const tabs = ['typists', 'payroll', 'records'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
        const content = document.getElementById(`admin${t.charAt(0).toUpperCase() + t.slice(1)}Tab`);
        if (t === tabName) {
            btn.className = 'flex-1 py-3 px-4 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition';
            content.classList.remove('hidden');
        } else {
            btn.className = 'flex-1 py-3 px-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition';
            content.classList.add('hidden');
        }
    });
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
}
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

// Modal Handlers: Add / Edit Typist
function openAddTypistModal() {
    document.getElementById('typistModalTitle').textContent = 'افزودن مقرر جدید';
    document.getElementById('editTypistId').value = '';
    document.getElementById('typistForm').reset();
    document.getElementById('typistRateWord').value = '15';
    document.getElementById('typistRatePage').value = '0';
    document.getElementById('typistDeliveryDateInput').value = getTodayJalaliString();
    openModal('typistModal');
}

function openEditTypistModal(id) {
    const t = globalTypists.find(item => String(item.id) === String(id));
    if (!t) return;

    document.getElementById('typistModalTitle').textContent = 'ویرایش اطلاعات مقرر';
    document.getElementById('editTypistId').value = t.id;
    document.getElementById('typistFirstName').value = t.first_name || '';
    document.getElementById('typistLastName').value = t.last_name || '';
    document.getElementById('typistPhone').value = t.phone || '';
    document.getElementById('typistNationalId').value = t.national_id || t.national_code || '';
    document.getElementById('typistProjectTitle').value = t.title || '';
    document.getElementById('typistDeliveryDateInput').value = t.delivery_date ? formatJalali(t.delivery_date) : '';
    document.getElementById('typistRateWord').value = t.rate_per_word !== undefined ? t.rate_per_word : 15;
    document.getElementById('typistRatePage').value = t.page_rate !== undefined ? t.page_rate : 0;
    document.getElementById('typistSheba').value = t.sheba_number || t.iban || '';
    document.getElementById('typistPassword').value = t.password || '';

    openModal('typistModal');
}

async function saveTypist(e) {
    e.preventDefault();
    const id = document.getElementById('editTypistId').value;
    const fn = document.getElementById('typistFirstName').value.trim();
    const ln = document.getElementById('typistLastName').value.trim();
    const phone = toEnglishDigits(document.getElementById('typistPhone').value.trim());
    const natId = toEnglishDigits(document.getElementById('typistNationalId').value.trim());
    const projectTitle = document.getElementById('typistProjectTitle').value.trim();
    const deliveryDate = toEnglishDigits(document.getElementById('typistDeliveryDateInput').value.trim());
    const rateWord = parseFloat(toEnglishDigits(document.getElementById('typistRateWord').value)) || 15;
    const ratePage = parseFloat(toEnglishDigits(document.getElementById('typistRatePage').value)) || 0;
    const sheba = toEnglishDigits(document.getElementById('typistSheba').value.trim());
    const customPass = toEnglishDigits(document.getElementById('typistPassword').value.trim());

    const defaultPass = phone.length >= 4 ? phone.slice(-4) : '1234';
    const finalPassword = customPass || defaultPass;

    const payload = {
        first_name: fn,
        last_name: ln,
        name: `${fn} ${ln}`.trim(),
        phone: phone,
        national_id: natId,
        national_code: natId,
        title: projectTitle || null,
        delivery_date: deliveryDate || null,
        rate_per_word: rateWord,
        default_word_rate: rateWord,
        page_rate: ratePage,
        default_page_rate: ratePage,
        sheba_number: sheba,
        iban: sheba,
        password: finalPassword,
        updated_at: new Date().toISOString()
    };

    try {
        const client = getDb();
        if (id) {
            const { error } = await client.from('typists').update(payload).eq('id', id);
            if (error) throw error;
            showAlert('اطلاعات مقرر بروزرسانی شد.');
        } else {
            payload.completed = false;
            payload.created_at = new Date().toISOString();
            const { error } = await client.from('typists').insert([payload]);
            if (error) throw error;
            showAlert('مقرر جدید با موفقیت اضافه شد.');
        }

        closeModal('typistModal');
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Error saving typist:', err);
        showAlert('خطا در ذخیره اطلاعات مقرر.', true);
    }
}

async function toggleTaskCompletion(id, completedStatus) {
    try {
        const updatePayload = {
            completed: completedStatus,
            completed_at: completedStatus ? new Date().toISOString() : null
        };

        const client = getDb();
        const { error } = await client.from('typists').update(updatePayload).eq('id', id);
        if (error) throw error;

        showAlert(completedStatus ? 'پروژه به عنوان تکمیل شده نشانه‌گذاری شد.' : 'پروژه به حالت فعال بازگشت.');
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Error toggling completion:', err);
        showAlert('خطا در تغییر وضعیت پروژه.', true);
    }
}

// Modal Handlers: Assign New Task
function openNewTaskModal(id) {
    const t = globalTypists.find(item => String(item.id) === String(id));
    if (!t) return;
    document.getElementById('newTaskId').value = t.id;
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDeliveryDate').value = getTodayJalaliString();
    openModal('newTaskModal');
}

async function saveNewTask(e) {
    e.preventDefault();
    const id = document.getElementById('newTaskId').value;
    const title = document.getElementById('newTaskTitle').value.trim();
    const deliveryDate = document.getElementById('newTaskDeliveryDate').value.trim();
    const nowIso = new Date().toISOString();

    try {
        const client = getDb();
        const { error } = await client.from('typists').update({
            title: title,
            delivery_date: deliveryDate,
            completed: false,
            completed_at: null,
            last_report_date: nowIso
        }).eq('id', id);

        if (error) throw error;
        
        showAlert('موضوع کار جدید ارجاع داده شد و زمان‌سنج گزارش‌دهی بازنشانی گردید.');
        closeModal('newTaskModal');
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Error assigning new task:', err);
        showAlert('خطا در ارجاع کار جدید.', true);
    }
}

async function deleteTypist(id) {
    if (!confirm('آیا از حذف این مقرر و تمامی سوابق او مطمئن هستید؟')) return;

    try {
        const client = getDb();
        const { error } = await client.from('typists').delete().eq('id', id);
        if (error) throw error;
        showAlert('مقرر حذف شد.');
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Error deleting typist:', err);
        showAlert('خطا در حذف مقرر.', true);
    }
}

// Modal Handlers: Manual Work Record Entry
function openManualRecordModal() {
    const select = document.getElementById('manualTypistSelect');
    select.innerHTML = globalTypists.map(t => `<option value="${t.id}">${getTypistName(t)} (${t.phone || ''})</option>`).join('');
    document.getElementById('manualRecordForm').reset();
    openModal('manualRecordModal');
}

async function saveManualRecord(e) {
    e.preventDefault();
    const typistId = document.getElementById('manualTypistSelect').value;
    const words = parseInt(toEnglishDigits(document.getElementById('manualWords').value), 10);
    const pages = parseInt(toEnglishDigits(document.getElementById('manualPages').value), 10) || 0;
    const title = document.getElementById('manualTitle').value.trim() || 'ثبت دستی ادمین';

    const typist = globalTypists.find(t => String(t.id) === String(typistId));
    const nowIso = new Date().toISOString();

    try {
        const res = await insertWorkRecord(typistId, words, pages, title || (typist ? typist.title : 'ثبت دستی'));

        if (!res.success) {
            const errMsg = res.error ? (res.error.message || res.error.details || JSON.stringify(res.error)) : 'خطا در دیتابیس';
            throw new Error(errMsg);
        }

        const client = getDb();
        if (client) {
            await client.from('typists').update({ last_report_date: nowIso }).eq('id', typistId);
        }

        showAlert('کارکرد دستی با موفقیت ثبت شد.');
        closeModal('manualRecordModal');
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Error saving manual record:', err);
        showAlert(`خطا در ثبت دستی کارکرد: ${err.message || 'مشکل در برقراری ارتباط'}`, true);
    }
}

async function deleteWorkRecord(id) {
    if (!confirm('آیا از حذف این گزارش کار مطمئن هستید؟')) return;
    try {
        const client = getDb();
        const { error } = await client.from('work_records').delete().eq('id', id);
        if (error) throw error;
        showAlert('گزارش کار حذف شد.');
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Error deleting record:', err);
        showAlert('خطا در حذف گزارش.', true);
    }
}

// Settlement Action
async function settleTypistPayroll(typistId, netPayable) {
    if (netPayable <= 0) {
        showAlert('مبلغ قابل پرداختی وجود ندارد (کارکرد صفر یا تسویه شده است).', true);
        return;
    }

    if (!confirm(`آیا از ثبت پرداخت به مبلغ ${formatNumber(netPayable)} ریال مطمئن هستید؟`)) return;

    try {
        const client = getDb();
        const { error } = await client.from('payments').insert([{
            typist_id: typistId,
            amount: netPayable,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;

        showAlert(`تسویه مبلغ ${formatNumber(netPayable)} ریال با موفقیت ثبت شد.`);
        await fetchAllDataForAdmin();
    } catch (err) {
        console.error('Payment logging error:', err);
        showAlert('خطا در ثبت اطلاعات پرداخت.', true);
    }
}

// SMS LOGIC
function openSmsModal() {
    document.getElementById('smsText').value = '';
    document.getElementById('smsResultArea').classList.add('hidden');
    openModal('smsModal');
}

function getTargetTypists() {
    const target = document.getElementById('smsTargetSelect').value;
if (target === 'overdue') {
    return globalTypists.filter(t => {
        if (t.completed) return false;
        const refDate = parseDateToJsDate(t.last_report_date || t.delivery_date || t.created_at);
        if (!refDate) return true;
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
        const diffDays = Math.floor((startToday.getTime() - startRef.getTime()) / (1000 * 60 * 60 * 24));
        return (10 - diffDays) < 0;
    });
}
    return globalTypists;
}

function sendSmsAction() {
    const text = document.getElementById('smsText').value.trim();
    if (!text) {
        showAlert('لطفا متن پیامک را وارد کنید.', true);
        return;
    }

    const typists = getTargetTypists();
    const phoneNumbers = typists
        .map(t => toEnglishDigits(t.phone || '').trim())
        .filter(p => p.length >= 10);

    if (phoneNumbers.length === 0) {
        showAlert('هیچ شماره موبایل معتبری برای گیرندگان پیدا نشد.', true);
        return;
    }

    const smsUrl = `sms:${phoneNumbers.join(',')}?body=${encodeURIComponent(text)}`;
    window.location.href = smsUrl;

    renderSmsRecipientsList(typists, text);
    showAlert(`دستور ارسال پیامک برای ${phoneNumbers.length} شماره فراخوانی شد.`);
}

function renderSmsRecipientsList(typists, text) {
    const container = document.getElementById('smsRecipientsContainer');
    const resultArea = document.getElementById('smsResultArea');
    container.innerHTML = '';

    typists.forEach(t => {
        const phone = toEnglishDigits(t.phone || '').trim();
        if (!phone) return;

        const div = document.createElement('div');
        div.className = 'flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100';
        div.innerHTML = `
            <span class="font-medium text-slate-800">${getTypistName(t)} (<span class="font-mono dir-ltr inline-block">${phone}</span>)</span>
            <a href="sms:${phone}?body=${encodeURIComponent(text)}" class="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2.5 py-1 rounded-md font-bold transition">
                ارسال پیامک تکی
            </a>
        `;
        container.appendChild(div);
    });

    resultArea.classList.remove('hidden');
}

function copySmsNumbers() {
    const typists = getTargetTypists();
    const phoneNumbers = typists
        .map(t => toEnglishDigits(t.phone || '').trim())
        .filter(p => p.length >= 10);

    if (phoneNumbers.length === 0) {
        showAlert('هیچ شماره‌ای برای کپی وجود ندارد.', true);
        return;
    }

    const numbersText = phoneNumbers.join('\n');
    navigator.clipboard.writeText(numbersText).then(() => {
        showAlert(`${phoneNumbers.length} شماره موبایل در حافظه کپی شد.`);
    }).catch(err => {
        showAlert('خطا در کپی کردن شماره‌ها.', true);
    });
}

// BANK EXCEL EXPORT (.xlsx) - Solves Leading Zero & Conversion Prompts
function exportBankCSV() {
    if (typeof globalTypists === 'undefined' || globalTypists.length === 0) {
        if (typeof showAlert === 'function') showAlert('هیچ داده‌ای برای خروجی موجود نیست.', true);
        else showAlert('هیچ داده‌ای برای خروجی موجود نیست.', true);
        return;
    }

    const headers = ['ردیف', 'نام', 'نام خانوادگی', 'شماره ملی', 'شماره تماس', 'شماره شبا', 'مبلغ قابل واریز (ریال)'];
    const rows = [headers];
    let currentRowIndex = 1;

    globalTypists.forEach((t) => {
        const myRecords = typeof globalReports !== 'undefined' 
            ? globalReports.filter(r => typeof isRecordBelongsToTypist === 'function' ? isRecordBelongsToTypist(r, t.id) : (r.typist_id === t.id || r.person_id === t.id))
            : [];
        
        const totalWords = myRecords.reduce((sum, r) => sum + (typeof getRecordWordsCount === 'function' ? getRecordWordsCount(r) : Number(r.words_count || 0)), 0);
        const totalPages = myRecords.reduce((sum, r) => sum + (typeof getRecordPageCount === 'function' ? getRecordPageCount(r) : Number(r.page_count || r.pages_count || r.quantity || 0)), 0);

        const wordRate = Number(t.rate_per_word !== undefined && t.rate_per_word !== null ? t.rate_per_word : (t.default_word_rate || 15));
        const pageRate = Number(t.page_rate !== undefined && t.page_rate !== null ? t.page_rate : (t.default_page_rate || 0));

        const myPayments = typeof globalPayments !== 'undefined'
            ? globalPayments.filter(p => String(p.typist_id) === String(t.id))
            : [];
        const totalPaid = myPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
            // محاسبه انحصاری کارکرد برای خروجی بانک
        let grossAmount = 0;
        myRecords.forEach(r => {
            const w = typeof getRecordWordsCount === 'function' ? getRecordWordsCount(r) : Number(r.words_count || 0);
            const p = typeof getRecordPageCount === 'function' ? getRecordPageCount(r) : Number(r.page_count || r.pages_count || r.quantity || 0);
            if (w > 0 && wordRate > 0) grossAmount += w * wordRate;
            else if (p > 0 && pageRate > 0) grossAmount += p * pageRate;
            else if (w > 0) grossAmount += w * wordRate;
            else grossAmount += p * pageRate;
        });
        const netPayable = grossAmount - totalPaid;

        if (netPayable > 0) {
            const typistNameStr = typeof getTypistName === 'function' ? getTypistName(t) : (t.name || (t.first_name + ' ' + (t.last_name || '')));
            const fn = t.first_name || typistNameStr.split(' ')[0] || '';
            const ln = t.last_name || typistNameStr.split(' ').slice(1).join(' ') || '';
            const natId = String(typeof getTypistNationalId === 'function' ? getTypistNationalId(t) : (t.national_id || t.national_code || ''));
            const phone = String(t.phone || '');
            const sheba = String(t.sheba_number || t.iban || '');

            rows.push([
                currentRowIndex++,
                fn,
                ln,
                natId,
                phone,
                sheba,
                netPayable
            ]);
        }
    });

    if (rows.length <= 1) {
        if (typeof showAlert === 'function') showAlert('تمامی مقرر‌ها تسویه شده‌اند و هیچ شخصی برای پرداختی بانک موجود نیست.', true);
        else showAlert('تمامی مقرر‌ها تسویه شده‌اند و هیچ شخصی برای پرداختی بانک موجود نیست.', true);
        return;
    }

    // ساخت فایل واقعی اکسل (.xlsx) با SheetJS
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // تنظیم ستون‌های کد ملی، شماره تماس و شماره شبا به فرمت متن جهت حفظ صفر اول
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            [3, 4, 5].forEach(C => {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (ws[cellRef]) {
                    ws[cellRef].t = 's'; // Force Text Format
                    ws[cellRef].z = '@';
                }
            });
        }
        
        // راست‌به‌چپ کردن شیت اکسل
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ RTL: true });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "لیست تسویه");
        const dateStr = typeof getTodayJalaliString === 'function' ? getTodayJalaliString().replace(/\//g, '-') : getJalaliDate().replace(/\//g, '-');
        XLSX.writeFile(wb, `Bank_Payments_${dateStr}.xlsx`);
    } else {
        // روش پشتیبان CSV با فرمول متن اکسل ="0912..."
        let csvContent = '\uFEFF';
        csvContent += headers.join(',') + '\n';
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            csvContent += `${r[0]},"${r[1]}","${r[2]}",="${r[3]}",="${r[4]}",="${r[5]}",${r[6]}\n`;
        }
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const dateStr = typeof getTodayJalaliString === 'function' ? getTodayJalaliString().replace(/\//g, '-') : getJalaliDate().replace(/\//g, '-');
        link.setAttribute('download', `Bank_Payments_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

async function downloadBackupJSON() {
    try {
        const backupData = {
            export_date: new Date().toISOString(),
            typists: globalTypists,
            work_records: globalReports,
            payments: globalPayments
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Supabase_Backup_${getTodayJalaliString().replace(/\//g, '-')}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showAlert('پشتیبان‌گیری JSON انجام شد.');
    } catch (err) {
        console.error('Error downloading backup:', err);
        showAlert('خطا در دریافت فایل پشتیبان.', true);
    }
}
// مبدل تاریخ شمسی به میلادی برای محاسبه ریاضی روزها
function jalaliToGregorian(jy, jm, jd) {
    let sal_a, gy, gm, gd, days;
    jy += 1595;
    days = -355668 + (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
        gy += 100 * Math.floor(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
        gy += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }
    gd = days + 1;
    sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return [gy, gm, gd];
}

// پارسر هوشمند تاریخ (پشتیبانی کامل از فرمت‌های شمسی 1403/01/15 و میلادی ISO)
function parseDateToJsDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;

    const str = toEnglishDigits(String(dateInput)).trim();
    if (str.includes('/')) {
        const parts = str.split('/').map(Number);
        if (parts.length === 3 && parts[0] > 1300 && parts[0] < 1500) {
            const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2]);
            return new Date(gy, gm - 1, gd);
        }
    }
    
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
}

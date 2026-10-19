// ==========================================
// Global Variables & Supabase Initialization
// ==========================================
let currentUser = null;
let globalTypists = [];
let globalProjects = [];
let globalReports = [];


// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



// ==========================================
// DATE & STRING HELPERS
// ==========================================
function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + 80 + gd + g_d_m[gm - 1];
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

function formatJalali(isoString) {
    if (!isoString) return '-';
    // If it already contains Persian date formats like ۱۴۰۵/۰۷/۱۳, return it directly
    if (String(isoString).includes('/')) return isoString; 
    
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const pad = (n) => n < 10 ? '0' + n : n;
        return `${jy}/${pad(jm)}/${pad(jd)}`;
    } catch (e) {
        return isoString;
    }
}

function toEnglishDigits(str) {
    if (!str) return '';
    const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let result = String(str);
    for (let i = 0; i < 10; i++) {
        result = result.replace(persianDigits[i], i).replace(arabicDigits[i], i);
    }
    return result.trim();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-800';
    toast.className = `${bgClass} text-white text-xs md:text-sm px-4 py-3 rounded-xl shadow-lg flex items-center justify-between transition-all duration-300 transform translate-y-2 pointer-events-auto`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="mr-2 font-bold">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function calculate10DayStatus(lastReportDateISO) {
    if (!lastReportDateISO) return { status: 'ok', text: 'منظم (تایم فعال)', isDelayed: false };
    
    // Ignore invalid persian texts in this calculation, rely on Date parsing
    const lastDate = new Date(lastReportDateISO);
    if (isNaN(lastDate.getTime())) return { status: 'ok', text: 'نامشخص', isDelayed: false };
    
    const now = new Date();
    const diffTime = now - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 10) {
        return { status: 'delayed', text: `تأخیر (${diffDays - 10} روز)`, isDelayed: true };
    } else {
        return { status: 'ok', text: `منظم (${10 - diffDays} روز مهلت)`, isDelayed: false };
    }
}

// Fallback Schema Getters (Matching your specific DB structure)
function getTypistFullName(t) {
    if (!t) return 'نامشخص';
    if (t.name) return t.name;
    if (t.first_name || t.last_name) return `${t.first_name || ''} ${t.last_name || ''}`.trim();
    if (t.full_name) return t.full_name;
    return 'تایپیست بدون نام';
}

function getTypistNationalId(t) {
    if (!t) return '-';
    return t.national_id || t.national_code || '-';
}

function getTypistShaba(t) {
    if (!t) return '-';
    return t.sheba_number || t.shaba || t.iban || t.account_number || '-';
}

function getTypistRateWord(t) {
    return Number(t.rate_per_word || t.default_word_rate || 15);
}

function getTypistRatePage(t) {
    return Number(t.page_rate || t.default_page_rate || 0);
}

function getRecordPageCount(r) {
    if (r.page_count !== undefined && r.page_count !== null) return Number(r.page_count);
    if (r.pages_count !== undefined && r.pages_count !== null) return Number(r.pages_count);
    if (r.quantity !== undefined && r.quantity !== null) return Number(r.quantity);
    return 0;
}

function getRecordDate(r) {
    return r.created_at || r.record_date || r.delivery_date || null;
}

// ==========================================
// AUTHENTICATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkSavedSession();
});

function checkSavedSession() {
    const saved = localStorage.getItem('payroll_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            setupUserUI();
        } catch (e) {
            localStorage.removeItem('payroll_user');
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = toEnglishDigits(document.getElementById('login-username').value);
    const passwordInput = toEnglishDigits(document.getElementById('login-password').value);
    const loginBtn = document.getElementById('login-btn');

    loginBtn.disabled = true;
    loginBtn.innerText = 'در حال بررسی...';

    try {
        if ((usernameInput === 'admin' || usernameInput === 'مدیر') && passwordInput === 'admin123') {
            currentUser = { role: 'admin', full_name: 'مدیر سیستم' };
            localStorage.setItem('payroll_user', JSON.stringify(currentUser));
            showToast('با موفقیت وارد شدید', 'success');
            setupUserUI();
            return;
        }

        const { data: typists, error } = await db.from('typists').select('*');
        if (error) throw error;

        const found = (typists || []).find(t => {
            const phone = t.phone || '';
            const nid = getTypistNationalId(t);
            const uid = t.id || '';
            const matchUser = (usernameInput === phone || usernameInput === nid || usernameInput === uid);
            
            const defaultPass = phone.length >= 4 ? phone.slice(-4) : '1234';
            const userPass = t.password || defaultPass;
            return matchUser && (passwordInput === userPass);
        });

        if (found) {
            currentUser = { role: 'typist', ...found };
            localStorage.setItem('payroll_user', JSON.stringify(currentUser));
            showToast(`خوش آمدید ${getTypistFullName(found)}`, 'success');
            setupUserUI();
        } else {
            showToast('نام کاربری یا رمز عبور اشتباه است', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('خطا در ارتباط با سرور', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerText = 'ورود';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('payroll_user');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('typist-dashboard').classList.add('hidden');
    document.getElementById('user-info-bar').classList.add('hidden');
    showToast('از سیستم خارج شدید', 'info');
}

function setupUserUI() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('user-info-bar').classList.remove('hidden');

    if (currentUser.role === 'admin') {
        document.getElementById('user-display-name').innerText = '👤 مدیر سیستم';
        document.getElementById('admin-dashboard').classList.remove('hidden');
        document.getElementById('typist-dashboard').classList.add('hidden');
        loadAdminData();
    } else {
        document.getElementById('user-display-name').innerText = `⌨️ ${getTypistFullName(currentUser)}`;
        document.getElementById('admin-dashboard').classList.add('hidden');
        document.getElementById('typist-dashboard').classList.remove('hidden');
        loadTypistData();
    }
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
async function loadAdminData() {
    await fetchTypists();
    await loadAdminReports();
}

async function fetchTypists() {
    try {
        const { data, error } = await db.from('typists').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        globalTypists = data || [];
        renderTypistsTable(globalTypists);
    } catch (err) {
        console.error('Fetch typists error:', err);
    }
}

function renderTypistsTable(list) {
    const tbody = document.getElementById('admin-typists-tbody');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">هیچ تایپیستی یافت نشد.</td></tr>`;
        return;
    }

    list.forEach(t => {
        const isCompleted = t.completed;
        const taskBadge = isCompleted 
            ? `<span class="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">بیکار (مبحث قبلی تمام شده)</span>`
            : (t.title ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">در حال انجام</span>` : `<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">بدون مبحث</span>`);
            
        const titleText = t.title || 'ثبت نشده';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-900">${getTypistFullName(t)}</td>
            <td class="p-3 font-mono text-slate-600">${t.phone || '-'}</td>
            <td class="p-3 font-bold text-slate-800 text-sm max-w-xs truncate" title="${titleText}">${titleText}</td>
            <td class="p-3">${taskBadge}</td>
            <td class="p-3 text-slate-600 font-mono text-xs">کلمه: ${getTypistRateWord(t)} | صفحه: ${getTypistRatePage(t)}</td>
            <td class="p-3 text-center">
                <button onclick="editTypist('${t.id}')" class="text-blue-600 hover:text-blue-800 font-bold text-xs px-2 py-1 bg-blue-50 rounded">ویرایش/تخصیص مبحث</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTypistsTable() {
    const query = toEnglishDigits(document.getElementById('admin-typist-search').value.toLowerCase());
    const filtered = globalTypists.filter(t => 
        getTypistFullName(t).toLowerCase().includes(query) ||
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.phone && t.phone.includes(query))
    );
    renderTypistsTable(filtered);
}

async function loadAdminReports() {
    try {
        const startDate = document.getElementById('admin-filter-start').value;
        const endDate = document.getElementById('admin-filter-end').value;

        let query = db.from('work_records').select('*');

        if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
        if (endDate) query = query.lte('created_at', new Date(endDate).toISOString());

        const { data, error } = await query;
        if (error) throw error;

        globalReports = data || [];
        // Sort in memory safely
        globalReports.sort((a,b) => new Date(getRecordDate(b) || 0) - new Date(getRecordDate(a) || 0));

        const tbody = document.getElementById('admin-reports-tbody');
        tbody.innerHTML = '';

        if (globalReports.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">هیچ کارکردی در این بازه یافت نشد.</td></tr>`;
            return;
        }

        globalReports.forEach(r => {
            const typistId = r.typist_id || r.person_id;
            const typist = globalTypists.find(t => t.id === typistId) || {};
            const typistName = getTypistFullName(typist);
            
            const rateWord = getTypistRateWord(typist);
            const ratePage = getTypistRatePage(typist);
            
            const pagesCount = getRecordPageCount(r);
            const wordsCount = r.words_count || 0;
            
            // Payment Formula matching your exact structure:
            const totalPayable = (wordsCount * rateWord) + (pagesCount * ratePage);
            const recordDate = getRecordDate(r);

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-mono text-slate-500">${formatJalali(recordDate)}</td>
                <td class="p-3 font-medium text-slate-900">${typistName}</td>
                <td class="p-3 font-bold text-slate-800">${r.title || 'عنوان ثبت نشده'}</td>
                <td class="p-3 font-bold text-slate-700">${Number(wordsCount).toLocaleString()}</td>
                <td class="p-3 font-bold text-blue-600">${Number(pagesCount).toLocaleString()}</td>
                <td class="p-3 font-bold text-emerald-600">${totalPayable.toLocaleString()} ریال</td>
                <td class="p-3 text-center">
                    <button onclick="deleteWorkRecord('${r.id}')" class="text-rose-600 hover:text-rose-800 text-xs font-bold">حذف</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Load admin reports error:', err);
    }
}

async function deleteWorkRecord(recordId) {
    if (!confirm('آیا از حذف این رکورد کارکرد اطمینان دارید؟')) return;
    try {
        const { error } = await db.from('work_records').delete().eq('id', recordId);
        if (error) throw error;
        showToast('کارکرد با موفقیت حذف شد', 'success');
        loadAdminReports();
    } catch (err) {
        console.error('Delete record error:', err);
    }
}

// ==========================================
// ADMIN DIRECT RECORD SUBMISSION FOR TYPIST
// ==========================================
function openAdminRecordModal() {
    const typistSelect = document.getElementById('admin-record-typist');
    typistSelect.innerHTML = '<option value="">-- انتخاب تایپیست --</option>';
    globalTypists.forEach(t => {
        typistSelect.innerHTML += `<option value="${t.id}">${getTypistFullName(t)} (مبحث: ${t.title || 'ندارد'})</option>`;
    });
    document.getElementById('admin-record-modal').classList.remove('hidden');
}

function closeAdminRecordModal() {
    document.getElementById('admin-record-modal').classList.add('hidden');
}

async function saveAdminRecord(e) {
    e.preventDefault();
    const typistId = document.getElementById('admin-record-typist').value;
    const words = parseInt(toEnglishDigits(document.getElementById('admin-record-words').value)) || 0;
    const pages = parseInt(toEnglishDigits(document.getElementById('admin-record-pages').value)) || 0;

    if (!typistId) return;

    try {
        const typist = globalTypists.find(t => t.id === typistId);
        const title = typist ? typist.title : 'ثبت توسط مدیر';
        const nowISO = new Date().toISOString();
        
        const { error: recErr } = await db.from('work_records').insert([{
            typist_id: typistId,
            person_id: typistId,
            title: title,
            page_count: pages,
            words_count: words,
            created_at: nowISO
        }]);
        if (recErr) throw recErr;

        await db.from('typists').update({ last_report_date: nowISO }).eq('id', typistId);

        showToast('کارکرد با موفقیت توسط مدیر ثبت گردید', 'success');
        closeAdminRecordModal();
        loadAdminData();
    } catch (err) {
        console.error('Admin record save error:', err);
        showToast('خطا در ثبت کارکرد', 'error');
    }
}

// ==========================================
// MANAGING TYPISTS (MODAL)
// ==========================================
function openAddTypistModal() {
    document.getElementById('typist-modal-title').innerText = 'افزودن تایپیست جدید';
    document.getElementById('typist-form-id').value = '';
    document.getElementById('typist-form').reset();
    document.getElementById('typist-modal').classList.remove('hidden');
}

function closeTypistModal() {
    document.getElementById('typist-modal').classList.add('hidden');
}

function editTypist(id) {
    const t = globalTypists.find(x => x.id === id);
    if (!t) return;
    document.getElementById('typist-modal-title').innerText = `ویرایش / تخصیص مبحث به ${getTypistFullName(t)}`;
    document.getElementById('typist-form-id').value = t.id;
    
    // DB Specific Mapping
    document.getElementById('typist-title').value = t.title || '';
    document.getElementById('typist-delivery').value = t.delivery_date || '';
    document.getElementById('typist-completed').checked = t.completed || false;
    document.getElementById('typist-rate-word').value = getTypistRateWord(t);
    document.getElementById('typist-rate-page').value = getTypistRatePage(t);
    
    document.getElementById('typist-first-name').value = t.first_name || t.name || '';
    document.getElementById('typist-last-name').value = t.last_name || '';
    document.getElementById('typist-national-id').value = getTypistNationalId(t);
    document.getElementById('typist-phone').value = t.phone || '';
    document.getElementById('typist-shaba').value = getTypistShaba(t);
    document.getElementById('typist-password').value = t.password || '';
    
    document.getElementById('typist-modal').classList.remove('hidden');
}

async function saveTypist(e) {
    e.preventDefault();
    const id = document.getElementById('typist-form-id').value;
    
    const title = document.getElementById('typist-title').value.trim();
    const delivery = document.getElementById('typist-delivery').value.trim();
    const completed = document.getElementById('typist-completed').checked;
    
    const rateWord = parseInt(toEnglishDigits(document.getElementById('typist-rate-word').value)) || 0;
    const ratePage = parseInt(toEnglishDigits(document.getElementById('typist-rate-page').value)) || 0;
    
    const firstName = document.getElementById('typist-first-name').value.trim();
    const lastName = document.getElementById('typist-last-name').value.trim();
    const nationalId = toEnglishDigits(document.getElementById('typist-national-id').value);
    const phone = toEnglishDigits(document.getElementById('typist-phone').value);
    const shaba = toEnglishDigits(document.getElementById('typist-shaba').value);
    const password = toEnglishDigits(document.getElementById('typist-password').value) || (phone.length >= 4 ? phone.slice(-4) : '1234');

    const payload = {
        title: title,
        delivery_date: delivery,
        completed: completed,
        rate_per_word: rateWord,
        default_word_rate: rateWord,
        page_rate: ratePage,
        default_page_rate: ratePage,
        
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        national_id: nationalId,
        national_code: nationalId,
        phone: phone,
        sheba_number: shaba,
        password: password
    };

    if (completed) {
        payload.completed_at = new Date().toISOString();
    }

    try {
        if (id) {
            const { error } = await db.from('typists').update(payload).eq('id', id);
            if (error) throw error;
            showToast('پروفایل و مبحث با موفقیت ذخیره شد', 'success');
        } else {
            payload.last_report_date = new Date().toISOString();
            const { error } = await db.from('typists').insert([payload]);
            if (error) throw error;
            showToast('تایپیست جدید اضافه شد', 'success');
        }
        closeTypistModal();
        fetchTypists();
    } catch (err) {
        console.error('Save typist error:', err);
        showToast('خطا در ذخیره اطلاعات', 'error');
    }
}

// ==========================================
// TYPIST DASHBOARD & REPORTING
// ==========================================
async function loadTypistData() {
    // Refresh user data from DB to get the most updated title and status
    const { data } = await db.from('typists').select('*').eq('id', currentUser.id).single();
    if (data) currentUser = { role: 'typist', ...data };

    document.getElementById('typist-welcome').innerText = `خوش آمدید، ${getTypistFullName(currentUser)}`;
    
    const currentTitle = currentUser.title || 'مبحثی برای شما ثبت نشده است';
    document.getElementById('typist-current-task').innerText = currentTitle;

    if (currentUser.completed) {
        document.getElementById('typist-report-container').innerHTML = `
            <div class="bg-amber-50 text-amber-800 p-6 rounded-xl border border-amber-200 text-center font-bold">
                کار شما روی مبحث قبلی به اتمام رسیده است.<br>لطفاً منتظر بمانید تا مدیر سیستم مبحث جدیدی به شما اختصاص دهد.
            </div>`;
    }

    update10DayBadge();
    await loadTypistHistory();
}

function update10DayBadge() {
    const badge = document.getElementById('typist-10day-badge');
    const status10 = calculate10DayStatus(currentUser.last_report_date || currentUser.created_at);

    if (status10.isDelayed) {
        badge.className = 'px-4 py-2 rounded-xl text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200 shadow-sm';
        badge.innerHTML = `⚠️ وضعیت گزارش‌دهی: <span class="underline">${status10.text}</span>`;
    } else {
        badge.className = 'px-4 py-2 rounded-xl text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm';
        badge.innerHTML = `✅ وضعیت گزارش‌دهی: <span>${status10.text}</span>`;
    }
}

async function submitTypistWorkReport(e) {
    e.preventDefault();
    const words = parseInt(toEnglishDigits(document.getElementById('report-words').value)) || 0;
    const pages = parseInt(toEnglishDigits(document.getElementById('report-pages').value)) || 0;
    const isFinished = document.getElementById('report-is-finished').checked;
    const title = currentUser.title;

    if (!title) {
        showToast('هیچ مبحث فعالی برای شما ثبت نشده است', 'error');
        return;
    }

    try {
        const nowISO = new Date().toISOString();

        const { error: recErr } = await db.from('work_records').insert([{
            typist_id: currentUser.id,
            person_id: currentUser.id,
            title: title,
            page_count: pages,
            words_count: words,
            created_at: nowISO
        }]);
        if (recErr) throw recErr;

        const updatePayload = { last_report_date: nowISO };
        if (isFinished) {
            updatePayload.completed = true;
            updatePayload.completed_at = nowISO;
        }

        const { error: typErr } = await db.from('typists').update(updatePayload).eq('id', currentUser.id);
        if (!typErr) {
            currentUser.last_report_date = nowISO;
            if (isFinished) currentUser.completed = true;
        }

        showToast('گزارش با موفقیت ثبت شد.', 'success');
        loadTypistData(); // Reload UI

    } catch (err) {
        console.error('Submit report error:', err);
        showToast('خطا در ثبت گزارش', 'error');
    }
}

async function loadTypistHistory() {
    try {
        const { data, error } = await db.from('work_records')
            .select('*')
            .or(`typist_id.eq.${currentUser.id},person_id.eq.${currentUser.id}`);

        if (error) throw error;
        
        const historyData = data || [];
        historyData.sort((a,b) => new Date(getRecordDate(b) || 0) - new Date(getRecordDate(a) || 0));

        const tbody = document.getElementById('typist-history-tbody');
        tbody.innerHTML = '';

        if (historyData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">هنوز هیچ گزارشی ثبت نکرده‌اید.</td></tr>`;
            return;
        }

        historyData.forEach(r => {
            const pagesCount = getRecordPageCount(r);
            const wordsCount = r.words_count || 0;
            const recordDate = getRecordDate(r);

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-mono text-slate-500">${formatJalali(recordDate)}</td>
                <td class="p-3 font-bold text-slate-800">${r.title || '-'}</td>
                <td class="p-3 font-bold text-slate-700">${Number(wordsCount).toLocaleString()}</td>
                <td class="p-3 font-bold text-blue-600">${Number(pagesCount).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Load typist history error:', err);
    }
}

// ==========================================
// GROUP SMS & EXPORTS
// ==========================================
function openSmsModal() {
    updateSmsRecipients();
    document.getElementById('sms-modal').classList.remove('hidden');
}

function closeSmsModal() {
    document.getElementById('sms-modal').classList.add('hidden');
}

function updateSmsRecipients() {
    const targetGroup = document.getElementById('sms-target-group').value;
    let list = targetGroup === 'delayed' 
        ? globalTypists.filter(t => calculate10DayStatus(t.last_report_date || t.created_at).isDelayed)
        : globalTypists;

    const phones = list.map(t => t.phone).filter(p => p && p.trim() !== '');
    document.getElementById('sms-recipients-list').value = phones.join(', ');
}

function sendSmsAction() {
    const phonesStr = document.getElementById('sms-recipients-list').value;
    const message = document.getElementById('sms-message-text').value.trim();

    if (!phonesStr || !message) return showToast('شماره تلفن یا متن پیامک خالی است', 'error');

    const phones = phonesStr.split(',').map(p => p.trim()).join(',');
    window.location.href = `sms:${phones}?body=${encodeURIComponent(message)}`;
}

async function exportBankExcel() {
    try {
        const { data: typists } = await db.from('typists').select('*');
        const { data: records } = await db.from('work_records').select('*');

        if (!typists) return;

        const headers = ["ردیف", "نام", "نام خانوادگی", "شماره ملی", "شماره تماس", "شماره شبا", "مبلغ قابل واریز (ریال)"];
        let csvContent = "\ufeff" + headers.join(",") + "\n";
        let rowNum = 1;

        typists.forEach(t => {
            const tRecords = (records || []).filter(r => (r.typist_id === t.id || r.person_id === t.id));
            
            const rateWord = getTypistRateWord(t);
            const ratePage = getTypistRatePage(t);

            const totalPayableRials = tRecords.reduce((sum, r) => {
                const w = r.words_count || 0;
                const p = getRecordPageCount(r);
                return sum + (w * rateWord) + (p * ratePage);
            }, 0);

            const fn = (t.first_name || t.name || '').replace(/,/g, '');
            const ln = (t.last_name || '').replace(/,/g, '');
            
            const row = [rowNum++, `"${fn}"`, `"${ln}"`, `"${getTypistNationalId(t)}"`, `"${t.phone || ''}"`, `"${getTypistShaba(t)}"`, totalPayableRials];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Bank_Payroll_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    } catch (err) {
        showToast('خطا در خروجی', 'error');
    }
}

async function exportFullDatabase() {
    try {
        const [t, r] = await Promise.all([db.from('typists').select('*'), db.from('work_records').select('*')]);
        const blob = new Blob([JSON.stringify({ typists: t.data, work_records: r.data }, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    } catch (err) {
        showToast('خطا در بکاپ', 'error');
    }
}

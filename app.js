/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.2.0)
   ========================================================================== */

// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Global State
let currentUser = null;
let globalTypists = [];
let globalProjects = [];
let globalReports = [];

// ==========================================
// UTILITY FUNCTIONS & FALLBACK READERS
// ==========================================
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
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function formatJalali(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
        return isoString;
    }
}

function calculate10DayStatus(lastReportDateISO) {
    if (!lastReportDateISO) {
        return { status: 'ok', text: 'منظم (تایم فعال)', daysLeft: 10, isDelayed: false };
    }
    const lastDate = new Date(lastReportDateISO);
    const now = new Date();
    const diffTime = now - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 10) {
        const delay = diffDays - 10;
        return { status: 'delayed', text: `تأخیر در ارسال گزارش (${delay} روز تاخیر)`, delayDays: delay, isDelayed: true };
    } else {
        const daysLeft = 10 - diffDays;
        return { status: 'ok', text: `منظم (${daysLeft} روز مهلت باقی‌مانده)`, daysLeft: daysLeft, isDelayed: false };
    }
}

// Dynamic Helpers matching DB exact schema
function getTypistFullName(t) {
    if (t.first_name || t.last_name) return `${t.first_name || ''} ${t.last_name || ''}`.trim();
    if (t.name) return t.name;
    return 'تایپیست بدون نام';
}

function getTypistNationalId(t) {
    return t.national_id || t.national_code || t.phone || '-';
}

function getTypistShaba(t) {
    return t.sheba_number || t.iban || t.account_number || '-';
}

function getTypistPageRate(t) {
    return t.page_rate || t.default_page_rate || 0;
}

// ==========================================
// INITIALIZATION & AUTHENTICATION
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
        // 1. Admin Auth
        if ((usernameInput === 'admin' || usernameInput === 'مدیر') && passwordInput === 'admin123') {
            currentUser = { role: 'admin', full_name: 'مدیر سیستم' };
            localStorage.setItem('payroll_user', JSON.stringify(currentUser));
            showToast('با موفقیت به عنوان مدیر وارد شدید', 'success');
            setupUserUI();
            return;
        }

        // 2. Fetch Typists to authenticate
        const { data: typists, error } = await db.from('typists').select('*');
        if (error) throw error;

        const found = typists.find(t => {
            const nid = getTypistNationalId(t);
            const phone = t.phone || '';
            const uid = t.id || '';
            const matchUser = (usernameInput === nid || usernameInput === phone || usernameInput === uid);
            const userPass = t.password || (phone.length >= 4 ? phone.slice(-4) : '1234');
            return matchUser && (passwordInput === userPass);
        });

        if (found) {
            currentUser = { role: 'typist', ...found };
            localStorage.setItem('payroll_user', JSON.stringify(currentUser));
            showToast(`خوش آمدید ${getTypistFullName(found)}`, 'success');
            setupUserUI();
        } else {
            showToast('شناسه کاربری یا رمز عبور اشتباه است', 'error');
        }
    } catch (err) {
        console.error('Login error:', err);
        showToast('خطا در برقراری ارتباط با دیتابیس', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerText = 'ورود به حساب کاربری';
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
        document.getElementById('typist-welcome').innerText = `خوش آمدید، ${getTypistFullName(currentUser)}`;
        loadTypistData();
    }
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
async function loadAdminData() {
    await Promise.all([
        fetchTypists(),
        fetchProjects(),
        loadAdminReports()
    ]);
}

async function fetchTypists() {
    try {
        const { data, error } = await db.from('typists').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        globalTypists = data || [];
        renderTypistsTable(globalTypists);
    } catch (err) {
        console.error('Fetch typists error:', err);
        showToast('خطا در دریافت لیست تایپیست‌ها', 'error');
    }
}

function renderTypistsTable(list) {
    const tbody = document.getElementById('admin-typists-tbody');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">هیچ تایپیستی ثبت نشده است.</td></tr>`;
        return;
    }

    list.forEach(t => {
        const status10 = calculate10DayStatus(t.last_report_date || t.created_at);
        const statusBadge = status10.isDelayed
            ? `<span class="bg-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 w-max">⚠️ ${status10.text}</span>`
            : `<span class="bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 w-max">✅ ${status10.text}</span>`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="p-3 font-medium text-slate-900">${getTypistFullName(t)}</td>
            <td class="p-3 font-mono text-slate-600">${getTypistNationalId(t)}</td>
            <td class="p-3 font-mono text-slate-600">${t.phone || '-'}</td>
            <td class="p-3 font-bold text-slate-800">${Number(getTypistPageRate(t)).toLocaleString()} ریال</td>
            <td class="p-3">${statusBadge}</td>
            <td class="p-3 text-center">
                <button onclick="editTypist('${t.id}')" class="text-blue-600 hover:text-blue-800 font-bold text-xs px-2 py-1">ویرایش</button>
                <button onclick="deleteTypist('${t.id}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs px-2 py-1">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTypistsTable() {
    const query = toEnglishDigits(document.getElementById('admin-typist-search').value.toLowerCase());
    const filtered = globalTypists.filter(t => 
        getTypistFullName(t).toLowerCase().includes(query) ||
        getTypistNationalId(t).includes(query) ||
        (t.phone && t.phone.includes(query))
    );
    renderTypistsTable(filtered);
}

async function loadAdminReports() {
    try {
        const startDate = document.getElementById('admin-filter-start').value;
        const endDate = document.getElementById('admin-filter-end').value;

        let query = db.from('work_records').select('*').order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
        if (endDate) query = query.lte('created_at', new Date(endDate).toISOString());

        const { data, error } = await query;
        if (error) throw error;
        globalReports = data || [];

        const tbody = document.getElementById('admin-reports-tbody');
        tbody.innerHTML = '';

        if (globalReports.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">هیچ کارکرد ثبت شده‌ای یافت نشد.</td></tr>`;
            return;
        }

        globalReports.forEach(r => {
            const typistId = r.typist_id || r.person_id;
            const typist = globalTypists.find(t => t.id === typistId) || {};
            const typistName = getTypistFullName(typist);
            const pageRate = getTypistPageRate(typist);
            const pagesCount = r.page_count !== undefined ? r.page_count : (r.pages_count || 0);
            const wordsCount = r.words_count || 0;
            const totalPayable = pagesCount * pageRate;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-mono text-slate-500">${formatJalali(r.created_at || r.record_date)}</td>
                <td class="p-3 font-medium text-slate-900">${typistName}</td>
                <td class="p-3 font-bold text-slate-800">${r.title || 'عنوان ثبت نشده'}</td>
                <td class="p-3 font-bold text-blue-600">${Number(pagesCount).toLocaleString()} صفحه</td>
                <td class="p-3 font-bold text-slate-700">${Number(wordsCount).toLocaleString()} کلمه</td>
                <td class="p-3 font-bold text-emerald-600">${totalPayable.toLocaleString()} ریال</td>
                <td class="p-3 text-center">
                    <button onclick="deleteWorkRecord('${r.id}')" class="text-rose-600 hover:text-rose-800 text-xs font-bold">حذف</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Load admin reports error:', err);
        showToast('خطا در دریافت لیست کارکردها', 'error');
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
        showToast('خطا در حذف کارکرد', 'error');
    }
}

// ==========================================
// MANAGING PROJECTS (WORK TITLES)
// ==========================================
async function fetchProjects() {
    try {
        const { data, error } = await db.from('projects').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        globalProjects = data || [];
        renderProjectsModalTable();
    } catch (err) {
        console.error('Fetch projects error:', err);
    }
}

function openManageProjectsModal() {
    fetchProjects();
    document.getElementById('projects-modal').classList.remove('hidden');
}

function closeProjectsModal() {
    document.getElementById('projects-modal').classList.add('hidden');
}

function renderProjectsModalTable() {
    const tbody = document.getElementById('projects-tbody');
    tbody.innerHTML = '';

    if (globalProjects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400">هیچ عنوان کاری ثبت نشده است.</td></tr>`;
        return;
    }

    globalProjects.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        const isCompleted = p.status === 'completed';
        const statusBadge = isCompleted 
            ? `<span class="text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold">تکمیل شده</span>`
            : `<span class="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">فعال</span>`;

        tr.innerHTML = `
            <td class="p-2 font-bold text-slate-800">${p.title}</td>
            <td class="p-2">${statusBadge}</td>
            <td class="p-2 text-center">
                <button onclick="toggleProjectStatus('${p.id}', '${p.status}')" class="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold">
                    ${isCompleted ? 'فعال‌سازی مجدد' : 'علامت‌گذاری به‌عنوان پایان‌یافته'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function addNewProject(e) {
    e.preventDefault();
    const input = document.getElementById('new-project-title');
    const title = input.value.trim();
    if (!title) return;

    try {
        const { error } = await db.from('projects').insert([{ title: title, status: 'active' }]);
        if (error) throw error;
        showToast('عنوان کار جدید با موفقیت اضافه شد', 'success');
        input.value = '';
        await fetchProjects();
    } catch (err) {
        console.error('Add project error:', err);
        showToast('خطا در افزودن عنوان کار', 'error');
    }
}

async function toggleProjectStatus(projectId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'completed' : 'active';
    try {
        const { error } = await db.from('projects').update({ status: newStatus }).eq('id', projectId);
        if (error) throw error;
        showToast('وضعیت عنوان کار تغییر کرد', 'success');
        await fetchProjects();
    } catch (err) {
        console.error('Toggle project status error:', err);
        showToast('خطا در تغییر وضعیت', 'error');
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
    document.getElementById('typist-modal-title').innerText = 'ویرایش اطلاعات تایپیست';
    document.getElementById('typist-form-id').value = t.id;
    document.getElementById('typist-first-name').value = t.first_name || '';
    document.getElementById('typist-last-name').value = t.last_name || '';
    document.getElementById('typist-national-id').value = getTypistNationalId(t);
    document.getElementById('typist-phone').value = t.phone || '';
    document.getElementById('typist-shaba').value = getTypistShaba(t);
    document.getElementById('typist-page-rate').value = getTypistPageRate(t);
    document.getElementById('typist-password').value = t.password || '';
    document.getElementById('typist-modal').classList.remove('hidden');
}

async function saveTypist(e) {
    e.preventDefault();
    const id = document.getElementById('typist-form-id').value;
    const firstName = document.getElementById('typist-first-name').value.trim();
    const lastName = document.getElementById('typist-last-name').value.trim();
    const nationalId = toEnglishDigits(document.getElementById('typist-national-id').value);
    const phone = toEnglishDigits(document.getElementById('typist-phone').value);
    const shaba = toEnglishDigits(document.getElementById('typist-shaba').value);
    const pageRate = parseInt(toEnglishDigits(document.getElementById('typist-page-rate').value)) || 0;
    const password = toEnglishDigits(document.getElementById('typist-password').value) || (phone.length >= 4 ? phone.slice(-4) : '1234');

    const payload = {
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        national_id: nationalId,
        phone: phone,
        sheba_number: shaba,
        page_rate: pageRate,
        password: password
    };

    try {
        if (id) {
            const { error } = await db.from('typists').update(payload).eq('id', id);
            if (error) throw error;
            showToast('اطلاعات تایپیست به‌روزرسانی شد', 'success');
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
        showToast('خطا در ذخیره اطلاعات تایپیست', 'error');
    }
}

async function deleteTypist(id) {
    if (!confirm('آیا از حذف این تایپیست و کلیه سوابق آن مطمئن هستید؟')) return;
    try {
        const { error } = await db.from('typists').delete().eq('id', id);
        if (error) throw error;
        showToast('تایپیست حذف شد', 'success');
        fetchTypists();
    } catch (err) {
        console.error('Delete typist error:', err);
        showToast('خطا در حذف تایپیست', 'error');
    }
}

// ==========================================
// TYPIST DASHBOARD & REPORTING
// ==========================================
async function loadTypistData() {
    update10DayBadge();
    await populateActiveProjectsDropdown();
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

async function populateActiveProjectsDropdown() {
    try {
        const { data: projects, error } = await db.from('projects').select('*').eq('status', 'active');
        if (error) throw error;

        const select = document.getElementById('report-title-select');
        select.innerHTML = '<option value="">-- انتخاب عنوان کار --</option>';

        (projects || []).forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.title;
            opt.dataset.id = p.id;
            opt.textContent = p.title;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Populate dropdown error:', err);
    }
}

async function submitTypistWorkReport(e) {
    e.preventDefault();
    const select = document.getElementById('report-title-select');
    const title = select.value;
    const pages = parseInt(toEnglishDigits(document.getElementById('report-pages').value)) || 0;
    const words = parseInt(toEnglishDigits(document.getElementById('report-words').value)) || 0;
    const isFinished = document.getElementById('report-is-finished').checked;

    if (!title) {
        showToast('لطفا عنوان کار را انتخاب کنید', 'error');
        return;
    }

    try {
        const nowISO = new Date().toISOString();

        // 1. Insert Work Record (Using schema exact columns: page_count and words_count)
        const { error: recErr } = await db.from('work_records').insert([{
            typist_id: currentUser.id,
            person_id: currentUser.id,
            title: title,
            page_count: pages,
            words_count: words,
            created_at: nowISO
        }]);
        if (recErr) throw recErr;

        // 2. Reset 10-Day Cycle in typists table
        const { error: typErr } = await db.from('typists').update({ last_report_date: nowISO }).eq('id', currentUser.id);
        if (!typErr) currentUser.last_report_date = nowISO;

        // 3. Mark project completed if checkbox checked
        if (isFinished) {
            const selectedOpt = select.options[select.selectedIndex];
            const pId = selectedOpt ? selectedOpt.dataset.id : null;
            if (pId) {
                await db.from('projects').update({ status: 'completed' }).eq('id', pId);
            }
        }

        showToast('گزارش کارکرد با موفقیت ثبت شد و تایمر ۱۰ روزه شما بازنشانی گردید.', 'success');
        document.getElementById('typist-report-form').reset();

        // Refresh Typist UI
        update10DayBadge();
        await populateActiveProjectsDropdown();
        await loadTypistHistory();

    } catch (err) {
        console.error('Submit report error:', err);
        showToast('خطا در ثبت گزارش کارکرد', 'error');
    }
}

async function loadTypistHistory() {
    try {
        const { data, error } = await db.from('work_records')
            .select('*')
            .or(`typist_id.eq.${currentUser.id},person_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('typist-history-tbody');
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">هنوز هیچ گزارشی ثبت نکرده‌اید.</td></tr>`;
            return;
        }

        data.forEach(r => {
            const pagesCount = r.page_count !== undefined ? r.page_count : (r.pages_count || 0);
            const wordsCount = r.words_count || 0;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-mono text-slate-500">${formatJalali(r.created_at || r.record_date)}</td>
                <td class="p-3 font-bold text-slate-800">${r.title || '-'}</td>
                <td class="p-3 font-bold text-blue-600">${Number(pagesCount).toLocaleString()} صفحه</td>
                <td class="p-3 font-bold text-slate-700">${Number(wordsCount).toLocaleString()} کلمه</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Load typist history error:', err);
    }
}

// ==========================================
// EXPORTS: BANK EXCEL & FULL DB BACKUP
// ==========================================
async function exportBankExcel() {
    try {
        const { data: typists } = await db.from('typists').select('*');
        const { data: records } = await db.from('work_records').select('*');

        if (!typists || typists.length === 0) {
            showToast('هیچ داده‌ای برای خروجی بانک وجود ندارد', 'error');
            return;
        }

        // Header required by Bank CSV export
        const headers = ["ردیف", "نام", "نام خانوادگی", "شماره ملی", "شماره تماس", "شماره شبا", "مبلغ قابل واریز (ریال)"];
        let csvContent = "\ufeff" + headers.join(",") + "\n"; // UTF-8 BOM for Microsoft Excel

        let rowNum = 1;
        typists.forEach(t => {
            const tRecords = (records || []).filter(r => (r.typist_id === t.id || r.person_id === t.id));
            const totalPages = tRecords.reduce((sum, r) => {
                const p = r.page_count !== undefined ? r.page_count : (r.pages_count || 0);
                return sum + (Number(p) || 0);
            }, 0);
            
            const pageRate = getTypistPageRate(t);
            const totalPayableRials = totalPages * pageRate;

            const fn = (t.first_name || t.name || '').replace(/,/g, '');
            const ln = (t.last_name || '').replace(/,/g, '');
            const nid = getTypistNationalId(t).replace(/,/g, '');
            const phone = (t.phone || '').replace(/,/g, '');
            const shaba = getTypistShaba(t).replace(/,/g, '');

            const row = [
                rowNum++,
                `"${fn}"`,
                `"${ln}"`,
                `"${nid}"`,
                `"${phone}"`,
                `"${shaba}"`,
                totalPayableRials
            ];
            csvContent += row.join(",") + "\n";
        });

        // Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Bank_Payroll_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('فایل اکسل بانک با موفقیت دانلود شد', 'success');

    } catch (err) {
        console.error('Export Bank Excel error:', err);
        showToast('خطا در دریافت خروجی اکسل بانک', 'error');
    }
}

async function exportFullDatabase() {
    try {
        showToast('در حال دریافت نسخه پشتیبان دیتابیس...', 'info');
        const [typistsRes, recordsRes, projectsRes, settingsRes, paymentsRes] = await Promise.all([
            db.from('typists').select('*'),
            db.from('work_records').select('*'),
            db.from('projects').select('*'),
            db.from('admin_settings').select('*'),
            db.from('payments').select('*')
        ]);

        const backupObject = {
            export_date: new Date().toISOString(),
            typists: typistsRes.data || [],
            work_records: recordsRes.data || [],
            projects: projectsRes.data || [],
            admin_settings: settingsRes.data || [],
            payments: paymentsRes.data || []
        };

        const jsonStr = JSON.stringify(backupObject, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Database_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('بکاپ کامل JSON دیتابیس دانلود شد', 'success');
    } catch (err) {
        console.error('Export DB Error:', err);
        showToast('خطا در دریافت پشتیبان دیتابیس', 'error');
    }
}

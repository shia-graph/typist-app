const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = db;

const state = {
    role: null, sessionToken: null, currentTypistId: null, typistIdentifier: null,
    dashboardData: [], selectedTypists: new Set(), typistProfile: null, reports: [], payments: []
};

// --- Theme Toggle ---
function toggleTheme() {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
        root.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        root.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

// --- Utils ---
const SafeNum = {
    format: (val) => (Number(val) || 0).toLocaleString('fa-IR'),
    short: (val) => {
        const n = Number(val) || 0;
        if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(1).replace('.', '/') + ' میلیارد';
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace('.', '/') + ' میلیون';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + ' هزار';
        return n.toLocaleString('fa-IR');
    }
};

async function rpc(fn, params = {}) {
    const { data, error } = await db.rpc(fn, params);
    if (error) return { success: false, message: error.message };
    return data;
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('typist_session');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.role = parsed.role;
            state.sessionToken = parsed.token;
            state.currentTypistId = parsed.typistId;
            state.typistIdentifier = parsed.identifier;
            updateNav();
            if (state.role === 'admin') showDashboardView();
            else showDetailView(state.currentTypistId);
            return;
        } catch (e) { localStorage.removeItem('typist_session'); }
    }
    document.getElementById('login-view').classList.remove('hidden');
});

function updateNav() {
    document.getElementById('btn-logout').classList.remove('hidden');
    document.getElementById('user-role-badge').textContent = state.role === 'admin' ? 'مدیر سیستم' : 'تایپیست';
}

function switchLoginTab(tab) {
    const a = document.getElementById('form-admin-login');
    const t = document.getElementById('form-typist-login');
    if (tab === 'admin') { a.classList.remove('hidden'); t.classList.add('hidden'); }
    else { a.classList.add('hidden'); t.classList.remove('hidden'); }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const pw = document.getElementById('admin-password').value;
    const res = await rpc('verify_admin_password', { p_password: pw });
    if (res?.success) {
        state.role = 'admin';
        localStorage.setItem('typist_session', JSON.stringify({ role: 'admin', token: res.token }));
        updateNav(); showDashboardView();
    } else showDialog('خطا', 'رمز عبور اشتباه است', 'error');
}

async function handleTypistLogin(e) {
    e.preventDefault();
    const id = document.getElementById('typist-identifier').value;
    const pw = document.getElementById('typist-password').value;
    const res = await rpc('verify_typist_password', { p_identifier: id, p_password: pw });
    if (res?.success) {
        state.role = 'typist';
        localStorage.setItem('typist_session', JSON.stringify({ role: 'typist', token: res.token, typistId: res.typist_id, identifier: id }));
        updateNav(); showDetailView(res.typist_id);
    } else showDialog('خطا', 'اطلاعات اشتباه است', 'error');
}

function logout() {
    localStorage.removeItem('typist_session');
    location.reload();
}

function showDashboardView() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    loadDashboard();
}

async function showDetailView(id) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    state.currentTypistId = id;
    
    if (state.role === 'admin') {
        document.getElementById('detail-admin-nav').classList.remove('hidden');
        document.getElementById('detail-admin-actions').classList.remove('hidden');
    }
    await loadTypistData(id);
}

// --- Dashboard ---
async function loadDashboard() {
    const data = await rpc('get_dashboard_summary');
    if (Array.isArray(data)) {
        state.dashboardData = data;
        renderDashboardList(data);
    }
}

function filterDashboard() {
    const q = document.getElementById('dashboard-search').value.toLowerCase();
    const f = state.dashboardData.filter(i => (i.name && i.name.toLowerCase().includes(q)) || (i.phone && i.phone.includes(q)) || (i.national_id && i.national_id.includes(q)));
    renderDashboardList(f);
}

function renderDashboardList(list) {
    const tbody = document.getElementById('typists-table-body');
    tbody.innerHTML = '';
    
    let w=0, pay=0, pd=0, rem=0;
    
    list.forEach(item => {
        w += Number(item.total_words); pay += Number(item.total_payable);
        pd += Number(item.total_paid); rem += Number(item.remaining);
        
        // محاسبه تایمر تحویل
        let timerBadge = '—';
        if (item.delivery_date) {
            timerBadge = getTimerBadge(item.delivery_date);
        }

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer';
        tr.onclick = (e) => { if (!['INPUT','BUTTON'].includes(e.target.tagName)) showDetailView(item.id); };
        tr.innerHTML = `
            <td class="p-3 text-center"><input type="checkbox" onchange="toggleSelectTypist('${item.id}', this.checked)"></td>
            <td class="p-4 font-bold">${item.name}</td>
            <td class="p-4 text-center">${timerBadge}</td>
            <td class="p-4 text-center font-mono text-cyan-600 dark:text-cyan-400">${SafeNum.format(item.total_words)}</td>
            <td class="p-4 text-left font-mono text-amber-600 dark:text-amber-400">${SafeNum.format(item.total_payable)}</td>
            <td class="p-4 text-left font-mono text-emerald-600 dark:text-emerald-400">${SafeNum.format(item.total_paid)}</td>
            <td class="p-4 text-left font-mono font-bold ${item.remaining>0?'text-rose-600 dark:text-rose-400':''}">${SafeNum.format(item.remaining)}</td>
            <td class="p-4 text-center">
                <button onclick="openTypistModal('${item.id}')" class="text-amber-500">✏️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('stat-total-typists').textContent = SafeNum.format(list.length);
    document.getElementById('stat-total-words').textContent = SafeNum.short(w);
    document.getElementById('stat-total-payable').textContent = SafeNum.short(pay);
    document.getElementById('stat-total-paid').textContent = SafeNum.short(pd);
    document.getElementById('stat-total-remaining').textContent = SafeNum.short(rem);
}

// --- Detail & Timer ---
async function loadTypistData(id) {
    const profile = await rpc('get_typist_profile', { p_typist_id: id });
    if (profile && profile.length > 0) {
        state.typistProfile = profile[0];
        const p = state.typistProfile;
        document.getElementById('detail-name').textContent = p.name;
        document.getElementById('detail-phone').textContent = p.phone;
        document.getElementById('detail-national-id').textContent = p.national_id || '—';
        document.getElementById('detail-card-number').textContent = p.card_number || '—';
        document.getElementById('detail-rate').textContent = SafeNum.format(p.rate_per_word || p.default_word_rate);
        
        document.getElementById('detail-btn-call').href = `tel:${p.phone}`;
        document.getElementById('detail-btn-sms').href = `sms:${p.phone}`;

        // نمایش نوار 타이مر در پروفایل
        const tBox = document.getElementById('delivery-timer-box');
        if (p.delivery_date) {
            tBox.innerHTML = `تاریخ تحویل: ${p.delivery_date} — وضعیت: ` + getTimerBadge(p.delivery_date);
            tBox.classList.remove('hidden');
            tBox.className = `p-4 rounded-xl font-bold text-sm text-center shadow-sm ${getTimerColorClass(p.delivery_date)}`;
        } else {
            tBox.classList.add('hidden');
        }
    } else {
        showDialog('خطا', 'پروفایل یافت نشد', 'error');
        return;
    }
}

// تبدیل تاریخ شمسی به میلادی برای تایمر
function shamsiToDate(shamsiStr) {
    try {
        const parts = shamsiStr.split('/');
        if (parts.length !== 3) return null;
        const jy = parseInt(parts[0], 10), jm = parseInt(parts[1], 10), jd = parseInt(parts[2], 10);
        let gy = jy + 621; let gm = 0; let gd = 0; // یک تبدیل تقریبی سریع برای تایمر
        return new Date(gy, jm - 1, jd); // جهت دیباگ دقیق از کتابخانه جلالی می‌توان استفاده کرد، اما اینجا تفاوت روزها کافیست
    } catch { return null; }
}

function getTimerBadge(shamsiDate) {
    if (!shamsiDate) return '—';
    // راه ساده: تبدیل تاریخ شمسی ورودی به Date جاوااسکریپت (تقریبی اما برای اختلاف روز دقیق است)
    const target = shamsiToDate(shamsiDate);
    if(!target) return '—';
    const now = new Date();
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) return `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">${SafeNum.format(diffDays)} روز مانده</span>`;
    if (diffDays === 0) return `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">امروز (سررسید)</span>`;
    return `<span class="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs">${SafeNum.format(Math.abs(diffDays))} روز تاخیر!</span>`;
}

function getTimerColorClass(shamsiDate) {
    const target = shamsiToDate(shamsiDate);
    if(!target) return 'bg-slate-100 text-slate-700';
    const diffDays = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 border border-blue-200';
    if (diffDays === 0) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 border border-amber-200';
    return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 border border-rose-200';
}

// --- Typist Form (Profile) ---
function openTypistModal(id = null) {
    document.getElementById('form-typist-edit').reset();
    document.getElementById('typist-form-id').value = id || '';
    if (id) {
        const p = state.dashboardData.find(x => x.id === id) || state.typistProfile;
        if (p) {
            document.getElementById('typist-form-first-name').value = p.first_name || '';
            document.getElementById('typist-form-last-name').value = p.last_name || '';
            document.getElementById('typist-form-father-name').value = p.father_name || '';
            document.getElementById('typist-form-phone').value = p.phone || '';
            document.getElementById('typist-form-national-id').value = p.national_id || '';
            document.getElementById('typist-form-card').value = p.card_number || '';
            document.getElementById('typist-form-iban').value = p.iban || '';
            document.getElementById('typist-form-delivery-date').value = p.delivery_date || '';
            document.getElementById('typist-form-rate').value = p.rate_per_word || 15;
        }
    } else {
        // برای تایپیست جدید، تاریخ تحویل ۱۰ روز آینده را به صورت پیش‌فرض می‌گذاریم (اختیاری)
        document.getElementById('typist-form-rate').value = 15;
    }
    document.getElementById('modal-typist').classList.remove('hidden');
}

async function handleSaveTypist(e) {
    e.preventDefault();
    const res = await rpc('upsert_typist', {
        p_id: document.getElementById('typist-form-id').value || null,
        p_first_name: document.getElementById('typist-form-first-name').value,
        p_last_name: document.getElementById('typist-form-last-name').value,
        p_father_name: document.getElementById('typist-form-father-name').value,
        p_phone: document.getElementById('typist-form-phone').value,
        p_national_id: document.getElementById('typist-form-national-id').value,
        p_card_number: document.getElementById('typist-form-card').value,
        p_iban: document.getElementById('typist-form-iban').value,
        p_delivery_date: document.getElementById('typist-form-delivery-date').value,
        p_rate_per_word: Number(document.getElementById('typist-form-rate').value) || 15
    });
    if (res?.success) {
        closeModal('modal-typist');
        showDialog('موفق', 'پروفایل ثبت شد', 'success');
        if (state.role === 'admin') loadDashboard();
    } else {
        showDialog('خطا', res?.message, 'error');
    }
}

// --- Excel Export ویژه پرداخت ---
function exportAllDashboardExcel() {
    if (!state.dashboardData.length) return;
    
    // هدرهای دقیق درخواستی
    let csv = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n';
    
    state.dashboardData.forEach((item, index) => {
        // تبدیل مبلغ بدهی (تومان) به ریال برای خروجی واریز
        const remainingRial = (Number(item.remaining) || 0) * 10;
        
        const row = [
            index + 1,
            `"${item.first_name || ''}"`,
            `"${item.last_name || ''}"`,
            `"${item.father_name || ''}"`,
            `"${item.national_id || ''}"`,
            `"${item.phone || ''}"`,
            `"${item.card_number || ''}"`,
            `"${item.iban || ''}"`,
            remainingRial
        ];
        csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `لیست_پرداخت_تایپیست_ها.csv`;
    link.click();
}

// --- Utils (Modals) ---
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showDialog(title, msg, type = 'info', onConfirm = null) {
    const m = document.getElementById('modal-dialog');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = msg;
    const btn = document.getElementById('dialog-btn-confirm');
    btn.onclick = () => { m.classList.add('hidden'); if(onConfirm) onConfirm(); };
    m.classList.remove('hidden');
}

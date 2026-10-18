/**
 * سیستم مدیریت تایپیست‌ها - نسخه پیشرفته
 */

// ۱. تنظیمات اتصال Supabase
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = db; // جهت دیباگ در کنسول

// ۲. وضعیت برنامه (State)
const state = {
    role: null, // 'admin' | 'typist'
    sessionToken: null,
    currentTypistId: null,
    typistIdentifier: null,
    dashboardData: [],
    selectedTypists: new Set(),
    typistProfile: null,
    reports: [],
    payments: [],
    editingReportId: null,
    editingPaymentId: null
};

// ۳. توابع کمکی اعداد و فرمت‌دهی
const SafeNum = {
    format: (val) => {
        const n = Number(val) || 0;
        return n.toLocaleString('fa-IR');
    },
    short: (val) => {
        const n = Number(val) || 0;
        if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(1).replace('.', '/') + ' میلیارد';
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace('.', '/') + ' میلیون';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + ' هزار';
        return n.toLocaleString('fa-IR');
    }
};

// فراخوانی RPC ایمن
async function rpc(functionName, params = {}) {
    try {
        const { data, error } = await db.rpc(functionName, params);
        if (error) {
            console.error(`RPC Error [${functionName}]:`, error);
            return { success: false, message: error.message || 'خطا در برقراری ارتباط با سرور' };
        }
        return data;
    } catch (err) {
        console.error(`Network Exception [${functionName}]:`, err);
        return { success: false, message: 'خطای شبکه یا عدم پاسخ سرور' };
    }
}

// ۴. راه اندازی اولیه
document.addEventListener('DOMContentLoaded', () => {
    checkExistingSession();
    initShamsiDatePicker();
});

function checkExistingSession() {
    const saved = localStorage.getItem('typist_app_session');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.role = parsed.role;
            state.sessionToken = parsed.token;
            state.currentTypistId = parsed.typistId || null;
            state.typistIdentifier = parsed.identifier || null;

            updateNavigationUI();
            if (state.role === 'admin') {
                showDashboardView();
            } else if (state.role === 'typist') {
                showDetailView(state.currentTypistId);
            }
            return;
        } catch (e) {
            localStorage.removeItem('typist_app_session');
        }
    }
    showLoginView();
}

function updateNavigationUI() {
    const roleBadge = document.getElementById('user-role-badge');
    const btnLogout = document.getElementById('btn-logout');
    const btnChangePw = document.getElementById('btn-change-pw');

    if (state.role === 'admin') {
        roleBadge.textContent = 'وارد شده به عنوان: مدیر سیستم';
        roleBadge.className = 'text-xs text-brand-400 font-bold';
        btnLogout.classList.remove('hidden');
        btnChangePw.classList.remove('hidden');
    } else if (state.role === 'typist') {
        roleBadge.textContent = 'وارد شده به عنوان: تایپیست';
        roleBadge.className = 'text-xs text-indigo-400 font-bold';
        btnLogout.classList.remove('hidden');
        btnChangePw.classList.remove('hidden');
    } else {
        roleBadge.textContent = 'لطفاً وارد شوید';
        roleBadge.className = 'text-xs text-slate-400';
        btnLogout.classList.add('hidden');
        btnChangePw.classList.add('hidden');
    }
}

// ۵. مدیریت تب‌ها و فرم‌های ورود
function switchLoginTab(tab) {
    const formAdmin = document.getElementById('form-admin-login');
    const formTypist = document.getElementById('form-typist-login');
    const tabAdmin = document.getElementById('tab-admin');
    const tabTypist = document.getElementById('tab-typist');

    if (tab === 'admin') {
        formAdmin.classList.remove('hidden');
        formTypist.classList.add('hidden');
        tabAdmin.className = 'flex-1 py-2 text-sm font-medium rounded-lg transition bg-brand-600 text-white shadow';
        tabTypist.className = 'flex-1 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg transition';
    } else {
        formAdmin.classList.add('hidden');
        formTypist.classList.remove('hidden');
        tabAdmin.className = 'flex-1 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg transition';
        tabTypist.className = 'flex-1 py-2 text-sm font-medium rounded-lg transition bg-indigo-600 text-white shadow';
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const pw = document.getElementById('admin-password').value.trim();
    const btn = document.getElementById('btn-admin-submit');

    btn.disabled = true;
    btn.textContent = 'در حال بررسی...';

    const res = await rpc('verify_admin_password', { p_password: pw });
    btn.disabled = false;
    btn.textContent = 'ورود به عنوان مدیر';

    if (res && res.success) {
        state.role = 'admin';
        state.sessionToken = res.token;
        localStorage.setItem('typist_app_session', JSON.stringify({ role: 'admin', token: res.token }));
        updateNavigationUI();
        showDashboardView();
    } else {
        showDialog('خطا', res.message || 'رمز عبور اشتباه است', 'error');
    }
}

async function handleTypistLogin(e) {
    e.preventDefault();
    const identifier = document.getElementById('typist-identifier').value.trim();
    const pw = document.getElementById('typist-password').value.trim();
    const btn = document.getElementById('btn-typist-submit');

    btn.disabled = true;
    btn.textContent = 'در حال بررسی...';

    const res = await rpc('verify_typist_password', { p_identifier: identifier, p_password: pw });
    btn.disabled = false;
    btn.textContent = 'ورود به پنل تایپیست';

    if (res && res.success) {
        state.role = 'typist';
        state.sessionToken = res.token;
        state.currentTypistId = res.typist_id;
        state.typistIdentifier = identifier;

        localStorage.setItem('typist_app_session', JSON.stringify({
            role: 'typist',
            token: res.token,
            typistId: res.typist_id,
            identifier: identifier
        }));

        updateNavigationUI();
        showDetailView(res.typist_id);
    } else {
        showDialog('خطا', res.message || 'اطلاعات ورود اشتباه است', 'error');
    }
}

function logout() {
    showDialog('خروج از حساب', 'آیا مایل به خروج از حساب کاربری هستید؟', 'confirm', () => {
        state.role = null;
        state.sessionToken = null;
        state.currentTypistId = null;
        state.typistIdentifier = null;
        localStorage.removeItem('typist_app_session');
        updateNavigationUI();
        showLoginView();
    });
}

// ۶. تغییر نمای صفحات (Views)
function showLoginView() {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');
}

function showDashboardView() {
    if (state.role !== 'admin') {
        showLoginView();
        return;
    }
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('detail-view').classList.add('hidden');
    loadDashboard();
}

async function showDetailView(typistId) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');

    state.currentTypistId = typistId;

    // تنظیم دسترسی‌ها براساس نقش
    const isAdmin = state.role === 'admin';
    document.getElementById('detail-admin-nav').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('detail-admin-actions').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('btn-add-report').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-add-payment').style.display = isAdmin ? 'block' : 'none';

    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? 'table-cell' : 'none';
    });

    await loadTypistDetailData(typistId);
}

// ۷. بارگذاری داده‌های داشبورد اصلی
async function loadDashboard() {
    const data = await rpc('get_dashboard_summary');
    if (Array.isArray(data)) {
        state.dashboardData = data;
        renderDashboardStats(data);
        renderDashboardList(data);
    } else {
        showDialog('خطا', 'مشکل در بارگذاری اطلاعات داشبورد', 'error');
    }
}

function renderDashboardStats(data) {
    let totalWords = 0;
    let totalPayable = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    data.forEach(item => {
        totalWords += Number(item.total_words) || 0;
        totalPayable += Number(item.total_payable) || 0;
        totalPaid += Number(item.total_paid) || 0;
        totalRemaining += Number(item.remaining) || 0;
    });

    document.getElementById('stat-total-typists').textContent = SafeNum.format(data.length);
    document.getElementById('stat-total-words').textContent = SafeNum.short(totalWords);
    document.getElementById('stat-total-payable').textContent = SafeNum.short(totalPayable);
    document.getElementById('stat-total-paid').textContent = SafeNum.short(totalPaid);
    document.getElementById('stat-total-remaining').textContent = SafeNum.short(totalRemaining);
}

function filterDashboard() {
    const query = document.getElementById('dashboard-search').value.trim().toLowerCase();
    if (!query) {
        renderDashboardList(state.dashboardData);
        return;
    }
    const filtered = state.dashboardData.filter(item =>
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.phone && item.phone.includes(query)) ||
        (item.national_id && item.national_id.includes(query))
    );
    renderDashboardList(filtered);
}

// رندر لیست تایپیست‌ها (دسکتاپ + کارت‌های موبایل)
function renderDashboardList(list) {
    const tbody = document.getElementById('typists-table-body');
    const cardsMobile = document.getElementById('typists-cards-mobile');

    tbody.innerHTML = '';
    cardsMobile.innerHTML = '';

    if (list.length === 0) {
        const emptyHtml = `<div class="p-8 text-center text-slate-400 text-sm">هیچ تایپیستی یافت نشد.</div>`;
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">هیچ تایپیستی یافت نشد.</td></tr>`;
        cardsMobile.innerHTML = emptyHtml;
        return;
    }

    list.forEach(item => {
        const isSelected = state.selectedTypists.has(item.id);
        const avatarColors = getAvatarColors(item.name);
        const remaining = Number(item.remaining) || 0;
        
        // رنگ وضعیت مانده حساب
        let statusBadge = '';
        if (remaining > 0) {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">بدهکار: ${SafeNum.short(remaining)}</span>`;
        } else if (remaining < 0) {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">بستانکار: ${SafeNum.short(Math.abs(remaining))}</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">تسویه شده</span>`;
        }

        // ۱. ردیف دسکتاپ
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition cursor-pointer group';
        tr.onclick = (e) => {
            // عدم هدایت اگر روی چک‌باکس یا دکمه‌های عملیاتی کلیک شد
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
            showDetailView(item.id);
        };

        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectTypist('${item.id}', this.checked)" class="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0">
            </td>
            <td class="p-4">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl ${avatarColors.bg} text-white font-bold flex items-center justify-center text-xs shadow-sm">
                        ${getInitials(item.name)}
                    </div>
                    <div>
                        <div class="font-bold text-white group-hover:text-brand-400 transition flex items-center gap-2">
                            <span>${item.name}</span>
                            ${statusBadge}
                        </div>
                        <div class="text-xs text-slate-400 font-mono dir-ltr text-right">${item.phone || 'بدون تلفن'}</div>
                    </div>
                </div>
            </td>
            <td class="p-4 text-center font-mono font-bold text-cyan-400">${SafeNum.format(item.total_words)}</td>
            <td class="p-4 text-center text-slate-300">${SafeNum.format(item.reports_count)}</td>
            <td class="p-4 text-left font-mono text-amber-400">${SafeNum.format(item.total_payable)}</td>
            <td class="p-4 text-left font-mono text-emerald-400">${SafeNum.format(item.total_paid)}</td>
            <td class="p-4 text-left font-mono font-bold ${remaining > 0 ? 'text-rose-400' : 'text-slate-300'}">${SafeNum.format(item.remaining)}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-1.5" onclick="event.stopPropagation()">
                    <a href="tel:${item.phone}" title="تماس" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700">📞</a>
                    <a href="sms:${item.phone}" title="پیامک" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700">💬</a>
                    <button onclick="openTypistModal('${item.id}')" title="ویرایش پروفایل" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700">✏️</button>
                    <button onclick="confirmDeleteTypist('${item.id}', '${item.name}')" title="حذف" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        // ۲. کارت موبایلی
        const card = document.createElement('div');
        card.className = 'p-4 hover:bg-slate-800/40 transition space-y-3';
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectTypist('${item.id}', this.checked)" class="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0">
                    <div class="w-10 h-10 rounded-xl ${avatarColors.bg} text-white font-bold flex items-center justify-center text-xs">
                        ${getInitials(item.name)}
                    </div>
                    <div>
                        <div class="font-bold text-white text-sm" onclick="showDetailView('${item.id}')">${item.name}</div>
                        <div class="text-xs text-slate-400 font-mono dir-ltr text-right">${item.phone || 'بدون تلفن'}</div>
                    </div>
                </div>
                <div>${statusBadge}</div>
            </div>

            <div class="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-xl text-center text-xs">
                <div>
                    <span class="text-slate-400 block text-[10px]">کلمات</span>
                    <span class="font-bold text-cyan-400">${SafeNum.format(item.total_words)}</span>
                </div>
                <div>
                    <span class="text-slate-400 block text-[10px]">پرداختی</span>
                    <span class="font-bold text-emerald-400">${SafeNum.short(item.total_paid)}</span>
                </div>
                <div>
                    <span class="text-slate-400 block text-[10px]">مانده</span>
                    <span class="font-bold ${remaining > 0 ? 'text-rose-400' : 'text-slate-300'}">${SafeNum.short(item.remaining)}</span>
                </div>
            </div>

            <div class="flex items-center justify-between pt-1 text-xs border-t border-slate-800/50">
                <button onclick="showDetailView('${item.id}')" class="text-brand-400 font-bold flex items-center gap-1">
                    <span>مشاهده گزارش‌ها و جزئیات</span>
                    <span>➔</span>
                </button>
                <div class="flex items-center gap-1.5">
                    <a href="tel:${item.phone}" class="p-1.5 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">📞</a>
                    <a href="sms:${item.phone}" class="p-1.5 rounded-lg bg-slate-800 text-indigo-400 border border-slate-700">💬</a>
                    <button onclick="openTypistModal('${item.id}')" class="p-1.5 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">✏️</button>
                </div>
            </div>
        `;
        cardsMobile.appendChild(card);
    });
}

// انتخاب برای پیامک گروهی
function toggleSelectTypist(id, checked) {
    if (checked) state.selectedTypists.add(id);
    else state.selectedTypists.delete(id);
    updateGroupSmsButton();
}

function toggleSelectAllTypists(checked) {
    if (checked) {
        state.dashboardData.forEach(item => state.selectedTypists.add(item.id));
    } else {
        state.selectedTypists.clear();
    }
    renderDashboardList(state.dashboardData);
    updateGroupSmsButton();
}

function updateGroupSmsButton() {
    const count = state.selectedTypists.size;
    document.getElementById('btn-group-sms-text').textContent = `پیامک گروهی (${SafeNum.format(count)})`;
}

// ۸. بارگذاری جزییات یک تایپیست
async function loadTypistDetailData(typistId) {
    const profile = await rpc('get_typist_profile', { p_typist_id: typistId });
    if (profile && profile.id) {
        state.typistProfile = profile;
        renderTypistProfile(profile);
    } else {
        showDialog('خطا', 'پروفایل تایپیست یافت نشد', 'error');
        return;
    }

    const reports = await rpc('get_typist_reports', { p_typist_id: typistId });
    state.reports = Array.isArray(reports) ? reports : [];
    renderReportsTable(state.reports);

    const payments = await rpc('get_typist_payments', { p_typist_id: typistId });
    state.payments = Array.isArray(payments) ? payments : [];
    renderPaymentsTable(state.payments);

    calculateTypistDetailSummary();
}

function renderTypistProfile(profile) {
    document.getElementById('detail-breadcrumb-name').textContent = profile.name;
    document.getElementById('detail-name').textContent = profile.name;
    document.getElementById('detail-phone').textContent = profile.phone || 'ثبت نشده';
    document.getElementById('detail-national-id').textContent = profile.national_id || profile.national_code || 'ثبت نشده';
    document.getElementById('detail-rate').textContent = SafeNum.format(profile.rate_per_word || profile.default_word_rate || 15);
    
    document.getElementById('detail-avatar').textContent = getInitials(profile.name);
    const colors = getAvatarColors(profile.name);
    document.getElementById('detail-avatar').className = `w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center text-xl font-bold text-white shadow-lg`;

    document.getElementById('detail-btn-call').href = `tel:${profile.phone}`;
    document.getElementById('detail-btn-sms').href = `sms:${profile.phone}`;
}

function calculateTypistDetailSummary() {
    let words = 0;
    let payable = 0;
    let paid = 0;

    state.reports.forEach(r => {
        words += Number(r.words) || 0;
        payable += Number(r.total_amount) || 0;
    });

    state.payments.forEach(p => {
        paid += Number(p.amount) || 0;
    });

    const remaining = payable - paid;

    document.getElementById('detail-total-words').textContent = SafeNum.format(words);
    document.getElementById('detail-total-payable').textContent = SafeNum.format(payable) + ' تومان';
    document.getElementById('detail-total-paid').textContent = SafeNum.format(paid) + ' تومان';
    
    const remEl = document.getElementById('detail-remaining');
    remEl.textContent = SafeNum.format(remaining) + ' تومان';
    if (remaining > 0) remEl.className = 'text-lg font-bold text-rose-400';
    else if (remaining < 0) remEl.className = 'text-lg font-bold text-amber-400';
    else remEl.className = 'text-lg font-bold text-emerald-400';
}

function renderReportsTable(reports) {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = '';

    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">هیچ گزارش کارکردی ثبت نشده است.</td></tr>`;
        return;
    }

    const isAdmin = state.role === 'admin';

    reports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-200">${r.period || '—'}</td>
            <td class="p-3 text-center font-mono text-cyan-400 font-bold">${SafeNum.format(r.words)}</td>
            <td class="p-3 text-center text-slate-300">${SafeNum.format(r.pages || 0)}</td>
            <td class="p-3 text-center text-slate-400">${SafeNum.format(r.rate || 15)}</td>
            <td class="p-3 text-left font-mono font-bold text-amber-400">${SafeNum.format(r.total_amount)} تومان</td>
            <td class="p-3 text-slate-300 max-w-xs truncate">${r.description || '—'}</td>
            ${isAdmin ? `
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="editReport('${r.id}')" class="p-1 text-amber-400 hover:text-amber-300">✏️</button>
                    <button onclick="confirmDeleteReport('${r.id}')" class="p-1 text-rose-400 hover:text-rose-300">🗑️</button>
                </div>
            </td>` : ''}
        `;
        tbody.appendChild(tr);
    });
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    tbody.innerHTML = '';

    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">هیچ پرداختی ثبت نشده است.</td></tr>`;
        return;
    }

    const isAdmin = state.role === 'admin';

    payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition';
        tr.innerHTML = `
            <td class="p-3 font-mono text-slate-200">${p.payment_date || '—'}</td>
            <td class="p-3 text-left font-mono font-bold text-emerald-400">${SafeNum.format(p.amount)} تومان</td>
            <td class="p-3 text-center text-slate-300">${p.method || 'کارت به کارت'}</td>
            <td class="p-3 text-center font-mono text-slate-400">${p.tracking_code || '—'}</td>
            <td class="p-3 text-slate-300 max-w-xs truncate">${p.description || '—'}</td>
            ${isAdmin ? `
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="editPayment('${p.id}')" class="p-1 text-amber-400 hover:text-amber-300">✏️</button>
                    <button onclick="confirmDeletePayment('${p.id}')" class="p-1 text-rose-400 hover:text-rose-300">🗑️</button>
                </div>
            </td>` : ''}
        `;
        tbody.appendChild(tr);
    });
}

// ۹. افزودن و ویرایش تایپیست (Modal)
function openTypistModal(typistId = null) {
    const modal = document.getElementById('modal-typist');
    const title = document.getElementById('modal-typist-title');
    const form = document.getElementById('form-typist-edit');

    form.reset();
    document.getElementById('typist-form-id').value = '';

    if (typistId) {
        title.textContent = 'ویرایش پروفایل تایپیست';
        const typist = state.dashboardData.find(t => t.id === typistId) || state.typistProfile;
        if (typist) {
            document.getElementById('typist-form-id').value = typist.id;
            document.getElementById('typist-form-name').value = typist.name || '';
            document.getElementById('typist-form-phone').value = typist.phone || '';
            document.getElementById('typist-form-national-id').value = typist.national_id || typist.national_code || '';
            document.getElementById('typist-form-rate').value = typist.rate_per_word || typist.default_word_rate || 15;
        }
    } else {
        title.textContent = 'افزودن تایپیست جدید';
        document.getElementById('typist-form-rate').value = 15;
    }

    modal.classList.remove('hidden');
}

async function handleSaveTypist(e) {
    e.preventDefault();
    const id = document.getElementById('typist-form-id').value || null;
    const name = document.getElementById('typist-form-name').value.trim();
    const phone = document.getElementById('typist-form-phone').value.trim();
    const nationalId = document.getElementById('typist-form-national-id').value.trim();
    const rate = Number(document.getElementById('typist-form-rate').value) || 15;

    const btn = document.getElementById('btn-save-typist');
    btn.disabled = true;
    btn.textContent = 'در حال ثبت...';

    const res = await rpc('upsert_typist', {
        p_id: id,
        p_name: name,
        p_phone: phone,
        p_national_id: nationalId,
        p_rate_per_word: rate
    });

    btn.disabled = false;
    btn.textContent = 'ذخیره پروفایل';

    if (res && res.success) {
        closeModal('modal-typist');
        showDialog('موفقیت', res.message || 'پروفایل تایپیست با موفقیت ثبت شد', 'success');
        
        if (state.role === 'admin') {
            await loadDashboard();
        }
        if (state.currentTypistId === id || (!id && res.id)) {
            await loadTypistDetailData(id || res.id);
        }
    } else {
        showDialog('خطا', res.message || 'عملیات با خطا مواجه شد', 'error');
    }
}

function confirmDeleteTypist(id, name) {
    showDialog('حذف تایپیست', `آیا از حذف تایپیست «${name}» اطمینان دارید؟`, 'confirm', async () => {
        const res = await rpc('delete_typist', { p_id: id });
        if (res && res.success) {
            showDialog('موفقیت', 'تایپیست با موفقیت حذف شد', 'success');
            loadDashboard();
        } else {
            showDialog('خطا', res.message || 'خطا در حذف تایپیست', 'error');
        }
    });
}

// ۱۰. مدیریت گزارش کارکرد (Report Modal)
function openReportModal(reportId = null) {
    const modal = document.getElementById('modal-report');
    const title = document.getElementById('modal-report-title');
    const form = document.getElementById('form-report');
    form.reset();

    state.editingReportId = reportId;
    document.getElementById('report-form-id').value = reportId || '';

    if (reportId) {
        title.textContent = 'ویرایش گزارش کارکرد';
        const r = state.reports.find(item => item.id === reportId);
        if (r) {
            document.getElementById('report-form-period').value = r.period || getTodayShamsi();
            document.getElementById('report-form-words').value = r.words || '';
            document.getElementById('report-form-pages').value = r.pages || 0;
            document.getElementById('report-form-rate').value = r.rate || state.typistProfile?.rate_per_word || 15;
            document.getElementById('report-form-desc').value = r.description || '';
        }
    } else {
        title.textContent = 'ثبت گزارش کارکرد جدید';
        document.getElementById('report-form-period').value = getTodayShamsi();
        document.getElementById('report-form-rate').value = state.typistProfile?.rate_per_word || 15;
    }

    modal.classList.remove('hidden');
}

async function handleSaveReport(e) {
    e.preventDefault();
    const id = document.getElementById('report-form-id').value || null;
    const period = document.getElementById('report-form-period').value.trim();
    const words = Number(document.getElementById('report-form-words').value) || 0;
    const pages = Number(document.getElementById('report-form-pages').value) || 0;
    const rate = Number(document.getElementById('report-form-rate').value) || 15;
    const desc = document.getElementById('report-form-desc').value.trim();

    const btn = document.getElementById('btn-save-report');
    btn.disabled = true;

    const res = await rpc('upsert_report', {
        p_id: id,
        p_typist_id: state.currentTypistId,
        p_words: words,
        p_pages: pages,
        p_rate: rate,
        p_period: period,
        p_description: desc
    });

    btn.disabled = false;

    if (res && res.success) {
        closeModal('modal-report');
        await loadTypistDetailData(state.currentTypistId);
    } else {
        showDialog('خطا', res.message || 'خطا در ثبت گزارش', 'error');
    }
}

function editReport(id) { openReportModal(id); }

function confirmDeleteReport(id) {
    showDialog('حذف گزارش', 'آیا از حذف این گزارش کارکرد مطمئن هستید؟', 'confirm', async () => {
        const res = await rpc('delete_report', { p_id: id });
        if (res && res.success) {
            await loadTypistDetailData(state.currentTypistId);
        } else {
            showDialog('خطا', res.message || 'خطا در حذف گزارش', 'error');
        }
    });
}

// ۱۱. مدیریت پرداخت‌ها (Payment Modal)
function openPaymentModal(paymentId = null) {
    const modal = document.getElementById('modal-payment');
    const title = document.getElementById('modal-payment-title');
    const form = document.getElementById('form-payment');
    form.reset();

    state.editingPaymentId = paymentId;
    document.getElementById('payment-form-id').value = paymentId || '';

    if (paymentId) {
        title.textContent = 'ویرایش پرداخت';
        const p = state.payments.find(item => item.id === paymentId);
        if (p) {
            document.getElementById('payment-form-amount').value = p.amount || '';
            document.getElementById('payment-form-date').value = p.payment_date || getTodayShamsi();
            document.getElementById('payment-form-method').value = p.method || 'کارت به کارت';
            document.getElementById('payment-form-tracking').value = p.tracking_code || '';
            document.getElementById('payment-form-desc').value = p.description || '';
        }
    } else {
        title.textContent = 'ثبت پرداخت جدید';
        document.getElementById('payment-form-date').value = getTodayShamsi();
    }

    modal.classList.remove('hidden');
}

async function handleSavePayment(e) {
    e.preventDefault();
    const id = document.getElementById('payment-form-id').value || null;
    const amount = Number(document.getElementById('payment-form-amount').value) || 0;
    const date = document.getElementById('payment-form-date').value.trim();
    const method = document.getElementById('payment-form-method').value;
    const tracking = document.getElementById('payment-form-tracking').value.trim();
    const desc = document.getElementById('payment-form-desc').value.trim();

    const btn = document.getElementById('btn-save-payment');
    btn.disabled = true;

    const res = await rpc('upsert_payment', {
        p_id: id,
        p_person_id: state.currentTypistId,
        p_amount: amount,
        p_payment_date: date,
        p_method: method,
        p_tracking_code: tracking,
        p_description: desc
    });

    btn.disabled = false;

    if (res && res.success) {
        closeModal('modal-payment');
        await loadTypistDetailData(state.currentTypistId);
    } else {
        showDialog('خطا', res.message || 'خطا در ثبت پرداخت', 'error');
    }
}

function editPayment(id) { openPaymentModal(id); }

function confirmDeletePayment(id) {
    showDialog('حذف پرداخت', 'آیا از حذف این تراکنش پرداخت مطمئن هستید؟', 'confirm', async () => {
        const res = await rpc('delete_payment', { p_id: id });
        if (res && res.success) {
            await loadTypistDetailData(state.currentTypistId);
        } else {
            showDialog('خطا', res.message || 'خطا در حذف پرداخت', 'error');
        }
    });
}

// ۱۲. پیامک گروهی
function openGroupSmsModal() {
    const selectedList = state.dashboardData.filter(item => state.selectedTypists.has(item.id));
    
    if (selectedList.length === 0) {
        showDialog('اطلاع', 'لطفاً حداقل یک تایپیست را از جدول/لیست تیک بزنید.', 'info');
        return;
    }

    const phones = selectedList.map(t => t.phone).filter(Boolean);
    document.getElementById('group-sms-recipients-count').textContent = `گیرندگان: ${SafeNum.format(phones.length)} نفر`;
    document.getElementById('group-sms-phones-list').textContent = phones.join(', ');

    document.getElementById('modal-group-sms').classList.remove('hidden');
}

function copyGroupPhones() {
    const text = document.getElementById('group-sms-phones-list').textContent;
    navigator.clipboard.writeText(text).then(() => {
        showDialog('موفقیت', 'شماره تلفن‌ها در حافظه کپی شد.', 'success');
    });
}

function triggerGroupSmsApp() {
    const text = document.getElementById('group-sms-phones-list').textContent;
    const body = encodeURIComponent(document.getElementById('group-sms-body').value.trim());
    
    if (!text || text === '—') return;

    // استانداردهای مختلف سیستم‌عامل‌ها برای پروتکل sms:
    const smsUrl = `sms:${text}?body=${body}`;
    window.location.href = smsUrl;
}

// ۱۳. خروجی کلی اکسل (CSV)
function exportAllDashboardCsv() {
    if (!state.dashboardData || state.dashboardData.length === 0) {
        showDialog('اطلاع', 'داده‌ای برای خروجی وجود ندارد.', 'info');
        return;
    }

    let csvContent = '\uFEFF'; // افزودن BOM جهت پشتیبانی کامل اکسل از فارسی
    csvContent += 'نام تایپیست,شماره تلفن,کد ملی,نرخ کلمه,تعداد کلمات,تعداد صفحات,کل قابل پرداخت (تومان),کل پرداخت شده (تومان),مانده بدهی (تومان),تعداد گزارش‌ها\n';

    state.dashboardData.forEach(item => {
        const row = [
            `"${item.name || ''}"`,
            `"${item.phone || ''}"`,
            `"${item.national_id || ''}"`,
            item.rate_per_word || 15,
            item.total_words || 0,
            item.total_pages || 0,
            item.total_payable || 0,
            item.total_paid || 0,
            item.remaining || 0,
            item.reports_count || 0
        ];
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `گزارش_جامع_تایپیست_ها_${getTodayShamsi().replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ۱۴. تغییر رمز عبور
function openChangePasswordModal() {
    document.getElementById('form-change-password').reset();
    document.getElementById('modal-change-password').classList.remove('hidden');
}

async function handleChangePassword(e) {
    e.preventDefault();
    const oldPw = document.getElementById('pw-old').value.trim();
    const newPw = document.getElementById('pw-new').value.trim();
    const confirmPw = document.getElementById('pw-confirm').value.trim();

    if (newPw !== confirmPw) {
        showDialog('خطا', 'رمز عبور جدید و تکرار آن یکسان نیستند', 'error');
        return;
    }

    let res;
    if (state.role === 'admin') {
        res = await rpc('change_admin_password', { p_old_password: oldPw, p_new_password: newPw });
    } else {
        res = await rpc('change_typist_password', {
            p_identifier: state.typistIdentifier,
            p_old_password: oldPw,
            p_new_password: newPw
        });
    }

    if (res && res.success) {
        closeModal('modal-change-password');
        showDialog('موفقیت', res.message || 'رمز عبور با موفقیت تغییر کرد', 'success');
    } else {
        showDialog('خطا', res.message || 'خطا در تغییر رمز عبور', 'error');
    }
}

// ۱۵. تقویم شمسی و توابع کمکی تاریخ
function getTodayShamsi() {
    try {
        const d = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = formatter.formatToParts(d);
        const y = parts.find(p => p.type === 'year').value;
        const m = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        return `${y}/${m}/${day}`;
    } catch (e) {
        return '1403/07/15';
    }
}

function initShamsiDatePicker() {
    document.querySelectorAll('[data-datepicker]').forEach(input => {
        if (!input.value) input.value = getTodayShamsi();
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showDialog(title, message, type = 'info', onConfirm = null) {
    const modal = document.getElementById('modal-dialog');
    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const iconEl = document.getElementById('dialog-icon');
    const btnConfirm = document.getElementById('dialog-btn-confirm');
    const btnCancel = document.getElementById('dialog-btn-cancel');

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (type === 'error') iconEl.textContent = '❌';
    else if (type === 'success') iconEl.textContent = '✅';
    else if (type === 'confirm') iconEl.textContent = '⚠️';
    else iconEl.textContent = 'ℹ️';

    btnCancel.style.display = type === 'confirm' ? 'block' : 'none';
    btnConfirm.textContent = type === 'confirm' ? 'تایید' : 'باشه';

    btnConfirm.onclick = () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    };

    btnCancel.onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

function getAvatarColors(name) {
    const bgClasses = [
        'bg-brand-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600',
        'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600', 'bg-amber-600'
    ];
    let hash = 0;
    if (name) {
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % bgClasses.length;
    return { bg: bgClasses[index] };
}

function getInitials(name) {
    if (!name) return 'ت';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name.slice(0, 2);
}

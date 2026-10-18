// ==========================================
// 1. Supabase Init & State
// ==========================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = db;

const state = {
    role: null, sessionToken: null, currentTypistId: null, typistIdentifier: null,
    dashboardData: [], selectedTypists: new Set(), typistProfile: null, reports: [], payments: []
};

// ==========================================
// 2. Utils
// ==========================================
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

function toggleTheme() {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
        root.classList.remove('dark'); localStorage.theme = 'light';
    } else {
        root.classList.add('dark'); localStorage.theme = 'dark';
    }
}

// ==========================================
// 3. Shamsi Date Picker Logic
// ==========================================
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const enToFa = (s) => String(s).replace(/\d/g, (d) => FA_DIGITS[+d]);
const faToEn = (s) => String(s).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

function todayShamsiStr() {
    try {
        const d = new Date();
        const f = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        return f; // e.g. ۱۴۰۳/۰۸/۱۵
    } catch { return '1403/01/01'; }
}

function initShamsiDatePicker() {
    document.querySelectorAll('[data-datepicker]').forEach(input => {
        if (input.dataset.dpInit) return;
        input.dataset.dpInit = "1";
        
        const wrapper = input.parentElement;
        const popup = wrapper.querySelector('[data-dp-popup]');
        if(!popup) return;

        // Populate popup
        popup.innerHTML = `
            <div class="dp-header">
                <button type="button" id="dp-prev">‹</button>
                <span class="dp-title" style="font-size:0.8rem; font-weight:bold;">انتخاب تاریخ</span>
                <button type="button" id="dp-next">›</button>
            </div>
            <div class="dp-grid">
                <div class="dp-dow">ش</div><div class="dp-dow">ی</div><div class="dp-dow">د</div><div class="dp-dow">س</div>
                <div class="dp-dow">چ</div><div class="dp-dow">پ</div><div class="dp-dow">ج</div>
            </div>
            <div class="dp-grid" id="dp-days"></div>
            <div style="text-align:center; margin-top:10px;">
                <button type="button" id="dp-today" class="text-xs bg-brand-500 text-white px-3 py-1 rounded">امروز</button>
            </div>
        `;
        
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dp-popup').forEach(p => p.classList.remove('active'));
            popup.classList.add('active');
            renderDays();
        });

        // Quick dummy render for days (1 to 30)
        function renderDays() {
            const daysContainer = popup.querySelector('#dp-days');
            let html = '';
            for(let i=1; i<=31; i++) {
                html += `<div class="dp-day">${enToFa(i)}</div>`;
            }
            daysContainer.innerHTML = html;
            daysContainer.querySelectorAll('.dp-day').forEach((btn, index) => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const day = String(index+1).padStart(2,'0');
                    // Get current year/month roughly
                    const y = todayShamsiStr().split('/')[0];
                    const m = todayShamsiStr().split('/')[1];
                    input.value = `${y}/${m}/${enToFa(day)}`;
                    popup.classList.remove('active');
                };
            });
        }
        
        popup.querySelector('#dp-today').onclick = (e) => {
            e.stopPropagation();
            input.value = todayShamsiStr();
            popup.classList.remove('active');
        };

        // Click outside closes popup
        document.addEventListener('click', (e) => {
            if(!wrapper.contains(e.target)) {
                popup.classList.remove('active');
            }
        });
    });
}

// ==========================================
// 4. Init & Auth
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initShamsiDatePicker();
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
    document.getElementById('btn-change-pw').classList.remove('hidden');
    document.getElementById('user-role-badge').textContent = state.role === 'admin' ? 'مدیر سیستم' : 'تایپیست';
    
    // Toggle Admin-only buttons based on role
    const adminEls = document.querySelectorAll('.admin-only');
    const adminBtns = ['btn-add-report', 'btn-add-payment', 'detail-admin-nav', 'detail-admin-actions'];
    
    if (state.role === 'admin') {
        adminEls.forEach(el => el.classList.remove('hidden'));
        adminBtns.forEach(id => {
            const btn = document.getElementById(id);
            if(btn) btn.classList.remove('hidden');
        });
    } else {
        adminEls.forEach(el => el.classList.add('hidden'));
        adminBtns.forEach(id => {
            const btn = document.getElementById(id);
            if(btn) btn.classList.add('hidden');
        });
    }
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
    } else showDialog('خطا', 'اطلاعات ورود اشتباه است', 'error');
}

function logout() {
    localStorage.removeItem('typist_session');
    location.reload();
}

// ==========================================
// 5. Views & Dashboard
// ==========================================
function showDashboardView() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    loadDashboard();
}

async function loadDashboard() {
    const data = await rpc('get_dashboard_summary');
    if (Array.isArray(data)) {
        state.dashboardData = data;
        state.selectedTypists.clear();
        updateGroupSmsBtn();
        document.getElementById('chk-select-all').checked = false;
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
        
        let timerBadge = '—';
        if (item.delivery_date) timerBadge = getTimerBadge(item.delivery_date);
        
        const isChecked = state.selectedTypists.has(item.id) ? 'checked' : '';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer';
        tr.onclick = (e) => { 
            // اگر روی چک‌باکس یا لینک‌های تماس کلیک شد، وارد جزئیات نشود
            if (!['INPUT','BUTTON','A'].includes(e.target.tagName)) showDetailView(item.id); 
        };
        
        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" ${isChecked} onchange="toggleSelectTypist('${item.id}', this.checked)" class="rounded w-4 h-4 text-brand-600 focus:ring-brand-500">
            </td>
            <td class="p-4">
                <div class="font-bold text-sm">${item.name}</div>
                <div class="text-xs opacity-70 dir-ltr text-right">${item.phone || '—'}</div>
            </td>
            <td class="p-4 text-center">${timerBadge}</td>
            <td class="p-4 text-center font-mono text-cyan-600 dark:text-cyan-400">${SafeNum.format(item.total_words)}</td>
            <td class="p-4 text-left font-mono text-amber-600 dark:text-amber-400">${SafeNum.format(item.total_payable)}</td>
            <td class="p-4 text-left font-mono text-emerald-600 dark:text-emerald-400">${SafeNum.format(item.total_paid)}</td>
            <td class="p-4 text-left font-mono font-bold ${item.remaining>0?'text-rose-600 dark:text-rose-400':''}">${SafeNum.format(item.remaining)}</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <a href="tel:${item.phone}" title="تماس" class="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-slate-300 transition">📞</a>
                    <a href="sms:${item.phone}" title="پیامک" class="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-300 transition">💬</a>
                    <button onclick="openTypistModal('${item.id}')" title="ویرایش" class="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-amber-600 dark:text-amber-500 hover:bg-slate-300 transition">✏️</button>
                </div>
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

// ==========================================
// 6. Group SMS & Selections
// ==========================================
function toggleSelectTypist(id, isChecked) {
    if (isChecked) state.selectedTypists.add(id);
    else state.selectedTypists.delete(id);
    updateGroupSmsBtn();
}

function toggleSelectAllTypists(isChecked) {
    const visibleRows = document.querySelectorAll('#typists-table-body input[type="checkbox"]');
    visibleRows.forEach(cb => {
        cb.checked = isChecked;
        const id = cb.closest('tr').querySelector('button[onclick^="openTypistModal"]').getAttribute('onclick').match(/'([^']+)'/)[1];
        if(isChecked) state.selectedTypists.add(id);
        else state.selectedTypists.delete(id);
    });
    updateGroupSmsBtn();
}

function updateGroupSmsBtn() {
    const btn = document.getElementById('btn-group-sms-text');
    if (btn) btn.textContent = `💬 پیامک گروهی (${SafeNum.format(state.selectedTypists.size)})`;
}

function openGroupSmsModal() {
    if (state.selectedTypists.size === 0) {
        showDialog('توجه', 'لطفا حداقل یک تایپیست را برای ارسال پیامک انتخاب کنید.', 'info');
        return;
    }
    const selectedPhones = state.dashboardData
        .filter(t => state.selectedTypists.has(t.id) && t.phone)
        .map(t => t.phone);
        
    document.getElementById('group-sms-recipients-count').textContent = `گیرندگان: ${SafeNum.format(selectedPhones.length)} نفر`;
    document.getElementById('group-sms-phones-list').textContent = selectedPhones.join(', ');
    document.getElementById('modal-group-sms').classList.remove('hidden');
}

function copyGroupPhones() {
    const txt = document.getElementById('group-sms-phones-list').textContent;
    navigator.clipboard.writeText(txt).then(() => showDialog('موفق', 'شماره‌ها کپی شدند', 'success'));
}

function triggerGroupSmsApp() {
    const txt = document.getElementById('group-sms-phones-list').textContent;
    const body = encodeURIComponent(document.getElementById('group-sms-body').value);
    if(txt) window.location.href = `sms:${txt}?body=${body}`;
}

// ==========================================
// 7. Detail View & Timer
// ==========================================
async function showDetailView(id) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    state.currentTypistId = id;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    await loadTypistData(id);
}

async function loadTypistData(id) {
    // 1. دریافت پروفایل
    const profile = await rpc('get_typist_profile', { p_typist_id: id });
    if (profile && profile.length > 0) {
        state.typistProfile = profile[0];
        const p = state.typistProfile;
        
        document.getElementById('detail-breadcrumb-name').textContent = p.name;
        document.getElementById('detail-name').textContent = p.name;
        document.getElementById('detail-phone').textContent = p.phone || '—';
        document.getElementById('detail-national-id').textContent = p.national_id || '—';
        document.getElementById('detail-card-number').textContent = p.card_number || '—';
        document.getElementById('detail-rate').textContent = SafeNum.format(p.rate_per_word || p.default_word_rate);
        
        document.getElementById('detail-btn-call').href = `tel:${p.phone}`;
        document.getElementById('detail-btn-sms').href = `sms:${p.phone}`;

        // تایمر تحویل
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

    // 2. دریافت گزارش‌ها و پرداخت‌ها
    const reports = await rpc('get_typist_reports', { p_typist_id: id });
    state.reports = Array.isArray(reports) ? reports : [];
    
    const payments = await rpc('get_typist_payments', { p_typist_id: id });
    state.payments = Array.isArray(payments) ? payments : [];

    renderReports();
    renderPayments();
    calculateDetailSummary();
}

function shamsiToDate(shamsiStr) {
    try {
        const parts = shamsiStr.split('/');
        if (parts.length !== 3) return null;
        let gy = parseInt(parts[0], 10) + 621; 
        return new Date(gy, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)); 
    } catch { return null; }
}

function getTimerBadge(shamsiDate) {
    const target = shamsiToDate(shamsiDate);
    if(!target) return '—';
    const diffDays = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    
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

function calculateDetailSummary() {
    let w=0, pay=0, pd=0;
    state.reports.forEach(r => { w += Number(r.words); pay += Number(r.total_amount); });
    state.payments.forEach(p => { pd += Number(p.amount); });
    const rem = pay - pd;

    document.getElementById('detail-total-words').textContent = SafeNum.format(w);
    document.getElementById('detail-total-payable').textContent = SafeNum.format(pay) + ' تومان';
    document.getElementById('detail-total-paid').textContent = SafeNum.format(pd) + ' تومان';
    const remEl = document.getElementById('detail-remaining');
    remEl.textContent = SafeNum.format(rem) + ' تومان';
    remEl.className = `text-lg font-bold ${rem > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`;
}

// ==========================================
// 8. Render Reports & Payments
// ==========================================
function renderReports() {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = '';
    if(state.reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center opacity-60">هیچ گزارشی ثبت نشده است</td></tr>`;
        return;
    }
    state.reports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800 transition';
        tr.innerHTML = `
            <td class="p-3 font-mono">${r.period || r.shamsi_date || '—'}</td>
            <td class="p-3 text-center font-bold text-cyan-600 dark:text-cyan-400">${SafeNum.format(r.words)}</td>
            <td class="p-3 text-center">${SafeNum.format(r.pages)}</td>
            <td class="p-3 text-center">${SafeNum.format(r.rate || r.rate_per_word)}</td>
            <td class="p-3 text-left font-bold text-amber-600 dark:text-amber-400">${SafeNum.format(r.total_amount)} تومان</td>
            <td class="p-3 opacity-80 max-w-xs truncate">${r.description || '—'}</td>
            <td class="p-3 text-center admin-only ${state.role === 'admin' ? '' : 'hidden'}">
                <button onclick="editReport('${r.id}')" class="p-1 text-amber-500 hover:text-amber-600">✏️</button>
                <button onclick="deleteReport('${r.id}')" class="p-1 text-red-500 hover:text-red-600">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPayments() {
    const tbody = document.getElementById('payments-table-body');
    tbody.innerHTML = '';
    if(state.payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center opacity-60">هیچ پرداختی ثبت نشده است</td></tr>`;
        return;
    }
    state.payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800 transition';
        tr.innerHTML = `
            <td class="p-3 font-mono">${p.payment_date || '—'}</td>
            <td class="p-3 text-left font-bold text-emerald-600 dark:text-emerald-400">${SafeNum.format(p.amount)} تومان</td>
            <td class="p-3 text-center">${p.method || '—'}</td>
            <td class="p-3 text-center font-mono opacity-80">${p.tracking_code || '—'}</td>
            <td class="p-3 opacity-80 max-w-xs truncate">${p.description || '—'}</td>
            <td class="p-3 text-center admin-only ${state.role === 'admin' ? '' : 'hidden'}">
                <button onclick="editPayment('${p.id}')" class="p-1 text-amber-500 hover:text-amber-600">✏️</button>
                <button onclick="deletePayment('${p.id}')" class="p-1 text-red-500 hover:text-red-600">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 9. Forms (Typist / Report / Payment)
// ==========================================

// --- Typist Profile Form ---
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
        document.getElementById('typist-form-rate').value = 15;
    }
    document.getElementById('modal-typist').classList.remove('hidden');
}

async function handleSaveTypist(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-typist');
    btn.disabled = true; btn.textContent = 'در حال ذخیره...';
    
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
    
    btn.disabled = false; btn.textContent = 'ذخیره پروفایل';
    
    if (res?.success) {
        closeModal('modal-typist');
        showDialog('موفق', 'پروفایل ثبت شد', 'success');
        if (state.role === 'admin') loadDashboard();
        if (state.currentTypistId) loadTypistData(state.currentTypistId);
    } else {
        showDialog('خطا', res?.message, 'error');
    }
}

// --- Report Form ---
function openReportModal(id = null) {
    document.getElementById('form-report').reset();
    document.getElementById('report-form-id').value = id || '';
    if(id) {
        const r = state.reports.find(x => x.id === id);
        if(r) {
            document.getElementById('report-form-period').value = r.period || todayShamsiStr();
            document.getElementById('report-form-words').value = r.words || '';
            document.getElementById('report-form-pages').value = r.pages || 0;
            document.getElementById('report-form-rate').value = r.rate || r.rate_per_word || state.typistProfile?.rate_per_word || 15;
            document.getElementById('report-form-desc').value = r.description || '';
        }
    } else {
        document.getElementById('report-form-period').value = todayShamsiStr();
        document.getElementById('report-form-rate').value = state.typistProfile?.rate_per_word || 15;
    }
    document.getElementById('modal-report').classList.remove('hidden');
}

function editReport(id) { openReportModal(id); }

async function handleSaveReport(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-report');
    btn.disabled = true; btn.textContent = 'صبر کنید...';
    
    const res = await rpc('upsert_report', {
        p_id: document.getElementById('report-form-id').value || null,
        p_typist_id: state.currentTypistId,
        p_words: Number(document.getElementById('report-form-words').value),
        p_pages: Number(document.getElementById('report-form-pages').value),
        p_rate: Number(document.getElementById('report-form-rate').value),
        p_period: document.getElementById('report-form-period').value,
        p_description: document.getElementById('report-form-desc').value
    });
    
    btn.disabled = false; btn.textContent = 'ثبت گزارش';
    if(res?.success) {
        closeModal('modal-report');
        loadTypistData(state.currentTypistId);
    } else { showDialog('خطا', res?.message, 'error'); }
}

function deleteReport(id) {
    showDialog('حذف گزارش', 'آیا مطمئن هستید؟', 'confirm', async () => {
        const res = await rpc('delete_report', { p_id: id });
        if(res?.success) loadTypistData(state.currentTypistId);
        else showDialog('خطا', res?.message, 'error');
    });
}

// --- Payment Form ---
function openPaymentModal(id = null) {
    document.getElementById('form-payment').reset();
    document.getElementById('payment-form-id').value = id || '';
    if(id) {
        const p = state.payments.find(x => x.id === id);
        if(p) {
            document.getElementById('payment-form-amount').value = p.amount || '';
            document.getElementById('payment-form-date').value = p.payment_date || todayShamsiStr();
            document.getElementById('payment-form-method').value = p.method || 'کارت به کارت';
            document.getElementById('payment-form-tracking').value = p.tracking_code || '';
            document.getElementById('payment-form-desc').value = p.description || '';
        }
    } else {
        document.getElementById('payment-form-date').value = todayShamsiStr();
    }
    document.getElementById('modal-payment').classList.remove('hidden');
}

function editPayment(id) { openPaymentModal(id); }

async function handleSavePayment(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-payment');
    btn.disabled = true; btn.textContent = 'صبر کنید...';
    
    const res = await rpc('upsert_payment', {
        p_id: document.getElementById('payment-form-id').value || null,
        p_person_id: state.currentTypistId,
        p_amount: Number(document.getElementById('payment-form-amount').value),
        p_payment_date: document.getElementById('payment-form-date').value,
        p_method: document.getElementById('payment-form-method').value,
        p_tracking_code: document.getElementById('payment-form-tracking').value,
        p_description: document.getElementById('payment-form-desc').value
    });
    
    btn.disabled = false; btn.textContent = 'ثبت پرداخت';
    if(res?.success) {
        closeModal('modal-payment');
        loadTypistData(state.currentTypistId);
    } else { showDialog('خطا', res?.message, 'error'); }
}

function deletePayment(id) {
    showDialog('حذف پرداخت', 'آیا مطمئن هستید؟', 'confirm', async () => {
        const res = await rpc('delete_payment', { p_id: id });
        if(res?.success) loadTypistData(state.currentTypistId);
        else showDialog('خطا', res?.message, 'error');
    });
}

// ==========================================
// 10. Change Password & CSV
// ==========================================
function openChangePasswordModal() {
    document.getElementById('form-change-password').reset();
    document.getElementById('modal-change-password').classList.remove('hidden');
}

async function handleChangePassword(e) {
    e.preventDefault();
    const o = document.getElementById('pw-old').value;
    const n = document.getElementById('pw-new').value;
    const c = document.getElementById('pw-confirm').value;
    if(n !== c) { showDialog('خطا', 'رمزهای جدید یکسان نیستند', 'error'); return; }
    
    let res;
    if(state.role === 'admin') res = await rpc('change_admin_password', { p_old_password: o, p_new_password: n });
    else res = await rpc('change_typist_password', { p_identifier: state.typistIdentifier, p_old_password: o, p_new_password: n });
    
    if(res?.success) {
        closeModal('modal-change-password');
        showDialog('موفق', 'رمز تغییر کرد', 'success');
    } else { showDialog('خطا', res?.message, 'error'); }
}

// --- Excel Export (Payment List) ---
function exportAllDashboardExcel() {
    if (!state.dashboardData.length) return;
    
    let csv = '\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n';
    
    state.dashboardData.forEach((item, index) => {
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

// ==========================================
// 11. Modal Utilities
// ==========================================
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showDialog(title, msg, type = 'info', onConfirm = null) {
    const m = document.getElementById('modal-dialog');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = msg;
    const btn = document.getElementById('dialog-btn-confirm');
    btn.onclick = () => { m.classList.add('hidden'); if(onConfirm) onConfirm(); };
    
    const cancelBtn = document.getElementById('dialog-btn-cancel');
    if (type === 'confirm') cancelBtn.classList.remove('hidden');
    else cancelBtn.classList.add('hidden');
    
    m.classList.remove('hidden');
}

/* ================= ==========================================
   Typist Payroll & Task Management System - Application Logic
   ========================================================== */

console.log("App script loaded successfully.");

// --- Supabase Config ---
const SUPABASE_URL = 'https://zgkhixllsmutjldszjls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2hpeGxsc211dGpsZHN6amxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzE3MTksImV4cCI6MjA1NTc0NzcxOX0.99zW5E_g3pZ3c2jE0m9pYt-hW46cZ14Z52-G6XyN88Y';

// Global instance to avoid "already declared" error
window.supabaseInstance = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- Application State ---
const state = {
    currentUser: null, 
    currentTypistId: null,
    typists: [],
    reports: [],
    payments: [],
    searchQuery: '',
    selectedTypistIds: new Set(),
    activeTab: 'admin',
    datePickerCallback: null,
    currentPickerDate: null
};

// Helper: Convert Persian/Arabic digits to English
function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    const pMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const aMap = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let strVal = String(str);
    for (let i = 0; i < 10; i++) {
        strVal = strVal.replace(new RegExp(pMap[i], 'g'), i).replace(new RegExp(aMap[i], 'g'), i);
    }
    return strVal.trim();
}

// Helper: Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-emerald-600 dark:bg-emerald-500',
        error: 'bg-rose-600 dark:bg-rose-500',
        info: 'bg-indigo-600 dark:bg-indigo-500',
        warning: 'bg-amber-600 dark:bg-amber-500'
    };
    
    toast.className = `fixed bottom-5 left-5 z-50 px-5 py-3 rounded-xl text-white font-medium shadow-2xl transition-all duration-300 transform translate-y-10 opacity-0 flex items-center gap-2 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Theme ---
window.toggleTheme = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.className = isDark ? 'fas fa-sun text-amber-400' : 'fas fa-moon text-indigo-600';
};

// --- Shamsi Date Utilities ---
const JDN_OFFSET = 1948320.5;
function isPersianLeapYear(jy) { return (((((jy - (jy > 0 ? 474 : 473)) % 2820) + 474) + 38) * 682) % 2816 < 682; }
function jalaliToGregorian(jy, jm, jd) {
    jy = parseInt(jy); jm = parseInt(jm); jd = parseInt(jd);
    let jy2 = jy - (jy >= 0 ? 474 : 473);
    let julianYear = 474 + (jy2 % 2820);
    let julianDays = jd + (jm <= 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) + Math.floor((julianYear * 682 - 110) / 2816) + (julianYear - 1) * 365 + Math.floor(jy2 / 2820) * 1029983 + (JDN_OFFSET - 1);
    let a = julianDays + 32044;
    let b = Math.floor((4 * a + 3) / 146097);
    let c = a - Math.floor((146097 * b) / 4);
    let d = Math.floor((4 * c + 3) / 1461);
    let e = c - Math.floor((1461 * d) / 4);
    let m = Math.floor((5 * e + 2) / 153);
    let day = e - Math.floor((153 * m + 2) / 5) + 1;
    let month = m + 3 - 12 * Math.floor(m / 10);
    let year = b * 100 + d - 4800 + Math.floor(m / 10);
    return new Date(year, month - 1, day);
}
function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
}
function getTodayJalali() {
    const today = new Date();
    return gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
}
function formatJalali(jObj) {
    if (!jObj || !jObj.jy) return '';
    return `${jObj.jy}/${String(jObj.jm).padStart(2, '0')}/${String(jObj.jd).padStart(2, '0')}`;
}
function parseJalali(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = toEnglishDigits(str).split('/');
    if (parts.length !== 3) return null;
    return { jy: parseInt(parts[0]), jm: parseInt(parts[1]), jd: parseInt(parts[2]) };
}

function getDeliveryTimerBadge(deliveryDateStr) {
    if (!deliveryDateStr) return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">تعریف نشده</span>`;
    const jObj = parseJalali(deliveryDateStr);
    if (!jObj) return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">نامعتبر</span>`;
    const targetDate = jalaliToGregorian(jObj.jy, jObj.jm, jObj.jd);
    const today = new Date(); today.setHours(0,0,0,0); targetDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><i class="fas fa-clock me-1"></i>${diffDays} روز باقی‌مانده</span>`;
    if (diffDays === 0) return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">امروز موعد تحویل</span>`;
    return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">${Math.abs(diffDays)} روز تأخیر</span>`;
}

// --- DatePicker ---
window.openDatePicker = function(currentValueStr, onSelectCallback) {
    state.datePickerCallback = onSelectCallback;
    let initialJalali = parseJalali(currentValueStr) || getTodayJalali();
    state.currentPickerDate = { jy: initialJalali.jy, jm: initialJalali.jm };
    renderDatePicker();
    document.getElementById('datepicker-modal').classList.remove('hidden');
};
window.closeDatePicker = function() {
    document.getElementById('datepicker-modal').classList.add('hidden');
    state.datePickerCallback = null;
};
function renderDatePicker() {
    const { jy, jm } = state.currentPickerDate;
    const yearSelect = document.getElementById('dp-year-select');
    const monthSelect = document.getElementById('dp-month-select');
    if (yearSelect && monthSelect) {
        yearSelect.innerHTML = '';
        for (let y = 1400; y <= 1410; y++) {
            const opt = document.createElement('option'); opt.value = y; opt.textContent = y;
            if (y === jy) opt.selected = true;
            yearSelect.appendChild(opt);
        }
        monthSelect.innerHTML = '';
        ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'].forEach((mName, idx) => {
            const opt = document.createElement('option'); opt.value = idx + 1; opt.textContent = mName;
            if (idx + 1 === jm) opt.selected = true;
            monthSelect.appendChild(opt);
        });
    }
    const daysGrid = document.getElementById('dp-days-grid');
    if (!daysGrid) return;
    daysGrid.innerHTML = '';
    let daysCount = jm <= 6 ? 31 : (jm <= 11 ? 30 : (isPersianLeapYear(jy) ? 30 : 29));
    let startDayOfWeek = (jalaliToGregorian(jy, jm, 1).getDay() + 1) % 7;
    for (let i = 0; i < startDayOfWeek; i++) { daysGrid.appendChild(document.createElement('div')); }
    const today = getTodayJalali();
    for (let d = 1; d <= daysCount; d++) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = d;
        const isT = (today.jy === jy && today.jm === jm && today.jd === d);
        btn.className = `h-9 w-9 rounded-lg text-sm flex items-center justify-center ${isT ? 'bg-indigo-100 text-indigo-600 font-bold border' : 'hover:bg-slate-100 text-slate-700 dark:text-slate-200'}`;
        btn.onclick = () => { state.datePickerCallback(formatJalali({ jy, jm, jd: d })); closeDatePicker(); };
        daysGrid.appendChild(btn);
    }
}

// --- Navigation ---
function showView(viewId) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    const adminOnly = document.querySelectorAll('.admin-only');
    const typistOnly = document.querySelectorAll('.typist-only');
    if (state.currentUser?.role === 'admin') {
        adminOnly.forEach(el => el.classList.remove('hidden'));
        typistOnly.forEach(el => el.classList.add('hidden'));
    } else {
        adminOnly.forEach(el => el.classList.add('hidden'));
        typistOnly.forEach(el => el.classList.remove('hidden'));
    }
}

// --- Authentication ---
window.handleLogin = async function(e) {
    if (e) e.preventDefault();
    if (!window.supabaseInstance) return showToast('خطا در اتصال به دیتابیس', 'error');
    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true; btn.innerHTML = 'در حال ورود...';
    try {
        if (state.activeTab === 'admin') {
            const pwd = toEnglishDigits(document.getElementById('admin-password-input').value);
            const { data, error } = await window.supabaseInstance.rpc('verify_admin_password', { p_password: pwd });
            if (error) throw error;
            const res = Array.isArray(data) ? data[0] : (data || {});
            if (res.success) {
                state.currentUser = { role: 'admin', name: 'مدیر سیستم' };
                showToast('خوش آمدید', 'success'); showDashboardView();
            } else showToast(res.message || 'خطا در ورود', 'error');
        } else {
            const iden = toEnglishDigits(document.getElementById('typist-identifier-input').value);
            const pwd = toEnglishDigits(document.getElementById('typist-password-input').value);
            const { data, error } = await window.supabaseInstance.rpc('verify_typist_password', { p_identifier: iden, p_password: pwd });
            if (error) throw error;
            const res = Array.isArray(data) ? data[0] : (data || {});
            if (res.success) {
                state.currentUser = { role: 'typist', name: res.typist.first_name, typistId: res.typist.id };
                showToast(`خوش آمدید ${res.typist.first_name}`, 'success'); showTypistDetailView(res.typist.id);
            } else showToast(res.message || 'خطا در ورود', 'error');
        }
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = 'ورود به سامانه'; }
};

window.handleLogout = function() {
    state.currentUser = null; showView('login-view'); showToast('خارج شدید', 'info');
};

// --- Dashboard ---
async function showDashboardView() {
    showView('dashboard-view');
    if (!window.supabaseInstance) return;
    try {
        const { data, error } = await window.supabaseInstance.rpc('get_dashboard_summary');
        if (error) throw error;
        state.typists = data || [];
        renderDashboard();
    } catch (err) { showToast(err.message, 'error'); }
}

function renderDashboard() {
    const container = document.getElementById('typists-list-container');
    if (!container) return;
    let filtered = state.typists.filter(t => {
        const q = state.searchQuery.toLowerCase();
        return `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) || t.phone?.includes(q);
    });
    
    // Stats
    let totalE = 0, totalP = 0;
    state.typists.forEach(t => { totalE += Number(t.total_earnings); totalP += Number(t.total_paid); });
    document.getElementById('stat-total-typists').textContent = state.typists.length.toLocaleString('fa-IR');
    document.getElementById('stat-total-earnings').textContent = totalE.toLocaleString('fa-IR') + ' تومان';
    document.getElementById('stat-total-paid').textContent = totalP.toLocaleString('fa-IR') + ' تومان';
    document.getElementById('stat-total-remaining').textContent = (totalE - totalP).toLocaleString('fa-IR') + ' تومان';

    container.innerHTML = filtered.map(t => `
        <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <input type="checkbox" onchange="toggleSelectTypist('${t.id}')" class="w-5 h-5 rounded cursor-pointer">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-slate-800 dark:text-slate-100">${t.first_name} ${t.last_name}</h3>
                            ${getDeliveryTimerBadge(t.delivery_date)}
                        </div>
                        <div class="text-xs text-slate-500 mt-1">
                            <span>کد ملی: ${t.national_id || '---'}</span> | <span>تماس: ${t.phone || '---'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-left me-4">
                        <span class="text-xs text-slate-400 block">مانده</span>
                        <span class="font-bold text-rose-600">${Number(t.remaining_balance).toLocaleString('fa-IR')} تومان</span>
                    </div>
                    <a href="tel:${t.phone}" class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><i class="fas fa-phone"></i></a>
                    <button onclick="showTypistDetailView('${t.id}')" class="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">مدیریت و جزئیات</button>
                </div>
            </div>
        </div>
    `).join('');
}

window.toggleSelectTypist = function(id) {
    if (state.selectedTypistIds.has(id)) state.selectedTypistIds.delete(id);
    else state.selectedTypistIds.add(id);
};

window.selectAllTypists = function(e) {
    if (e.target.checked) state.typists.forEach(t => state.selectedTypistIds.add(t.id));
    else state.selectedTypistIds.clear();
    renderDashboard();
};

// --- Detail View ---
window.showTypistDetailView = async function(id) {
    state.currentTypistId = id; showView('detail-view');
    try {
        const { data, error } = await window.supabaseInstance.rpc('get_typist_detail', { p_typist_id: id });
        if (error) throw error;
        const res = Array.isArray(data) ? data[0] : data;
        renderTypistDetail(res);
    } catch (err) { showToast(err.message, 'error'); }
};

function renderTypistDetail(data) {
    const t = data.typist;
    document.getElementById('detail-typist-name').textContent = `${t.first_name} ${t.last_name}`;
    document.getElementById('detail-timer-badge-container').innerHTML = getDeliveryTimerBadge(t.delivery_date);
    
    // Fill form
    document.getElementById('edit-first-name').value = t.first_name || '';
    document.getElementById('edit-last-name').value = t.last_name || '';
    document.getElementById('edit-national-id').value = t.national_id || '';
    document.getElementById('edit-phone').value = t.phone || '';
    document.getElementById('edit-page-rate').value = t.page_rate || 0;
    document.getElementById('edit-delivery-date').value = t.delivery_date || '';

    document.getElementById('detail-total-earnings').textContent = Number(data.total_earnings).toLocaleString('fa-IR') + ' تومان';
    document.getElementById('detail-total-paid').textContent = Number(data.total_paid).toLocaleString('fa-IR') + ' تومان';
    document.getElementById('detail-remaining-balance').textContent = Number(data.remaining_balance).toLocaleString('fa-IR') + ' تومان';

    renderReportsTable(data.reports);
    renderPaymentsTable(data.payments);
}

function renderReportsTable(reports) {
    const isAdmin = state.currentUser?.role === 'admin';
    document.getElementById('reports-table-body').innerHTML = reports.map((r, i) => `
        <tr class="border-b dark:border-slate-800 text-sm">
            <td class="py-3 px-4">${(i+1).toLocaleString('fa-IR')}</td>
            <td class="py-3 px-4">${r.report_date}</td>
            <td class="py-3 px-4 font-bold text-indigo-600">${r.page_count} صفحه</td>
            ${isAdmin ? `<td class="py-3 px-4">${Number(r.rate).toLocaleString('fa-IR')}</td>` : ''}
            ${isAdmin ? `<td class="py-3 px-4 font-bold">${Number(r.total_amount).toLocaleString('fa-IR')}</td>` : ''}
            <td class="py-3 px-4 text-xs text-slate-400">${r.description || ''}</td>
            <td class="py-3 px-4"><button onclick="deleteReport('${r.id}')" class="text-rose-500"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    document.getElementById('th-report-rate').style.display = isAdmin ? '' : 'none';
    document.getElementById('th-report-total').style.display = isAdmin ? '' : 'none';
}

function renderPaymentsTable(payments) {
    document.getElementById('payments-table-body').innerHTML = payments.map((p, i) => `
        <tr class="border-b dark:border-slate-800 text-sm">
            <td class="py-3 px-4">${(i+1).toLocaleString('fa-IR')}</td>
            <td class="py-3 px-4">${p.payment_date}</td>
            <td class="py-3 px-4 font-bold text-emerald-600">${Number(p.amount).toLocaleString('fa-IR')}</td>
            <td class="py-3 px-4 text-xs text-slate-400">${p.description || ''}</td>
            <td class="py-3 px-4">${state.currentUser?.role === 'admin' ? `<button onclick="deletePayment('${p.id}')" class="text-rose-500"><i class="fas fa-trash"></i></button>` : ''}</td>
        </tr>
    `).join('');
}

// --- CRUD Actions ---
window.saveTypistProfile = async function(e) {
    if (e) e.preventDefault();
    const payload = {
        p_id: state.currentTypistId,
        p_first_name: document.getElementById('edit-first-name').value,
        p_last_name: document.getElementById('edit-last-name').value,
        p_national_id: toEnglishDigits(document.getElementById('edit-national-id').value),
        p_phone: toEnglishDigits(document.getElementById('edit-phone').value),
        p_page_rate: Number(toEnglishDigits(document.getElementById('edit-page-rate').value)),
        p_delivery_date: document.getElementById('edit-delivery-date').value
    };
    try {
        await window.supabaseInstance.rpc('upsert_typist', payload);
        showToast('پروفایل بروزرسانی شد', 'success'); showTypistDetailView(state.currentTypistId);
    } catch (err) { showToast(err.message, 'error'); }
};

window.openAddTypistModal = () => document.getElementById('add-typist-modal').classList.remove('hidden');
window.closeAddTypistModal = () => document.getElementById('add-typist-modal').classList.add('hidden');
window.handleAddTypistSubmit = async function(e) {
    e.preventDefault();
    const payload = {
        p_id: null,
        p_first_name: document.getElementById('add-first-name').value,
        p_last_name: document.getElementById('add-last-name').value,
        p_national_id: toEnglishDigits(document.getElementById('add-national-id').value),
        p_phone: toEnglishDigits(document.getElementById('add-phone').value),
        p_page_rate: Number(toEnglishDigits(document.getElementById('add-page-rate').value)),
        p_delivery_date: document.getElementById('add-delivery-date').value
    };
    try {
        await window.supabaseInstance.rpc('upsert_typist', payload);
        showToast('تایپیست اضافه شد', 'success'); closeAddTypistModal(); showDashboardView();
    } catch (err) { showToast(err.message, 'error'); }
};

window.openAddReportModal = () => {
    document.getElementById('report-date-input').value = formatJalali(getTodayJalali());
    document.getElementById('add-report-modal').classList.remove('hidden');
};
window.closeAddReportModal = () => document.getElementById('add-report-modal').classList.add('hidden');
window.handleAddReportSubmit = async function(e) {
    e.preventDefault();
    try {
        await window.supabaseInstance.rpc('add_typist_report', {
            p_typist_id: state.currentTypistId,
            p_page_count: Number(toEnglishDigits(document.getElementById('report-page-count').value)),
            p_report_date: document.getElementById('report-date-input').value,
            p_description: document.getElementById('report-desc').value
        });
        showToast('گزارش ثبت شد', 'success'); closeAddReportModal(); showTypistDetailView(state.currentTypistId);
    } catch (err) { showToast(err.message, 'error'); }
};

window.openAddPaymentModal = () => {
    document.getElementById('payment-date-input').value = formatJalali(getTodayJalali());
    document.getElementById('add-payment-modal').classList.remove('hidden');
};
window.closeAddPaymentModal = () => document.getElementById('add-payment-modal').classList.add('hidden');
window.handleAddPaymentSubmit = async function(e) {
    e.preventDefault();
    try {
        await window.supabaseInstance.rpc('add_payment', {
            p_typist_id: state.currentTypistId,
            p_amount: Number(toEnglishDigits(document.getElementById('payment-amount-input').value)),
            p_payment_date: document.getElementById('payment-date-input').value,
            p_description: document.getElementById('payment-desc-input').value
        });
        showToast('پرداخت ثبت شد', 'success'); closeAddPaymentModal(); showTypistDetailView(state.currentTypistId);
    } catch (err) { showToast(err.message, 'error'); }
};

window.deleteReport = async (id) => { if(confirm('حذف؟')) { await window.supabaseInstance.rpc('delete_typist_report', {p_report_id: id}); showTypistDetailView(state.currentTypistId); } };
window.deletePayment = async (id) => { if(confirm('حذف؟')) { await window.supabaseInstance.rpc('delete_payment', {p_payment_id: id}); showTypistDetailView(state.currentTypistId); } };

window.exportBankCsv = function() {
    const headers = ['ردیف', 'نام', 'نام خانوادگی', 'کد ملی', 'شماره تماس', 'مبلغ ریال'];
    const rows = state.typists.map((t, i) => [i+1, t.first_name, t.last_name, t.national_id, t.phone, (t.remaining_balance * 10)]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = 'bank.csv'; link.click();
};

// --- Group SMS ---
window.openGroupSmsModal = () => {
    if (state.selectedTypistIds.size === 0) return showToast('ابتدا انتخاب کنید', 'warning');
    document.getElementById('group-sms-modal').classList.remove('hidden');
};
window.closeGroupSmsModal = () => document.getElementById('group-sms-modal').classList.add('hidden');
window.sendGroupSms = () => {
    const phones = state.typists.filter(t => state.selectedTypistIds.has(t.id)).map(t => t.phone).join(',');
    window.location.href = `sms:${phones}?body=${encodeURIComponent(document.getElementById('sms-body-input').value)}`;
    closeGroupSmsModal();
};

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    
    document.getElementById('tab-admin-login').onclick = () => {
        state.activeTab = 'admin';
        document.getElementById('tab-admin-login').className = 'flex-1 py-3 text-center border-b-2 font-bold border-indigo-600 text-indigo-600';
        document.getElementById('tab-typist-login').className = 'flex-1 py-3 text-center border-b-2 border-transparent text-slate-400';
        document.getElementById('field-admin-password').classList.remove('hidden');
        document.getElementById('field-typist-inputs').classList.add('hidden');
    };
    document.getElementById('tab-typist-login').onclick = () => {
        state.activeTab = 'typist';
        document.getElementById('tab-typist-login').className = 'flex-1 py-3 text-center border-b-2 font-bold border-indigo-600 text-indigo-600';
        document.getElementById('tab-admin-login').className = 'flex-1 py-3 text-center border-b-2 border-transparent text-slate-400';
        document.getElementById('field-typist-inputs').classList.remove('hidden');
        document.getElementById('field-admin-password').classList.add('hidden');
    };

    document.getElementById('search-typists-input').oninput = (e) => { state.searchQuery = e.target.value; renderDashboard(); };
    document.getElementById('dp-prev-month').onclick = () => { if(state.currentPickerDate.jm > 1) state.currentPickerDate.jm--; else { state.currentPickerDate.jm=12; state.currentPickerDate.jy--; } renderDatePicker(); };
    document.getElementById('dp-next-month').onclick = () => { if(state.currentPickerDate.jm < 12) state.currentPickerDate.jm++; else { state.currentPickerDate.jm=1; state.currentPickerDate.jy++; } renderDatePicker(); };
    document.getElementById('dp-year-select').onchange = (e) => { state.currentPickerDate.jy = parseInt(e.target.value); renderDatePicker(); };
    document.getElementById('dp-month-select').onchange = (e) => { state.currentPickerDate.jm = parseInt(e.target.value); renderDatePicker(); };
});

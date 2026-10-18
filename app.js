/* ================= ==========================================
   Typist Payroll & Task Management System - Application Logic
   ========================================================== */

console.log("Typist Payroll App initialized successfully.");

// --- Supabase Config ---
const SUPABASE_URL = 'https://zgkhixllsmutjldszjls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2hpeGxsc211dGpsZHN6amxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzE3MTksImV4cCI6MjA1NTc0NzcxOX0.99zW5E_g3pZ3c2jE0m9pYt-hW46cZ14Z52-G6XyN88Y';

window.supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- Application State ---
const state = {
    currentUser: null, // { role: 'admin' | 'typist', typistId: string | null, name: string }
    currentTypistId: null,
    typists: [],
    reports: [],
    payments: [],
    searchQuery: '',
    selectedTypistIds: new Set(),
    activeTab: 'admin',
    datePickerTargetId: null,
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
        info: 'bg-blue-600 dark:bg-blue-500',
        warning: 'bg-amber-500 dark:bg-amber-400'
    };
    
    toast.className = `fixed bottom-5 left-5 z-50 px-5 py-3 rounded-xl text-white font-medium shadow-2xl transition-all duration-300 transform translate-y-10 opacity-0 flex items-center gap-2 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Theme (Dark/Light Mode) ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeToggleUI();
}

window.toggleTheme = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeToggleUI();
};

function updateThemeToggleUI() {
    const isDark = document.documentElement.classList.contains('dark');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');
    if (darkIcon && lightIcon) {
        if (isDark) {
            darkIcon.classList.remove('hidden');
            lightIcon.classList.add('hidden');
        } else {
            darkIcon.classList.add('hidden');
            lightIcon.classList.remove('hidden');
        }
    }
}

// --- Shamsi Date Utilities ---
const JDN_OFFSET = 1948320.5;
function isPersianLeapYear(jy) {
    return (((((jy - (jy > 0 ? 474 : 473)) % 2820) + 474) + 38) * 682) % 2816 < 682;
}

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
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
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
    const m = String(jObj.jm).padStart(2, '0');
    const d = String(jObj.jd).padStart(2, '0');
    return `${jObj.jy}/${m}/${d}`;
}

function parseJalali(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = toEnglishDigits(str).split('/');
    if (parts.length !== 3) return null;
    const jy = parseInt(parts[0]), jm = parseInt(parts[1]), jd = parseInt(parts[2]);
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
    return { jy, jm, jd };
}

function getDeliveryTimerBadge(deliveryDateStr) {
    if (!deliveryDateStr) return `<span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">نامشخص</span>`;
    const jObj = parseJalali(deliveryDateStr);
    if (!jObj) return `<span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">نامعتبر</span>`;
    
    const targetDate = jalaliToGregorian(jObj.jy, jObj.jm, jObj.jd);
    const today = new Date();
    today.setHours(0,0,0,0);
    targetDate.setHours(0,0,0,0);
    
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `<span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">${diffDays} روز مانده</span>`;
    else if (diffDays === 0) return `<span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">امروز موعد تحویل</span>`;
    else return `<span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">${Math.abs(diffDays)} روز تاخیر</span>`;
}

// --- Datepicker Logic ---
const monthNamesPersian = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

function openDatePicker(targetId) {
    state.datePickerTargetId = targetId;
    const inputEl = document.getElementById(targetId);
    let initialJalali = parseJalali(inputEl ? inputEl.value : '') || getTodayJalali();
    state.currentPickerDate = { jy: initialJalali.jy, jm: initialJalali.jm };
    
    renderDatePicker();
    document.getElementById('modal-datepicker')?.classList.remove('hidden');
}

function renderDatePicker() {
    if (!state.currentPickerDate) state.currentPickerDate = getTodayJalali();
    const { jy, jm } = state.currentPickerDate;
    
    const title = document.getElementById('dp-current-title');
    if (title) title.textContent = `${monthNamesPersian[jm - 1]} ${jy}`;
    
    const yearSelect = document.getElementById('dp-select-year');
    const monthSelect = document.getElementById('dp-select-month');
    
    if (yearSelect && monthSelect) {
        yearSelect.innerHTML = '';
        for (let y = 1390; y <= 1410; y++) {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            if (y === jy) opt.selected = true;
            yearSelect.appendChild(opt);
        }
        monthSelect.innerHTML = '';
        monthNamesPersian.forEach((mName, idx) => {
            const opt = document.createElement('option');
            opt.value = idx + 1; opt.textContent = mName;
            if (idx + 1 === jm) opt.selected = true;
            monthSelect.appendChild(opt);
        });
    }
    
    let daysCount = (jm <= 6) ? 31 : (jm <= 11) ? 30 : (isPersianLeapYear(jy) ? 30 : 29);
    const firstDayGreg = jalaliToGregorian(jy, jm, 1);
    let startDayOfWeek = (firstDayGreg.getDay() + 1) % 7;
    
    const grid = document.getElementById('dp-days-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        grid.appendChild(emptyCell);
    }
    
    const todayJalali = getTodayJalali();
    for (let d = 1; d <= daysCount; d++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isToday = (todayJalali.jy === jy && todayJalali.jm === jm && todayJalali.jd === d);
        btn.className = `p-1 rounded-lg text-sm font-medium transition-all ${isToday ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`;
        btn.textContent = d;
        btn.onclick = () => {
            if (state.datePickerTargetId) {
                const targetInput = document.getElementById(state.datePickerTargetId);
                if (targetInput) targetInput.value = formatJalali({ jy, jm, jd: d });
            }
            document.getElementById('modal-datepicker')?.classList.add('hidden');
        };
        grid.appendChild(btn);
    }
}

// --- Navigation ---
function showView(viewId) {
    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.add('hidden');
    document.getElementById('detail-view')?.classList.add('hidden');
    document.getElementById(viewId)?.classList.remove('hidden');
    updateNavUI();
}

function updateNavUI() {
    const navControls = document.getElementById('user-nav-controls');
    if (navControls) {
        if (state.currentUser) navControls.classList.remove('hidden');
        else navControls.classList.add('hidden');
    }
}

// --- Authentication ---
window.handleLogin = async function(e, role) {
    e.preventDefault();
    if (!window.supabaseClient) {
        showToast('خطا در اتصال به دیتابیس', 'error');
        return;
    }
    
    const errBox = document.getElementById('login-error');
    if (errBox) errBox.classList.add('hidden');
    
    try {
        if (role === 'admin') {
            const pwd = toEnglishDigits(document.getElementById('admin-password')?.value || '');
            const { data, error } = await window.supabaseClient.rpc('verify_admin_password', { p_password: pwd });
            if (error) throw error;
            const res = Array.isArray(data) ? data[0] : (data || {});
            if (res && res.success) {
                state.currentUser = { role: 'admin', name: 'مدیر', typistId: null };
                showToast('با موفقیت وارد شدید', 'success');
                showDashboardView();
            } else {
                throw new Error(res?.message || 'رمز عبور اشتباه است');
            }
        } else {
            const iden = toEnglishDigits(document.getElementById('typist-identity')?.value || '');
            const pwd = toEnglishDigits(document.getElementById('typist-password')?.value || '');
            const { data, error } = await window.supabaseClient.rpc('verify_typist_password', { p_identifier: iden, p_password: pwd });
            if (error) throw error;
            const res = Array.isArray(data) ? data[0] : (data || {});
            if (res && res.success && res.typist) {
                state.currentUser = { role: 'typist', name: `${res.typist.first_name} ${res.typist.last_name}`, typistId: res.typist.id };
                showToast('خوش آمدید', 'success');
                showTypistDetailView(res.typist.id);
            } else {
                throw new Error(res?.message || 'اطلاعات ورود اشتباه است');
            }
        }
    } catch (err) {
        if (errBox) {
            errBox.textContent = err.message || 'خطا در ورود';
            errBox.classList.remove('hidden');
        } else {
            showToast(err.message, 'error');
        }
    }
};

window.handleLogout = function() {
    state.currentUser = null;
    state.currentTypistId = null;
    document.getElementById('form-login-admin')?.reset();
    document.getElementById('form-login-typist')?.reset();
    showView('login-view');
    showToast('از سیستم خارج شدید', 'info');
};

// --- Dashboard (Admin) ---
async function showDashboardView() {
    if (!state.currentUser || state.currentUser.role !== 'admin') return;
    showView('dashboard-view');
    await loadDashboardData();
}

async function loadDashboardData() {
    if (!window.supabaseClient) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('get_dashboard_summary');
        if (error) throw error;
        let items = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
        state.typists = Array.isArray(items) ? items : [];
        renderDashboard();
    } catch (err) {
        showToast('خطا در دریافت لیست تایپیست‌ها', 'error');
    }
}

function renderDashboard() {
    const tbody = document.getElementById('typists-table-body');
    if (!tbody) return;
    
    let filtered = state.typists.filter(t => {
        const q = state.searchQuery.toLowerCase();
        const str = `${t.first_name || ''} ${t.last_name || ''} ${t.national_id || ''} ${t.phone || ''}`.toLowerCase();
        return str.includes(q);
    });

    let totalEarnings = 0, totalPaid = 0, totalWords = 0;
    state.typists.forEach(t => {
        totalEarnings += Number(t.total_earnings || 0);
        totalPaid += Number(t.total_paid || 0);
        totalWords += Number(t.page_rate || 0); // Placeholder for words if needed
    });

    document.getElementById('stat-total-typists').textContent = state.typists.length.toLocaleString('fa-IR') + ' نفر';
    document.getElementById('stat-total-paid').textContent = totalPaid.toLocaleString('fa-IR') + ' تومان';
    document.getElementById('stat-total-remaining').textContent = (totalEarnings - totalPaid).toLocaleString('fa-IR') + ' تومان';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">موردی یافت نشد</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const remaining = Number(t.remaining_balance || 0);
        const fullName = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'بدون نام';
        const isChecked = state.selectedTypistIds.has(t.id) ? 'checked' : '';
        
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <td class="p-4 text-center">
                    <input type="checkbox" onchange="window.toggleSelectTypist('${t.id}')" ${isChecked} class="rounded border-slate-300 text-blue-600" />
                </td>
                <td class="p-4">
                    <div class="font-bold text-slate-900 dark:text-white">${fullName}</div>
                    <div class="text-xs text-slate-500 mt-1">${t.national_id || '---'}</div>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        <a href="tel:${t.phone}" class="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg></a>
                        <a href="sms:${t.phone}" class="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path></svg></a>
                    </div>
                </td>
                <td class="p-4 text-center font-medium">${(Number(t.page_rate) || 0).toLocaleString('fa-IR')}</td>
                <td class="p-4 text-center font-bold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                    ${Math.abs(remaining).toLocaleString('fa-IR')} ${remaining < 0 ? '(طلبکار)' : ''}
                </td>
                <td class="p-4 text-center">${getDeliveryTimerBadge(t.delivery_date)}</td>
                <td class="p-4 text-center">
                    <button onclick="window.showTypistDetailView('${t.id}')" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-xs font-semibold">جزئیات</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.toggleSelectTypist = function(id) {
    if (state.selectedTypistIds.has(id)) state.selectedTypistIds.delete(id);
    else state.selectedTypistIds.add(id);
    updateSmsCount();
};

window.selectAllTypists = function(checked) {
    if (checked) state.typists.forEach(t => state.selectedTypistIds.add(t.id));
    else state.selectedTypistIds.clear();
    renderDashboard();
};

function updateSmsCount() {
    const el = document.getElementById('modal-sms-recipients-count');
    if (el) el.textContent = `تعداد دریافت‌کنندگان: ${state.selectedTypistIds.size.toLocaleString('fa-IR')} نفر`;
}

// --- Detail View (Admin & Typist) ---
window.showTypistDetailView = async function(typistId) {
    state.currentTypistId = typistId;
    showView('detail-view');
    
    // UI role setup
    const isAdmin = (state.currentUser && state.currentUser.role === 'admin');
    document.getElementById('detail-back-bar').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('detail-rate-badge').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-open-add-payment').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('wrapper-modal-typist-rate').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('wrapper-modal-report-rate').style.display = isAdmin ? 'block' : 'none';
    
    await loadTypistDetail(typistId);
};

async function loadTypistDetail(id) {
    if (!window.supabaseClient) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('get_typist_detail', { p_typist_id: id });
        if (error) throw error;
        const res = Array.isArray(data) ? data[0] : (data || {});
        if (res && res.success) renderTypistDetail(res);
    } catch (err) {
        showToast('خطا در دریافت جزئیات', 'error');
    }
}

function renderTypistDetail(data) {
    const t = data.typist || {};
    const isAdmin = (state.currentUser && state.currentUser.role === 'admin');
    
    document.getElementById('detail-name').textContent = `${t.first_name || ''} ${t.last_name || ''}`;
    document.getElementById('detail-subinfo').textContent = `کد ملی: ${t.national_id || '---'} | موبایل: ${t.phone || '---'}`;
    document.getElementById('detail-delivery-badge-wrapper').innerHTML = getDeliveryTimerBadge(t.delivery_date);
    
    if (isAdmin) {
        document.getElementById('detail-rate-badge').textContent = `💵 نرخ هر کلمه: ${(Number(t.page_rate) || 0).toLocaleString('fa-IR')} تومان`;
        document.getElementById('detail-contact-actions').innerHTML = `
            <a href="tel:${t.phone}" class="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg></a>
            <a href="sms:${t.phone}" class="p-2 bg-blue-100 text-blue-700 rounded-xl"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path></svg></a>
        `;
    }

    const earnings = Number(data.total_earnings || 0);
    const paid = Number(data.total_paid || 0);
    const remaining = Number(data.remaining_balance || 0);
    
    document.getElementById('detail-stat-total').textContent = earnings.toLocaleString('fa-IR') + ' تومان';
    document.getElementById('detail-stat-paid').textContent = paid.toLocaleString('fa-IR') + ' تومان';
    document.getElementById('detail-stat-remaining').textContent = Math.abs(remaining).toLocaleString('fa-IR') + ' تومان';
    
    // Store data in form for editing
    document.getElementById('modal-typist-id').value = t.id || '';
    document.getElementById('modal-typist-firstname').value = t.first_name || '';
    document.getElementById('modal-typist-lastname').value = t.last_name || '';
    document.getElementById('modal-typist-father').value = t.father_name || '';
    document.getElementById('modal-typist-nationalid').value = t.national_id || '';
    document.getElementById('modal-typist-phone').value = t.phone || '';
    document.getElementById('modal-typist-rate').value = t.page_rate || '';
    document.getElementById('modal-typist-card').value = t.card_number || '';
    document.getElementById('modal-typist-iban').value = t.iban || '';
    document.getElementById('modal-typist-delivery').value = t.delivery_date || '';

    renderReports(data.reports || [], isAdmin);
    renderPayments(data.payments || [], isAdmin);
}

function renderReports(reports, isAdmin) {
    const tbody = document.getElementById('reports-table-body');
    const thRate = document.getElementById('th-report-rate');
    if (thRate) thRate.style.display = isAdmin ? '' : 'none';
    
    if (!reports.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">هیچ کارکردی ثبت نشده</td></tr>`;
        return;
    }
    
    let totalWordsCounter = 0;
    
    tbody.innerHTML = reports.map(r => {
        const words = Number(r.page_count || 0);
        totalWordsCounter += words;
        return `
            <tr class="border-b border-slate-100 dark:border-slate-800">
                <td class="p-3">${r.report_date || ''}</td>
                <td class="p-3 text-center font-bold text-blue-600">${words.toLocaleString('fa-IR')}</td>
                <td class="p-3 text-center">---</td>
                ${isAdmin ? `<td class="p-3 text-center">${(Number(r.rate)||0).toLocaleString('fa-IR')}</td>` : ''}
                <td class="p-3 text-center font-bold">${(Number(r.total_amount)||0).toLocaleString('fa-IR')}</td>
                <td class="p-3 text-xs text-slate-500">${r.description || ''}</td>
                <td class="p-3 text-center">
                    <button onclick="window.deleteReport('${r.id}')" class="text-rose-500 hover:text-rose-700"><svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('detail-stat-words').textContent = totalWordsCounter.toLocaleString('fa-IR');
}

function renderPayments(payments, isAdmin) {
    const tbody = document.getElementById('payments-table-body');
    if (!payments.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">هیچ پرداختی ثبت نشده</td></tr>`;
        return;
    }
    tbody.innerHTML = payments.map(p => `
        <tr class="border-b border-slate-100 dark:border-slate-800">
            <td class="p-3">${p.payment_date || ''}</td>
            <td class="p-3 text-center font-bold text-emerald-600">${(Number(p.amount)||0).toLocaleString('fa-IR')}</td>
            <td class="p-3 text-center">---</td>
            <td class="p-3 text-center">---</td>
            <td class="p-3 text-xs text-slate-500">${p.description || ''}</td>
            <td class="p-3 text-center">
                ${isAdmin ? `<button onclick="window.deletePayment('${p.id}')" class="text-rose-500 hover:text-rose-700"><svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>` : ''}
            </td>
        </tr>
    `).join('');
}

// --- CRUD Actions ---
window.submitTypistForm = async function(e) {
    e.preventDefault();
    const tId = document.getElementById('modal-typist-id').value;
    const payload = {
        p_id: tId ? tId : null,
        p_first_name: document.getElementById('modal-typist-firstname').value,
        p_last_name: document.getElementById('modal-typist-lastname').value,
        p_father_name: document.getElementById('modal-typist-father').value,
        p_national_id: toEnglishDigits(document.getElementById('modal-typist-nationalid').value),
        p_phone: toEnglishDigits(document.getElementById('modal-typist-phone').value),
        p_card_number: toEnglishDigits(document.getElementById('modal-typist-card').value),
        p_iban: toEnglishDigits(document.getElementById('modal-typist-iban').value),
        p_page_rate: Number(toEnglishDigits(document.getElementById('modal-typist-rate').value || 0)),
        p_delivery_date: document.getElementById('modal-typist-delivery').value
    };
    
    try {
        const { error } = await window.supabaseClient.rpc('upsert_typist', payload);
        if (error) throw error;
        showToast('اطلاعات با موفقیت ذخیره شد', 'success');
        document.getElementById('modal-typist').classList.add('hidden');
        if (state.currentUser.role === 'admin' && !tId) loadDashboardData();
        if (state.currentTypistId) loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در ذخیره اطلاعات', 'error');
    }
};

window.submitReportForm = async function(e) {
    e.preventDefault();
    if (!state.currentTypistId) return;
    const words = Number(toEnglishDigits(document.getElementById('modal-report-words').value || 0));
    const pages = document.getElementById('modal-report-pages').value;
    const date = document.getElementById('modal-report-date').value;
    const notes = document.getElementById('modal-report-notes').value;
    
    try {
        const { error } = await window.supabaseClient.rpc('add_typist_report', {
            p_typist_id: state.currentTypistId,
            p_page_count: words, // Passing words into page_count column based on new schema
            p_report_date: date,
            p_description: notes ? `صفحات: ${pages} - ${notes}` : `صفحات: ${pages}`
        });
        if (error) throw error;
        showToast('گزارش با موفقیت ثبت شد', 'success');
        document.getElementById('modal-report').classList.add('hidden');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در ثبت گزارش', 'error');
    }
};

window.submitPaymentForm = async function(e) {
    e.preventDefault();
    if (!state.currentTypistId) return;
    const amount = Number(toEnglishDigits(document.getElementById('modal-payment-amount').value || 0));
    const date = document.getElementById('modal-payment-date').value;
    const method = document.getElementById('modal-payment-method').value;
    const ref = document.getElementById('modal-payment-ref').value;
    const notes = document.getElementById('modal-payment-notes').value;
    
    const fullNotes = `روش: ${method} | پیگیری: ${ref} | ${notes}`;
    
    try {
        const { error } = await window.supabaseClient.rpc('add_payment', {
            p_typist_id: state.currentTypistId,
            p_amount: amount,
            p_payment_date: date,
            p_description: fullNotes
        });
        if (error) throw error;
        showToast('پرداخت با موفقیت ثبت شد', 'success');
        document.getElementById('modal-payment').classList.add('hidden');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در ثبت پرداخت', 'error');
    }
};

window.submitChangePassword = async function(e) {
    e.preventDefault();
    const oldP = toEnglishDigits(document.getElementById('modal-pass-current').value);
    const newP = toEnglishDigits(document.getElementById('modal-pass-new').value);
    
    try {
        let res;
        if (state.currentUser.role === 'admin') {
            res = await window.supabaseClient.rpc('change_admin_password', { p_old_password: oldP, p_new_password: newP });
        } else {
            res = await window.supabaseClient.rpc('change_typist_password', { p_typist_id: state.currentUser.typistId, p_old_password: oldP, p_new_password: newP });
        }
        const data = Array.isArray(res?.data) ? res.data[0] : (res?.data || {});
        if (data.success) {
            showToast('رمز عبور تغییر کرد', 'success');
            document.getElementById('modal-password').classList.add('hidden');
        } else {
            throw new Error(data.message || 'رمز عبور فعلی اشتباه است');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.deleteReport = async function(id) {
    if(!confirm('آیا مطمئن هستید؟')) return;
    await window.supabaseClient.rpc('delete_typist_report', { p_report_id: id });
    loadTypistDetail(state.currentTypistId);
};

window.deletePayment = async function(id) {
    if(!confirm('آیا مطمئن هستید؟')) return;
    await window.supabaseClient.rpc('delete_payment', { p_payment_id: id });
    loadTypistDetail(state.currentTypistId);
};

// --- Export & SMS ---
window.exportBankCsv = function() {
    if (!state.typists.length) return;
    const headers = ['ردیف', 'نام', 'نام خانوادگی', 'نام پدر', 'کد ملی', 'شماره تماس', 'شماره کارت', 'شماره شبا', 'مبلغ پرداختی به ریال'];
    const rows = state.typists.map((t, i) => {
        const rem = Number(t.remaining_balance || 0);
        return [
            i + 1,
            `"${t.first_name || ''}"`, `"${t.last_name || ''}"`, `"${t.father_name || ''}"`,
            `"${t.national_id || ''}"`, `"${t.phone || ''}"`, `"${t.card_number || ''}"`,
            `"${t.iban || ''}"`, (rem > 0 ? rem * 10 : 0)
        ].join(',');
    });
    
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bank_export_${formatJalali(getTodayJalali()).replace(/\//g,'-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
};

window.sendGroupSms = function() {
    const text = document.getElementById('modal-sms-text').value;
    const phones = state.typists.filter(t => state.selectedTypistIds.has(t.id)).map(t => t.phone).join(',');
    if (!phones) return showToast('شماره‌ای انتخاب نشده', 'warning');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    window.location.href = `sms:${phones}${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`;
    document.getElementById('modal-sms').classList.add('hidden');
};

// --- Event Listeners Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Theme
    document.getElementById('theme-toggle')?.addEventListener('click', window.toggleTheme);
    
    // Auth Tabs
    const tAdmin = document.getElementById('tab-login-admin');
    const tTypist = document.getElementById('tab-login-typist');
    const fAdmin = document.getElementById('form-login-admin');
    const fTypist = document.getElementById('form-login-typist');
    
    if (tAdmin && tTypist) {
        tAdmin.onclick = () => {
            tAdmin.classList.add('text-blue-600', 'border-blue-600');
            tAdmin.classList.remove('text-slate-500', 'border-transparent');
            tTypist.classList.remove('text-blue-600', 'border-blue-600');
            tTypist.classList.add('text-slate-500', 'border-transparent');
            fAdmin?.classList.remove('hidden');
            fTypist?.classList.add('hidden');
        };
        tTypist.onclick = () => {
            tTypist.classList.add('text-blue-600', 'border-blue-600');
            tTypist.classList.remove('text-slate-500', 'border-transparent');
            tAdmin.classList.remove('text-blue-600', 'border-blue-600');
            tAdmin.classList.add('text-slate-500', 'border-transparent');
            fTypist?.classList.remove('hidden');
            fAdmin?.classList.add('hidden');
        };
    }

    // Forms
    fAdmin?.addEventListener('submit', (e) => window.handleLogin(e, 'admin'));
    fTypist?.addEventListener('submit', (e) => window.handleLogin(e, 'typist'));
    
    document.getElementById('btn-logout')?.addEventListener('click', window.handleLogout);
    document.getElementById('btn-open-change-password')?.addEventListener('click', () => {
        document.getElementById('form-change-password').reset();
        document.getElementById('modal-password').classList.remove('hidden');
    });

    // Dashboard Buttons
    document.getElementById('dashboard-search')?.addEventListener('input', (e) => {
        state.searchQuery = e.target.value; renderDashboard();
    });
    
    document.getElementById('select-all-typists')?.addEventListener('change', (e) => window.selectAllTypists(e.target.checked));
    
    document.getElementById('btn-export-excel')?.addEventListener('click', window.exportBankCsv);
    
    document.getElementById('btn-group-sms')?.addEventListener('click', () => {
        if(state.selectedTypistIds.size === 0) return showToast('کسی را انتخاب نکرده‌اید', 'warning');
        updateSmsCount();
        document.getElementById('modal-sms').classList.remove('hidden');
    });
    
    document.getElementById('btn-open-add-typist')?.addEventListener('click', () => {
        document.getElementById('form-typist').reset();
        document.getElementById('modal-typist-id').value = '';
        document.getElementById('modal-typist').classList.remove('hidden');
    });

    // Detail View Buttons
    document.getElementById('btn-back-to-dashboard')?.addEventListener('click', showDashboardView);
    
    document.getElementById('btn-open-add-report')?.addEventListener('click', () => {
        document.getElementById('form-report').reset();
        document.getElementById('modal-report-date').value = formatJalali(getTodayJalali());
        document.getElementById('modal-report').classList.remove('hidden');
    });
    
    document.getElementById('btn-open-add-payment')?.addEventListener('click', () => {
        document.getElementById('form-payment').reset();
        document.getElementById('modal-payment-date').value = formatJalali(getTodayJalali());
        document.getElementById('modal-payment').classList.remove('hidden');
    });
    
    document.getElementById('btn-open-edit-profile')?.addEventListener('click', () => {
        document.getElementById('modal-typist').classList.remove('hidden');
    });

    // Form Submits
    document.getElementById('form-typist')?.addEventListener('submit', window.submitTypistForm);
    document.getElementById('form-report')?.addEventListener('submit', window.submitReportForm);
    document.getElementById('form-payment')?.addEventListener('submit', window.submitPaymentForm);
    document.getElementById('form-change-password')?.addEventListener('submit', window.submitChangePassword);
    
    document.getElementById('btn-send-sms-confirm')?.addEventListener('click', window.sendGroupSms);

    // Modals Close
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.fixed.inset-0');
            if (modal) modal.classList.add('hidden');
        });
    });

    // Datepicker Triggers
    document.querySelectorAll('.btn-trigger-datepicker').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openDatePicker(e.target.dataset.target);
        });
    });

    // Datepicker Controls
    document.getElementById('dp-prev-month')?.addEventListener('click', () => {
        if (!state.currentPickerDate) return;
        if (state.currentPickerDate.jm > 1) state.currentPickerDate.jm--;
        else { state.currentPickerDate.jm = 12; state.currentPickerDate.jy--; }
        renderDatePicker();
    });
    
    document.getElementById('dp-next-month')?.addEventListener('click', () => {
        if (!state.currentPickerDate) return;
        if (state.currentPickerDate.jm < 12) state.currentPickerDate.jm++;
        else { state.currentPickerDate.jm = 1; state.currentPickerDate.jy++; }
        renderDatePicker();
    });
    
    document.getElementById('dp-select-month')?.addEventListener('change', (e) => {
        if (state.currentPickerDate) { state.currentPickerDate.jm = parseInt(e.target.value); renderDatePicker(); }
    });
    
    document.getElementById('dp-select-year')?.addEventListener('change', (e) => {
        if (state.currentPickerDate) { state.currentPickerDate.jy = parseInt(e.target.value); renderDatePicker(); }
    });
    
    document.getElementById('dp-btn-today')?.addEventListener('click', () => {
        state.currentPickerDate = getTodayJalali();
        renderDatePicker();
    });
});

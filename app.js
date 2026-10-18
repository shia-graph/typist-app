/* =========================================================================
   Typist Payroll & Task Management System - Application Logic
   Author: Full Version Un-Minified
   ========================================================================= */

console.log("🚀 Typist Payroll App initialized successfully.");

// ==========================================
// 1. Supabase Configuration & Initialization
// ==========================================
const SUPABASE_URL = 'https://zgkhixllsmutjldszjls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2hpeGxsc211dGpsZHN6amxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzE3MTksImV4cCI6MjA1NTc0NzcxOX0.99zW5E_g3pZ3c2jE0m9pYt-hW46cZ14Z52-G6XyN88Y';

window.supabaseClient = null;

if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase client connected successfully.");
} else {
    console.error("❌ ERROR: Supabase library not found! Please check your internet connection or CDN link.");
}

// ==========================================
// 2. Global State Management
// ==========================================
const state = {
    currentUser: null,       // Stores { role: 'admin'|'typist', name: '...', typistId: '...' }
    currentTypistId: null,   // Stores the ID of the typist currently being viewed in detail page
    typists: [],             // Array of all typists fetched for the dashboard
    searchQuery: '',         // Dashboard search string
    selectedTypistIds: new Set(), // Set of UUIDs selected for Group SMS
    datePickerTargetId: null,     // HTML ID of the input field the datepicker is updating
    currentPickerDate: null       // Object { jy, jm, jd } representing currently viewed month in datepicker
};

// ==========================================
// 3. Global Utility Functions
// ==========================================

/**
 * Converts Persian (Farsi) and Arabic digits to English digits for DB storage.
 */
function toEnglishDigits(str) {
    if (str === null || str === undefined) return '';
    const persianMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicMap  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let result = String(str);
    for (let i = 0; i < 10; i++) {
        result = result.replace(new RegExp(persianMap[i], 'g'), i)
                       .replace(new RegExp(arabicMap[i], 'g'), i);
    }
    return result.trim();
}

/**
 * Displays a beautiful toast notification popup.
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    
    // Style configurations based on toast type
    const bgColors = {
        success: 'bg-emerald-600',
        error: 'bg-rose-600',
        info: 'bg-blue-600',
        warning: 'bg-amber-500'
    };
    
    toast.className = `fixed bottom-6 left-6 z-[9999] px-6 py-3.5 rounded-xl text-white font-bold shadow-2xl transition-all duration-300 transform translate-y-10 opacity-0 flex items-center gap-2 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Specifically handles UI errors in the login screen.
 */
function showErrorBox(msg) {
    const errBox = document.getElementById('login-error');
    if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
    } else {
        showToast(msg, 'error');
    }
}

// ==========================================
// 4. Dark & Light Mode Theme Management
// ==========================================
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

// ==========================================
// 5. Shamsi (Jalali) Calendar Utilities
// ==========================================
const JDN_OFFSET = 1948320.5;

function isPersianLeapYear(jy) {
    return (((((jy - (jy > 0 ? 474 : 473)) % 2820) + 474) + 38) * 682) % 2816 < 682;
}

function jalaliToGregorian(jy, jm, jd) {
    jy = parseInt(jy); 
    jm = parseInt(jm); 
    jd = parseInt(jd);
    
    let jy2 = jy - (jy >= 0 ? 474 : 473);
    let julianYear = 474 + (jy2 % 2820);
    let julianDays = jd + (jm <= 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) 
                   + Math.floor((julianYear * 682 - 110) / 2816) 
                   + (julianYear - 1) * 365 
                   + Math.floor(jy2 / 2820) * 1029983 
                   + (JDN_OFFSET - 1);
                   
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
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) 
             - Math.floor((gy2 + 99) / 100) 
             + Math.floor((gy2 + 399) / 400) 
             - 80 + gd + g_d_m[gm - 1];
             
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
    return `${jObj.jy}/${String(jObj.jm).padStart(2, '0')}/${String(jObj.jd).padStart(2, '0')}`;
}

function parseJalali(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = toEnglishDigits(str).split('/');
    if (parts.length !== 3) return null;
    
    const jy = parseInt(parts[0]);
    const jm = parseInt(parts[1]);
    const jd = parseInt(parts[2]);
    
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
    return { jy, jm, jd };
}

function getDeliveryTimerBadge(deliveryDateStr) {
    if (!deliveryDateStr) {
        return `<span class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">نامشخص</span>`;
    }
    
    const jObj = parseJalali(deliveryDateStr);
    if (!jObj) {
        return `<span class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">تاریخ نامعتبر</span>`;
    }
    
    const targetDate = jalaliToGregorian(jObj.jy, jObj.jm, jObj.jd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
        return `<span class="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">${diffDays} روز مانده</span>`;
    } else if (diffDays === 0) {
        return `<span class="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shadow-sm animate-pulse">امروز تحویل</span>`;
    } else {
        return `<span class="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 shadow-sm">${Math.abs(diffDays)} روز تاخیر</span>`;
    }
}

// ==========================================
// 6. Custom Shamsi DatePicker Logic
// ==========================================
const monthNamesPersian = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

function openDatePicker(targetId) {
    state.datePickerTargetId = targetId;
    const inputEl = document.getElementById(targetId);
    
    let initialJalali = parseJalali(inputEl ? inputEl.value : '') || getTodayJalali();
    state.currentPickerDate = { jy: initialJalali.jy, jm: initialJalali.jm };
    
    renderDatePicker();
    
    const modal = document.getElementById('modal-datepicker');
    if (modal) modal.classList.remove('hidden');
}

function renderDatePicker() {
    if (!state.currentPickerDate) {
        state.currentPickerDate = getTodayJalali();
    }
    const { jy, jm } = state.currentPickerDate;
    
    const title = document.getElementById('dp-current-title');
    if (title) {
        title.textContent = `${monthNamesPersian[jm - 1]} ${jy}`;
    }
    
    const yearSelect = document.getElementById('dp-select-year');
    const monthSelect = document.getElementById('dp-select-month');
    
    if (yearSelect && monthSelect) {
        yearSelect.innerHTML = '';
        for (let y = 1390; y <= 1410; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === jy) opt.selected = true;
            yearSelect.appendChild(opt);
        }
        
        monthSelect.innerHTML = '';
        monthNamesPersian.forEach((mName, idx) => {
            const opt = document.createElement('option');
            opt.value = idx + 1;
            opt.textContent = mName;
            if (idx + 1 === jm) opt.selected = true;
            monthSelect.appendChild(opt);
        });
    }
    
    let daysCount = 30;
    if (jm <= 6) daysCount = 31;
    else if (jm <= 11) daysCount = 30;
    else daysCount = isPersianLeapYear(jy) ? 30 : 29;
    
    const firstDayGreg = jalaliToGregorian(jy, jm, 1);
    let startDayOfWeek = (firstDayGreg.getDay() + 1) % 7;
    
    const grid = document.getElementById('dp-days-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Fill empty cells before start of month
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        grid.appendChild(emptyCell);
    }
    
    const todayJalali = getTodayJalali();
    
    // Generate day buttons
    for (let d = 1; d <= daysCount; d++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        
        const isToday = (todayJalali.jy === jy && todayJalali.jm === jm && todayJalali.jd === d);
        
        btn.className = `w-full h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-200 ${
            isToday 
            ? 'bg-blue-600 text-white shadow-md' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
        }`;
        
        btn.textContent = d;
        btn.onclick = () => {
            if (state.datePickerTargetId) {
                const targetInput = document.getElementById(state.datePickerTargetId);
                if (targetInput) {
                    targetInput.value = formatJalali({ jy, jm, jd: d });
                }
            }
            document.getElementById('modal-datepicker')?.classList.add('hidden');
        };
        grid.appendChild(btn);
    }
}

// ==========================================
// 7. Navigation & View Controller
// ==========================================
function showView(viewId) {
    // Hide all main views safely
    const views = ['login-view', 'dashboard-view', 'detail-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });
    
    // Show Target View
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    
    updateNavUI();
}

function updateNavUI() {
    const navControls = document.getElementById('user-nav-controls');
    if (navControls) {
        if (state.currentUser) {
            navControls.classList.remove('hidden');
        } else {
            navControls.classList.add('hidden');
        }
    }
}

// ==========================================
// 8. Authentication Logic
// ==========================================
window.handleLogin = async function(e, role) {
    e.preventDefault();
    
    const errBox = document.getElementById('login-error');
    if (errBox) errBox.classList.add('hidden');

    if (!window.supabaseClient) {
        showErrorBox("ارتباط با پایگاه داده برقرار نیست. لطفا اینترنت خود را چک کنید.");
        return;
    }
    
    // Update button states for loading
    const btnId = (role === 'admin') ? 'btn-submit-admin' : 'btn-submit-typist';
    const btn = document.getElementById(btnId);
    const originalText = btn ? btn.textContent : '';
    if (btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 mx-auto text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`; 
    }
    
    try {
        if (role === 'admin') {
            const pwdInput = document.getElementById('admin-password');
            const pwd = toEnglishDigits(pwdInput ? pwdInput.value : '');
            
            const { data, error } = await window.supabaseClient.rpc('verify_admin_password', { p_password: pwd });
            if (error) throw error;
            
            const res = Array.isArray(data) ? data[0] : (data || {});
            
            if (res && res.success) {
                state.currentUser = { role: 'admin', name: 'مدیر کل سیستم', typistId: null };
                showToast('ورود با موفقیت انجام شد', 'success');
                showDashboardView();
            } else {
                throw new Error(res?.message || 'رمز عبور وارد شده اشتباه است');
            }
            
        } else {
            const idenInput = document.getElementById('typist-identity');
            const pwdInput = document.getElementById('typist-password');
            
            const iden = toEnglishDigits(idenInput ? idenInput.value : '');
            const pwd = toEnglishDigits(pwdInput ? pwdInput.value : '');
            
            const { data, error } = await window.supabaseClient.rpc('verify_typist_password', { 
                p_identifier: iden, 
                p_password: pwd 
            });
            if (error) throw error;
            
            const res = Array.isArray(data) ? data[0] : (data || {});
            
            if (res && res.success && res.typist) {
                state.currentUser = { 
                    role: 'typist', 
                    name: `${res.typist.first_name} ${res.typist.last_name}`, 
                    typistId: res.typist.id 
                };
                showToast(`خوش آمدید، ${state.currentUser.name}`, 'success');
                showTypistDetailView(res.typist.id);
            } else {
                throw new Error(res?.message || 'مشخصات ورود اشتباه است');
            }
        }
    } catch (err) {
        console.error("Auth Error:", err);
        showErrorBox(err.message || 'خطا در احراز هویت سرور');
    } finally {
        if (btn) { 
            btn.disabled = false; 
            btn.textContent = originalText; 
        }
    }
};

window.handleLogout = function() {
    state.currentUser = null;
    state.currentTypistId = null;
    state.typists = [];
    
    const formAdmin = document.getElementById('form-login-admin');
    const formTypist = document.getElementById('form-login-typist');
    
    if (formAdmin) formAdmin.reset();
    if (formTypist) formTypist.reset();
    
    showView('login-view');
    showToast('شما از سیستم خارج شدید', 'info');
};

// ==========================================
// 9. Dashboard Logic (Admin Only)
// ==========================================
async function showDashboardView() {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
        showErrorBox('شما دسترسی به این بخش را ندارید');
        return;
    }
    
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
        console.error("Dashboard Load Error:", err);
        showToast('خطا در دریافت لیست تایپیست‌ها', 'error');
    }
}

function renderDashboard() {
    const tbody = document.getElementById('typists-table-body');
    if (!tbody) return;
    
    // Filtering Logic
    let filtered = state.typists.filter(t => {
        if (!t) return false;
        const q = (state.searchQuery || '').toLowerCase();
        const str = `${t.first_name || ''} ${t.last_name || ''} ${t.national_id || ''} ${t.phone || ''}`.toLowerCase();
        return str.includes(q);
    });

    // Dashboard Statistics Calculation
    let totalEarnings = 0;
    let totalPaid = 0;
    
    state.typists.forEach(t => {
        if (t) {
            totalEarnings += Number(t.total_earnings || 0);
            totalPaid += Number(t.total_paid || 0);
        }
    });

    // Update DOM Stats
    const elTotalTypists = document.getElementById('stat-total-typists');
    const elTotalPaid = document.getElementById('stat-total-paid');
    const elTotalRem = document.getElementById('stat-total-remaining');
    
    if(elTotalTypists) elTotalTypists.textContent = state.typists.length.toLocaleString('fa-IR') + ' نفر';
    if(elTotalPaid) elTotalPaid.textContent = totalPaid.toLocaleString('fa-IR') + ' تومان';
    if(elTotalRem) elTotalRem.textContent = (totalEarnings - totalPaid).toLocaleString('fa-IR') + ' تومان';

    // Empty State Check
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-500 font-bold">هیچ تایپیستی یافت نشد</td></tr>`;
        return;
    }

    // Render Table Rows
    tbody.innerHTML = filtered.map(t => {
        const remaining = Number(t.remaining_balance || 0);
        const fullName = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'بدون نام';
        const isChecked = state.selectedTypistIds.has(t.id) ? 'checked' : '';
        
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
                <td class="p-4 text-center">
                    <input type="checkbox" onchange="window.toggleSelectTypist('${t.id}')" ${isChecked} 
                           class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </td>
                <td class="p-4">
                    <div class="font-black text-slate-900 dark:text-white text-base">${fullName}</div>
                    <div class="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
                        <i class="far fa-id-card"></i> ${t.national_id || '---'}
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex items-center justify-center gap-2">
                        <a href="tel:${t.phone}" title="تماس تلفنی" class="p-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-600 hover:text-white transition shadow-sm">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                        </a>
                        <a href="sms:${t.phone}" title="ارسال پیامک" class="p-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-600 hover:text-white transition shadow-sm">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path></svg>
                        </a>
                    </div>
                </td>
                <td class="p-4 text-center font-bold text-slate-700 dark:text-slate-300">
                    ${(Number(t.page_rate) || 0).toLocaleString('fa-IR')}
                </td>
                <td class="p-4 text-center">
                    <span class="font-black text-base ${remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                        ${Math.abs(remaining).toLocaleString('fa-IR')}
                    </span>
                    <span class="text-xs block mt-1 ${remaining < 0 ? 'text-emerald-500' : 'text-rose-500'}">
                        ${remaining < 0 ? '(طلبکار از مدیر)' : (remaining > 0 ? '(بدهکار به مدیر)' : 'تصفیه شده')}
                    </span>
                </td>
                <td class="p-4 text-center">
                    ${getDeliveryTimerBadge(t.delivery_date)}
                </td>
                <td class="p-4 text-center">
                    <button onclick="window.showTypistDetailView('${t.id}')" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition shadow-sm">
                        جزئیات کامل
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.toggleSelectTypist = function(id) {
    if (state.selectedTypistIds.has(id)) {
        state.selectedTypistIds.delete(id);
    } else {
        state.selectedTypistIds.add(id);
    }
    updateSmsCount();
};

window.selectAllTypists = function(checked) {
    if (checked) {
        state.typists.forEach(t => { if (t && t.id) state.selectedTypistIds.add(t.id); });
    } else {
        state.selectedTypistIds.clear();
    }
    renderDashboard();
};

function updateSmsCount() {
    const el = document.getElementById('modal-sms-recipients-count');
    if (el) {
        el.textContent = `تعداد دریافت‌کنندگان: ${state.selectedTypistIds.size.toLocaleString('fa-IR')} نفر`;
    }
}

// ==========================================
// 10. Detail View (For Admin & Typists)
// ==========================================
window.showTypistDetailView = async function(typistId) {
    state.currentTypistId = typistId;
    showView('detail-view');
    
    // Check Role to Hide/Show Specific Elements
    const isAdmin = (state.currentUser && state.currentUser.role === 'admin');
    
    const dpBack = document.getElementById('detail-back-bar');
    const dpRate = document.getElementById('detail-rate-badge');
    const btnAddP = document.getElementById('btn-open-add-payment');
    const wRateT = document.getElementById('wrapper-modal-typist-rate');
    const wRateR = document.getElementById('wrapper-modal-report-rate');
    const thRate = document.getElementById('th-report-rate');

    if(dpBack) dpBack.style.display = isAdmin ? 'flex' : 'none';
    if(dpRate) dpRate.style.display = isAdmin ? 'block' : 'none';
    if(btnAddP) btnAddP.style.display = isAdmin ? 'flex' : 'none';
    if(wRateT) wRateT.style.display = isAdmin ? 'block' : 'none';
    if(wRateR) wRateR.style.display = isAdmin ? 'block' : 'none';
    if(thRate) thRate.style.display = isAdmin ? 'table-cell' : 'none';
    
    await loadTypistDetail(typistId);
};

async function loadTypistDetail(id) {
    if (!window.supabaseClient) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('get_typist_detail', { p_typist_id: id });
        if (error) throw error;
        
        const res = Array.isArray(data) ? data[0] : (data || {});
        
        if (res && res.success) {
            renderTypistDetail(res);
        } else {
            showToast('خطا در بارگذاری اطلاعات کاربر', 'error');
        }
    } catch (err) {
        console.error("Load Detail Error:", err);
        showToast('خطا در دریافت اطلاعات دیتابیس', 'error');
    }
}

function renderTypistDetail(data) {
    const t = data.typist || {};
    const isAdmin = (state.currentUser && state.currentUser.role === 'admin');
    
    // Header Info Mapping
    const dtName = document.getElementById('detail-name');
    const dtSub = document.getElementById('detail-subinfo');
    const dtBadge = document.getElementById('detail-delivery-badge-wrapper');
    const dtRate = document.getElementById('detail-rate-badge');
    const dtContact = document.getElementById('detail-contact-actions');

    if(dtName) dtName.textContent = `${t.first_name || ''} ${t.last_name || ''}`;
    if(dtSub) dtSub.textContent = `کد ملی: ${t.national_id || '---'} | شماره تماس: ${t.phone || '---'}`;
    if(dtBadge) dtBadge.innerHTML = getDeliveryTimerBadge(t.delivery_date);
    
    if (isAdmin && dtRate && dtContact) {
        dtRate.textContent = `💵 نرخ پایه هر کلمه: ${(Number(t.page_rate) || 0).toLocaleString('fa-IR')} تومان`;
        dtContact.innerHTML = `
            <a href="tel:${t.phone}" class="p-2.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl transition shadow-sm"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg></a>
            <a href="sms:${t.phone}" class="p-2.5 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl transition shadow-sm"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"></path></svg></a>
        `;
    }

    // Financial Mapping
    const earnings = Number(data.total_earnings || 0);
    const paid = Number(data.total_paid || 0);
    const remaining = Number(data.remaining_balance || 0);
    
    const stTot = document.getElementById('detail-stat-total');
    const stPaid = document.getElementById('detail-stat-paid');
    const stRem = document.getElementById('detail-stat-remaining');
    
    if(stTot) stTot.textContent = earnings.toLocaleString('fa-IR');
    if(stPaid) stPaid.textContent = paid.toLocaleString('fa-IR');
    if(stRem) stRem.textContent = Math.abs(remaining).toLocaleString('fa-IR');
    
    // Store data inside Modal Inputs for easy editing later
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('modal-typist-id', t.id);
    setVal('modal-typist-firstname', t.first_name);
    setVal('modal-typist-lastname', t.last_name);
    setVal('modal-typist-father', t.father_name);
    setVal('modal-typist-nationalid', t.national_id);
    setVal('modal-typist-phone', t.phone);
    setVal('modal-typist-rate', t.page_rate);
    setVal('modal-typist-card', t.card_number);
    setVal('modal-typist-iban', t.iban);
    setVal('modal-typist-delivery', t.delivery_date);

    // Render Sub-Tables
    renderReportsTable(data.reports || [], isAdmin);
    renderPaymentsTable(data.payments || [], isAdmin);
}

function renderReportsTable(reports, isAdmin) {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;

    if (!reports.length) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-center py-8 text-slate-500 font-bold">هیچ سند کارکردی ثبت نشده است</td></tr>`;
        return;
    }
    
    let totalWordsCounter = 0;
    
    tbody.innerHTML = reports.map(r => {
        const words = Number(r.page_count || 0);
        totalWordsCounter += words;
        
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 transition-colors">
                <td class="p-4 font-medium">${r.report_date || '---'}</td>
                <td class="p-4 text-center font-black text-blue-600 dark:text-blue-400 text-lg">${words.toLocaleString('fa-IR')}</td>
                ${isAdmin ? `<td class="p-4 text-center font-medium">${(Number(r.rate)||0).toLocaleString('fa-IR')}</td>` : ''}
                <td class="p-4 text-center font-black text-slate-800 dark:text-slate-200">${(Number(r.total_amount)||0).toLocaleString('fa-IR')}</td>
                <td class="p-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${r.description || 'بدون توضیح'}</td>
                <td class="p-4 text-center">
                    <button onclick="window.deleteReport('${r.id}')" title="حذف گزارش" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition">
                        <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    const dw = document.getElementById('detail-stat-words');
    if(dw) dw.textContent = totalWordsCounter.toLocaleString('fa-IR');
}

function renderPaymentsTable(payments, isAdmin) {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;

    if (!payments.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-500 font-bold">هیچ پرداختی در سیستم ثبت نشده است</td></tr>`;
        return;
    }

    tbody.innerHTML = payments.map(p => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 transition-colors">
            <td class="p-4 font-medium">${p.payment_date || '---'}</td>
            <td class="p-4 text-center font-black text-emerald-600 dark:text-emerald-400 text-lg">${(Number(p.amount)||0).toLocaleString('fa-IR')}</td>
            <td class="p-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${p.description || 'بدون توضیح'}</td>
            <td class="p-4 text-center">
                ${isAdmin ? `
                <button onclick="window.deletePayment('${p.id}')" title="حذف تراکنش" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition">
                    <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
                ` : '<span class="text-slate-400 text-xs">عدم دسترسی</span>'}
            </td>
        </tr>
    `).join('');
}

// ==========================================
// 11. Database CRUD Actions
// ==========================================

window.submitTypistForm = async function(e) {
    e.preventDefault();
    const tId = document.getElementById('modal-typist-id')?.value;
    
    // Assemble payload ensuring clean data
    const payload = {
        p_id: tId ? tId : null,
        p_first_name: document.getElementById('modal-typist-firstname')?.value || '',
        p_last_name: document.getElementById('modal-typist-lastname')?.value || '',
        p_father_name: document.getElementById('modal-typist-father')?.value || '',
        p_national_id: toEnglishDigits(document.getElementById('modal-typist-nationalid')?.value || ''),
        p_phone: toEnglishDigits(document.getElementById('modal-typist-phone')?.value || ''),
        p_card_number: toEnglishDigits(document.getElementById('modal-typist-card')?.value || ''),
        p_iban: toEnglishDigits(document.getElementById('modal-typist-iban')?.value || ''),
        p_page_rate: Number(toEnglishDigits(document.getElementById('modal-typist-rate')?.value || 0)),
        p_delivery_date: document.getElementById('modal-typist-delivery')?.value || ''
    };
    
    try {
        const { error } = await window.supabaseClient.rpc('upsert_typist', payload);
        if (error) throw error;
        
        showToast('اطلاعات با موفقیت ذخیره شد', 'success');
        document.getElementById('modal-typist')?.classList.add('hidden');
        
        // Reload appropriate view data
        if (state.currentUser.role === 'admin' && !tId) {
            loadDashboardData();
        }
        if (state.currentTypistId) {
            loadTypistDetail(state.currentTypistId);
        }
    } catch (err) {
        console.error("Save Typist Error:", err);
        showToast('خطا در ذخیره اطلاعات پایگاه داده', 'error');
    }
};

window.submitReportForm = async function(e) {
    e.preventDefault();
    if (!state.currentTypistId) return;
    
    const words = Number(toEnglishDigits(document.getElementById('modal-report-words')?.value || 0));
    const pages = document.getElementById('modal-report-pages')?.value || '';
    const date = document.getElementById('modal-report-date')?.value || '';
    const notes = document.getElementById('modal-report-notes')?.value || '';
    
    // We combine Pages into the Notes description since the DB schema stores words in page_count column based on standard typing formulas.
    const descriptionBuilder = [];
    if (pages && pages !== '0') descriptionBuilder.push(`تعداد صفحات: ${pages}`);
    if (notes) descriptionBuilder.push(notes);
    
    try {
        const { error } = await window.supabaseClient.rpc('add_typist_report', {
            p_typist_id: state.currentTypistId,
            p_page_count: words, 
            p_report_date: date,
            p_description: descriptionBuilder.join(' - ')
        });
        
        if (error) throw error;
        
        showToast('گزارش کارکرد با موفقیت ثبت شد', 'success');
        document.getElementById('modal-report')?.classList.add('hidden');
        
        // Refresh detail view
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        console.error("Save Report Error:", err);
        showToast('خطا در ثبت سند کارکرد', 'error');
    }
};

window.submitPaymentForm = async function(e) {
    e.preventDefault();
    if (!state.currentTypistId) return;
    
    const amount = Number(toEnglishDigits(document.getElementById('modal-payment-amount')?.value || 0));
    const date = document.getElementById('modal-payment-date')?.value || '';
    const method = document.getElementById('modal-payment-method')?.value || '';
    const ref = document.getElementById('modal-payment-ref')?.value || '';
    const notes = document.getElementById('modal-payment-notes')?.value || '';
    
    const descriptionBuilder = [`روش واریز: ${method}`];
    if (ref) descriptionBuilder.push(`کد پیگیری: ${ref}`);
    if (notes) descriptionBuilder.push(`توضیحات: ${notes}`);
    
    try {
        const { error } = await window.supabaseClient.rpc('add_payment', {
            p_typist_id: state.currentTypistId,
            p_amount: amount,
            p_payment_date: date,
            p_description: descriptionBuilder.join(' | ')
        });
        
        if (error) throw error;
        
        showToast('سند پرداختی با موفقیت ثبت شد', 'success');
        document.getElementById('modal-payment')?.classList.add('hidden');
        
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        console.error("Save Payment Error:", err);
        showToast('خطا در ثبت سند پرداختی', 'error');
    }
};

window.submitChangePassword = async function(e) {
    e.preventDefault();
    
    const oldP = toEnglishDigits(document.getElementById('modal-pass-current')?.value || '');
    const newP = toEnglishDigits(document.getElementById('modal-pass-new')?.value || '');
    
    try {
        let res;
        
        if (state.currentUser.role === 'admin') {
            res = await window.supabaseClient.rpc('change_admin_password', { 
                p_old_password: oldP, 
                p_new_password: newP 
            });
        } else {
            res = await window.supabaseClient.rpc('change_typist_password', { 
                p_typist_id: state.currentUser.typistId, 
                p_old_password: oldP, 
                p_new_password: newP 
            });
        }
        
        const data = Array.isArray(res?.data) ? res.data[0] : (res?.data || {});
        
        if (data.success) {
            showToast('رمز عبور امنیتی تغییر یافت', 'success');
            document.getElementById('modal-password')?.classList.add('hidden');
        } else {
            throw new Error(data.message || 'رمز عبور فعلی تطابق ندارد');
        }
    } catch (err) {
        console.error("Change Password Error:", err);
        showToast(err.message, 'error');
    }
};

window.deleteReport = async function(id) {
    if (!confirm('⚠️ آیا از حذف دائمی این سند کارکرد اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return;
    
    try {
        await window.supabaseClient.rpc('delete_typist_report', { p_report_id: id });
        showToast('سند کارکرد حذف شد', 'info');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در حذف سیستم', 'error');
    }
};

window.deletePayment = async function(id) {
    if (!confirm('⚠️ آیا از حذف این سند پرداختی اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return;
    
    try {
        await window.supabaseClient.rpc('delete_payment', { p_payment_id: id });
        showToast('سند پرداختی حذف شد', 'info');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در حذف سیستم', 'error');
    }
};

// ==========================================
// 12. External Exports & Integrations (CSV/SMS)
// ==========================================
window.exportBankCsv = function() {
    if (!state.typists.length) {
        showToast('داده‌ای برای دریافت خروجی وجود ندارد', 'warning');
        return;
    }
    
    const headers = ['ردیف', 'نام', 'نام خانوادگی', 'نام پدر', 'کد ملی', 'شماره تماس', 'شماره کارت', 'شماره شبا', 'مبلغ پرداختی به ریال'];
    
    const rows = state.typists.map((t, i) => {
        const remainingToman = Number(t.remaining_balance || 0);
        // بانک‌ها مبلغ را به ریال نیاز دارند
        const paymentRial = remainingToman > 0 ? remainingToman * 10 : 0; 
        
        return [
            i + 1,
            `"${t.first_name || ''}"`, 
            `"${t.last_name || ''}"`, 
            `"${t.father_name || ''}"`,
            `"${t.national_id || ''}"`, 
            `"${t.phone || ''}"`, 
            `"${t.card_number || ''}"`,
            `"${t.iban || ''}"`, 
            paymentRial
        ].join(',');
    });
    
    // Add UTF-8 BOM so Excel opens Persian text correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bank_export_${formatJalali(getTodayJalali()).replace(/\//g,'-')}.csv`;
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    showToast('فایل اکسل بانکی با موفقیت دانلود شد', 'success');
};

window.sendGroupSms = function() {
    const text = document.getElementById('modal-sms-text')?.value || '';
    
    // Extract phone numbers of selected users
    const phones = state.typists
        .filter(t => state.selectedTypistIds.has(t.id))
        .map(t => t.phone)
        .join(',');
        
    if (!phones) {
        showToast('لطفا ابتدا کاربران مورد نظر را از لیست انتخاب کنید', 'warning');
        return;
    }
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    
    window.location.href = `sms:${phones}${separator}body=${encodeURIComponent(text)}`;
    
    document.getElementById('modal-sms')?.classList.add('hidden');
};

// ==========================================
// 13. System Boot (Event Binding Wrapper)
// ==========================================
function attachAllEvents() {
    console.log("🛠 Binding all interactive events...");
    
    initTheme();
    document.getElementById('theme-toggle')?.addEventListener('click', window.toggleTheme);
    
    // Auth Navigation Tabs Logic
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
            
            if (fAdmin) fAdmin.classList.remove('hidden');
            if (fTypist) fTypist.classList.add('hidden');
        };
        
        tTypist.onclick = () => {
            tTypist.classList.add('text-blue-600', 'border-blue-600');
            tTypist.classList.remove('text-slate-500', 'border-transparent');
            
            tAdmin.classList.remove('text-blue-600', 'border-blue-600');
            tAdmin.classList.add('text-slate-500', 'border-transparent');
            
            if (fTypist) fTypist.classList.remove('hidden');
            if (fAdmin) fAdmin.classList.add('hidden');
        };
    }

    // Login Form Submission Events
    if (fAdmin) fAdmin.addEventListener('submit', (e) => window.handleLogin(e, 'admin'));
    if (fTypist) fTypist.addEventListener('submit', (e) => window.handleLogin(e, 'typist'));
    
    document.getElementById('btn-logout')?.addEventListener('click', window.handleLogout);
    
    document.getElementById('btn-open-change-password')?.addEventListener('click', () => {
        document.getElementById('form-change-password')?.reset();
        document.getElementById('modal-password')?.classList.remove('hidden');
    });

    // Dashboard Interactivity
    document.getElementById('dashboard-search')?.addEventListener('input', (e) => {
        state.searchQuery = e.target.value; 
        renderDashboard();
    });
    
    document.getElementById('select-all-typists')?.addEventListener('change', (e) => {
        window.selectAllTypists(e.target.checked);
    });
    
    document.getElementById('btn-export-excel')?.addEventListener('click', window.exportBankCsv);
    
    document.getElementById('btn-group-sms')?.addEventListener('click', () => {
        if(state.selectedTypistIds.size === 0) {
            showToast('لطفا حداقل یک نفر را انتخاب کنید', 'warning');
            return;
        }
        updateSmsCount();
        document.getElementById('modal-sms')?.classList.remove('hidden');
    });
    
    document.getElementById('btn-open-add-typist')?.addEventListener('click', () => {
        document.getElementById('form-typist')?.reset();
        const idInput = document.getElementById('modal-typist-id');
        if (idInput) idInput.value = '';
        document.getElementById('modal-typist')?.classList.remove('hidden');
    });

    // Detail View Actions
    document.getElementById('btn-back-to-dashboard')?.addEventListener('click', showDashboardView);
    
    document.getElementById('btn-open-add-report')?.addEventListener('click', () => {
        document.getElementById('form-report')?.reset();
        const dInput = document.getElementById('modal-report-date');
        if(dInput) dInput.value = formatJalali(getTodayJalali());
        document.getElementById('modal-report')?.classList.remove('hidden');
    });
    
    document.getElementById('btn-open-add-payment')?.addEventListener('click', () => {
        document.getElementById('form-payment')?.reset();
        const pInput = document.getElementById('modal-payment-date');
        if(pInput) pInput.value = formatJalali(getTodayJalali());
        document.getElementById('modal-payment')?.classList.remove('hidden');
    });
    
    document.getElementById('btn-open-edit-profile')?.addEventListener('click', () => {
        document.getElementById('modal-typist')?.classList.remove('hidden');
    });

    // Form Submissions
    document.getElementById('form-typist')?.addEventListener('submit', window.submitTypistForm);
    document.getElementById('form-report')?.addEventListener('submit', window.submitReportForm);
    document.getElementById('form-payment')?.addEventListener('submit', window.submitPaymentForm);
    document.getElementById('form-change-password')?.addEventListener('submit', window.submitChangePassword);
    
    document.getElementById('btn-send-sms-confirm')?.addEventListener('click', window.sendGroupSms);

    // Global Modal Closure Engine
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.fixed.inset-0');
            if (modal) modal.classList.add('hidden');
        });
    });

    // Datepicker Connections
    document.querySelectorAll('.btn-trigger-datepicker').forEach(btn => {
        btn.addEventListener('click', (e) => {
            openDatePicker(e.target.dataset.target);
        });
    });

    // Datepicker UI Controls
    document.getElementById('dp-prev-month')?.addEventListener('click', () => {
        if (!state.currentPickerDate) return;
        if (state.currentPickerDate.jm > 1) {
            state.currentPickerDate.jm--;
        } else { 
            state.currentPickerDate.jm = 12; 
            state.currentPickerDate.jy--; 
        }
        renderDatePicker();
    });
    
    document.getElementById('dp-next-month')?.addEventListener('click', () => {
        if (!state.currentPickerDate) return;
        if (state.currentPickerDate.jm < 12) {
            state.currentPickerDate.jm++;
        } else { 
            state.currentPickerDate.jm = 1; 
            state.currentPickerDate.jy++; 
        }
        renderDatePicker();
    });
    
    document.getElementById('dp-select-month')?.addEventListener('change', (e) => {
        if (state.currentPickerDate) { 
            state.currentPickerDate.jm = parseInt(e.target.value); 
            renderDatePicker(); 
        }
    });
    
    document.getElementById('dp-select-year')?.addEventListener('change', (e) => {
        if (state.currentPickerDate) { 
            state.currentPickerDate.jy = parseInt(e.target.value); 
            renderDatePicker(); 
        }
    });
    
    document.getElementById('dp-btn-today')?.addEventListener('click', () => {
        state.currentPickerDate = getTodayJalali();
        renderDatePicker();
    });
    
    console.log("✅ All UI events bound and active.");
}

// Ensure DOM is fully parsed before executing logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAllEvents);
} else {
    attachAllEvents();
}

const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


let supabase = null;
if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
    activeTab: 'admin', // 'admin' | 'typist' for login tab
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
    
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);
    
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

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeToggleUI();
}

function updateThemeToggleUI() {
    const isDark = document.documentElement.classList.contains('dark');
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun text-amber-400' : 'fas fa-moon text-indigo-600';
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
    const jy = parseInt(parts[0]);
    const jm = parseInt(parts[1]);
    const jd = parseInt(parts[2]);
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
    return { jy, jm, jd };
}

// Calculate days status for delivery timer badge
function getDeliveryTimerBadge(deliveryDateStr) {
    if (!deliveryDateStr) return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">تعریف نشده</span>`;
    
    const jObj = parseJalali(deliveryDateStr);
    if (!jObj) return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">نامعتبر</span>`;
    
    const targetDate = jalaliToGregorian(jObj.jy, jObj.jm, jObj.jd);
    const today = new Date();
    today.setHours(0,0,0,0);
    targetDate.setHours(0,0,0,0);
    
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
        return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><i class="fas fa-clock me-1"></i>${diffDays} روز باقی‌مانده</span>`;
    } else if (diffDays === 0) {
        return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><i class="fas fa-exclamation-triangle me-1"></i>امروز موعد تحویل</span>`;
    } else {
        return `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><i class="fas fa-exclamation-circle me-1"></i>${Math.abs(diffDays)} روز تأخیر</span>`;
    }
}

// --- DatePicker Modal UI ---
const monthNamesPersian = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

function openDatePicker(currentValueStr, onSelectCallback) {
    state.datePickerCallback = onSelectCallback;
    let initialJalali = parseJalali(currentValueStr) || getTodayJalali();
    state.currentPickerDate = { jy: initialJalali.jy, jm: initialJalali.jm };
    
    renderDatePicker();
    const modal = document.getElementById('datepicker-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeDatePicker() {
    const modal = document.getElementById('datepicker-modal');
    if (modal) modal.classList.add('hidden');
    state.datePickerCallback = null;
}

function renderDatePicker() {
    const { jy, jm } = state.currentPickerDate;
    
    const yearSelect = document.getElementById('dp-year-select');
    const monthSelect = document.getElementById('dp-month-select');
    
    if (yearSelect && monthSelect) {
        yearSelect.innerHTML = '';
        for (let y = 1400; y <= 1410; y++) {
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
    
    // Calculate days count
    let daysCount = 30;
    if (jm <= 6) daysCount = 31;
    else if (jm <= 11) daysCount = 30;
    else daysCount = isPersianLeapYear(jy) ? 30 : 29;
    
    // Day 1 Day-of-week calculation (0: Sun ... 6: Sat)
    const firstDayGreg = jalaliToGregorian(jy, jm, 1);
    let startDayOfWeek = (firstDayGreg.getDay() + 1) % 7; // Convert to Persian week (Sat: 0, Sun: 1, ...)
    
    const grid = document.getElementById('dp-days-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Empty slots for padding
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'h-9';
        grid.appendChild(emptyCell);
    }
    
    const todayJalali = getTodayJalali();
    
    for (let d = 1; d <= daysCount; d++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isToday = (todayJalali.jy === jy && todayJalali.jm === jm && todayJalali.jd === d);
        
        btn.className = `h-9 w-9 mx-auto rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
            isToday ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-300 dark:border-indigo-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
        }`;
        btn.textContent = d;
        btn.onclick = () => {
            const selectedStr = formatJalali({ jy, jm, jd: d });
            if (state.datePickerCallback) {
                state.datePickerCallback(selectedStr);
            }
            closeDatePicker();
        };
        grid.appendChild(btn);
    }
}

// --- Navigation & View Switching ---
function showView(viewId) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    
    // Control elements visibility by role
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    const typistOnlyElements = document.querySelectorAll('.typist-only');
    
    if (state.currentUser && state.currentUser.role === 'admin') {
        adminOnlyElements.forEach(el => el.classList.remove('hidden'));
        typistOnlyElements.forEach(el => el.classList.add('hidden'));
    } else if (state.currentUser && state.currentUser.role === 'typist') {
        adminOnlyElements.forEach(el => el.classList.add('hidden'));
        typistOnlyElements.forEach(el => el.classList.remove('hidden'));
    }
}

// --- Authentication ---
async function handleLogin(e) {
    e.preventDefault();
    if (!supabase) {
        showToast('خطا در اتصال به دیتابیس Supabase', 'error');
        return;
    }
    
    const btn = document.getElementById('login-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>در حال ورود...'; }
    
    try {
        if (state.activeTab === 'admin') {
            const pwd = toEnglishDigits(document.getElementById('admin-password-input').value);
            const { data, error } = await supabase.rpc('verify_admin_password', { p_password: pwd });
            
            if (error) throw error;
            if (data && data.success) {
                state.currentUser = { role: 'admin', name: 'مدیر سیستم', typistId: null };
                showToast('با موفقیت وارد شدید', 'success');
                showDashboardView();
            } else {
                showToast(data?.message || 'رمز عبور مدیر اشتباه است', 'error');
            }
        } else {
            const identifier = toEnglishDigits(document.getElementById('typist-identifier-input').value);
            const pwd = toEnglishDigits(document.getElementById('typist-password-input').value);
            
            if (!identifier) {
                showToast('لطفا کد ملی یا شماره همراه را وارد کنید', 'warning');
                return;
            }
            
            const { data, error } = await supabase.rpc('verify_typist_password', {
                p_identifier: identifier,
                p_password: pwd
            });
            
            if (error) throw error;
            if (data && data.success) {
                state.currentUser = {
                    role: 'typist',
                    name: `${data.typist.first_name || ''} ${data.typist.last_name || ''}`,
                    typistId: data.typist.id
                };
                showToast(`خوش آمدید، ${state.currentUser.name}`, 'success');
                showTypistDetailView(data.typist.id);
            } else {
                showToast(data?.message || 'شناسه یا رمز عبور اشتباه است', 'error');
            }
        }
    } catch (err) {
        console.error('Login Error:', err);
        showToast('خطا در ارتباط با سرور: ' + (err.message || err), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'ورود به سامانه'; }
    }
}

function handleLogout() {
    state.currentUser = null;
    state.currentTypistId = null;
    document.getElementById('login-form').reset();
    showView('login-view');
    showToast('از سامانه خارج شدید', 'info');
}

// --- Dashboard View (Admin) ---
async function showDashboardView() {
    showView('dashboard-view');
    await loadDashboardData();
}

async function loadDashboardData() {
    if (!supabase) return;
    try {
        const { data, error } = await supabase.rpc('get_dashboard_summary');
        if (error) throw error;
        
        state.typists = data || [];
        renderDashboard();
    } catch (err) {
        console.error('Fetch Dashboard Error:', err);
        showToast('خطا در دریافت اطلاعات دیتابیس: ' + err.message, 'error');
    }
}

function renderDashboard() {
    const container = document.getElementById('typists-list-container');
    if (!container) return;
    
    let filtered = state.typists.filter(t => {
        const fullName = `${t.first_name || ''} ${t.last_name || ''}`.toLowerCase();
        const nationalId = (t.national_id || '').toLowerCase();
        const phone = (t.phone || '').toLowerCase();
        const q = state.searchQuery.toLowerCase();
        return fullName.includes(q) || nationalId.includes(q) || phone.includes(q);
    });
    
    // Update Summaries
    let grandTotalEarnings = 0;
    let grandTotalPaid = 0;
    state.typists.forEach(t => {
        grandTotalEarnings += Number(t.total_earnings || 0);
        grandTotalPaid += Number(t.total_paid || 0);
    });
    
    const countEl = document.getElementById('stat-total-typists');
    const earningsEl = document.getElementById('stat-total-earnings');
    const paidEl = document.getElementById('stat-total-paid');
    const remainingEl = document.getElementById('stat-total-remaining');
    
    if (countEl) countEl.textContent = state.typists.length.toLocaleString('fa-IR');
    if (earningsEl) earningsEl.textContent = grandTotalEarnings.toLocaleString('fa-IR') + ' تومان';
    if (paidEl) paidEl.textContent = grandTotalPaid.toLocaleString('fa-IR') + ' تومان';
    if (remainingEl) remainingEl.textContent = (grandTotalEarnings - grandTotalPaid).toLocaleString('fa-IR') + ' تومان';

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400">
                <i class="fas fa-users-slash text-4xl mb-3 block"></i>
                <p class="font-medium">هیچ تایپیستی پیدا نشد</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((t, idx) => {
        const fullName = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'بدون نام';
        const isChecked = state.selectedTypistIds.has(t.id);
        const timerBadge = getDeliveryTimerBadge(t.delivery_date);
        const remaining = Number(t.remaining_balance || 0);
        
        return `
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-200">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" onchange="toggleSelectTypist('${t.id}')" ${isChecked ? 'checked' : ''} 
                            class="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 text-lg">${fullName}</h3>
                                ${timerBadge}
                            </div>
                            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <span><i class="far fa-id-card me-1"></i>${t.national_id || '---'}</span>
                                <span><i class="fas fa-phone me-1"></i>${t.phone || '---'}</span>
                                ${state.currentUser.role === 'admin' ? `<span><i class="fas fa-file-invoice me-1"></i>نرخ صفحه: ${(Number(t.page_rate) || 0).toLocaleString('fa-IR')} تومان</span>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                        <div class="text-start md:text-left me-2">
                            <span class="text-xs text-slate-400 block">مانده حساب</span>
                            <span class="font-extrabold ${remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} text-base">
                                ${Math.abs(remaining).toLocaleString('fa-IR')} تومان ${remaining < 0 ? '(طلبکار)' : ''}
                            </span>
                        </div>
                        
                        <!-- Quick Call & SMS Buttons -->
                        <div class="flex items-center gap-1.5">
                            <a href="tel:${t.phone}" title="تماس تلفنی" class="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center">
                                <i class="fas fa-phone"></i>
                            </a>
                            <a href="sms:${t.phone}" title="ارسال پیامک" class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center">
                                <i class="fas fa-comment-alt"></i>
                            </a>
                            <button onclick="showTypistDetailView('${t.id}')" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5 me-1">
                                <i class="fas fa-user-gear"></i>
                                <span>مدیریت و جزئیات</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleSelectTypist(id) {
    if (state.selectedTypistIds.has(id)) {
        state.selectedTypistIds.delete(id);
    } else {
        state.selectedTypistIds.add(id);
    }
}

function selectAllTypists(e) {
    if (e.target.checked) {
        state.typists.forEach(t => state.selectedTypistIds.add(t.id));
    } else {
        state.selectedTypistIds.clear();
    }
    renderDashboard();
}

function openGroupSmsModal() {
    if (state.selectedTypistIds.size === 0) {
        showToast('لطفا حداقل یک تایپیست را انتخاب کنید', 'warning');
        return;
    }
    const modal = document.getElementById('group-sms-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeGroupSmsModal() {
    const modal = document.getElementById('group-sms-modal');
    if (modal) modal.classList.add('hidden');
}

function sendGroupSms() {
    const bodyText = document.getElementById('sms-body-input').value;
    const selectedTypists = state.typists.filter(t => state.selectedTypistIds.has(t.id));
    const phones = selectedTypists.map(t => t.phone).filter(p => !!p).join(',');
    
    if (!phones) {
        showToast('شماره تلفن معتبری یافت نشد', 'error');
        return;
    }
    
    // Open native SMS URI scheme
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    const smsUrl = `sms:${phones}${separator}body=${encodeURIComponent(bodyText)}`;
    
    window.location.href = smsUrl;
    closeGroupSmsModal();
}

// --- Detail View (Single Typist) ---
async function showTypistDetailView(typistId) {
    state.currentTypistId = typistId;
    showView('detail-view');
    await loadTypistDetail(typistId);
}

async function loadTypistDetail(typistId) {
    if (!supabase) return;
    try {
        const { data, error } = await supabase.rpc('get_typist_detail', { p_typist_id: typistId });
        if (error) throw error;
        
        if (data && data.success && data.typist) {
            renderTypistDetail(data);
        } else {
            showToast(data?.message || 'اطلاعات تایپیست یافت نشد', 'error');
        }
    } catch (err) {
        console.error('Fetch Detail Error:', err);
        showToast('خطا در دریافت جزئیات تایپیست: ' + (err.message || err), 'error');
    }
}

function renderTypistDetail(data) {
    const typist = data.typist || {};
    const fullName = `${typist.first_name || ''} ${typist.last_name || ''}`.trim() || 'بدون نام';
    
    // Header Info
    const nameEl = document.getElementById('detail-typist-name');
    if (nameEl) nameEl.textContent = fullName;
    
    const badgeContainer = document.getElementById('detail-timer-badge-container');
    if (badgeContainer) badgeContainer.innerHTML = getDeliveryTimerBadge(typist.delivery_date);
    
    // Form pre-fill
    document.getElementById('edit-first-name').value = typist.first_name || '';
    document.getElementById('edit-last-name').value = typist.last_name || '';
    document.getElementById('edit-father-name').value = typist.father_name || '';
    document.getElementById('edit-national-id').value = typist.national_id || '';
    document.getElementById('edit-phone').value = typist.phone || '';
    document.getElementById('edit-card-number').value = typist.card_number || '';
    document.getElementById('edit-iban').value = typist.iban || '';
    
    const pageRateInput = document.getElementById('edit-page-rate');
    if (pageRateInput) pageRateInput.value = typist.page_rate || 0;
    
    document.getElementById('edit-delivery-date').value = typist.delivery_date || '';

    // Summary Cards
    const totalEarningsEl = document.getElementById('detail-total-earnings');
    const totalPaidEl = document.getElementById('detail-total-paid');
    const remainingEl = document.getElementById('detail-remaining-balance');
    
    const earnings = Number(data.total_earnings || 0);
    const paid = Number(data.total_paid || 0);
    const remaining = Number(data.remaining_balance || 0);
    
    if (totalEarningsEl) totalEarningsEl.textContent = earnings.toLocaleString('fa-IR') + ' تومان';
    if (totalPaidEl) totalPaidEl.textContent = paid.toLocaleString('fa-IR') + ' تومان';
    if (remainingEl) remainingEl.textContent = Math.abs(remaining).toLocaleString('fa-IR') + ' تومان' + (remaining < 0 ? ' (طلبکار)' : '');

    // Render Tables
    renderReportsTable(data.reports || []);
    renderPaymentsTable(data.payments || []);
}

function renderReportsTable(reports) {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;
    
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">هیچ کارکردی ثبت نشده است</td></tr>`;
        return;
    }
    
    const isAdmin = state.currentUser.role === 'admin';
    
    tbody.innerHTML = reports.map((r, i) => {
        const pages = Number(r.page_count || 0);
        const rate = Number(r.rate || 0);
        const total = Number(r.total_amount || 0);
        
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800">
                <td class="py-3 px-4 font-medium">${(i + 1).toLocaleString('fa-IR')}</td>
                <td class="py-3 px-4">${r.report_date || '---'}</td>
                <td class="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">${pages.toLocaleString('fa-IR')} صفحه</td>
                ${isAdmin ? `<td class="py-3 px-4">${rate.toLocaleString('fa-IR')} تومان</td>` : ''}
                ${isAdmin ? `<td class="py-3 px-4 font-extrabold text-slate-800 dark:text-slate-200">${total.toLocaleString('fa-IR')} تومان</td>` : ''}
                <td class="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">${r.description || '---'}</td>
                <td class="py-3 px-4">
                    <button onclick="deleteReport('${r.id}')" class="text-rose-500 hover:text-rose-700 p-1 transition-colors" title="حذف">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Hide rate column header if typist
    const thRate = document.getElementById('th-report-rate');
    const thTotal = document.getElementById('th-report-total');
    if (thRate) thRate.style.display = isAdmin ? '' : 'none';
    if (thTotal) thTotal.style.display = isAdmin ? '' : 'none';
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;
    
    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">هیچ پرداختی ثبت نشده است</td></tr>`;
        return;
    }
    
    const isAdmin = state.currentUser.role === 'admin';
    
    tbody.innerHTML = payments.map((p, i) => {
        const amount = Number(p.amount || 0);
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800">
                <td class="py-3 px-4 font-medium">${(i + 1).toLocaleString('fa-IR')}</td>
                <td class="py-3 px-4">${p.payment_date || '---'}</td>
                <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">${amount.toLocaleString('fa-IR')} تومان</td>
                <td class="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">${p.description || '---'}</td>
                ${isAdmin ? `
                <td class="py-3 px-4">
                    <button onclick="deletePayment('${p.id}')" class="text-rose-500 hover:text-rose-700 p-1 transition-colors" title="حذف">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>` : '<td></td>'}
            </tr>
        `;
    }).join('');
}

// --- CRUD Actions ---
async function saveTypistProfile(e) {
    if (e) e.preventDefault();
    if (!supabase || !state.currentTypistId) return;
    
    const payload = {
        p_id: state.currentTypistId,
        p_first_name: document.getElementById('edit-first-name').value,
        p_last_name: document.getElementById('edit-last-name').value,
        p_father_name: document.getElementById('edit-father-name').value,
        p_national_id: toEnglishDigits(document.getElementById('edit-national-id').value),
        p_phone: toEnglishDigits(document.getElementById('edit-phone').value),
        p_card_number: toEnglishDigits(document.getElementById('edit-card-number').value),
        p_iban: toEnglishDigits(document.getElementById('edit-iban').value),
        p_page_rate: Number(toEnglishDigits(document.getElementById('edit-page-rate')?.value || 0)),
        p_delivery_date: document.getElementById('edit-delivery-date').value
    };
    
    try {
        const { data, error } = await supabase.rpc('upsert_typist', payload);
        if (error) throw error;
        
        showToast('اطلاعات پروفایل با موفقیت به‌روزرسانی شد', 'success');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        console.error('Save Profile Error:', err);
        showToast('خطا در ذخیره پروفایل: ' + err.message, 'error');
    }
}

function openAddTypistModal() {
    document.getElementById('add-typist-form').reset();
    const modal = document.getElementById('add-typist-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddTypistModal() {
    const modal = document.getElementById('add-typist-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAddTypistSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    
    const payload = {
        p_id: null, // Create New
        p_first_name: document.getElementById('add-first-name').value,
        p_last_name: document.getElementById('add-last-name').value,
        p_father_name: document.getElementById('add-father-name').value,
        p_national_id: toEnglishDigits(document.getElementById('add-national-id').value),
        p_phone: toEnglishDigits(document.getElementById('add-phone').value),
        p_card_number: toEnglishDigits(document.getElementById('add-card-number').value),
        p_iban: toEnglishDigits(document.getElementById('add-iban').value),
        p_page_rate: Number(toEnglishDigits(document.getElementById('add-page-rate').value || 0)),
        p_delivery_date: document.getElementById('add-delivery-date').value
    };
    
    try {
        const { data, error } = await supabase.rpc('upsert_typist', payload);
        if (error) throw error;
        
        showToast('تایپیست جدید با موفقیت اضافه شد', 'success');
        closeAddTypistModal();
        loadDashboardData();
    } catch (err) {
        console.error('Add Typist Error:', err);
        showToast('خطا در افزودن تایپیست: ' + err.message, 'error');
    }
}

// Add Report Modal
function openAddReportModal() {
    const form = document.getElementById('add-report-form');
    if (form) form.reset();
    
    // Set default date to today
    const dateInput = document.getElementById('report-date-input');
    if (dateInput) dateInput.value = formatJalali(getTodayJalali());
    
    const modal = document.getElementById('add-report-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddReportModal() {
    const modal = document.getElementById('add-report-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAddReportSubmit(e) {
    e.preventDefault();
    if (!supabase || !state.currentTypistId) return;
    
    const pageCount = Number(toEnglishDigits(document.getElementById('report-page-count').value));
    const reportDate = document.getElementById('report-date-input').value;
    const desc = document.getElementById('report-desc').value;
    
    if (!pageCount || pageCount <= 0) {
        showToast('لطفاً تعداد صفحات معتبر وارد کنید', 'warning');
        return;
    }
    
    try {
        const { data, error } = await supabase.rpc('add_typist_report', {
            p_typist_id: state.currentTypistId,
            p_page_count: pageCount,
            p_report_date: reportDate,
            p_description: desc
        });
        
        if (error) throw error;
        
        showToast('کارکرد با موفقیت ثبت شد', 'success');
        closeAddReportModal();
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        console.error('Add Report Error:', err);
        showToast('خطا در ثبت کارکرد: ' + err.message, 'error');
    }
}

async function deleteReport(reportId) {
    if (!confirm('آیا از حذف این کارکرد اطمینان دارید؟')) return;
    try {
        const { data, error } = await supabase.rpc('delete_typist_report', { p_report_id: reportId });
        if (error) throw error;
        showToast('کارکرد حذف شد', 'info');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در حذف کارکرد: ' + err.message, 'error');
    }
}

// Add Payment Modal (Admin Only)
function openAddPaymentModal() {
    const form = document.getElementById('add-payment-form');
    if (form) form.reset();
    
    const dateInput = document.getElementById('payment-date-input');
    if (dateInput) dateInput.value = formatJalali(getTodayJalali());
    
    const modal = document.getElementById('add-payment-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAddPaymentModal() {
    const modal = document.getElementById('add-payment-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleAddPaymentSubmit(e) {
    e.preventDefault();
    if (!supabase || !state.currentTypistId) return;
    
    const amount = Number(toEnglishDigits(document.getElementById('payment-amount-input').value));
    const paymentDate = document.getElementById('payment-date-input').value;
    const desc = document.getElementById('payment-desc-input').value;
    
    if (!amount || amount <= 0) {
        showToast('لطفاً مبلغ معتبر وارد کنید', 'warning');
        return;
    }
    
    try {
        const { data, error } = await supabase.rpc('add_payment', {
            p_typist_id: state.currentTypistId,
            p_amount: amount,
            p_payment_date: paymentDate,
            p_description: desc
        });
        
        if (error) throw error;
        
        showToast('پرداختی با موفقیت ثبت شد', 'success');
        closeAddPaymentModal();
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        console.error('Add Payment Error:', err);
        showToast('خطا در ثبت پرداخت: ' + err.message, 'error');
    }
}

async function deletePayment(paymentId) {
    if (!confirm('آیا از حذف این پرداختی اطمینان دارید؟')) return;
    try {
        const { data, error } = await supabase.rpc('delete_payment', { p_payment_id: paymentId });
        if (error) throw error;
        showToast('پرداختی حذف شد', 'info');
        loadTypistDetail(state.currentTypistId);
    } catch (err) {
        showToast('خطا در حذف پرداخت: ' + err.message, 'error');
    }
}

// Password Change Modal
function openChangePasswordModal() {
    document.getElementById('change-password-form').reset();
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    
    const oldPwd = toEnglishDigits(document.getElementById('old-password-input').value);
    const newPwd = toEnglishDigits(document.getElementById('new-password-input').value);
    
    if (!newPwd || newPwd.length < 4) {
        showToast('رمز عبور جدید باید حداقل ۴ کاراکتر باشد', 'warning');
        return;
    }
    
    try {
        let res;
        if (state.currentUser.role === 'admin') {
            res = await supabase.rpc('change_admin_password', {
                p_old_password: oldPwd,
                p_new_password: newPwd
            });
        } else {
            res = await supabase.rpc('change_typist_password', {
                p_typist_id: state.currentUser.typistId,
                p_old_password: oldPwd,
                p_new_password: newPwd
            });
        }
        
        if (res.error) throw res.error;
        if (res.data && res.data.success) {
            showToast('رمز عبور با موفقیت تغییر کرد', 'success');
            closeChangePasswordModal();
        } else {
            showToast(res.data?.message || 'رمز عبور فعلی اشتباه است', 'error');
        }
    } catch (err) {
        console.error('Change Password Error:', err);
        showToast('خطا در تغییر رمز عبور: ' + err.message, 'error');
    }
}

// --- Bank Payment CSV/Excel Export (Rial Calculation) ---
function exportBankCsv() {
    if (state.typists.length === 0) {
        showToast('اطلاعاتی برای خروجی وجود ندارد', 'warning');
        return;
    }
    
    // Headers: ردیف, نام, نام خانوادگی, نام پدر, کد ملی, شماره تماس, شماره کارت, شماره شبا, مبلغ پرداختی به ریال
    const headers = ['ردیف', 'نام', 'نام خانوادگی', 'نام پدر', 'کد ملی', 'شماره تماس', 'شماره کارت', 'شماره شبا', 'مبلغ پرداختی به ریال'];
    
    const rows = state.typists.map((t, index) => {
        const remainingToman = Number(t.remaining_balance || 0);
        // Calculation: Remaining balance (Toman) * 10 = Amount in Rial
        const amountRial = remainingToman > 0 ? remainingToman * 10 : 0;
        
        return [
            index + 1,
            `"${(t.first_name || '').replace(/"/g, '""')}"`,
            `"${(t.last_name || '').replace(/"/g, '""')}"`,
            `"${(t.father_name || '').replace(/"/g, '""')}"`,
            `"${t.national_id || ''}"`,
            `"${t.phone || ''}"`,
            `"${t.card_number || ''}"`,
            `"${t.iban || ''}"`,
            amountRial
        ].join(',');
    });
    
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bank_payments_${formatJalali(getTodayJalali()).replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('فایل اکسل/CSV بانک با موفقیت دانلود شد', 'success');
}

// --- Initialize Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Global Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    
    // Auth Tab Switching
    const tabAdmin = document.getElementById('tab-admin-login');
    const tabTypist = document.getElementById('tab-typist-login');
    const fieldAdmin = document.getElementById('field-admin-password');
    const fieldTypist = document.getElementById('field-typist-inputs');
    
    if (tabAdmin && tabTypist) {
        tabAdmin.addEventListener('click', () => {
            state.activeTab = 'admin';
            tabAdmin.classList.add('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
            tabAdmin.classList.remove('border-transparent', 'text-slate-400');
            tabTypist.classList.remove('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
            tabTypist.classList.add('border-transparent', 'text-slate-400');
            fieldAdmin.classList.remove('hidden');
            fieldTypist.classList.add('hidden');
        });
        
        tabTypist.addEventListener('click', () => {
            state.activeTab = 'typist';
            tabTypist.classList.add('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
            tabTypist.classList.remove('border-transparent', 'text-slate-400');
            tabAdmin.classList.remove('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
            tabAdmin.classList.add('border-transparent', 'text-slate-400');
            fieldTypist.classList.remove('hidden');
            fieldAdmin.classList.add('hidden');
        });
    }

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Search Dashboard
    const searchInput = document.getElementById('search-typists-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderDashboard();
        });
    }
    
    // Edit Typist Form Submit
    const editForm = document.getElementById('edit-typist-form');
    if (editForm) editForm.addEventListener('submit', saveTypistProfile);
    
    // Add Typist Form Submit
    const addTypistForm = document.getElementById('add-typist-form');
    if (addTypistForm) addTypistForm.addEventListener('submit', handleAddTypistSubmit);
    
    // Add Report Form Submit
    const addReportForm = document.getElementById('add-report-form');
    if (addReportForm) addReportForm.addEventListener('submit', handleAddReportSubmit);

    // Add Payment Form Submit
    const addPaymentForm = document.getElementById('add-payment-form');
    if (addPaymentForm) addPaymentForm.addEventListener('submit', handleAddPaymentSubmit);
    
    // Change Password Form Submit
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', handleChangePasswordSubmit);

    // DatePicker Navigation
    const dpPrevMonth = document.getElementById('dp-prev-month');
    const dpNextMonth = document.getElementById('dp-next-month');
    
    if (dpPrevMonth) {
        dpPrevMonth.onclick = () => {
            if (state.currentPickerDate.jm > 1) {
                state.currentPickerDate.jm--;
            } else {
                state.currentPickerDate.jm = 12;
                state.currentPickerDate.jy--;
            }
            renderDatePicker();
        };
    }
    
    if (dpNextMonth) {
        dpNextMonth.onclick = () => {
            if (state.currentPickerDate.jm < 12) {
                state.currentPickerDate.jm++;
            } else {
                state.currentPickerDate.jm = 1;
                state.currentPickerDate.jy++;
            }
            renderDatePicker();
        };
    }
    
    const dpYearSelect = document.getElementById('dp-year-select');
    const dpMonthSelect = document.getElementById('dp-month-select');
    
    if (dpYearSelect) {
        dpYearSelect.onchange = (e) => {
            state.currentPickerDate.jy = parseInt(e.target.value);
            renderDatePicker();
        };
    }
    
    if (dpMonthSelect) {
        dpMonthSelect.onchange = (e) => {
            state.currentPickerDate.jm = parseInt(e.target.value);
            renderDatePicker();
        };
    }
});

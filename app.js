
// ==========================================
// ۱. ثبت توابع سراسری روی window (جهت رفع ReferenceError)
// ==========================================
window.showLoginModal = function() {
    const modal = document.getElementById('loginModal') || document.getElementById('typistLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        const sec = document.getElementById('loginSection');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal') || document.getElementById('typistLoginModal');
    if (modal) modal.classList.add('hidden');
};

// ==========================================
// ۲. تنظیمات اتصال به دیتابیس Supabase
// ==========================================

const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// متغیرهای وضعیت جاری برنامه (State)
let currentTypist = null;
let isAdmin = false;
let allTypists = [];
let allReports = [];
let allPayments = [];
let calendarTargetInput = null;

// ==========================================
// ۳. کتابخانه محاسبات تقویم شمسی جلالی
// ==========================================
const Jalali = {
    toJalaali(gy, gm, gd) {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy = (gy <= 1600) ? 0 : 979;
        gy -= (gy <= 1600) ? 621 : 1600;
        const gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) 
                 + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
        jy += 33 * Math.floor(days / 12053);
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        jy += Math.floor((days - 1) / 365);
        if (days > 0) days = (days - 1) % 365;
        const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
        const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
        return { jy, jm, jd };
    },

    toGregorian(jy, jm, jd) {
        let gy = (jy <= 979) ? 621 : 1600;
        jy -= (jy <= 979) ? 0 : 979;
        let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) 
                 + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
        gy += 400 * Math.floor(days / 146097);
        days %= 146097;
        if (days > 36524) {
            gy += 100 * Math.floor(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        gy += Math.floor((days - 1) / 365);
        if (days > 0) days = (days - 1) % 365;
        const gd = days + 1;
        const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let gm = 0;
        while (gm < 13 && days >= sal_a[gm]) {
            days -= sal_a[gm];
            gm++;
        }
        return { gy, gm, gd: days + 1 };
    },

    todayString() {
        const now = new Date();
        const j = this.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
    },

    parse(str) {
        if (!str) return null;
        const parts = String(str).trim().split('/').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return { jy: parts[0], jm: parts[1], jd: parts[2] };
    },

    formatDate(dateObj) {
        if (!dateObj) return '-';
        const d = new Date(dateObj);
        if (isNaN(d.getTime())) return '-';
        const j = this.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
    },

    daysBetween(jDateStr1, jDateStr2) {
        const d1 = this.parse(jDateStr1);
        const d2 = this.parse(jDateStr2);
        if (!d1 || !d2) return 0;
        const g1 = this.toGregorian(d1.jy, d1.jm, d1.jd);
        const g2 = this.toGregorian(d2.jy, d2.jm, d2.jd);
        const dt1 = new Date(g1.gy, g1.gm - 1, g1.gd);
        const dt2 = new Date(g2.gy, g2.gm - 1, g2.gd);
        return Math.floor((dt2 - dt1) / (1000 * 60 * 60 * 24));
    }
};

// ==========================================
// ۴. موتور تایم‌لاین ۱۰ روزه و وضعیت تاخیر
// ==========================================
function calculatePeriodTimeline(typist, reports) {
    const today = Jalali.todayString();
    const startDate = typist.delivery_date || today;

    const typistReports = reports
        .filter(r => r.typist_id === typist.id)
        .sort((a, b) => (Number(a.period) || 0) - (Number(b.period) || 0));

    const highestSubmittedPeriod = typistReports.length > 0 
        ? Math.max(...typistReports.map(r => Number(r.period) || 0)) 
        : 0;

    const activePeriod = highestSubmittedPeriod + 1;

    let lastCheckpointDate = startDate;
    if (typistReports.length > 0) {
        const lastRep = typistReports[typistReports.length - 1];
        lastCheckpointDate = Jalali.formatDate(lastRep.created_at);
    }

    const daysSinceCheckpoint = Math.max(0, Jalali.daysBetween(lastCheckpointDate, today));
    const daysRemaining = 10 - daysSinceCheckpoint;
    const isLate = daysRemaining < 0;
    const delayDays = isLate ? Math.abs(daysRemaining) : 0;

    return {
        activePeriod,
        highestSubmittedPeriod,
        daysRemaining: Math.max(0, daysRemaining),
        isLate,
        delayDays,
        statusLabel: isLate 
            ? `⚠️ تاخیر در دوره ${activePeriod} (${delayDays} روز گذشته)` 
            : `⏳ دوره ${activePeriod} (${daysRemaining} روز مانده تا موعد ثبت)`
    };
}

// ==========================================
// ۵. مدیریت پاپ‌آپ تقویم شمسی جلالی
// ==========================================
let calYear = 1405;
let calMonth = 7;

window.openJalaliCalendar = function(inputElement) {
    calendarTargetInput = inputElement;
    const currentVal = inputElement.value ? Jalali.parse(inputElement.value) : null;
    const today = Jalali.parse(Jalali.todayString());
    
    calYear = currentVal ? currentVal.jy : today.jy;
    calMonth = currentVal ? currentVal.jm : today.jm;

    renderCalendarPopup();
    const modal = document.getElementById('jalaliCalendarModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeJalaliCalendar = function() {
    const modal = document.getElementById('jalaliCalendarModal');
    if (modal) modal.classList.add('hidden');
};

function renderCalendarPopup() {
    const titleElem = document.getElementById('calMonthYearTitle');
    const gridElem = document.getElementById('calDaysGrid');
    if (!titleElem || !gridElem) return;

    const monthNames = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    titleElem.innerText = `${monthNames[calMonth]} ${calYear}`;

    gridElem.innerHTML = '';
    const daysInMonth = (calMonth <= 6) ? 31 : (calMonth <= 11 ? 30 : 29);

    for (let day = 1; day <= daysInMonth; day++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p-2 text-sm rounded-lg hover:bg-emerald-600 hover:text-white transition-colors border border-gray-100 text-gray-700 font-medium';
        btn.innerText = day;
        btn.onclick = () => {
            if (calendarTargetInput) {
                const formatted = `${calYear}/${String(calMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
                calendarTargetInput.value = formatted;
            }
            window.closeJalaliCalendar();
        };
        gridElem.appendChild(btn);
    }
}

window.prevCalMonth = function() {
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendarPopup();
};

window.nextCalMonth = function() {
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    renderCalendarPopup();
};

// ==========================================
// ۶. ورود تایپیست و ورود مدیر
// ==========================================
window.handleTypistLogin = async function() {
    const nationalCode = (document.getElementById('loginNationalCode') || {}).value?.trim();
    const phone = (document.getElementById('loginPhone') || {}).value?.trim();

    if (!nationalCode || !phone) {
        alert('لطفاً کد ملی و شماره همراه خود را وارد نمایید.');
        return;
    }

    try {
        const { data, error } = await db
            .from('typists')
            .select('*')
            .eq('national_code', nationalCode)
            .eq('phone', phone)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            alert('مشخصات تایپیست در سامانه یافت نشد.');
            return;
        }

        currentTypist = data;
        isAdmin = false;
        window.closeLoginModal();
        showTypistDashboard();
    } catch (err) {
        console.error('خطای ورود تایپیست:', err);
        alert('خطا در ورود: ' + err.message);
    }
};

window.handleAdminLogin = async function() {
    const inputPass = prompt('رمز عبور مدیر را وارد نمایید:');
    if (!inputPass) return;

    try {
        const { data, error } = await db
            .from('app_settings')
            .select('value')
            .eq('key', 'admin_password')
            .maybeSingle();

        if (error) {
            console.error('Supabase error:', error);
            alert('خطای پایگاه داده: ' + error.message);
            return;
        }

        if (!data || !data.value) {
            alert('خطا: رکورد admin_password در جدول app_settings یافت نشد. لطفاً در دیتابیس مقداردهی کنید.');
            return;
        }

        if (data.value.toString().trim() === inputPass.trim()) {
            isAdmin = true;
            currentTypist = null;
            showAdminDashboard();
        } else {
            alert('رمز عبور مدیر اشتباه است!');
        }
    } catch (err) {
        console.error('خطا در ورود مدیر:', err);
        alert('خطای برنامه: ' + (err.message || 'نامشخص'));
    }
};


window.logout = function() {
    currentTypist = null;
    isAdmin = false;
    const typSec = document.getElementById('typistDashboardSection');
    const admSec = document.getElementById('adminDashboardSection');
    const logSec = document.getElementById('loginSection');
    
    if (typSec) typSec.classList.add('hidden');
    if (admSec) admSec.classList.add('hidden');
    if (logSec) logSec.classList.remove('hidden');
};

// ==========================================
// ۷. پنل تایپیست و ثبت کارکرد ۱۰ روزه
// ==========================================
async function showTypistDashboard() {
    const logSec = document.getElementById('loginSection');
    const admSec = document.getElementById('adminDashboardSection');
    const typSec = document.getElementById('typistDashboardSection');

    if (logSec) logSec.classList.add('hidden');
    if (admSec) admSec.classList.add('hidden');
    if (typSec) typSec.classList.remove('hidden');

    const nameElem = document.getElementById('typistHeaderName');
    if (nameElem && currentTypist) nameElem.innerText = currentTypist.name || 'همکار گرامی';
    await loadTypistData();
}

async function loadTypistData() {
    try {
        const { data: reports, error } = await db
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypist.id)
            .order('period', { ascending: false });

        if (error) throw error;
        const myReports = reports || [];

        const timeline = calculatePeriodTimeline(currentTypist, myReports);

        const timelineBox = document.getElementById('periodTimelineBox');
        if (timelineBox) {
            timelineBox.innerHTML = `
                <div class="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl border ${timeline.isLate ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">${timeline.isLate ? '⚠️' : '⏱️'}</span>
                        <div>
                            <div class="font-bold text-base">${timeline.statusLabel}</div>
                            <div class="text-xs text-gray-500 mt-1">تعداد دوره‌های تکمیل شده: ${timeline.highestSubmittedPeriod} دوره</div>
                        </div>
                    </div>
                    <div class="bg-white px-4 py-2 rounded-lg border text-sm font-semibold shadow-sm">
                        دوره قابل ثبت: <span class="text-blue-600 font-bold">دوره ${timeline.activePeriod}</span>
                    </div>
                </div>
            `;
        }

        const periodInput = document.getElementById('reportPeriodInput');
        if (periodInput) periodInput.value = timeline.activePeriod;

        const tbody = document.getElementById('typistReportsTbody');
        if (!tbody) return;

        if (myReports.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">هنوز کارکردی برای شما ثبت نشده است.</td></tr>`;
            return;
        }

        tbody.innerHTML = myReports.map(r => {
            const pages = Number(r.pages) || 0;
            const words = r.words ? Number(r.words).toLocaleString('fa-IR') : '-';
            const dateStr = r.created_at ? Jalali.formatDate(r.created_at) : '-';
            const periodNum = r.period || 1;
            const lateBadge = r.is_late 
                ? `<span class="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-normal mr-1">تاخیر (${r.delay_days} روز)</span>` 
                : `<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-normal mr-1">به‌موقع</span>`;

            return `
                <tr class="border-b hover:bg-gray-50 text-center">
                    <td class="py-3 font-semibold text-gray-800">دوره ${periodNum} ${lateBadge}</td>
                    <td class="py-3 text-emerald-600 font-bold">${pages.toLocaleString('fa-IR')}</td>
                    <td class="py-3 text-gray-700">${words}</td>
                    <td class="py-3 text-gray-500 text-sm">${dateStr}</td>
                    <td class="py-3 text-gray-600 text-sm">${r.description || '-'}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('خطا در دریافت اطلاعات کارکرد:', err);
    }
}

window.submitTypistReport = async function() {
    const period = parseInt(document.getElementById('reportPeriodInput').value);
    const pages = parseInt(document.getElementById('reportPagesInput').value);
    const words = parseInt(document.getElementById('reportWordsInput')?.value) || 0;
    const desc = document.getElementById('reportDescInput').value.trim();

    if (isNaN(pages) || pages <= 0) {
        alert('لطفاً تعداد صفحات تایپ‌شده را به عدد وارد کنید.');
        return;
    }

    try {
        const { data: reports } = await db
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypist.id);

        const timeline = calculatePeriodTimeline(currentTypist, reports || []);

        const reportData = {
            typist_id: currentTypist.id,
            period: period || timeline.activePeriod,
            pages: pages,
            words: words,
            description: desc,
            is_late: timeline.isLate,
            delay_days: timeline.delayDays,
            created_at: new Date().toISOString()
        };

        const { error } = await db.from('typist_reports').insert([reportData]);
        if (error) throw error;

        alert('✅ گزارش با موفقیت ثبت شد و تایمر ۱۰ روز دوره بعد مجدداً آغاز گردید.');
        document.getElementById('reportPagesInput').value = '';
        if (document.getElementById('reportWordsInput')) document.getElementById('reportWordsInput').value = '';
        document.getElementById('reportDescInput').value = '';
        await loadTypistData();
    } catch (err) {
        alert('خطا در ثبت گزارش: ' + err.message);
    }
};

// ==========================================
// ۸. داشبورد مدیریت و ثبت کارکرد توسط مدیر
// ==========================================
async function showAdminDashboard() {
    const logSec = document.getElementById('loginSection');
    const typSec = document.getElementById('typistDashboardSection');
    const admSec = document.getElementById('adminDashboardSection');

    if (logSec) logSec.classList.add('hidden');
    if (typSec) typSec.classList.add('hidden');
    if (admSec) admSec.classList.remove('hidden');

    await loadAdminAllData();
}

async function loadAdminAllData() {
    try {
        const [tRes, rRes, pRes] = await Promise.all([
            db.from('typists').select('*').order('name'),
            db.from('typist_reports').select('*').order('created_at', { ascending: false }),
            db.from('payments').select('*').order('created_at', { ascending: false })
        ]);

        allTypists = tRes.data || [];
        allReports = rRes.data || [];
        allPayments = pRes.data || [];

        populateAdminTypistDropdown();
        renderAdminReportsList();
        renderAdminTypistsManagement();
    } catch (err) {
        console.error('خطا در دریافت اطلاعات مدیر:', err);
    }
}

function populateAdminTypistDropdown() {
    const select = document.getElementById('adminTypistSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- انتخاب تایپیست --</option>' +
        allTypists.map(t => `<option value="${t.id}">${t.name || 'بدون نام'} (${t.national_code})</option>`).join('');
}

function renderAdminReportsList() {
    const tbody = document.getElementById('adminAllReportsTbody');
    if (!tbody) return;

    if (allReports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">هیچ کارکردی ثبت نشده است.</td></tr>`;
        return;
    }

    const typistMap = {};
    allTypists.forEach(t => { typistMap[t.id] = t; });

    tbody.innerHTML = allReports.map(r => {
        const typist = typistMap[r.typist_id] || { name: 'نامشخص', national_code: '-' };
        const pages = Number(r.pages) || 0;
        const words = r.words ? Number(r.words).toLocaleString('fa-IR') : '-';
        const dateStr = r.created_at ? Jalali.formatDate(r.created_at) : '-';
        const lateBadge = r.is_late 
            ? `<span class="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">تاخیر (${r.delay_days} روز)</span>` 
            : `<span class="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded">به‌موقع</span>`;

        return `
            <tr class="border-b hover:bg-gray-50 text-center">
                <td class="py-3 text-right font-medium text-gray-800 pr-4">
                    <div>${typist.name}</div>
                    <div class="text-xs text-gray-400 font-mono">${typist.national_code}</div>
                </td>
                <td class="py-3 font-semibold text-gray-700">دوره ${r.period || 1}</td>
                <td class="py-3 text-emerald-600 font-bold">${pages.toLocaleString('fa-IR')}</td>
                <td class="py-3 text-gray-600">${words}</td>
                <td class="py-3 text-sm text-gray-500">${dateStr}</td>
                <td class="py-3">${lateBadge}</td>
                <td class="py-3 text-xs text-gray-500 max-w-xs truncate">${r.description || '-'}</td>
            </tr>
        `;
    }).join('');
}

window.handleAdminDirectReportSubmit = async function() {
    const typistId = document.getElementById('adminTypistSelect').value;
    const period = parseInt(document.getElementById('adminReportPeriod').value);
    const pages = parseInt(document.getElementById('adminReportPages').value);
    const words = parseInt(document.getElementById('adminReportWords')?.value) || 0;
    const desc = document.getElementById('adminReportDesc').value.trim();

    if (!typistId) {
        alert('لطفاً یک تایپیست را انتخاب کنید.');
        return;
    }
    if (isNaN(pages) || pages <= 0) {
        alert('لطفاً تعداد صفحات را به عدد وارد کنید.');
        return;
    }

    try {
        const reportData = {
            typist_id: typistId,
            period: period || 1,
            pages: pages,
            words: words,
            description: desc || 'ثبت دستی توسط مدیریت',
            is_late: false,
            delay_days: 0,
            created_at: new Date().toISOString()
        };

        const { error } = await db.from('typist_reports').insert([reportData]);
        if (error) throw error;

        alert('✅ کارکرد تایپیست توسط مدیر با موفقیت ثبت شد.');
        document.getElementById('adminReportPages').value = '';
        if (document.getElementById('adminReportWords')) document.getElementById('adminReportWords').value = '';
        document.getElementById('adminReportDesc').value = '';
        await loadAdminAllData();
    } catch (err) {
        alert('خطا در ثبت کارکرد: ' + err.message);
    }
};

function renderAdminTypistsManagement() {
    const container = document.getElementById('adminTypistsListContainer');
    if (!container) return;

    if (allTypists.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-gray-400">تایپیستی ثبت نشده است.</div>`;
        return;
    }

    container.innerHTML = allTypists.map(t => {
        const myReports = allReports.filter(r => r.typist_id === t.id);
        const totalPages = myReports.reduce((sum, r) => sum + (Number(r.pages) || 0), 0);
        const timeline = calculatePeriodTimeline(t, myReports);

        return `
            <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-800 text-lg">${t.name}</span>
                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">${t.national_code}</span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1 flex flex-wrap gap-4">
                        <span>📱 تلفن: <a href="tel:${t.phone}" class="text-blue-600 hover:underline font-mono">${t.phone}</a></span>
                        <span>💳 شبا: <span class="font-mono">${t.shaba || '-'}</span></span>
                        <span>📅 تحویل: ${t.delivery_date || '-'}</span>
                    </div>
                    <div class="mt-2 text-xs font-semibold ${timeline.isLate ? 'text-red-600' : 'text-emerald-700'}">
                        ${timeline.statusLabel} | مجموع صفحات: ${totalPages.toLocaleString('fa-IR')}
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button onclick="window.openSettlementModal('${t.id}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors">
                        💰 تسویه‌حساب (ماهانه / کامل)
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// ۹. تسویه حساب و خروجی اکسل بانکی (۵ ستون)
// ==========================================
let currentSettlementTypistId = null;

window.openSettlementModal = function(typistId) {
    currentSettlementTypistId = typistId;
    const typist = allTypists.find(t => t.id === typistId);
    if (!typist) return;

    const nameSpan = document.getElementById('settlementTypistName');
    if (nameSpan) nameSpan.innerText = typist.name;
    const modal = document.getElementById('settlementModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeSettlementModal = function() {
    currentSettlementTypistId = null;
    const modal = document.getElementById('settlementModal');
    if (modal) modal.classList.add('hidden');
};

window.executeSettlement = async function() {
    const model = document.getElementById('settlementTypeSelect').value;
    const amount = parseInt(document.getElementById('settlementAmountInput').value);
    const desc = document.getElementById('settlementDescInput').value.trim();

    if (isNaN(amount) || amount <= 0) {
        alert('لطفاً مبلغ معتبر وارد نمایید.');
        return;
    }

    try {
        const paymentRecord = {
            typist_id: currentSettlementTypistId,
            amount: amount,
            settlement_type: model,
            description: desc || (model === 'full' ? 'تسویه کامل و نهایی پروژه' : 'تسویه کارکرد ماهانه'),
            created_at: new Date().toISOString()
        };

        const { error } = await db.from('payments').insert([paymentRecord]);
        if (error) throw error;

        alert('✅ تسویه‌حساب با موفقیت ثبت شد.');
        window.closeSettlementModal();
        await loadAdminAllData();
    } catch (err) {
        alert('خطا در ثبت تسویه: ' + err.message);
    }
};

window.exportSettlementsToExcel = function() {
    if (allPayments.length === 0) {
        alert('داده‌ای برای خروجی اکسل وجود ندارد.');
        return;
    }

    const typistMap = {};
    allTypists.forEach(t => { typistMap[t.id] = t; });

    const headers = ["نام و نام خانوادگی", "کد ملی", "شماره تماس", "مبلغ", "شماره شبا"];

    const rows = allPayments.map(p => {
        const typist = typistMap[p.typist_id] || {};
        const name = (typist.name || '').replace(/,/g, ' ');
        const nationalCode = `\t${typist.national_code || ''}`;
        const phone = `\t${typist.phone || ''}`;
        const amount = p.amount || 0;
        const shaba = `\t${typist.shaba || ''}`;

        return [name, nationalCode, phone, amount, shaba].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `تسویه_بانکی_${Jalali.todayString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// تایید بارگذاری بدون ارور
console.log('✅ نسخه جدید سامانه با تعریف سراسری توابع با موفقیت لود شد.');




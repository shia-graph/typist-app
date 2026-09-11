import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ اطلاعات سوپابیس شما
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const PASSWORD = '7853421'; // رمز ورود

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// 🗓️ کتابخانه تقویم شمسی
// ============================================
const Jalaali = {
    g_days_in_month: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    j_days_in_month: [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29],
    jMonthName: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    isLeapGregorian(year) { return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0); },
    isLeapJalaali(jy) { return this.jalCal(jy).leap === 0; },
    jalCal(jy) {
        const breaks = [ -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178 ];
        const bl = breaks.length;
        let jp = breaks[0], jm, jump, leapYear = -14, n, i;
        const jyPlus1 = jy + 1;
        for (i = 1; i < bl; i += 1) {
            jm = breaks[i];
            jump = jm - jp;
            if (jyPlus1 < jm) break;
            leapYear += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
            jp = jm;
        }
        n = jyPlus1 - jp;
        leapYear += Math.floor(n / 33) * 8 + Math.floor((n % 33 + 3) / 4);
        if ((jump % 33) === 4 && (jump - n) === 4) leapYear += 1;
        const leapJ = (jump % 33 === 4 && (n - 1) % 33 === 0) || (jump % 33 === 5 && n % 33 === 0) || (jump % 33 === 5 && (n + 1) % 33 === 0);
        let marchDay = 20;
        if (leapYear === 1) marchDay = 21;
        return { leap: leapYear % 33 === 0 || leapJ, gy: jy + 621, march: marchDay };
    },
    j2d(jy, jm, jd) { const r = this.jalCal(jy); return this.gregorian2julianday(r.gy, 3, r.march) + (jm <= 6 ? (jm - 1) * 31 : ((jm - 7) * 30 + 186)) + jd - 1; },
    d2j(jdn) {
        const gy = this.julianday2gregorian(jdn).year - 621;
        const r = this.jalCal(gy);
        const jdn1f = this.gregorian2julianday(gy + 621, 3, r.march);
        let k = jdn - jdn1f;
        let jy, jm, jd;
        if (k >= 0) {
            if (k <= 185) { jm = 1 + Math.floor(k / 31); jd = (k % 31) + 1; }
            else { k -= 186; jm = 7 + Math.floor(k / 30); jd = (k % 30) + 1; }
            jy = gy;
        } else {
            jy = gy - 1; k += 179;
            if (r.leap === 1) k += 1;
            if (k <= 185) { jm = 1 + Math.floor(k / 31); jd = (k % 31) + 1; }
            else { k -= 186; jm = 7 + Math.floor(k / 30); jd = (k % 30) + 1; }
        }
        return { year: jy, month: jm, day: jd };
    },
    gregorian2julianday(year, month, day) { return 367 * year - Math.floor((7 * (year + Math.floor((month + 9) / 12))) / 4) + Math.floor((275 * month) / 9) + day + 1721013.5; },
    julianday2gregorian(jd) {
        const l = jd + 68569;
        const n = Math.floor((4 * l) / 146097);
        const l2 = l - Math.floor((146097 * n + 3) / 4);
        const i = Math.floor((4000 * (l2 + 1)) / 1461001);
        const l3 = l2 - Math.floor((1461 * i) / 4) + 31;
        const j = Math.floor((80 * l3) / 2447);
        const day = l3 - Math.floor((2447 * j) / 80);
        const l4 = Math.floor(j / 11);
        const month = j + 2 - 12 * l4;
        const year = 100 * (n - 49) + i + l4;
        return { year, month, day };
    },
    toJalaali(gy, gm, gd) { return this.d2j(this.gregorian2julianday(gy, gm, gd)); },
    toGregorian(jy, jm, jd) { return this.julianday2gregorian(this.j2d(jy, jm, jd)); },
    today() { const now = new Date(); return this.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate()); },
    toPersianDigits(str) { const p = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']; return String(str).replace(/[0-9]/g, d => p[+d]); },
    formatJalali(jy, jm, jd) { return this.toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`); },
    parseJalali(str) { const parts = String(str).split('/').map(p => +String(p).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return { year: parts[0], month: parts[1], day: parts[2] }; },
    daysBetween(j1, j2) { return this.j2d(j2.year, j2.month, j2.day) - this.j2d(j1.year, j1.month, j1.day); }
};

// ============================================
// 📦 مدیریت داده‌ها (اتصال به سوپابیس)
// ============================================
let projectsCache = [];

async function loadProjects() {
    const { data, error } = await supabase.from('typists').select('*').order('created_at', { ascending: false });
    if (error) { console.error("خطا در دریافت اطلاعات:", error); return []; }
    
    projectsCache = data.map(p => {
        const createdDate = p.created_at ? new Date(p.created_at) : new Date();
        const jToday = Jalaali.toJalaali(createdDate.getFullYear(), createdDate.getMonth() + 1, createdDate.getDate());
        return {
            id: p.id,
            name: p.name,
            phone: p.phone,
            title: p.title,
            deliveryDate: p.delivery_date,
            createdAt: Jalaali.formatJalali(jToday.year, jToday.month, jToday.day),
            reports: p.reports || [],
            completed: p.completed || false
        };
    });
    return projectsCache;
}

async function saveProjectToSupabase(project) {
    const payload = {
        name: project.name,
        phone: project.phone,
        title: project.title,
        delivery_date: project.deliveryDate,
        completed: project.completed,
        reports: project.reports || []
    };
    
    if (project.id) {
        await supabase.from('typists').update(payload).eq('id', project.id);
    } else {
        await supabase.from('typists').insert([payload]);
    }
}

async function deleteProjectFromSupabase(id) {
    await supabase.from('typists').delete().eq('id', id);
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ============================================
// 🧮 منطق وضعیت و محاسبات (دقیقا مثل کد شما)
// ============================================
function calculateProjectStatus(project) {
    const today = Jalaali.today();
    const created = Jalaali.parseJalali(project.createdAt);
    const delivery = Jalaali.parseJalali(project.deliveryDate);
    const daysSinceCreation = Jalaali.daysBetween(created, today);
    const totalDays = Jalaali.daysBetween(created, delivery);
    
    if (project.completed) {
        return { status: 'delivered', daysSinceCreation, totalDays, currentPeriod: null, daysLeft: 0, daysUntilDelivery: Jalaali.daysBetween(today, delivery) };
    }
    
    const currentPeriod = Math.floor(daysSinceCreation / 10) + 1;
    const daysIntoCurrentPeriod = daysSinceCreation % 10;
    const daysLeftInPeriod = 10 - daysIntoCurrentPeriod;
    const reports = project.reports || [];
    const lastReportedPeriod = reports.length > 0 ? reports[reports.length - 1].period : 0;
    const daysUntilDelivery = Jalaali.daysBetween(today, delivery);
    
    if (daysUntilDelivery < 0) {
        return { status: 'delayed', daysSinceCreation, totalDays, currentPeriod, daysLeft: daysLeftInPeriod, daysUntilDelivery, delayText: `${Math.abs(daysUntilDelivery)} روز از موعد تحویل گذشته`, isDeliveryOverdue: true };
    }
    
    if (lastReportedPeriod >= currentPeriod) {
        return { status: 'active', daysSinceCreation, totalDays, currentPeriod, daysLeft: daysLeftInPeriod, daysUntilDelivery };
    } else if (lastReportedPeriod < currentPeriod - 1) {
        return { status: 'delayed', daysSinceCreation, totalDays, currentPeriod, daysLeft: daysLeftInPeriod, daysUntilDelivery, delayText: `${(currentPeriod - lastReportedPeriod - 1) * 10 + daysIntoCurrentPeriod} روز تاخیر در گزارش` };
    } else {
        if (daysLeftInPeriod <= 0) {
            const delayDays = daysSinceCreation - (currentPeriod - 1) * 10;
            return { status: 'delayed', daysSinceCreation, totalDays, currentPeriod, daysLeft: 0, daysUntilDelivery, delayText: `${delayDays} روز از موعد گزارش گذشته`, isLate: true, delayDays };
        }
        const isUrgent = daysLeftInPeriod <= 3;
        return { status: isUrgent ? 'pending' : 'active', daysSinceCreation, totalDays, currentPeriod, daysLeft: daysLeftInPeriod, daysUntilDelivery, isLate: false };
    }
}

// ============================================
// 🎨 رندر کارت پروژه (دقیقا مثل کد شما)
// ============================================
function renderProjectCard(project) {
    const status = calculateProjectStatus(project);
    const today = Jalaali.today();
    const colorMap = {
        active: { badge: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-500/20', bar: 'bg-blue-500', icon: 'text-blue-600 dark:text-blue-400' },
        pending: { badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20', bar: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400' },
        delayed: { badge: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20', bar: 'bg-red-500', icon: 'text-red-600 dark:text-red-400' },
        delivered: { badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20', bar: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' }
    };
    const colors = colorMap[status.status];
    const statusTextMap = {
        active: 'به‌موقع',
        pending: `⚠️ ${status.daysLeft} روز تا پایان مهلت`,
        delayed: status.delayText || 'تاخیر دارد',
        delivered: '✓ تکمیل شده'
    };
    const periodProgress = status.status !== 'delivered' ? Math.min(100, ((10 - status.daysLeft) / 10) * 100) : 100;
    const initials = project.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const reportsHtml = (project.reports || []).slice().reverse().map(r => {
        const isLate = r.isLate;
        return `<div class="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full ${isLate ? 'bg-red-500' : 'bg-emerald-500'} flex-shrink-0"></span>
                <span class="text-slate-700 dark:text-slate-300 truncate">دوره ${Jalaali.toPersianDigits(r.period)} • ${Jalaali.toPersianDigits(r.pages)} صفحه</span>
            </div>
            <span class="text-slate-400 dark:text-slate-500 text-[10px] flex-shrink-0">${isLate ? `<span class="text-red-500">${Jalaali.toPersianDigits(r.delayDays)}+ روز تاخیر</span>` : Jalaali.formatJalali(r.date.year, r.date.month, r.date.day)}</span>
        </div>`;
    }).join('');
    
    return `<div class="project-card group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 animate-slide-up" data-id="${project.id}" data-status="${status.status}">
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-primary-500/20 flex-shrink-0">${initials}</div>
                <div class="min-w-0">
                    <h3 class="font-bold text-slate-900 dark:text-white text-sm truncate">${project.name}</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5" dir="ltr" style="justify-content: flex-start;">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        <span>${Jalaali.toPersianDigits(project.phone)}</span>
                    </p>
                </div>
            </div>
            <button onclick="showMenu(event, '${project.id}')" class="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition relative">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
            </button>
        </div>
        <div class="space-y-3 mb-4">
            <div>
                <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">عنوان پروژه</p>
                <p class="text-sm text-slate-800 dark:text-slate-100 font-medium line-clamp-2">${project.title}</p>
            </div>
            <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    تحویل: ${project.deliveryDate}
                </span>
                <span class="font-semibold ${status.daysUntilDelivery < 0 ? 'text-red-600 dark:text-red-400' : status.daysUntilDelivery <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}">
                    ${status.daysUntilDelivery < 0 ? `${Jalaali.toPersianDigits(Math.abs(status.daysUntilDelivery))}- روز گذشته` : status.daysUntilDelivery === 0 ? 'امروز' : `${Jalaali.toPersianDigits(status.daysUntilDelivery)} روز مانده`}
                </span>
            </div>
        </div>
        <div class="mb-4">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${colors.badge}">
                <span class="w-1.5 h-1.5 rounded-full ${colors.icon} animate-pulse-slow"></span>
                ${statusTextMap[status.status]}
            </div>
        </div>
        ${status.status !== 'delivered' ? `
        <div class="mb-4">
            <div class="flex items-center justify-between mb-1.5">
                <span class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">دوره ${Jalaali.toPersianDigits(status.currentPeriod)} از ۱۰ روز</span>
                <span class="text-[11px] font-bold ${colors.icon}">${status.daysLeft > 0 ? `${Jalaali.toPersianDigits(status.daysLeft)} روز مانده` : 'پایان یافته'}</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div class="${colors.bar} h-2 rounded-full transition-all duration-700 ease-out" style="width: ${periodProgress}%"></div>
            </div>
        </div>` : ''}
        ${(project.reports || []).length > 0 ? `
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">گزارش‌ها (${Jalaali.toPersianDigits(project.reports.length)})</p>
                <span class="text-[10px] text-slate-400">${project.reports.reduce((s, r) => s + (r.pages || 0), 0)} صفحه</span>
            </div>
            <div class="space-y-1.5 max-h-32 overflow-y-auto">${reportsHtml}</div>
        </div>` : `
        <div class="mb-4 py-4 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-center">
            <p class="text-[11px] text-slate-400 dark:text-slate-500">هنوز گزارشی ثبت نشده</p>
        </div>`}
        <div class="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            ${status.status !== 'delivered' ? `
            <button onclick="openReportModal('${project.id}')" class="flex-1 py-2.5 rounded-xl ${status.status === 'delayed' ? 'bg-red-600 hover:bg-red-700 animate-pulse-slow' : 'bg-primary-600 hover:bg-primary-700'} text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                ثبت گزارش
            </button>
            <button onclick="completeProject('${project.id}')" class="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-500/20">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                تکمیل
            </button>` : `
            <div class="flex-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-500/20">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                پروژه تکمیل شده است
            </div>`}
        </div>
    </div>`;
}

// ============================================
// 🖥️ رندر لیست
// ============================================
async function renderProjects() {
    const projects = await loadProjects();
    const listEl = document.getElementById('typistList');
    const emptyEl = document.getElementById('emptyState');
    if (projects.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        emptyEl.classList.add('flex', 'flex-col', 'items-center', 'justify-center');
    } else {
        emptyEl.classList.add('hidden');
        const priority = { delayed: 0, pending: 1, active: 2, delivered: 3 };
        const sorted = projects.slice().sort((a, b) => {
            const sa = calculateProjectStatus(a).status;
            const sb = calculateProjectStatus(b).status;
            return priority[sa] - priority[sb];
        });
        listEl.innerHTML = sorted.map(renderProjectCard).join('');
    }
    updateStats(projects);
    applyFilter();
}

function updateStats(projects) {
    const stats = { active: 0, pending: 0, delayed: 0, delivered: 0 };
    projects.forEach(p => {
        const s = calculateProjectStatus(p).status;
        stats[s]++;
    });
    document.getElementById('stat-active').textContent = Jalaali.toPersianDigits(stats.active);
    document.getElementById('stat-pending').textContent = Jalaali.toPersianDigits(stats.pending);
    document.getElementById('stat-delayed').textContent = Jalaali.toPersianDigits(stats.delayed);
    document.getElementById('stat-delivered').textContent = Jalaali.toPersianDigits(stats.delivered);
}

// ============================================
// 🔍 فیلتر
// ============================================
let currentFilter = 'all';
function applyFilter() {
    document.querySelectorAll('.project-card').forEach(card => {
        const status = card.dataset.status;
        if (currentFilter === 'all' || status === currentFilter) card.style.display = '';
        else card.style.display = 'none';
    });
}
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'shadow-sm'));
        btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'shadow-sm');
        applyFilter();
    });
});
document.querySelector('[data-filter="all"]').classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'shadow-sm');

// ============================================
// 📅 تقویم شمسی (دقیقا مثل کد شما)
// ============================================
let calendarState = { viewYear: null, viewMonth: null, selected: null, inputEl: null };
function openCalendar(inputEl, initialValue = null) {
    const today = Jalaali.today();
    calendarState.inputEl = inputEl;
    if (initialValue) {
        const p = Jalaali.parseJalali(initialValue);
        calendarState.viewYear = p.year; calendarState.viewMonth = p.month; calendarState.selected = p;
    } else {
        calendarState.viewYear = today.year; calendarState.viewMonth = today.month; calendarState.selected = null;
    }
    renderCalendar();
    document.getElementById('calendarDropdown').classList.add('open');
}
function closeCalendar() { document.getElementById('calendarDropdown').classList.remove('open'); }
function renderCalendar() {
    const dropdown = document.getElementById('calendarDropdown');
    const today = Jalaali.today();
    const { viewYear, viewMonth, selected } = calendarState;
    const firstDayGreg = Jalaali.toGregorian(viewYear, viewMonth, 1);
    const firstDayOfWeek = new Date(firstDayGreg.year, firstDayGreg.month - 1, firstDayGreg.day).getDay();
    const startOffset = (firstDayOfWeek + 1) % 7;
    const isLeap = Jalaali.isLeapJalaali(viewYear);
    const daysInMonth = viewMonth <= 6 ? 31 : (viewMonth === 12 && !isLeap ? 29 : 30);
    let html = `<div class="flex items-center justify-between mb-3">
        <button type="button" onclick="calendarPrev()" class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>
        <div class="text-center"><div class="text-sm font-bold text-slate-900 dark:text-white">${Jalaali.jMonthName[viewMonth - 1]} ${Jalaali.toPersianDigits(viewYear)}</div></div>
        <button type="button" onclick="calendarNext()" class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
    </div>
    <div class="grid grid-cols-7 gap-1 mb-2">${['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(d => `<div class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 text-center">${d}</div>`).join('')}</div>
    <div class="grid grid-cols-7 gap-1">`;
    for (let i = 0; i < startOffset; i++) html += `<div class="cal-day"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = viewYear === today.year && viewMonth === today.month && d === today.day;
        const isSelected = selected && selected.year === viewYear && selected.month === viewMonth && selected.day === d;
        const classes = ['cal-day'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        html += `<div class="${classes.join(' ')}" onclick="selectDate(${viewYear}, ${viewMonth}, ${d})">${Jalaali.toPersianDigits(d)}</div>`;
    }
    html += `</div><div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button type="button" onclick="selectToday()" class="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">امروز</button>
        <button type="button" onclick="closeCalendar()" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">بستن</button>
    </div>`;
    dropdown.innerHTML = html;
}
window.calendarPrev = function() { calendarState.viewMonth--; if (calendarState.viewMonth < 1) { calendarState.viewMonth = 12; calendarState.viewYear--; } renderCalendar(); };
window.calendarNext = function() { calendarState.viewMonth++; if (calendarState.viewMonth > 12) { calendarState.viewMonth = 1; calendarState.viewYear++; } renderCalendar(); };
window.selectDate = function(y, m, d) { calendarState.selected = { year: y, month: m, day: d }; calendarState.inputEl.value = Jalaali.formatJalali(y, m, d); closeCalendar(); };
window.selectToday = function() { const today = Jalaali.today(); window.selectDate(today.year, today.month, today.day); };

// ============================================
// 🚪 مدیریت مودال‌ها و اکشن‌ها (اتصال به سوپابیس)
// ============================================
window.openProjectModal = function(projectId = null) {
    const modal = document.getElementById('formModal');
    const backdrop = document.getElementById('modalBackdrop');
    const content = document.getElementById('modalContent');
    const form = document.getElementById('typistForm');
    form.reset();
    document.getElementById('editId').value = '';
    if (projectId) {
        const p = projectsCache.find(x => x.id === projectId);
        if (p) {
            document.getElementById('editId').value = p.id;
            document.getElementById('name').value = p.name;
            document.getElementById('phone').value = p.phone;
            document.getElementById('title').value = p.title;
            document.getElementById('deliveryDate').value = p.deliveryDate;
            document.getElementById('formTitle').textContent = 'ویرایش پروژه';
            document.getElementById('submitBtnText').textContent = 'ذخیره تغییرات';
        }
    } else {
        document.getElementById('formTitle').textContent = 'ثبت پروژه جدید';
        document.getElementById('submitBtnText').textContent = 'ذخیره پروژه';
    }
    modal.classList.remove('hidden');
    requestAnimationFrame(() => { backdrop.classList.remove('opacity-0'); content.classList.remove('scale-95', 'opacity-0'); });
};
window.closeProjectModal = function() {
    const modal = document.getElementById('formModal');
    const backdrop = document.getElementById('modalBackdrop');
    const content = document.getElementById('modalContent');
    backdrop.classList.add('opacity-0'); content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};
window.openReportModal = function(projectId) {
    const project = projectsCache.find(p => p.id === projectId);
    if (!project) return;
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportContent');
    const statusBox = document.getElementById('reportStatusBox');
    const status = calculateProjectStatus(project);
    document.getElementById('reportProjectId').value = projectId;
    document.getElementById('reportProjectTitle').textContent = project.name + ' - ' + project.title;
    document.getElementById('reportPages').value = '';
    document.getElementById('reportText').value = '';
    if (status.status === 'delayed' && status.isLate) {
        statusBox.className = 'p-3 rounded-xl text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 flex items-center gap-2';
        statusBox.innerHTML = `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>این گزارش <strong>${Jalaali.toPersianDigits(status.delayDays)} روز</strong> تاخیر دارد</span>`;
        statusBox.classList.remove('hidden');
    } else { statusBox.classList.add('hidden'); }
    modal.classList.remove('hidden');
    requestAnimationFrame(() => content.classList.remove('scale-95', 'opacity-0'));
};
window.closeReportModal = function() {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportContent');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};
window.submitReport = async function() {
    const projectId = document.getElementById('reportProjectId').value;
    const pages = parseInt(document.getElementById('reportPages').value) || 0;
    const text = document.getElementById('reportText').value.trim();
    if (pages <= 0) { alert('لطفاً تعداد صفحات را وارد کنید'); return; }
    const project = projectsCache.find(p => p.id === projectId);
    if (!project) return;
    const today = Jalaali.today();
    const created = Jalaali.parseJalali(project.createdAt);
    const daysSinceCreation = Jalaali.daysBetween(created, today);
    const currentPeriod = Math.floor(daysSinceCreation / 10) + 1;
    const reports = project.reports || [];
    const lastReportedPeriod = reports.length > 0 ? reports[reports.length - 1].period : 0;
    const expectedPeriod = lastReportedPeriod + 1;
    let isLate = false, delayDays = 0;
    const expectedEndDay = expectedPeriod * 10;
    if (daysSinceCreation > expectedEndDay) { isLate = true; delayDays = daysSinceCreation - expectedEndDay; }
    reports.push({ period: currentPeriod, date: today, pages, text, isLate, delayDays, timestamp: Date.now() });
    project.reports = reports;
    await saveProjectToSupabase(project);
    closeReportModal();
    showAlert(isLate ? `گزارش با ${Jalaali.toPersianDigits(delayDays)} روز تاخیر ثبت شد` : 'گزارش با موفقیت ثبت شد', isLate ? 'warning' : 'success');
};
window.completeProject = async function(projectId) {
    const project = projectsCache.find(p => p.id === projectId);
    if (!project) return;
    if (!confirm('آیا از تکمیل پروژه اطمینان دارید؟')) return;
    project.completed = true;
    await saveProjectToSupabase(project);
    showAlert('پروژه با موفقیت تکمیل شد', 'success');
};
window.showMenu = async function(e, projectId) {
    e.stopPropagation();
    if (confirm('آیا از حذف این پروژه اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) {
        await deleteProjectFromSupabase(projectId);
        showAlert('پروژه حذف شد', 'success');
    }
};
window.confirmDelete = function() {};

// ============================================
// 💬 نمایش پیام و ثبت فرم
// ============================================
function showAlert(message, type = 'success') {
    const container = document.getElementById('alertContainer');
    const colors = { success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400', warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400', error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' };
    const icon = { success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>', warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>', error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>' };
    const alert = document.createElement('div');
    alert.className = `animate-fade-in flex items-center gap-3 border px-4 py-3 rounded-xl text-sm ${colors[type]}`;
    alert.innerHTML = `<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon[type]}</svg><span class="font-medium flex-1">${message}</span>`;
    container.appendChild(alert);
    setTimeout(() => { alert.style.opacity = '0'; setTimeout(() => alert.remove(), 300); }, 3500);
}

document.getElementById('typistForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const title = document.getElementById('title').value.trim();
    const deliveryDate = document.getElementById('deliveryDate').value.trim();
    if (!name || !title || !deliveryDate) { alert('لطفاً تمام فیلدهای الزامی را پر کنید'); return; }
    
    if (id) {
        const project = projectsCache.find(p => p.id === id);
        if (project) {
            project.name = name; project.phone = phone; project.title = title; project.deliveryDate = deliveryDate;
            await saveProjectToSupabase(project);
            showAlert('پروژه با موفقیت بروزرسانی شد', 'success');
        }
    } else {
        const today = Jalaali.today();
        const newProject = {
            name, phone, title, deliveryDate,
            createdAt: Jalaali.formatJalali(today.year, today.month, today.day),
            reports: [], completed: false
        };
        await saveProjectToSupabase(newProject);
        showAlert('پروژه جدید با موفقیت ثبت شد. اولین گزارش ظرف ۱۰ روز آینده', 'success');
    }
    closeProjectModal();
});

// ============================================
// 📅 Event Listeners
// ============================================
document.getElementById('deliveryDate').addEventListener('click', function(e) {
    e.stopPropagation();
    openCalendar(this, this.value);
});
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('calendarDropdown');
    const input = document.getElementById('deliveryDate');
    if (dropdown && !dropdown.contains(e.target) && e.target !== input) closeCalendar();
});

// Theme Toggle
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) htmlElement.classList.add('dark');
else htmlElement.classList.remove('dark');
themeToggleBtn.addEventListener('click', () => {
    if (htmlElement.classList.contains('dark')) { htmlElement.classList.remove('dark'); localStorage.theme = 'light'; }
    else { htmlElement.classList.add('dark'); localStorage.theme = 'dark'; }
});

document.getElementById('modalBackdrop').addEventListener('click', closeProjectModal);
document.getElementById('reportBackdrop').addEventListener('click', closeReportModal);

// Login
if (localStorage.getItem('isLoggedIn') === 'true') {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
    renderProjects();
}
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = document.getElementById('passwordInput').value;
    if (pwd === PASSWORD) {
        localStorage.setItem('isLoggedIn', 'true');
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appWrapper').classList.remove('hidden');
        renderProjects();
    } else { document.getElementById('loginError').classList.remove('hidden'); }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeProjectModal(); closeReportModal(); closeCalendar(); }
});

// همگام‌سازی لحظه‌ای (Realtime) سوپابیس
supabase.channel('public:typists').on('postgres_changes', { event: '*', schema: 'public', table: 'typists' }, renderProjects).subscribe();

setInterval(renderProjects, 60 * 60 * 1000);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { toJalaali as libToJalaali, toGregorian as libToGregorian, isLeapJalaaliYear as libIsLeapYear, jalaaliMonthLength as libMonthLength } from 'https://esm.sh/jalaali-js@1.1.0';

const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const esc = (str) => { if (!str) return ''; return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };

const Jalaali = {
    jMonthName: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    today() { const n = new Date(); const j = libToJalaali(n.getFullYear(), n.getMonth()+1, n.getDate()); return { year: j.jy, month: j.jm, day: j.jd }; },
    toPersianDigits(str) { if(!str) return ''; const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹']; return String(str).replace(/[0-9]/g, d => p[+d]); },
    formatJalali(jy, jm, jd) { return this.toPersianDigits(`${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`); },
    parseJalali(str) { 
        if (!str || typeof str !== 'string') return null;
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
        const normalized = String(str)
            .replace(/[۰-۹]/g, d => persianDigits.indexOf(d))
            .replace(/[٠-٩]/g, d => arabicDigits.indexOf(d));
        const parts = normalized.split('/').map(p => parseInt(p.trim(), 10));
        if (parts.length !== 3 || parts.some(isNaN) || parts.some(p => p <= 0)) return null;
        return { year: parts[0], month: parts[1], day: parts[2] }; 
    },
    daysBetween(j1, j2) { 
        if(!j1||!j2) return 0; 
        try {
            const g1 = libToGregorian(j1.year, j1.month, j1.day); 
            const d1 = new Date(g1.gy, g1.gm - 1, g1.gd); 
            const g2 = libToGregorian(j2.year, j2.month, j2.day); 
            const d2 = new Date(g2.gy, g2.gm - 1, g2.gd); 
            return Math.round((d2.getTime() - d1.getTime()) / 86400000);
        } catch (e) { return 0; } 
    },
    isLeapJalaali(jy) { return libIsLeapYear(jy); }, 
    jMonthLength(jy, jm) { return libMonthLength(jy, jm); },
    toGregorian(jy, jm, jd) { const g = libToGregorian(jy, jm, jd); return { year: g.gy, month: g.gm, day: g.gd }; },
    toJalaali(gy, gm, gd) { const j = libToJalaali(gy, gm, gd); return { year: j.jy, month: j.jm, day: j.jd }; }
};

let projectsCache = [];
let calendarTargetInput = null;

async function loadProjects() {
    const { data, error } = await supabase.from('typists').select('*, typist_reports(*)').order('created_at', { ascending: false });
    if (error) return [];
    projectsCache = (data || []).map(p => {
        const cd = p.created_at ? new Date(p.created_at) : new Date();
        const jc = Jalaali.toJalaali(cd.getFullYear(), cd.getMonth()+1, cd.getDate());
        return { 
            id: p.id, 
            name: p.name || 'بدون نام', 
            phone: p.phone || '-', 
            title: p.title || 'بدون عنوان', 
            startDate: p.delivery_date, 
            createdAt: Jalaali.formatJalali(jc.year, jc.month, jc.day), 
            reports: p.typist_reports || [], 
            completed: p.completed || false 
        };
    });
    return projectsCache;
}

async function saveProjectToSupabase(p) {
    const payload = { name: p.name, phone: p.phone, title: p.title, delivery_date: p.startDate, completed: p.completed || false };
    if (p.id) { const { error } = await supabase.from('typists').update(payload).eq('id', p.id); if (error) throw error; }
    else { const { error } = await supabase.from('typists').insert([payload]); if (error) throw error; }
}
async function softDeleteProject(id) { const { error } = await supabase.from('typists').delete().eq('id', id); if (error) throw error; }
async function completeProjectInSupabase(id) { const { error } = await supabase.from('typists').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id); if (error) throw error; }
async function insertReportToSupabase(pid, per, pg, txt, isLate, delay) { const { error } = await supabase.from('typist_reports').insert([{ typist_id: pid, period: per, pages: pg, description: txt, is_late: isLate, delay_days: delay }]); if (error) throw error; }

function calculateProjectStatus(p) {
    const today = Jalaali.today();
    const startDate = Jalaali.parseJalali(p.startDate);
    
    if (!startDate) return { status: 'active', daysLeft: 10, currentPeriod: 1, daysSinceStart: 0, daysUntilReport: 10, isReported: false, isLate: false };

    const daysSinceStart = Math.max(0, Jalaali.daysBetween(startDate, today));

    if (p.completed) return { status: 'delivered', daysLeft: 0, currentPeriod: 0, daysSinceStart, daysUntilReport: 0, isReported: true, isLate: false };

    if (Jalaali.daysBetween(today, startDate) > 0) {
        return { status: 'pending', daysLeft: 10, currentPeriod: 0, daysSinceStart: 0, daysUntilReport: 10, isReported: false, isLate: false, isNotStarted: true };
    }

    const currentPeriod = Math.floor(daysSinceStart / 10) + 1;
    const dayInPeriod = daysSinceStart % 10;
    const daysUntilReport = 10 - dayInPeriod;

    const reports = Array.isArray(p.reports) ? p.reports : [];
    const reportedPeriods = reports.map(r => Number(r.period)).filter(Number.isFinite);
    const isReported = reportedPeriods.includes(currentPeriod);

    if (isReported) {
        return { status: 'active', daysLeft: daysUntilReport, currentPeriod, daysSinceStart, daysUntilReport, isReported: true, isLate: false };
    }

    const lastReportedPeriod = reportedPeriods.length > 0 ? Math.max(...reportedPeriods) : 0;
    if (lastReportedPeriod < currentPeriod - 1) {
        const missedPeriods = currentPeriod - 1 - lastReportedPeriod;
        return { status: 'delayed', daysLeft: daysUntilReport, currentPeriod, daysSinceStart, daysUntilReport, delayText: `${Jalaali.toPersianDigits(missedPeriods)} دوره جا افتاده`, missedPeriods, isReported: false, isLate: true };
    }

    if (daysUntilReport <= 0) {
        const delayDays = Math.abs(daysUntilReport);
        return { status: 'delayed', daysLeft: 0, currentPeriod, daysSinceStart, daysUntilReport, delayText: `${Jalaali.toPersianDigits(delayDays)} روز تاخیر در گزارش`, isLate: true, delayDays, isReported: false };
    }

    return { status: daysUntilReport <= 3 ? 'pending' : 'active', daysLeft: daysUntilReport, currentPeriod, daysSinceStart, daysUntilReport, isReported: false, isLate: false };
}

function renderProjectCard(project) {
    const status = calculateProjectStatus(project);
    let timeText = '', timeBadgeClass = '';
    
    if (status.status === 'delivered') { timeText = 'تکمیل شده'; timeBadgeClass = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100'; }
    else if (status.isNotStarted) { timeText = 'در انتظار شروع'; timeBadgeClass = 'bg-slate-100 dark:bg-slate-700 text-slate-600 border-slate-200'; }
    else if (status.isLate) { timeText = status.delayText || 'تاخیر در گزارش'; timeBadgeClass = 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-100'; }
    else { timeText = `${Jalaali.toPersianDigits(status.daysUntilReport)} روز تا گزارش`; timeBadgeClass = status.daysUntilReport <= 3 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-100' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 border-blue-100'; }

    const isDelayed = status.status === 'delayed';
    const initials = esc((project.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2));
    const reportsHtml = (project.reports || []).slice().reverse().map(r => `
        <div class="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs border border-slate-100 dark:border-slate-700/50">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="w-2 h-2 rounded-full ${r.is_late ? 'bg-red-500' : 'bg-emerald-500'} flex-shrink-0"></span>
                <span class="text-slate-700 dark:text-slate-300 font-medium truncate">دوره ${Jalaali.toPersianDigits(r.period)} • ${Jalaali.toPersianDigits(r.pages)} صفحه</span>
            </div>
            <span class="text-slate-400 text-[10px] flex-shrink-0 font-medium">${r.is_late ? `<span class="text-red-500">${Jalaali.toPersianDigits(r.delay_days)} روز تاخیر</span>` : 'به‌موقع'}</span>
        </div>`).join('');

    return `
    <div class="project-card glass rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:shadow-lg transition-all duration-300 animate-slide-up" data-id="${project.id}" data-status="${status.status}">
        <div class="p-5 flex items-center justify-between cursor-pointer select-none" data-action="toggle" data-id="${project.id}">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm font-black text-white shadow-md flex-shrink-0">${initials}</div>
                <div class="min-w-0">
                    <h3 class="font-black text-slate-900 dark:text-white text-sm truncate">${esc(project.name)}</h3>
                    <p class="text-xs text-slate-500 mt-0.5 font-mono" dir="ltr" style="text-align:right;">${esc(Jalaali.toPersianDigits(project.phone))}</p>
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold border ${timeBadgeClass} whitespace-nowrap">${timeText}</span>
                <svg class="card-chevron w-5 h-5 text-slate-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
        <div class="card-details-wrapper">
            <div class="p-5 pt-0 space-y-4">
                <div class="border-t border-slate-100 dark:border-slate-800 my-2"></div>
                <div>
                    <p class="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">عنوان پروژه</p>
                    <p class="text-sm text-slate-800 dark:text-slate-100 font-bold leading-relaxed">${esc(project.title)}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                        <p class="text-slate-400 mb-1 text-[10px]">روزهای سپری‌شده از دریافت کار</p>
                        <p class="font-black text-slate-900 dark:text-white text-lg">${Jalaali.toPersianDigits(status.daysSinceStart)} روز</p>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                        <p class="text-slate-400 mb-1 text-[10px]">${isDelayed ? 'وضعیت گزارش دوره' : 'روزهای مانده تا گزارش ۱۰ روزه'}</p>
                        <p class="font-black ${isDelayed ? 'text-red-600' : 'text-emerald-600'} text-lg">
                            ${isDelayed ? (status.delayText || 'نیاز به اقدام فوری') : Jalaali.toPersianDigits(status.daysUntilReport) + ' روز'}
                        </p>
                    </div>
                </div>
                ${status.status !== 'delivered' && !status.isNotStarted ? `
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[11px] font-bold text-slate-600">دوره ${Jalaali.toPersianDigits(status.currentPeriod)} از ۱۰ روز</span>
                        <span class="text-[11px] font-black ${isDelayed ? 'text-red-500' : 'text-primary-600'}">${status.daysLeft > 0 ? `${Jalaali.toPersianDigits(status.daysLeft)} روز مانده` : 'پایان دوره'}</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div class="h-2.5 rounded-full transition-all duration-700 ease-out ${isDelayed ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-primary-500 to-primary-400'}" style="width: ${Math.min(100, ((10 - status.daysLeft) / 10) * 100)}%"></div>
                    </div>
                </div>` : ''}
                ${(project.reports || []).length > 0 ? `
                <div>
                    <p class="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-wider">سوابق گزارش (${Jalaali.toPersianDigits(project.reports.length)})</p>
                    <div class="space-y-2 max-h-32 overflow-y-auto pr-1">${reportsHtml}</div>
                </div>` : `<div class="py-6 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 text-center"><p class="text-sm text-slate-400 font-medium mb-1">هنوز گزارشی ثبت نشده است</p><p class="text-xs text-slate-400">اولین گزارش دوره را ثبت کنید</p></div>`}
                <div class="flex gap-2 pt-2">
                    ${status.status !== 'delivered' && !status.isNotStarted ? `
                    <button data-action="report" data-id="${project.id}" class="flex-1 py-3 rounded-xl ${isDelayed ? 'bg-gradient-to-r from-red-600 to-red-500' : 'bg-gradient-to-r from-primary-600 to-primary-500'} text-white text-sm font-black transition flex items-center justify-center gap-2 shadow-lg">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>ثبت گزارش
                    </button>
                    <button data-action="complete" data-id="${project.id}" class="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 text-sm font-black transition flex items-center justify-center gap-2 border border-emerald-200">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>تکمیل
                    </button>` : status.status === 'delivered' ? `
                    <div class="flex-1 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 text-sm font-black transition flex items-center justify-center gap-2 border border-emerald-200">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>پروژه تکمیل شده است
                    </div>` : ''}
                    <button data-action="edit" data-id="${project.id}" class="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition border border-slate-200 dark:border-slate-700" title="ویرایش پروژه">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button data-action="delete" data-id="${project.id}" class="px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 text-slate-600 hover:text-red-600 transition border border-slate-200 dark:border-slate-700" title="حذف پروژه">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

async function renderProjects() {
    const ps = await loadProjects(); const l = document.getElementById('typistList'); const e = document.getElementById('emptyState');
    if (ps.length === 0) { l.innerHTML = ''; e.classList.remove('hidden'); e.classList.add('flex','flex-col','items-center','justify-center'); }
    else { e.classList.add('hidden'); const pr = { delayed: 0, pending: 1, active: 2, delivered: 3 }; const sorted = ps.slice().sort((a,b) => pr[calculateProjectStatus(a).status] - pr[calculateProjectStatus(b).status]); l.innerHTML = sorted.map(renderProjectCard).join(''); }
    updateStats(ps); applyFilter();
}

function updateStats(ps) { const s = { active: 0, pending: 0, delayed: 0, delivered: 0 }; ps.forEach(p => s[calculateProjectStatus(p).status]++); document.getElementById('stat-active').textContent = Jalaali.toPersianDigits(s.active); document.getElementById('stat-pending').textContent = Jalaali.toPersianDigits(s.pending); document.getElementById('stat-delayed').textContent = Jalaali.toPersianDigits(s.delayed); document.getElementById('stat-delivered').textContent = Jalaali.toPersianDigits(s.delivered); }

let currentFilter = 'all';
function applyFilter() { document.querySelectorAll('.project-card').forEach(c => c.style.display = (currentFilter === 'all' || c.dataset.status === currentFilter) ? '' : 'none'); }
document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { currentFilter = b.dataset.filter; document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('bg-white', 'text-slate-900', 'shadow-sm')); b.classList.add('bg-white', 'text-slate-900', 'shadow-sm'); applyFilter(); }));
const allFilterBtn = document.querySelector('[data-filter="all"]');
if (allFilterBtn) allFilterBtn.classList.add('bg-white', 'text-slate-900', 'shadow-sm');

let calendarState = { viewYear: null, viewMonth: null, selected: null };
function openCalendar(inp, val = null) { calendarTargetInput = inp; const t = Jalaali.today(); if (val && Jalaali.parseJalali(val)) { const p = Jalaali.parseJalali(val); calendarState.viewYear = p.year; calendarState.viewMonth = p.month; calendarState.selected = p; } else { calendarState.viewYear = t.year; calendarState.viewMonth = t.month; calendarState.selected = null; } renderCalendarModal(); document.getElementById('calendarModal').classList.remove('hidden'); }
function closeCalendar() { document.getElementById('calendarModal').classList.add('hidden'); }
function renderCalendarModal() {
    const c = document.getElementById('calendarContainer'); const t = Jalaali.today(); const { viewYear: vy, viewMonth: vm, selected: sel } = calendarState;
    const fg = Jalaali.toGregorian(vy, vm, 1); const sd = (new Date(fg.year, fg.month-1, fg.day).getDay() + 1) % 7; const dm = Jalaali.jMonthLength(vy, vm);
    let h = `<div class="flex items-center justify-between mb-6"><button type="button" class="cal-prev w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button><div class="text-base font-black text-slate-900 dark:text-white">${Jalaali.jMonthName[vm-1]} ${Jalaali.toPersianDigits(vy)}</div><button type="button" class="cal-next w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button></div><div class="grid grid-cols-7 gap-2 mb-3">${['ش','ی','د','س','چ','پ','ج'].map(d => `<div class="text-xs font-black text-slate-400 text-center">${d}</div>`).join('')}</div><div class="grid grid-cols-7 gap-2">`;
    for (let i=0; i<sd; i++) h += `<div></div>`;
    for (let d=1; d<=dm; d++) { const isT = vy === t.year && vm === t.month && d === t.day; const isS = sel && sel.year === vy && sel.month === vm && sel.day === d; h += `<div class="cal-day ${isT ? 'today' : ''} ${isS ? 'selected' : ''}" data-day="${d}">${Jalaali.toPersianDigits(d)}</div>`; }
    h += `</div><div class="mt-6 pt-4 border-t flex justify-between"><button type="button" class="cal-today text-sm text-primary-600 font-black">انتخاب امروز</button><button type="button" class="cal-close text-sm text-slate-500 font-bold">بستن</button></div>`;
    c.innerHTML = h;
}
document.getElementById('calendarModal').addEventListener('click', e => {
    if (e.target.classList.contains('cal-backdrop')) return closeCalendar();
    if (e.target.closest('.cal-prev')) { calendarState.viewMonth--; if (calendarState.viewMonth < 1) { calendarState.viewMonth = 12; calendarState.viewYear--; } renderCalendarModal(); }
    else if (e.target.closest('.cal-next')) { calendarState.viewMonth++; if (calendarState.viewMonth > 12) { calendarState.viewMonth = 1; calendarState.viewYear++; } renderCalendarModal(); }
    else if (e.target.closest('.cal-today')) { const t = Jalaali.today(); calendarState.selected = { year: t.year, month: t.month, day: t.day }; if (calendarTargetInput) calendarTargetInput.value = Jalaali.formatJalali(t.year, t.month, t.day); closeCalendar(); }
    else if (e.target.closest('.cal-close')) { closeCalendar(); }
    else if (e.target.closest('.cal-day')) { const de = e.target.closest('.cal-day'); if (!de.dataset.day) return; const d = parseInt(de.dataset.day); calendarState.selected = { year: calendarState.viewYear, month: calendarState.viewMonth, day: d }; if (calendarTargetInput) calendarTargetInput.value = Jalaali.formatJalali(calendarState.viewYear, calendarState.viewMonth, d); closeCalendar(); }
});

// ✅ اتصال رویداد کلیک به کادر دور فیلد (به جای خود فیلد readonly) برای حل مشکل موبایل
const dateWrapper = document.getElementById('deliveryDateWrapper');
if (dateWrapper) {
    dateWrapper.addEventListener('click', function() {
        const input = document.getElementById('deliveryDate');
        openCalendar(input, input.value);
    });
}

document.getElementById('openProjectBtn').addEventListener('click', () => openProjectModal());
document.getElementById('emptyAddBtn').addEventListener('click', () => openProjectModal());
document.getElementById('closeFormBtn').addEventListener('click', closeProjectModal);
document.getElementById('modalBackdrop').addEventListener('click', closeProjectModal);
document.getElementById('closeReportBtn').addEventListener('click', closeReportModal);
document.getElementById('reportBackdrop').addEventListener('click', closeReportModal);
document.getElementById('cancelDeleteBtn').addEventListener('click', () => document.getElementById('deleteModal').classList.add('hidden'));
document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
document.getElementById('exportBtn').addEventListener('click', exportToCSV);
document.getElementById('submitReportBtn').addEventListener('click', submitReport);

document.getElementById('typistList').addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]'); if (!target) return;
    const card = target.closest('.project-card'); if (!card) return;
    const id = card.dataset.id; const action = target.dataset.action;
    if (action === 'toggle') { document.querySelectorAll('.project-card.is-expanded').forEach(c => { if (c !== card) c.classList.remove('is-expanded'); }); card.classList.toggle('is-expanded'); }
    else if (action === 'report') { openReportModal(id); }
    else if (action === 'complete') { completeProject(id); }
    else if (action === 'edit') { openProjectModal(id); }
    else if (action === 'delete') { document.getElementById('deleteProjectId').value = id; document.getElementById('deleteModal').classList.add('hidden'); document.getElementById('deleteModal').classList.remove('hidden'); }
});

function openProjectModal(id = null) { const m = document.getElementById('formModal'); const b = document.getElementById('modalBackdrop'); const c = document.getElementById('modalContent'); document.getElementById('typistForm').reset(); document.getElementById('editId').value = ''; if (id) { const p = projectsCache.find(x => x.id === id); if (p) { document.getElementById('editId').value = p.id; document.getElementById('name').value = p.name; document.getElementById('phone').value = p.phone; document.getElementById('title').value = p.title; document.getElementById('deliveryDate').value = p.startDate; document.getElementById('formTitle').textContent = 'ویرایش پروژه'; document.getElementById('submitBtnText').textContent = 'ذخیره تغییرات'; } } else { document.getElementById('formTitle').textContent = 'ثبت پروژه جدید'; document.getElementById('submitBtnText').textContent = 'ذخیره پروژه'; } m.classList.remove('hidden'); requestAnimationFrame(() => { b.classList.remove('opacity-0'); c.classList.remove('scale-95', 'opacity-0'); }); }
function closeProjectModal() { const m = document.getElementById('formModal'); const b = document.getElementById('modalBackdrop'); const c = document.getElementById('modalContent'); b.classList.add('opacity-0'); c.classList.add('scale-95', 'opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); }

function openReportModal(id) { const p = projectsCache.find(x => x.id === id); if (!p) return; const s = calculateProjectStatus(p); if (s.status === 'delivered') return; if (p.reports && p.reports.some(r => r.period === s.currentPeriod)) { showAlert('برای این دوره قبلاً گزارش ثبت شده است.', 'warning'); return; } document.getElementById('reportProjectId').value = id; document.getElementById('reportPeriod').value = s.currentPeriod; document.getElementById('reportProjectTitle').textContent = `${p.name} - دوره ${Jalaali.toPersianDigits(s.currentPeriod)}`; document.getElementById('reportPages').value = ''; document.getElementById('reportText').value = ''; const sb = document.getElementById('reportStatusBox'); if (s.status === 'delayed' && s.isLate) { sb.className = 'p-4 rounded-xl text-xs font-medium bg-red-50 border border-red-200 text-red-700 flex items-center gap-2'; sb.innerHTML = `<span>این گزارش <strong>${Jalaali.toPersianDigits(s.delayDays || 0)} روز</strong> تاخیر دارد</span>`; sb.classList.remove('hidden'); } else { sb.classList.add('hidden'); } const m = document.getElementById('reportModal'); const c = document.getElementById('reportContent'); m.classList.remove('hidden'); requestAnimationFrame(() => c.classList.remove('scale-95', 'opacity-0')); }
function closeReportModal() { const m = document.getElementById('reportModal'); const c = document.getElementById('reportContent'); c.classList.add('scale-95', 'opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); }

async function submitReport() { const btn = document.getElementById('submitReportBtn'); btn.disabled = true; btn.innerText = 'در حال ثبت...'; const pid = document.getElementById('reportProjectId').value; const per = parseInt(document.getElementById('reportPeriod').value); const pg = parseInt(document.getElementById('reportPages').value); const txt = document.getElementById('reportText').value.trim(); if (!pg || pg <= 0) { showAlert('لطفاً تعداد صفحات معتبر وارد کنید', 'warning'); btn.disabled = false; btn.innerText = 'ثبت گزارش'; return; } const p = projectsCache.find(x => x.id === pid); const s = calculateProjectStatus(p); try { await insertReportToSupabase(pid, per, pg, txt, s.isLate || false, s.delayDays || 0); closeReportModal(); showAlert('گزارش ثبت شد', 'success'); await renderProjects(); } catch (e) { showAlert('خطا در ثبت', 'error'); } finally { btn.disabled = false; btn.innerText = 'ثبت گزارش'; } }

async function completeProject(id) { if (!confirm('تکمیل نهایی؟')) return; try { await completeProjectInSupabase(id); showAlert('تکمیل شد', 'success'); await renderProjects(); } catch (e) { showAlert('خطا', 'error'); } }
async function confirmDelete() { const id = document.getElementById('deleteProjectId').value; const btn = document.getElementById('confirmDeleteBtn'); btn.disabled = true; btn.innerText = 'حذف...'; try { await softDeleteProject(id); document.getElementById('deleteModal').classList.add('hidden'); showAlert('حذف شد', 'success'); await renderProjects(); } catch (e) { showAlert('خطا', 'error'); } finally { btn.disabled = false; btn.innerText = 'حذف'; } }

document.getElementById('typistForm').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    const btn = document.getElementById('submitBtn'); 
    btn.disabled = true; 
    document.getElementById('submitBtnText').innerText = 'ذخیره...'; 
    
    const id = document.getElementById('editId').value; 
    const n = document.getElementById('name').value.trim(); 
    const ph = document.getElementById('phone').value.trim(); 
    const t = document.getElementById('title').value.trim(); 
    const dd = document.getElementById('deliveryDate').value.trim(); 
    
    // ✅ اصلاح پیام خطا: اگر تاریخ خالی بود یا نامعتبر بود
    if (!dd) { 
        showAlert('لطفاً تاریخ دریافت کار را از تقویم انتخاب کنید', 'warning'); 
        btn.disabled = false; 
        document.getElementById('submitBtnText').innerText = id ? 'ذخیره تغییرات' : 'ذخیره پروژه'; 
        return; 
    } 
    if (!Jalaali.parseJalali(dd)) { 
        showAlert('فرمت تاریخ نامعتبر است. لطفاً از تقویم برنامه انتخاب کنید.', 'warning'); 
        btn.disabled = false; 
        document.getElementById('submitBtnText').innerText = id ? 'ذخیره تغییرات' : 'ذخیره پروژه'; 
        return; 
    } 
    
    try { 
        await saveProjectToSupabase({ id, name: n, phone: ph, title: t, startDate: dd }); 
        closeProjectModal(); 
        showAlert(id ? 'ویرایش شد' : 'ثبت شد', 'success'); 
        await renderProjects(); 
    } catch (er) { 
        showAlert('خطا در ذخیره‌سازی', 'error'); 
    } finally { 
        btn.disabled = false; 
        document.getElementById('submitBtnText').innerText = id ? 'ذخیره تغییرات' : 'ذخیره پروژه'; 
    } 
});

function exportToCSV() { if (!projectsCache || projectsCache.length === 0) { showAlert('پروژه‌ای نیست', 'warning'); return; } const h = ['نام', 'شماره', 'عنوان', 'تاریخ دریافت کار', 'وضعیت', 'صفحات', 'گزارش‌ها']; let c = "\uFEFF" + h.map(x => `"${x}"`).join(',') + '\n'; projectsCache.forEach(p => { const s = calculateProjectStatus(p); const stTxt = s.status === 'active' ? 'به‌موقع' : s.status === 'pending' ? (s.isNotStarted ? 'در انتظار شروع' : 'در انتظار گزارش') : s.status === 'delayed' ? (s.delayText || 'تاخیر') : 'تکمیل'; const tp = (p.reports || []).reduce((a, r) => a + r.pages, 0); const rt = (p.reports || []).map(r => `دوره ${r.period}:${r.pages}ص`).join(' | '); c += [esc(p.name), esc(p.phone), esc(p.title), esc(p.startDate), esc(stTxt), tp, esc(rt)].map(v => `"${v}"`).join(',') + '\n'; }); const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = `گزارش.csv`; l.click(); }

function showAlert(m, t = 'success') { const c = document.getElementById('alertContainer'); const cl = { success: 'bg-emerald-50 text-emerald-700 border-emerald-200', warning: 'bg-amber-50 text-amber-700 border-amber-200', error: 'bg-red-50 text-red-700 border-red-200' }; const a = document.createElement('div'); a.className = `animate-fade-in flex items-center gap-3 border px-4 py-3 rounded-xl text-sm font-medium ${cl[t]}`; a.textContent = m; c.appendChild(a); setTimeout(() => { a.style.opacity = '0'; setTimeout(() => a.remove(), 300); }, 3000); }

document.getElementById('loginForm').addEventListener('submit', async (e) => { e.preventDefault(); const btn = document.getElementById('loginBtn'); btn.disabled = true; document.getElementById('loginSpinner').classList.remove('hidden'); document.getElementById('loginError').classList.add('hidden'); const { error } = await supabase.auth.signInWithPassword({ email: document.getElementById('emailInput').value, password: document.getElementById('passwordInput').value }); if (error) { document.getElementById('loginError').classList.remove('hidden'); btn.disabled = false; document.getElementById('loginSpinner').classList.add('hidden'); } });
document.getElementById('logoutBtn').addEventListener('click', async () => await supabase.auth.signOut());
supabase.auth.onAuthStateChange((e, s) => { if (s) { document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('appWrapper').classList.remove('hidden'); renderProjects(); } else { document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('appWrapper').classList.add('hidden'); } });

const tt = document.getElementById('themeToggle'); const he = document.documentElement;
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) he.classList.add('dark'); else he.classList.remove('dark');
tt.addEventListener('click', () => { if (he.classList.contains('dark')) { he.classList.remove('dark'); localStorage.theme = 'light'; } else { he.classList.add('dark'); localStorage.theme = 'dark'; } });

supabase.channel('public:typists').on('postgres_changes', { event: '*', schema: 'public', table: 'typists' }, renderProjects).subscribe();
supabase.channel('public:typist_reports').on('postgres_changes', { event: '*', schema: 'public', table: 'typist_reports' }, renderProjects).subscribe();
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeProjectModal(); closeReportModal(); closeCalendar(); document.getElementById('deleteModal').classList.add('hidden'); } });

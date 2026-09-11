import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { toJalaali as libToJalaali, toGregorian as libToGregorian, isLeapJalaaliYear as libIsLeap, jalaaliMonthLength as libMonthLength } from 'https://esm.sh/jalaali-js@1.1.0';

const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 🛡️ تابع جلوگیری از حملات XSS
const esc = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
};

// ============================================
// 🗓️ کتابخانه تقویم شمسی
// ============================================
const Jalaali = {
    jMonthName: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    today() {
        const now = new Date();
        const j = libToJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        return { year: j.jy, month: j.jm, day: j.jd };
    },
    toPersianDigits(str) {
        if (!str) return '';
        const p = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return String(str).replace(/[0-9]/g, d => p[+d]);
    },
    formatJalali(jy, jm, jd) { return this.toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`); },
    parseJalali(str) {
        const parts = String(str).split('/').map(p => +String(p).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return { year: parts[0], month: parts[1], day: parts[2] };
    },
    daysBetween(j1, j2) {
        if(!j1 || !j2) return 0;
        const g1 = libToGregorian(j1.year, j1.month, j1.day);
        const date1 = new Date(g1.gy, g1.gm - 1, g1.gd);
        const g2 = libToGregorian(j2.year, j2.month, j2.day);
        const date2 = new Date(g2.gy, g2.gm - 1, g2.gd);
        return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
    },
    isLeapJalaali(jy) { return libIsLeap(jy); },
    jMonthLength(jy, jm) { return libMonthLength(jy, jm); },
    toGregorian(jy, jm, jd) { const g = libToGregorian(jy, jm, jd); return { year: g.gy, month: g.gm, day: g.gd }; },
    toJalaali(gy, gm, gd) { const j = libToJalaali(gy, gm, gd); return { year: j.jy, month: j.jm, day: j.jd }; }
};

// ============================================
// 📦 مدیریت داده‌ها (Supabase)
// ============================================
let projectsCache = [];

async function loadProjects() {
    const { data, error } = await supabase.from('typists').select('*, typist_reports(*)').is('deleted_at', null).order('created_at', { ascending: false });
    if (error) { console.error("خطا در دریافت اطلاعات:", error); return []; }
    projectsCache = data.map(p => {
        const createdDate = p.created_at ? new Date(p.created_at) : new Date();
        const jCreated = Jalaali.toJalaali(createdDate.getFullYear(), createdDate.getMonth() + 1, createdDate.getDate());
        return {
            id: p.id, name: p.name, phone: p.phone, title: p.title, deliveryDate: p.delivery_date,
            createdAt: Jalaali.formatJalali(jCreated.year, jCreated.month, jCreated.day),
            reports: p.typist_reports || [], completed: p.completed || false
        };
    });
    return projectsCache;
}

async function saveProjectToSupabase(project) {
    const payload = { name: project.name, phone: project.phone, title: project.title, delivery_date: project.deliveryDate };
    if (project.id) {
        const { error } = await supabase.from('typists').update(payload).eq('id', project.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('typists').insert([payload]);
        if (error) throw error;
    }
}

async function softDeleteProject(id) {
    const { error } = await supabase.from('typists').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
}

async function completeProjectInSupabase(id) {
    const { error } = await supabase.from('typists').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
}

async function insertReportToSupabase(projectId, period, pages, text, isLate, delayDays) {
    const { error } = await supabase.from('typist_reports').insert([{ typist_id: projectId, period, pages, description: text, is_late: isLate, delay_days: delayDays }]);
    if (error) throw error;
}

// ============================================
// 🧮 منطق وضعیت و دوره‌های ۱۰ روزه
// ============================================
function calculateProjectStatus(project) {
    const today = Jalaali.today();
    const createdJalali = Jalaali.parseJalali(project.createdAt);
    if (!createdJalali) return { status: 'active', daysLeft: 0 };
    const deliveryJalali = Jalaali.parseJalali(project.deliveryDate);
    const daysSinceCreation = Jalaali.daysBetween(createdJalali, today);
    const daysUntilDelivery = deliveryJalali ? Jalaali.daysBetween(today, deliveryJalali) : 0;
    
    if (project.completed) return { status: 'delivered', daysLeft: 0, currentPeriod: 0, daysUntilDelivery };
    
    const currentPeriod = Math.floor(daysSinceCreation / 10) + 1;
    const deadlineDayForCurrentPeriod = currentPeriod * 10 - 1;
    const reports = project.reports || [];
    const reportedPeriods = reports.map(r => r.period);
    const lastReportedPeriod = reportedPeriods.length > 0 ? Math.max(...reportedPeriods) : 0;
    
    if (reportedPeriods.includes(currentPeriod)) return { status: 'active', daysLeft: 0, currentPeriod, daysUntilDelivery, isLate: false };
    if (lastReportedPeriod < currentPeriod - 1) return { status: 'delayed', daysLeft: 0, currentPeriod, daysUntilDelivery, delayText: `${currentPeriod - lastReportedPeriod - 1} دوره جا افتاده است` };
    
    const daysLeftInPeriod = deadlineDayForCurrentPeriod - daysSinceCreation + 1;
    if (daysLeftInPeriod < 0) return { status: 'delayed', daysLeft: 0, currentPeriod, daysUntilDelivery, delayText: `${Math.abs(daysLeftInPeriod)} روز از موعد گزارش گذشته`, isLate: true, delayDays: Math.abs(daysLeftInPeriod) };
    
    const isUrgent = daysLeftInPeriod <= 3;
    return { status: isUrgent ? 'pending' : 'active', daysLeft: daysLeftInPeriod, currentPeriod, daysUntilDelivery };
}

// ============================================
// 🎨 رندر کارت پروژه
// ============================================
function renderProjectCard(project) {
    const status = calculateProjectStatus(project);
    // تطبیق رنگ‌ها با UI جدید (سبز نفتی و قرمز)
    const colors = {
        active: { badge: 'bg-blue-50 text-blue-700 border-blue-100', bar: 'bg-blue-500', text: 'text-blue-600' },
        pending: { badge: 'bg-amber-50 text-amber-700 border-amber-100', bar: 'bg-amber-500', text: 'text-amber-600' },
        delayed: { badge: 'bg-red-50 text-red-700 border-red-100', bar: 'bg-red-500', text: 'text-red-600' },
        delivered: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: 'bg-emerald-500', text: 'text-emerald-600' }
    }[status.status];
    
    const statusText = { active: 'به‌موقع', pending: `${status.daysLeft} روز مانده`, delayed: status.delayText || 'تاخیر', delivered: 'تکمیل شده' }[status.status];
    
    const totalPages = (project.reports || []).reduce((s, r) => s + (r.pages || 0), 0);
    const reportsCount = (project.reports || []).length;
    const initials = esc(project.name.split(' ').map(n => n[0]).join('').slice(0, 2));
    
    const reportsHtml = (project.reports || []).sort((a,b) => b.period - a.period).map(r => `
        <div class="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] border border-slate-100 dark:border-slate-700/50">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full ${r.is_late ? 'bg-red-500' : 'bg-emerald-500'} flex-shrink-0"></span>
                <span class="text-slate-700 dark:text-slate-300 truncate">دوره ${Jalaali.toPersianDigits(r.period)} • ${Jalaali.toPersianDigits(r.pages)} صفحه</span>
            </div>
        </div>`).join('');
    
    return `<div class="project-card group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all animate-slide-up" data-id="${project.id}" data-status="${status.status}">
        <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">${initials}</div>
                <div class="min-w-0">
                    <h3 class="font-bold text-slate-900 dark:text-white text-sm truncate">${esc(project.name)}</h3>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="ltr" style="text-align: right;">${esc(Jalaali.toPersianDigits(project.phone))}</p>
                </div>
            </div>
            <button class="menu-btn w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition flex-shrink-0" data-id="${project.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg></button>
        </div>
        
        <div class="mb-3">
            <p class="text-xs text-slate-700 dark:text-slate-200 font-medium line-clamp-1 mb-1.5">${esc(project.title)}</p>
            <div class="flex items-center justify-between text-[10px]">
                <span class="px-2 py-0.5 rounded-md font-bold border ${colors.badge}">${statusText}</span>
                <span class="text-slate-400 font-medium">تحویل: ${esc(project.deliveryDate)}</span>
            </div>
        </div>

        ${status.status !== 'delivered' ? `
        <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-slate-400 font-medium">دوره ${Jalaali.toPersianDigits(status.currentPeriod)} • ${status.daysLeft > 0 ? `${Jalaali.toPersianDigits(status.daysLeft)} روز مانده` : 'پایان یافته'}</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div class="${colors.bar} h-1.5 rounded-full transition-all duration-700" style="width: ${Math.min(100, ((10 - status.daysLeft) / 10) * 100)}%"></div>
            </div>
        </div>` : ''}

        <div class="mb-3 flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
            <span class="text-slate-500 dark:text-slate-400 font-medium">گزارش‌ها: ${Jalaali.toPersianDigits(reportsCount)} • ${Jalaali.toPersianDigits(totalPages)} صفحه</span>
            ${reportsCount > 0 ? `<button type="button" class="toggle-reports text-primary-600 dark:text-primary-400 font-bold hover:underline">جزئیات</button>` : ''}
        </div>
        
        <div class="report-list hidden mb-3 space-y-1.5 max-h-28 overflow-y-auto pr-1">
            ${reportsHtml}
        </div>

        <div class="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            ${status.status !== 'delivered' ? `
            <button class="report-btn flex-1 py-2 rounded-lg ${status.status === 'delayed' ? 'bg-red-600 hover:bg-red-500' : 'bg-primary-600 hover:bg-primary-500'} text-white text-[11px] font-bold transition" data-id="${project.id}">ثبت گزارش</button>
            <button class="complete-btn py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 text-[11px] font-medium border border-emerald-100" data-id="${project.id}">تکمیل</button>` : `<div class="flex-1 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-bold text-center">پروژه تکمیل شده است</div>`}
        </div>
    </div>`;
}

async function renderProjects() {
    const projects = await loadProjects();
    const listEl = document.getElementById('typistList');
    const emptyEl = document.getElementById('emptyState');
    if (projects.length === 0) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); }
    else { emptyEl.classList.add('hidden'); listEl.innerHTML = projects.map(renderProjectCard).join(''); }
    updateStats(projects); applyFilter();
}

function updateStats(projects) {
    const stats = { active: 0, pending: 0, delayed: 0, delivered: 0 };
    projects.forEach(p => { stats[calculateProjectStatus(p).status]++; });
    document.getElementById('stat-active').textContent = Jalaali.toPersianDigits(stats.active);
    document.getElementById('stat-pending').textContent = Jalaali.toPersianDigits(stats.pending);
    document.getElementById('stat-delayed').textContent = Jalaali.toPersianDigits(stats.delayed);
    document.getElementById('stat-delivered').textContent = Jalaali.toPersianDigits(stats.delivered);
}

// ============================================
// 🔐 احراز هویت
// ============================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    document.getElementById('loginSpinner').classList.remove('hidden');
    document.getElementById('loginError').classList.add('hidden');
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        document.getElementById('loginError').classList.remove('hidden');
        btn.disabled = false;
        document.getElementById('loginSpinner').classList.add('hidden');
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appWrapper').classList.remove('hidden');
        renderProjects();
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('appWrapper').classList.add('hidden');
    }
});

// ============================================
// 🚪 مودال‌ها و اکشن‌ها (Event Delegation)
// ============================================
document.getElementById('openProjectBtn').addEventListener('click', () => openProjectModal());
document.getElementById('emptyAddBtn').addEventListener('click', () => openProjectModal());
document.getElementById('closeFormBtn').addEventListener('click', closeProjectModal);
document.getElementById('modalBackdrop').addEventListener('click', closeProjectModal);
document.getElementById('closeReportBtn').addEventListener('click', closeReportModal);
document.getElementById('reportBackdrop').addEventListener('click', closeReportModal);
document.getElementById('cancelDeleteBtn').addEventListener('click', () => document.getElementById('deleteModal').classList.add('hidden'));
document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
document.getElementById('exportBtn').addEventListener('click', exportToCSV);

document.getElementById('typistList').addEventListener('click', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.menu-btn')) {
        document.getElementById('deleteProjectId').value = id;
        document.getElementById('deleteModal').classList.remove('hidden');
    } else if (e.target.closest('.report-btn')) {
        openReportModal(id);
    } else if (e.target.closest('.complete-btn')) {
        completeProject(id);
    } else if (e.target.closest('.toggle-reports')) {
        const list = card.querySelector('.report-list');
        if (list) list.classList.toggle('hidden');
    }
});

function openProjectModal(projectId = null) {
    const modal = document.getElementById('formModal'); const backdrop = document.getElementById('modalBackdrop'); const content = document.getElementById('modalContent');
    document.getElementById('typistForm').reset(); document.getElementById('editId').value = '';
    if (projectId) {
        const p = projectsCache.find(x => x.id === projectId);
        if (p) {
            document.getElementById('editId').value = p.id; document.getElementById('name').value = p.name;
            document.getElementById('phone').value = p.phone; document.getElementById('title').value = p.title;
            document.getElementById('deliveryDate').value = p.deliveryDate;
            document.getElementById('formTitle').textContent = 'ویرایش پروژه'; document.getElementById('submitBtnText').textContent = 'ذخیره تغییرات';
        }
    } else {
        document.getElementById('formTitle').textContent = 'ثبت پروژه جدید'; document.getElementById('submitBtnText').textContent = 'ذخیره پروژه';
    }
    modal.classList.remove('hidden'); requestAnimationFrame(() => { backdrop.classList.remove('opacity-0'); content.classList.remove('scale-95', 'opacity-0'); });
}

function closeProjectModal() {
    const modal = document.getElementById('formModal'); const backdrop = document.getElementById('modalBackdrop'); const content = document.getElementById('modalContent');
    backdrop.classList.add('opacity-0'); content.classList.add('scale-95', 'opacity-0'); setTimeout(() => modal.classList.add('hidden'), 300);
}

function openReportModal(projectId) {
    const project = projectsCache.find(p => p.id === projectId);
    if (!project) return;
    const status = calculateProjectStatus(project);
    if (status.status === 'delivered') return;
    if (project.reports && project.reports.some(r => r.period === status.currentPeriod)) {
        showAlert('برای این دوره قبلاً گزارش ثبت شده است.', 'warning'); return;
    }
    document.getElementById('reportProjectId').value = projectId;
    document.getElementById('reportPeriod').value = status.currentPeriod;
    document.getElementById('reportProjectTitle').textContent = `${project.name} - دوره ${Jalaali.toPersianDigits(status.currentPeriod)}`;
    document.getElementById('reportPages').value = ''; document.getElementById('reportText').value = '';
    const statusBox = document.getElementById('reportStatusBox');
    if (status.status === 'delayed' && status.isLate) {
        statusBox.className = 'p-4 rounded-xl text-xs font-medium bg-red-50 dark:bg-red-500/10 border border-red-200 text-red-700 flex items-center gap-2';
        statusBox.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>این گزارش <strong>${Jalaali.toPersianDigits(status.delayDays)} روز</strong> تاخیر دارد</span>`;
        statusBox.classList.remove('hidden');
    } else { statusBox.classList.add('hidden'); }
    const modal = document.getElementById('reportModal'); const content = document.getElementById('reportContent');
    modal.classList.remove('hidden'); requestAnimationFrame(() => content.classList.remove('scale-95', 'opacity-0'));
}

function closeReportModal() {
    const modal = document.getElementById('reportModal'); const content = document.getElementById('reportContent');
    content.classList.add('scale-95', 'opacity-0'); setTimeout(() => modal.classList.add('hidden'), 300);
}

document.getElementById('submitReportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('submitReportBtn');
    btn.disabled = true; btn.innerText = 'در حال ثبت...';
    const projectId = document.getElementById('reportProjectId').value;
    const period = parseInt(document.getElementById('reportPeriod').value);
    const pages = parseInt(document.getElementById('reportPages').value);
    const text = document.getElementById('reportText').value.trim();
    if (!pages || pages <= 0) { showAlert('لطفاً تعداد صفحات معتبر وارد کنید', 'warning'); btn.disabled = false; btn.innerText = 'ثبت گزارش'; return; }
    const project = projectsCache.find(p => p.id === projectId);
    const status = calculateProjectStatus(project);
    try {
        await insertReportToSupabase(projectId, period, pages, text, status.isLate || false, status.delayDays || 0);
        closeReportModal(); showAlert('گزارش با موفقیت ثبت شد', 'success');
    } catch (err) {
        showAlert('خطا در ثبت گزارش', 'error');
    } finally {
        btn.disabled = false; btn.innerText = 'ثبت گزارش';
    }
});

async function completeProject(projectId) {
    if (!confirm('آیا از تکمیل نهایی پروژه اطمینان دارید؟')) return;
    try { await completeProjectInSupabase(projectId); showAlert('پروژه تکمیل شد', 'success'); } 
    catch (err) { showAlert('خطا در ثبت', 'error'); }
}

async function confirmDelete() {
    const id = document.getElementById('deleteProjectId').value;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true; btn.innerText = 'در حال حذف...';
    try { await softDeleteProject(id); document.getElementById('deleteModal').classList.add('hidden'); showAlert('پروژه حذف شد', 'success'); } 
    catch (err) { showAlert('خطا در حذف', 'error'); } 
    finally { btn.disabled = false; btn.innerText = 'بله، حذف شود'; }
}

document.getElementById('typistForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; document.getElementById('submitBtnText').innerText = 'در حال ذخیره...';
    const id = document.getElementById('editId').value;
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const title = document.getElementById('title').value.trim();
    const deliveryDate = document.getElementById('deliveryDate').value.trim();
    if (!Jalaali.parseJalali(deliveryDate)) { showAlert('تاریخ تحویل نامعتبر است', 'warning'); btn.disabled = false; document.getElementById('submitBtnText').innerText = 'ذخیره پروژه'; return; }
    try {
        await saveProjectToSupabase({ id, name, phone, title, deliveryDate });
        closeProjectModal(); showAlert(id ? 'پروژه ویرایش شد' : 'پروژه جدید ثبت شد', 'success');
    } catch (err) {
        showAlert('خطا در ذخیره‌سازی', 'error');
    } finally {
        btn.disabled = false; document.getElementById('submitBtnText').innerText = 'ذخیره پروژه';
    }
});

// ============================================
// 📤 خروجی CSV
// ============================================
function exportToCSV() {
    if (!projectsCache || projectsCache.length === 0) { showAlert('پروژه‌ای برای خروجی وجود ندارد', 'warning'); return; }
    const headers = ['نام', 'شماره', 'عنوان', 'تحویل', 'وضعیت', 'مجموع صفحات', 'گزارش‌ها'];
    let csv = "\uFEFF" + headers.map(h => `"${h}"`).join(',') + '\n';
    projectsCache.forEach(p => {
        const status = calculateProjectStatus(p).status;
        const totalPages = (p.reports || []).reduce((s, r) => s + r.pages, 0);
        const repText = (p.reports || []).map(r => `دوره ${r.period}: ${r.pages} صفحه`).join(' | ');
        csv += [esc(p.name), esc(p.phone), esc(p.title), esc(p.deliveryDate), esc(status), totalPages, esc(repText)].map(v => `"${v}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const today = Jalaali.today();
    link.setAttribute('href', url);
    link.setAttribute('download', `گزارش-${Jalaali.formatJalali(today.year, today.month, today.day)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}

// ============================================
// 💬 آلرت‌ها و فیلترها
// ============================================
function showAlert(message, type = 'success') {
    const container = document.getElementById('alertContainer');
    const colors = { success: 'bg-emerald-50 text-emerald-700 border-emerald-200', warning: 'bg-amber-50 text-amber-700 border-amber-200', error: 'bg-red-50 text-red-700 border-red-200' };
    const alert = document.createElement('div');
    alert.className = `animate-fade-in flex items-center gap-3 border px-4 py-3 rounded-xl text-sm font-medium ${colors[type]}`;
    alert.textContent = message;
    container.appendChild(alert);
    setTimeout(() => { alert.style.opacity = '0'; setTimeout(() => alert.remove(), 300); }, 3000);
}

let currentFilter = 'all';
function applyFilter() { document.querySelectorAll('.project-card').forEach(c => c.style.display = (currentFilter === 'all' || c.dataset.status === currentFilter) ? '' : 'none'); }
document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'shadow-sm'));
    btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'shadow-sm');
    applyFilter();
}));
document.querySelector('[data-filter="all"]').classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-900', 'dark:text-white', 'shadow-sm');

// ============================================
// 📅 تقویم شمسی (پاپ آپ مودال)
// ============================================
let calendarState = { viewYear: null, viewMonth: null, selected: null, inputEl: null };

function openCalendar(inputEl, initialValue = null) {
    const today = Jalaali.today(); calendarState.inputEl = inputEl;
    if (initialValue && Jalaali.parseJalali(initialValue)) { const p = Jalaali.parseJalali(initialValue); calendarState.viewYear = p.year; calendarState.viewMonth = p.month; calendarState.selected = p; }
    else { calendarState.viewYear = today.year; calendarState.viewMonth = today.month; calendarState.selected = null; }
    renderCalendar(); document.getElementById('calendarModal').classList.remove('hidden');
}

function closeCalendar() { document.getElementById('calendarModal').classList.add('hidden'); }

function renderCalendar() {
    const container = document.getElementById('calendarContainer'); 
    const today = Jalaali.today(); 
    const { viewYear, viewMonth, selected } = calendarState;
    const firstDayGreg = Jalaali.toGregorian(viewYear, viewMonth, 1);
    const jsDay = new Date(firstDayGreg.year, firstDayGreg.month - 1, firstDayGreg.day).getDay();
    const startOffset = (jsDay + 1) % 7; 
    const daysInMonth = Jalaali.jMonthLength(viewYear, viewMonth);
    
    let html = `<div class="flex items-center justify-between mb-4">
        <button type="button" class="cal-prev w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 flex items-center justify-center transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>
        <div class="text-base font-black text-slate-900 dark:text-white">${Jalaali.jMonthName[viewMonth - 1]} ${Jalaali.toPersianDigits(viewYear)}</div>
        <button type="button" class="cal-next w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 flex items-center justify-center transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
    </div>
    <div class="grid grid-cols-7 gap-1 mb-2">${['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(d => `<div class="text-xs font-bold text-slate-400 text-center pb-2">${d}</div>`).join('')}</div>
    <div class="grid grid-cols-7 gap-1">`;
    
    for (let i = 0; i < startOffset; i++) html += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = viewYear === today.year && viewMonth === today.month && d === today.day;
        const isSelected = selected && selected.year === viewYear && selected.month === viewMonth && selected.day === d;
        html += `<div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-day="${d}">${Jalaali.toPersianDigits(d)}</div>`;
    }
    html += `</div>
    <div class="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <button type="button" class="cal-today text-xs text-primary-600 font-medium bg-primary-50 px-3 py-1.5 rounded-lg">انتخاب امروز</button>
        <button type="button" class="cal-close text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg">بستن</button>
    </div>`;
    container.innerHTML = html;
}

document.getElementById('calendarModal').addEventListener('click', function(e) {
    if (e.target.classList.contains('cal-backdrop')) { closeCalendar(); return; }
    if (e.target.closest('.cal-prev')) {
        calendarState.viewMonth--; if (calendarState.viewMonth < 1) { calendarState.viewMonth = 12; calendarState.viewYear--; } renderCalendar();
    } else if (e.target.closest('.cal-next')) {
        calendarState.viewMonth++; if (calendarState.viewMonth > 12) { calendarState.viewMonth = 1; calendarState.viewYear++; } renderCalendar();
    } else if (e.target.closest('.cal-today')) {
        const t = Jalaali.today(); calendarState.selected = { year: t.year, month: t.month, day: t.day }; calendarState.inputEl.value = Jalaali.formatJalali(t.year, t.month, t.day); closeCalendar();
    } else if (e.target.closest('.cal-close')) {
        closeCalendar();
    } else if (e.target.closest('.cal-day')) {
        const dayEl = e.target.closest('.cal-day');
        if (!dayEl.dataset.day) return;
        const d = parseInt(dayEl.dataset.day);
        calendarState.selected = { year: calendarState.viewYear, month: calendarState.viewMonth, day: d };
        calendarState.inputEl.value = Jalaali.formatJalali(calendarState.viewYear, calendarState.viewMonth, d);
        closeCalendar();
    }
});

document.getElementById('deliveryDate').addEventListener('click', function() {
    openCalendar(this, this.value);
});

// 🌓 Theme Toggle
const themeToggleBtn = document.getElementById('themeToggle'); const htmlElement = document.documentElement;
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) htmlElement.classList.add('dark'); else htmlElement.classList.remove('dark');
themeToggleBtn.addEventListener('click', () => { if (htmlElement.classList.contains('dark')) { htmlElement.classList.remove('dark'); localStorage.theme = 'light'; } else { htmlElement.classList.add('dark'); localStorage.theme = 'dark'; } });

// 🔄 Realtime
supabase.channel('public:typists').on('postgres_changes', { event: '*', schema: 'public', table: 'typists' }, renderProjects).subscribe();
supabase.channel('public:typist_reports').on('postgres_changes', { event: '*', schema: 'public', table: 'typist_reports' }, renderProjects).subscribe();

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeProjectModal(); closeReportModal(); closeCalendar(); document.getElementById('deleteModal').classList.add('hidden'); } });

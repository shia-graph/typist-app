import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { toJalaali as libToJalaali, toGregorian as libToGregorian, jalaaliMonthLength as libMonthLength } from 'https://esm.sh/jalaali-js@1.1.0';

const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const esc = (str) => { if (!str) return ''; return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
const formatNum = (num) => new Intl.NumberFormat('fa-IR').format(Math.round(num || 0));

const Jalaali = {
    jMonthName: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    today() { const n = new Date(); const j = libToJalaali(n.getFullYear(), n.getMonth()+1, n.getDate()); return { year: j.jy, month: j.jm, day: j.jd }; },
    toPersianDigits(str) { if(!str) return ''; const p = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹']; return String(str).replace(/[0-9]/g, d => p[+d]); },
    formatJalali(jy, jm, jd) { return this.toPersianDigits(`${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`); },
    parseJalali(str) { 
        if (!str || typeof str !== 'string') return null;
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        const normalized = String(str).replace(/[۰-۹]/g, d => persianDigits.indexOf(d));
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
    }
};

let personsCache = [];
let currentUser = null;
let currentUserProfile = null;
let currentSettleId = null;
let calendarTargetInput = null;
let calendarState = { viewYear: null, viewMonth: null, selected: null };

// ============================================
// احراز هویت
// ============================================
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    currentUser = user;

    const { data: profile, error: profileError } = await supabase.from('typists').select('*').eq('user_id', user.id).maybeSingle();
    if (profileError) console.error("Profile Error:", profileError);
    
    currentUserProfile = profile;
    
    if (profile && profile.is_admin) {
        document.getElementById('userWrapper').classList.add('hidden');
        document.getElementById('adminWrapper').classList.remove('hidden');
        loadAdminData();
    } else if (profile) {
        document.getElementById('adminWrapper').classList.add('hidden');
        document.getElementById('userWrapper').classList.remove('hidden');
        document.getElementById('userName').textContent = profile.name;
        loadUserData(profile);
    } else {
        alert('پروفایل کاربری شما در سیستم یافت نشد. لطفا با مدیر سیستم تماس بگیرید.');
        await supabase.auth.signOut();
    }
}

// ============================================
// محاسبه دقیق وضعیت دوره ۱۰ روزه
// ============================================
function calculatePeriodStatus(deliveryDateStr, reportsArray) {
    const today = Jalaali.today();
    const startDate = deliveryDateStr ? Jalaali.parseJalali(deliveryDateStr) : today;
    if (!startDate) return { periodText: 'تاریخ نامعتبر', statusClass: 'text-red-600 bg-red-50', periodToReport: 1 };

    const daysPassed = Math.max(0, Jalaali.daysBetween(startDate, today));
    const currentPeriod = Math.floor(daysPassed / 10) + 1;
    const daysIntoCurrentPeriod = daysPassed % 10;
    const daysLeft = 10 - daysIntoCurrentPeriod;

    const reports = reportsArray || [];
    const reportedPeriods = reports.map(r => Number(r.period) || 0).filter(n => n > 0);
    const lastReportedPeriod = reportedPeriods.length > 0 ? Math.max(...reportedPeriods) : 0;
    
    let periodText = '', statusClass = '';
    let periodToReport = lastReportedPeriod + 1;

    if (lastReportedPeriod >= currentPeriod) {
        // دوره فعلی گزارش داده شده
        periodText = `دوره ${currentPeriod} ثبت شد (${daysLeft} روز تا دوره بعد)`;
        statusClass = 'text-emerald-600 bg-emerald-50 border border-emerald-200';
    } else if (lastReportedPeriod < currentPeriod - 1) {
        // چند دوره تاخیر دارد
        const missedPeriods = currentPeriod - 1 - lastReportedPeriod;
        periodText = `${missedPeriods} دوره تاخیر (دوره ${periodToReport} ثبت نشده)`;
        statusClass = 'text-red-600 bg-red-50 border border-red-200';
    } else {
        // در دوره فعلی است و هنوز گزارش نداده
        periodText = `دوره ${currentPeriod} (${daysLeft} روز مانده)`;
        statusClass = 'text-amber-600 bg-amber-50 border border-amber-200';
    }

    return { periodText, statusClass, periodToReport, daysPassed, daysLeft };
}

// ============================================
// منطق ادمین
// ============================================
async function loadAdminData() {
    const { data, error } = await supabase.from('typists').select('*, typist_reports(*), payments(*)');
    if (error) { alert("خطا در دریافت لیست: " + error.message); return; }
    
    personsCache = (data || []).filter(p => !p.is_admin);
    
    const list = document.getElementById('adminList');
    list.innerHTML = personsCache.map(p => {
        const reports = p.typist_reports || [];
        const settles = p.payments || [];
        const totalSettled = settles.reduce((s, r) => s + Number(r.amount || 0), 0);
        
        const { periodText, statusClass } = calculatePeriodStatus(p.delivery_date, reports);
        const phoneEn = (p.phone || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

        return `
        <div class="glass rounded-2xl p-5 border border-slate-200/50">
            <div onclick="window.toggleCard('${p.id}')" class="cursor-pointer">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="font-bold">${esc(p.name)}</h3>
                        <p class="text-xs text-slate-500">${esc(p.title || 'بدون عنوان')}</p>
                    </div>
                    <a href="tel:${phoneEn}" class="text-blue-600 text-xs font-bold border border-blue-200 rounded-lg px-2 py-1" onclick="event.stopPropagation()">تماس</a>
                </div>
                
                <div class="mb-3">
                    <span class="text-xs font-bold px-2 py-1 rounded-lg ${statusClass}">${periodText}</span>
                </div>

                <div class="text-xs text-slate-500 space-y-1">
                    <p>مجموع تسویه شده: <span class="font-bold text-emerald-600">${formatNum(totalSettled)}</span> تومان</p>
                    <p>تعداد گزارش‌ها: ${formatNum(reports.length)} مورد</p>
                </div>
            </div>

            <div id="card-details-${p.id}" class="card-accordion mt-4 border-t border-slate-200 pt-4">
                <h4 class="font-bold text-sm mb-2">سوابق گزارش‌ها:</h4>
                <div class="space-y-2 mb-4">
                    ${reports.map(r => `<div class="text-xs bg-slate-50 p-2 rounded-lg">دوره ${r.period} - ${r.pages} صفحه</div>`).join('') || '<p class="text-xs text-slate-400">گزارشی ثبت نشده</p>'}
                </div>
                
                <h4 class="font-bold text-sm mb-2">سوابق تسویه:</h4>
                <div class="space-y-2 mb-4">
                    ${settles.map(s => `<div class="text-xs bg-slate-50 p-2 rounded-lg">${formatNum(s.amount)} تومان</div>`).join('') || '<p class="text-xs text-slate-400">تسویه‌ای ثبت نشده</p>'}
                </div>

                <div class="flex gap-2">
                    <button onclick="window.openAdminReportModal('${p.id}')" class="flex-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">+ گزارش</button>
                    <button onclick="window.openSettleModal('${p.id}')" class="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-200">+ تسویه</button>
                    <button onclick="window.editPerson('${p.id}')" class="py-2 px-3 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold border border-slate-200">ویرایش</button>
                    <button onclick="window.deletePerson('${p.id}')" class="py-2 px-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100">حذف</button>
                </div>
            </div>
        </div>`;
    }).join('') || '<p class="text-center text-slate-400 col-span-full">هنوز تایپیستی ثبت نشده است.</p>';
}

// ============================================
// توابع سراسری (Window)
// ============================================
window.toggleCard = (id) => {
    const el = document.getElementById(`card-details-${id}`);
    if (el) el.classList.toggle('open');
};

window.closePersonModal = () => document.getElementById('personModal').classList.add('hidden');
window.editPerson = (id) => {
    const p = personsCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('personId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pPhone').value = p.phone || '';
    document.getElementById('pTitle').value = p.title || '';
    document.getElementById('pDeliveryDate').value = p.delivery_date || '';
    document.getElementById('personModalTitle').textContent = 'ویرایش تایپیست';
    document.getElementById('personModal').classList.remove('hidden');
};

window.openSettleModal = (id) => {
    currentSettleId = id;
    document.getElementById('settleQty').value = 0;
    document.getElementById('settleRate').value = 0;
    document.getElementById('settleAmount').value = 0;
    document.getElementById('settleDesc').value = '';
    document.getElementById('settleModal').classList.remove('hidden');
};
window.closeSettleModal = () => document.getElementById('settleModal').classList.add('hidden');
window.calcSettle = () => {
    const q = parseFloat(document.getElementById('settleQty').value) || 0;
    const r = parseFloat(document.getElementById('settleRate').value) || 0;
    document.getElementById('settleAmount').value = q * r;
};
window.deletePerson = async (id) => {
    if(confirm('حذف شود؟')) { 
        const { error } = await supabase.from('typists').delete().eq('id', id); 
        if (error) { alert("خطا در حذف: " + error.message); }
        else { loadAdminData(); }
    }
};
window.calPrev = () => { calendarState.viewMonth--; if (calendarState.viewMonth < 1) { calendarState.viewMonth = 12; calendarState.viewYear--; } renderCalendarModal(); };
window.calNext = () => { calendarState.viewMonth++; if (calendarState.viewMonth > 12) { calendarState.viewMonth = 1; calendarState.viewYear++; } renderCalendarModal(); };
window.calSelect = (d) => { 
    calendarTargetInput.value = Jalaali.formatJalali(calendarState.viewYear, calendarState.viewMonth, d); 
    document.getElementById('calendarModal').classList.add('hidden'); 
};

// ============================================
// منطق تایپیست
// ============================================
async function loadUserData(profile) {
    const pid = profile.id;
    const { data: reports, error: rErr } = await supabase.from('typist_reports').select('*').eq('typist_id', pid).order('created_at', { ascending: false });
    const { data: settles, error: sErr } = await supabase.from('payments').select('*').eq('person_id', pid);
    
    if (rErr) console.error("Reports Error:", rErr);
    if (sErr) console.error("Settles Error:", sErr);

    const totalSettled = settles?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
    
    const { periodText } = calculatePeriodStatus(profile.delivery_date, reports);
    document.getElementById('userStatus').textContent = periodText;
    
    const list = document.getElementById('userWorkList');
    list.innerHTML = reports?.map(r => `
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100">
            <div><p class="text-sm font-bold">دوره ${r.period}: ${r.pages} صفحه</p><p class="text-xs text-slate-500">${r.description || ''}</p></div>
        </div>
    `).join('') || '<p class="text-center text-slate-400">هنوز گزارشی ثبت نشده است.</p>';
}

// ============================================
// فرم‌ها و رویدادها
// ============================================
document.getElementById('personForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('personId').value;
    const payload = { 
        name: document.getElementById('pName').value, 
        phone: document.getElementById('pPhone').value,
        title: document.getElementById('pTitle').value,
        delivery_date: document.getElementById('pDeliveryDate').value 
    };
    
    let error;
    if (id) { 
        const res = await supabase.from('typists').update(payload).eq('id', id); 
        error = res.error;
    } else { 
        const res = await supabase.from('typists').insert([payload]); 
        error = res.error;
    }

    if (error) {
        alert("خطا در ذخیره تایپیست: " + error.message);
    } else {
        alert("تایپیست با موفقیت ذخیره شد.");
        window.closePersonModal(); 
        loadAdminData();
    }
});

document.getElementById('settleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('settleAmount').value) || 0;
    if (amount <= 0) { alert("مبلغ نامعتبر است"); return; }

    const { error } = await supabase.from('payments').insert([{
        person_id: currentSettleId,
        amount: amount,
        description: document.getElementById('settleDesc').value,
        status: 'valid'
    }]);
    
    if (error) { alert("خطا در ثبت تسویه: " + error.message); }
    else { alert("تسویه با موفقیت ثبت شد."); window.closeSettleModal(); loadAdminData(); }
});

document.getElementById('userWorkForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUserProfile) {
        alert('پروفایل شما یافت نشد. لطفاً خارج شوید و دوباره وارد شوید.');
        return;
    }

    const form = e.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton.disabled) return;

    const pages = Number.parseInt(
        document.getElementById('userWorkPages').value,
        10
    );
    const description = document.getElementById('userWorkDesc').value.trim();

    if (!Number.isInteger(pages) || pages < 0) {
        alert('تعداد صفحات معتبر نیست.');
        return;
    }

    const pid = currentUserProfile.id;
    const { periodToReport } = calculatePeriodStatus(currentUserProfile.delivery_date, currentUserProfile.typist_reports || []);

    submitButton.disabled = true;
    submitButton.textContent = 'در حال ثبت...';

    try {
        const { data, error } = await supabase
            .from('typist_reports')
            .insert([{
                typist_id: pid,
                period: periodToReport,
                pages: pages,
                description: description
            }])
            .select()
            .single();

        if (error) {
            console.error('Report insert error:', error);
            alert('خطا در ثبت گزارش: ' + error.message);
            return;
        }

        alert('گزارش با موفقیت ثبت شد.');
        form.reset();

        await loadUserData(currentUserProfile);
    } catch (err) {
        console.error('Unexpected report error:', err);
        alert('خطای غیرمنتظره هنگام ثبت گزارش: ' + (err.message || err));
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'ثبت گزارش';
    }
});

// ============================================
// مودال ثبت گزارش توسط مدیر
// ============================================
window.openAdminReportModal = (id) => {
    const p = personsCache.find(x => x.id === id);
    if (!p) return;

    document.getElementById('adminReportPersonId').value = id;
    
    const today = Jalaali.today();
    const { periodToReport } = calculatePeriodStatus(p.delivery_date, p.typist_reports || []);

    document.getElementById('adminReportDate').value = Jalaali.formatJalali(today.year, today.month, today.day);
    document.getElementById('adminReportPages').value = 0;
    document.getElementById('adminReportDesc').value = '';
    
    document.getElementById('adminReportModal').querySelector('h2').textContent = `ثبت گزارش (دوره ${periodToReport}) برای ${p.name}`;
    
    document.getElementById('adminReportModal').classList.remove('hidden');
};
window.closeAdminReportModal = () => document.getElementById('adminReportModal').classList.add('hidden');

document.getElementById('adminReportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const personId = document.getElementById('adminReportPersonId').value;
    const p = personsCache.find(x => x.id === personId);
    if (!p) return;

    const pages = parseInt(document.getElementById('adminReportPages').value) || 0;
    const description = document.getElementById('adminReportDesc').value.trim();

    const { periodToReport } = calculatePeriodStatus(p.delivery_date, p.typist_reports || []);

    const { error } = await supabase.from('typist_reports').insert([{
        typist_id: personId,
        period: periodToReport,
        pages: pages,
        description: description
    }]);

    if (error) {
        if (error.message.includes('duplicate key value')) {
            alert("این دوره قبلا برای این تایپیست ثبت شده است.");
        } else {
            alert("خطا در ثبت گزارش: " + error.message);
        }
    } else {
        alert("گزارش با موفقیت ثبت شد.");
        window.closeAdminReportModal();
        loadAdminData();
    }
});

// ============================================
// کدهای تقویم
// ============================================
function openCalendar(inp) {
    calendarTargetInput = inp;
    const t = Jalaali.today();
    calendarState = { 
        viewYear: t.year, 
        viewMonth: t.month, 
        selected: Jalaali.parseJalali(inp.value) 
    };
    renderCalendarModal();
    document.getElementById('calendarModal').classList.remove('hidden');
}

function renderCalendarModal() {
    const c = document.getElementById('calendarContainer');
    const t = Jalaali.today();
    const { viewYear: vy, viewMonth: vm, selected: sel } = calendarState;
    
    const fg = libToGregorian(vy, vm, 1);
    const sd = (new Date(fg.gy, fg.gm-1, fg.gd).getDay() + 1) % 7;
    const dm = libMonthLength(vy, vm);
    
    let h = `<div class="flex justify-between mb-4">
        <button onclick="window.calPrev()" class="bg-slate-100 dark:bg-slate-800 rounded-lg w-8 h-8">◀</button>
        <div class="font-bold">${Jalaali.jMonthName[vm-1]} ${Jalaali.toPersianDigits(vy)}</div>
        <button onclick="window.calNext()" class="bg-slate-100 dark:bg-slate-800 rounded-lg w-8 h-8">▶</button>
    </div>
    <div class="cal-grid mb-2">${['ش','ی','د','س','چ','پ','ج'].map(d=>`<div class="cal-header">${d}</div>`).join('')}</div>
    <div class="cal-grid">`;
    
    for (let i=0; i<sd; i++) h += `<div></div>`;
    for (let d=1; d<=dm; d++) {
        const isT = vy===t.year && vm===t.month && d===t.day;
        const isS = sel && sel.year===vy && sel.month===vm && sel.day===d;
        h += `<div class="cal-day ${isT?'today':''} ${isS?'selected':''}" onclick="window.calSelect(${d})">${Jalaali.toPersianDigits(d)}</div>`;
    }
    h += `</div>`;
    c.innerHTML = h;
}

// ============================================
// راه‌اندازی دکمه‌ها و ورود
// ============================================
document.getElementById('addPersonBtn').addEventListener('click', () => {
    document.getElementById('personForm').reset();
    document.getElementById('personId').value = '';
    document.getElementById('personModalTitle').textContent = 'ثبت تایپیست';
    document.getElementById('personModal').classList.remove('hidden');
});

document.getElementById('closePersonBtn').addEventListener('click', window.closePersonModal);
document.getElementById('closeSettleBtn').addEventListener('click', window.closeSettleModal);
document.getElementById('closeAdminReportBtn').addEventListener('click', window.closeAdminReportModal);
document.getElementById('personBackdrop').addEventListener('click', window.closePersonModal);
document.getElementById('settleBackdrop').addEventListener('click', window.closeSettleModal);
document.getElementById('adminReportBackdrop').addEventListener('click', window.closeAdminReportModal);

document.getElementById('pDeliveryDate').addEventListener('click', (e) => {
    e.preventDefault();
    openCalendar(e.target);
});
document.getElementById('adminReportDate').addEventListener('click', (e) => {
    e.preventDefault();
    openCalendar(e.target);
});

document.getElementById('calendarModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('cal-backdrop')) document.getElementById('calendarModal').classList.add('hidden');
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: document.getElementById('emailInput').value, password: document.getElementById('passwordInput').value });
    if (error) alert("خطا در ورود: " + error.message);
});

document.getElementById('logoutBtn').addEventListener('click', async () => await supabase.auth.signOut());
document.getElementById('logoutBtn2').addEventListener('click', async () => await supabase.auth.signOut());

supabase.auth.onAuthStateChange((e, s) => {
    if (s) { document.getElementById('loginScreen').classList.add('hidden'); checkAuth(); }
    else { document.getElementById('loginScreen').classList.remove('hidden'); document.getElementById('adminWrapper').classList.add('hidden'); document.getElementById('userWrapper').classList.add('hidden'); }
});

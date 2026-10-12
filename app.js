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
    toGregorian(jy, jm, jd) {
        const g = libToGregorian(jy, jm, jd);
        return {
            year: g.gy,
            month: g.gm,
            day: g.gd
        };
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
        // اصلاح امنیتی: اگر پروفایل پیدا نشد، پنل ادمین نمایش داده نشود
        alert('پروفایل کاربری شما در سیستم یافت نشد. لطفا با مدیر سیستم تماس بگیرید.');
        await supabase.auth.signOut();
    }
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
        
        const today = Jalaali.today();
        const startDate = p.delivery_date ? Jalaali.parseJalali(p.delivery_date) : today;
        const daysPassed = Jalaali.daysBetween(startDate, today);
        const currentPeriod = Math.floor(daysPassed / 10) + 1;
        const lastReportedPeriod = reports.length > 0 ? Math.max(...reports.map(r => r.period || 0)) : 0;
        
        let statusText = '', statusClass = '';
        if (lastReportedPeriod >= currentPeriod) { 
            statusText = `دوره ${currentPeriod} ثبت شد`; 
            statusClass = 'text-emerald-600 bg-emerald-50 border border-emerald-200'; 
        } else if (lastReportedPeriod < currentPeriod - 1) { 
            statusText = `${currentPeriod - 1 - lastReportedPeriod} دوره تاخیر`; 
            statusClass = 'text-red-600 bg-red-50 border border-red-200'; 
        } else { 
            statusText = `${10 - (daysPassed % 10)} روز مانده`; 
            statusClass = 'text-amber-600 bg-amber-50 border border-amber-200'; 
        }

        return `
        <div class="glass rounded-2xl p-5 border border-slate-200/50">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold">${esc(p.name)}</h3>
                <span class="text-xs font-bold px-2 py-1 rounded-lg ${statusClass}">${statusText}</span>
            </div>
            <div class="text-xs text-slate-500 mb-4 space-y-1">
                <p>مجموع تسویه شده: <span class="font-bold text-emerald-600">${formatNum(totalSettled)}</span> تومان</p>
                <p>تعداد گزارش‌ها: ${formatNum(reports.length)} مورد</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.openSettleModal('${p.id}')" class="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-200">+ تسویه حساب</button>
                <button onclick="window.deletePerson('${p.id}')" class="py-2 px-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100">حذف</button>
            </div>
        </div>`;
    }).join('') || '<p class="text-center text-slate-400 col-span-full">هنوز تایپیستی ثبت نشده است.</p>';
}

// ============================================
// توابع سراسری (Window)
// ============================================
window.closePersonModal = () => document.getElementById('personModal').classList.add('hidden');
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
    
    const today = Jalaali.today();
    const startDate = profile.delivery_date ? Jalaali.parseJalali(profile.delivery_date) : today;
    const daysPassed = Jalaali.daysBetween(startDate, today);
    const currentPeriod = Math.floor(daysPassed / 10) + 1;
    const lastReportedPeriod = reports?.length > 0 ? Math.max(...reports.map(r => r.period || 0)) : 0;
    
    let statusText = '';
    if (lastReportedPeriod >= currentPeriod) { 
        statusText = `گزارش دوره ${currentPeriod} ثبت شده است. تا دوره بعدی ${10 - (daysPassed % 10)} روز مانده.`; 
    } else { 
        statusText = `لطفا گزارش دوره ${currentPeriod} را ثبت کنید.`; 
    }
    document.getElementById('userStatus').textContent = statusText;
    
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

    const title = document.getElementById('userWorkTitle').value.trim();
    const pages = Number.parseInt(
        document.getElementById('userWorkPages').value,
        10
    );
    const description = document.getElementById('userWorkDesc').value.trim();

    if (!title) {
        alert('عنوان کار را وارد کنید.');
        return;
    }

    if (!Number.isInteger(pages) || pages < 0) {
        alert('تعداد صفحات معتبر نیست.');
        return;
    }

    const pid = currentUserProfile.id;

    const today = Jalaali.today();
    const startDate = currentUserProfile.delivery_date
        ? Jalaali.parseJalali(currentUserProfile.delivery_date)
        : today;

    if (!startDate) {
        alert('تاریخ شروع کار معتبر نیست. لطفاً با مدیر تماس بگیرید.');
        return;
    }

    const daysPassed = Math.max(0, Jalaali.daysBetween(startDate, today));
    const currentPeriod = Math.floor(daysPassed / 10) + 1;

    const reportDescription = [title, description]
        .filter(Boolean)
        .join(' — ');

    submitButton.disabled = true;
    submitButton.textContent = 'در حال ثبت...';

    try {
        const { data, error } = await supabase
            .from('typist_reports')
            .insert([{
                typist_id: pid,
                period: currentPeriod,
                pages: pages,
                description: reportDescription
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
    
    const fg = Jalaali.toGregorian(vy, vm, 1);
    const sd = (new Date(fg.year, fg.month-1, fg.day).getDay() + 1) % 7;
    const dm = libMonthLength(vy, vm);
    
    let h = `<div class="flex justify-between mb-4">
        <button onclick="window.calPrev()" class="bg-slate-100 dark:bg-slate-800 rounded-lg w-8 h-8">◀</button>
        <div class="font-bold">${Jalaali.jMonthName[vm-1]} ${Jalaali.toPersianDigits(vy)}</div>
        <button onclick="window.calNext()" class="bg-slate-100 dark:bg-slate-800 rounded-lg w-8 h-8">▶</button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center text-xs mb-2">${['ش','ی','د','س','چ','پ','ج'].map(d=>`<div>${d}</div>`).join('')}</div>
    <div class="grid grid-cols-7 gap-1">`;
    
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
    document.getElementById('personModal').classList.remove('hidden');
});

document.getElementById('closePersonBtn').addEventListener('click', window.closePersonModal);
document.getElementById('closeSettleBtn').addEventListener('click', window.closeSettleModal);
document.getElementById('personBackdrop').addEventListener('click', window.closePersonModal);
document.getElementById('settleBackdrop').addEventListener('click', window.closeSettleModal);

document.getElementById('pDeliveryDate').addEventListener('click', (e) => {
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

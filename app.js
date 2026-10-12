import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { toJalaali as libToJalaali, toGregorian as libToGregorian, isLeapJalaaliYear as libIsLeapYear, jalaaliMonthLength as libMonthLength } from 'https://esm.sh/jalaali-js@1.1.0';

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
    toGregorian(jy, jm, jd) { const g = libToGregorian(jy, jm, jd); return { year: g.gy, month: g.gm, day: g.gd }; }
};

let personsCache = [];
let currentLedgerId = null;
let currentUserProfile = null;

// ============================================
// احراز هویت و مسیریابی (Admin vs User)
// ============================================
async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('typists').select('*').eq('user_id', user.id).single();
    currentUserProfile = profile;

    if (profile && profile.is_admin) {
        document.getElementById('userWrapper').classList.add('hidden');
        document.getElementById('adminWrapper').classList.remove('hidden');
        loadPersons();
    } else if (profile) {
        document.getElementById('adminWrapper').classList.add('hidden');
        document.getElementById('userWrapper').classList.remove('hidden');
        document.getElementById('userName').textContent = profile.name;
        loadUserDashboard();
    } else {
        await supabase.auth.signOut();
    }
}

// ============================================
// منطق پورتال ادمین
// ============================================
async function loadPersons() {
    const { data, error } = await supabase.from('typists').select('*, work_records!person_id(total_amount, status), payments!person_id(amount, status)').eq('is_active', true);
    if (error) return [];
    
    personsCache = data.map(p => {
        const validWork = p.work_records?.filter(r => r.status === 'approved') || [];
        const validPayments = p.payments?.filter(r => r.status === 'valid') || [];
        const totalWork = validWork.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        const totalPaid = validPayments.reduce((s, r) => s + Number(r.amount || 0), 0);
        return { ...p, totalWork, totalPaid, balance: totalWork - totalPaid };
    });
    
    renderPersons();
    updateDashboard();
}

function renderPersons() {
    const l = document.getElementById('personsList');
    if (personsCache.length === 0) { l.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">هنوز شخصی ثبت نشده است.</td></tr>`; return; }
    l.innerHTML = personsCache.map(p => `
        <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td class="p-4 font-bold">${esc(p.name)}</td>
            <td class="p-4 text-emerald-600">${formatNum(p.totalWork)}</td>
            <td class="p-4 text-amber-600">${formatNum(p.totalPaid)}</td>
            <td class="p-4 font-black ${p.balance > 0 ? 'text-red-600' : 'text-emerald-600'}">${formatNum(p.balance)}</td>
            <td class="p-4">
                <button onclick="openLedger('${p.id}')" class="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold">دفتر حساب</button>
                <button onclick="editPerson('${p.id}')" class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg">ویرایش</button>
            </td>
        </tr>
    `).join('');
}

function updateDashboard() {
    document.getElementById('stat-persons').textContent = formatNum(personsCache.length);
    const tWork = personsCache.reduce((s, p) => s + p.totalWork, 0);
    const tPaid = personsCache.reduce((s, p) => s + p.totalPaid, 0);
    const tBal = personsCache.reduce((s, p) => s + p.balance, 0);
    document.getElementById('stat-work').textContent = formatNum(tWork);
    document.getElementById('stat-payments').textContent = formatNum(tPaid);
    document.getElementById('stat-balance').textContent = formatNum(tBal);
}

window.editPerson = (id) => {
    const p = personsCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('personId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pPhone').value = p.phone || '';
    document.getElementById('pWordRate').value = p.default_word_rate || 0;
    document.getElementById('pPageRate').value = p.default_page_rate || 0;
    document.getElementById('personModal').classList.remove('hidden');
};
window.closePersonModal = () => document.getElementById('personModal').classList.add('hidden');

document.getElementById('personForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('personId').value;
    const payload = {
        name: document.getElementById('pName').value, phone: document.getElementById('pPhone').value,
        default_word_rate: parseFloat(document.getElementById('pWordRate').value) || 0,
        default_page_rate: parseFloat(document.getElementById('pPageRate').value) || 0
    };
    if (id) { await supabase.from('typists').update(payload).eq('id', id); }
    else { await supabase.from('typists').insert([payload]); }
    closePersonModal(); loadPersons();
});

window.openLedger = async (id) => {
    currentLedgerId = id;
    const p = personsCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('ledgerTitle').textContent = `دفتر حساب: ${p.name}`;
    document.getElementById('ledgerTotalWork').textContent = formatNum(p.totalWork);
    document.getElementById('ledgerTotalPaid').textContent = formatNum(p.totalPaid);
    document.getElementById('ledgerBalance').textContent = formatNum(p.balance);
    
    const { data: works } = await supabase.from('work_records').select('*').eq('person_id', id).order('record_date', { ascending: false });
    const { data: pays } = await supabase.from('payments').select('*').eq('person_id', id).order('payment_date', { ascending: false });
    
    const list = document.getElementById('ledgerList');
    list.innerHTML = '';
    
    works?.forEach(w => {
        const statusClass = w.status === 'approved' ? 'text-emerald-600' : 'text-amber-600';
        list.innerHTML += `<div class="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
            <div><p class="text-sm font-bold">کارکرد: ${esc(w.title || '-')} <span class="text-xs ${statusClass}">(${w.status})</span></p><p class="text-xs text-slate-500">${Jalaali.formatJalali(...(w.record_date.split('-').map(Number)))}</p></div>
            <p class="font-black text-emerald-600">${formatNum(w.total_amount)} ت</p>
        </div>`;
    });
    pays?.forEach(py => {
        list.innerHTML += `<div class="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-500/5 rounded-xl border border-amber-100 dark:border-amber-500/20">
            <div><p class="text-sm font-bold">پرداخت</p><p class="text-xs text-slate-500">${Jalaali.formatJalali(...(py.payment_date.split('-').map(Number)))}</p></div>
            <p class="font-black text-amber-600">${formatNum(py.amount)} ت</p>
        </div>`;
    });
    
    document.getElementById('ledgerModal').classList.remove('hidden');
};
window.closeLedgerModal = () => document.getElementById('ledgerModal').classList.add('hidden');

window.openPaymentModal = (id) => {
    document.getElementById('payPersonId').value = id;
    document.getElementById('payDate').value = Jalaali.formatJalali(Jalaali.today().year, Jalaali.today().month, Jalaali.today().day);
    document.getElementById('paymentModal').classList.remove('hidden');
};
window.closePaymentModal = () => document.getElementById('paymentModal').classList.add('hidden');

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const jDate = Jalaali.parseJalali(document.getElementById('payDate').value);
    const gDate = Jalaali.toGregorian(jDate.year, jDate.month, jDate.day);
    const amount = parseFloat(document.getElementById('payAmount').value) || 0;
    if (amount <= 0) return alert('مبلغ نامعتبر است');
    
    await supabase.from('payments').insert([{
        person_id: document.getElementById('payPersonId').value,
        payment_date: `${gDate.year}-${gDate.month}-${gDate.day}`,
        amount: amount,
        tracking_code: document.getElementById('payTracking').value
    }]);
    closePaymentModal(); loadPersons(); openLedger(currentLedgerId);
});

// ============================================
// منطق پورتال تایپیست‌ها
// ============================================
async function loadUserDashboard() {
    if (!currentUserProfile) return;
    const pid = currentUserProfile.id;
    
    const { data: works } = await supabase.from('work_records').select('*').eq('person_id', pid).order('record_date', { ascending: false });
    const { data: pays } = await supabase.from('payments').select('*').eq('person_id', pid);
    
    const tWork = works?.filter(w => w.status === 'approved').reduce((s, r) => s + Number(r.total_amount || 0), 0) || 0;
    const tPaid = pays?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
    
    document.getElementById('userTotalWork').textContent = formatNum(tWork) + ' تومان';
    document.getElementById('userTotalPaid').textContent = formatNum(tPaid) + ' تومان';
    
    const list = document.getElementById('userWorkList');
    list.innerHTML = works?.map(w => {
        const statusText = w.status === 'approved' ? 'تایید شده' : 'در انتظار تایید';
        const statusClass = w.status === 'approved' ? 'text-emerald-600' : 'text-amber-600';
        return `<div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <div><p class="text-sm font-bold">${esc(w.title || '-')}</p><p class="text-xs text-slate-500">${Jalaali.formatJalali(...(w.record_date.split('-').map(Number)))} - <span class="${statusClass}">${statusText}</span></p></div>
            <p class="font-black text-emerald-600">${formatNum(w.total_amount)} ت</p>
        </div>`;
    }).join('') || '<p class="text-center text-slate-400 py-4">هنوز کارکردی ثبت نشده است.</p>';
}

document.getElementById('userWorkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserProfile) return;
    
    const jDate = Jalaali.parseJalali(document.getElementById('userWorkDate').value);
    const gDate = Jalaali.toGregorian(jDate.year, jDate.month, jDate.day);
    const qty = parseFloat(document.getElementById('userWorkQty').value) || 0;
    const rate = parseFloat(document.getElementById('userWorkRate').value) || 0;
    
    const { error } = await supabase.from('work_records').insert([{
        person_id: currentUserProfile.id,
        record_date: `${gDate.year}-${gDate.month}-${gDate.day}`,
        title: document.getElementById('userWorkTitle').value,
        quantity: qty, unit_rate: rate, total_amount: qty * rate,
        status: 'pending'
    }]);
    
    if (error) { alert('خطا در ثبت: ' + error.message); } 
    else {
        alert('کارکرد با موفقیت ثبت شد و در انتظار تایید ادمین است.');
        document.getElementById('userWorkForm').reset();
        document.getElementById('userWorkDate').value = Jalaali.formatJalali(Jalaali.today().year, Jalaali.today().month, Jalaali.today().day);
        loadUserDashboard();
    }
});

['userWorkQty', 'userWorkRate'].forEach(id => document.getElementById(id).addEventListener('input', () => {
    const q = parseFloat(document.getElementById('userWorkQty').value) || 0;
    const r = parseFloat(document.getElementById('userWorkRate').value) || 0;
    document.getElementById('userWorkTotal').value = q * r;
}));

// ============================================
// خروجی اکسل (فقط ادمین)
// ============================================
window.exportToExcel = (type) => {
    let data = [], sheetName = '';
    if (type === 'persons') {
        sheetName = 'فهرست اشخاص';
        data = personsCache.map(p => ({ 'نام': p.name, 'شماره تماس': p.phone, 'مجموع کارکرد': p.totalWork, 'مجموع پرداخت': p.totalPaid, 'مانده': p.balance }));
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}.xlsx`);
};

// ============================================
// تقویم و رویدادها
// ============================================
let calendarTargetInput = null;
let calendarState = { viewYear: null, viewMonth: null, selected: null };
function openCalendar(inp) { calendarTargetInput = inp; const t = Jalaali.today(); calendarState = { viewYear: t.year, viewMonth: t.month, selected: Jalaali.parseJalali(inp.value) }; renderCalendarModal(); document.getElementById('calendarModal').classList.remove('hidden'); }
function renderCalendarModal() {
    const c = document.getElementById('calendarContainer'); const t = Jalaali.today(); const { viewYear: vy, viewMonth: vm, selected: sel } = calendarState;
    const fg = Jalaali.toGregorian(vy, vm, 1); const sd = (new Date(fg.year, fg.month-1, fg.day).getDay() + 1) % 7; const dm = libMonthLength(vy, vm);
    let h = `<div class="flex justify-between mb-4"><button onclick="calPrev()" class="bg-slate-100 dark:bg-slate-800 rounded-lg w-8 h-8">◀</button><div class="font-bold">${Jalaali.jMonthName[vm-1]} ${Jalaali.toPersianDigits(vy)}</div><button onclick="calNext()" class="bg-slate-100 dark:bg-slate-800 rounded-lg w-8 h-8">▶</button></div><div class="grid grid-cols-7 gap-1 text-center text-xs mb-2">${['ش','ی','د','س','چ','پ','ج'].map(d=>`<div>${d}</div>`).join('')}</div><div class="grid grid-cols-7 gap-1">`;
    for (let i=0; i<sd; i++) h += `<div></div>`;
    for (let d=1; d<=dm; d++) { const isT = vy===t.year&&vm===t.month&&d===t.day; const isS = sel&&sel.year===vy&&sel.month===vm&&sel.day===d; h += `<div class="cal-day ${isT?'today':''} ${isS?'selected':''}" onclick="calSelect(${d})">${Jalaali.toPersianDigits(d)}</div>`; }
    h += `</div>`;
    c.innerHTML = h;
}
window.calPrev = () => { calendarState.viewMonth--; if (calendarState.viewMonth < 1) { calendarState.viewMonth = 12; calendarState.viewYear--; } renderCalendarModal(); };
window.calNext = () => { calendarState.viewMonth++; if (calendarState.viewMonth > 12) { calendarState.viewMonth = 1; calendarState.viewYear++; } renderCalendarModal(); };
window.calSelect = (d) => { calendarTargetInput.value = Jalaali.formatJalali(calendarState.viewYear, calendarState.viewMonth, d); document.getElementById('calendarModal').classList.add('hidden'); };

document.getElementById('addPersonBtn').addEventListener('click', () => {
    document.getElementById('personForm').reset(); document.getElementById('personId').value = ''; document.getElementById('personModal').classList.remove('hidden');
});
document.getElementById('payDateWrapper').addEventListener('click', (e) => { e.preventDefault(); openCalendar(document.getElementById('payDate')); });
document.getElementById('userDateWrapper').addEventListener('click', (e) => { e.preventDefault(); openCalendar(document.getElementById('userWorkDate')); });
document.getElementById('calendarModal').addEventListener('click', (e) => { if (e.target.classList.contains('cal-backdrop')) document.getElementById('calendarModal').classList.add('hidden'); });
document.getElementById('userWorkDate').value = Jalaali.formatJalali(Jalaali.today().year, Jalaali.today().month, Jalaali.today().day);

document.getElementById('personBackdrop').addEventListener('click', closePersonModal);
document.getElementById('ledgerBackdrop').addEventListener('click', closeLedgerModal);
document.getElementById('paymentBackdrop').addEventListener('click', closePaymentModal);

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: document.getElementById('emailInput').value, password: document.getElementById('passwordInput').value });
    if (error) document.getElementById('loginError').classList.remove('hidden');
});
document.getElementById('logoutBtn').addEventListener('click', async () => await supabase.auth.signOut());
document.getElementById('logoutBtn2').addEventListener('click', async () => await supabase.auth.signOut());

supabase.auth.onAuthStateChange((e, s) => {
    if (s) {
        document.getElementById('loginScreen').classList.add('hidden');
        loadUserProfile();
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('adminWrapper').classList.add('hidden');
        document.getElementById('userWrapper').classList.add('hidden');
    }
});

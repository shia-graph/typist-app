import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ اطلاعات سوپابیس شما (که مسدود نیست)
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const APP_PASSWORD = '7853421'; // رمز ورود به برنامه

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- منطق صفحه لاگین (رمز عبور) ---
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');
const loginScreen = document.getElementById('loginScreen');
const appWrapper = document.getElementById('appWrapper');

if (localStorage.getItem('isAuthenticated') === 'true') {
    loginScreen.classList.add('hidden');
    appWrapper.classList.remove('hidden');
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === APP_PASSWORD) {
        loginScreen.classList.add('hidden');
        appWrapper.classList.remove('hidden');
        localStorage.setItem('isAuthenticated', 'true');
    } else {
        loginError.classList.remove('hidden');
    }
});

// --- متغیرهای اصلی اپلیکیشن ---
const typistForm = document.getElementById('typistForm');
const typistList = document.getElementById('typistList');
const alertContainer = document.getElementById('alertContainer');
const formModal = document.getElementById('formModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalContent = document.getElementById('modalContent');

function closeModal() {
    modalBackdrop.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { formModal.classList.add('hidden'); }, 300);
}

function toPersianNum(num) {
    if (!num) return '۰';
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/[0-9]/g, (d) => persianDigits[d]);
}

function getInitials(name) {
    if (!name) return '؟';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0);
    return parts[0].charAt(0) + parts[1].charAt(0);
}

// --- دریافت اطلاعات از سوپابیس ---
async function fetchTypists() {
    try {
        const { data: typists, error } = await supabase
            .from('typists')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) { console.error("خطا:", error); return; }

        typistList.innerHTML = '';
        alertContainer.innerHTML = '';
        
        let activeCount = 0, deliveredCount = 0, delayedCount = 0, pendingCount = 0;

        if (!typists || typists.length === 0) {
            typistList.innerHTML = `
                <div class="col-span-full text-center py-16 text-slate-400 dark:text-slate-600 flex flex-col items-center gap-3">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
                    <p class="font-medium text-sm">هنوز پروژه‌ای ثبت نشده است.</p>
                </div>`;
            updateStats(0, 0, 0, 0);
            return;
        }

        typists.forEach((data) => {
            const id = data.id;
            const today = new Date();
            const lastCheck = data.last_reminder_date ? new Date(data.last_reminder_date) : (data.created_at ? new Date(data.created_at) : new Date());
            const diffDays = Math.floor((today - lastCheck) / (1000 * 60 * 60 * 24));
            let shouldAlert = (diffDays >= 10 && data.status !== 'delivered');

            let statusClass = '', statusText = '';
            if (data.status === 'progress') {
                statusClass = 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-100 dark:border-primary-500/20';
                statusText = 'در حال انجام';
                activeCount++;
            } else if (data.status === 'delivered') {
                statusClass = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20';
                statusText = 'تکمیل شده';
                deliveredCount++;
            } else if (data.status === 'delayed') {
                statusClass = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20';
                statusText = 'تاخیر دارد';
                delayedCount++;
            }

            const card = document.createElement('div');
            card.className = 'group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 animate-slide-up flex flex-col';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">${toPersianNum(getInitials(data.name))}</div>
                        <div>
                            <h3 class="font-bold text-slate-900 dark:text-white text-sm">${data.name}</h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                ${data.phone ? toPersianNum(data.phone) : 'ثبت نشده'}
                            </p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusClass}">${statusText}</span>
                </div>
                
                <div class="space-y-3 mb-4 flex-grow">
                    <div>
                        <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">عنوان پروژه</p>
                        <p class="text-sm text-slate-700 dark:text-slate-200 font-medium line-clamp-1">${data.title}</p>
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            تحویل: ${toPersianNum(data.delivery_date)}
                        </span>
                    </div>
                </div>

                <div class="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
                    ${data.status !== 'delivered' ? `
                    <button onclick="updateStatus('${id}', 'delivered')" class="flex-1 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-500/20">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        تحویل شد
                    </button>
                    ` : ''}
                    <button onclick="deleteTypist('${id}')" class="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-red-100 dark:border-red-500/20">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        حذف
                    </button>
                </div>
            `;
            typistList.appendChild(card);

            if (shouldAlert) {
                pendingCount++;
                const alert = document.createElement('div');
                alert.className = 'animate-fade-in flex flex-col md:flex-row items-start gap-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl';
                alert.innerHTML = `
                    <div class="flex items-start gap-3 flex-grow">
                        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div>
                            <span class="text-sm font-bold block mb-1">یادآوری ۱۰ روزه پیگیری</span>
                            <span class="text-xs text-amber-600 dark:text-amber-500">${data.name} حدود ${toPersianNum(diffDays)} روز پیش پروژه را دریافت کرده است. آیا تحویل داده است؟</span>
                        </div>
                    </div>
                    <div class="flex gap-2 w-full md:w-auto">
                        <button onclick="resetReminder('${id}')" class="flex-1 md:flex-none px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition">پیگیری (۱۰ روز دیگر)</button>
                        <button onclick="updateStatus('${id}', 'delivered')" class="flex-1 md:flex-none px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition">بله، تحویل داد</button>
                    </div>
                `;
                alertContainer.appendChild(alert);
            }
        });

        updateStats(activeCount, deliveredCount, pendingCount, delayedCount);
    } catch (error) {
        console.error("خطا در دریافت اطلاعات:", error);
    }
}

// آپدیت باکس‌های آماری
function updateStats(active, delivered, pending, delayed) {
    document.getElementById('stat-active').textContent = toPersianNum(active);
    document.getElementById('stat-delivered').textContent = toPersianNum(delivered);
    document.getElementById('stat-pending').textContent = toPersianNum(pending);
    document.getElementById('stat-delayed').textContent = toPersianNum(delayed);
}

// --- همگام‌سازی لحظه‌ای سوپابیس (Realtime) ---
supabase
  .channel('public:typists')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'typists' }, fetchTypists)
  .subscribe();

// --- ثبت پروژه جدید ---
typistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const title = document.getElementById('title').value;
    const deliveryDate = document.getElementById('deliveryDate').value;

    const { error } = await supabase.from('typists').insert([
        { name, phone, title, delivery_date: deliveryDate, status: 'progress' }
    ]);

    if (error) {
        alert("خطا در ثبت: " + error.message);
    } else {
        typistForm.reset();
        closeModal();
    }
});

// --- تغییر وضعیت ---
window.updateStatus = async (id, status) => {
    await supabase.from('typists').update({ 
        status: status,
        last_reminder_date: new Date().toISOString() 
    }).eq('id', id);
};

// --- ریست تایمر پیگیری ---
window.resetReminder = async (id) => {
    await supabase.from('typists').update({ 
        last_reminder_date: new Date().toISOString() 
    }).eq('id', id);
};

// --- حذف ---
window.deleteTypist = async (id) => {
    if(confirm("آیا از حذف این مورد مطمئن هستید؟")) {
        await supabase.from('typists').delete().eq('id', id);
    }
};

// بارگذاری اولیه
fetchTypists();
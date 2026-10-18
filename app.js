// ==========================================
// تنظیمات اتصال Supabase
// ==========================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// متغیرهای وضعیت (State)
// ==========================================
let currentTypist = null;
let isAdminLoggedIn = false;
let allTypistsCache = [];

const $ = (id) => document.getElementById(id);

function closeModal(modalId) {
    const m = $(modalId);
    if (m) m.classList.add('hidden');
}

window.toggleSettleTypeUI = function() {
    const isFull = document.querySelector('input[name="settleType"]:checked')?.value === 'full';
    const container = $('monthlyPeriodContainer');
    if (container) {
        if (isFull) {
            container.classList.add('hidden');
        } else {
            container.classList.remove('hidden');
        }
    }
};

// ==========================================
// رویدادهای راه‌اندازی
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = $('adminToggleBtn');
    if (adminBtn) adminBtn.addEventListener('click', handleAdminToggle);

    const logoutBtn = $('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutTypist);

    const loginForm = $('typistLoginForm');
    if (loginForm) loginForm.addEventListener('submit', handleTypistLogin);

    const profileForm = $('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const editProfBtn = $('editProfileBtn');
    if (editProfBtn) editProfBtn.addEventListener('click', openProfileModal);

    const openRepBtn = $('openReportModalBtn');
    if (openRepBtn) {
        openRepBtn.addEventListener('click', () => {
            $('reportForm').reset();
            $('reportModal').classList.remove('hidden');
        });
    }

    const repForm = $('reportForm');
    if (repForm) repForm.addEventListener('submit', handleReportSubmit);

    const newTypistBtn = $('newTypistBtn');
    if (newTypistBtn) newTypistBtn.addEventListener('click', createNewTypistByAdmin);

    const exportExcelBtn = $('exportExcelBtn');
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);

    const paymentForm = $('paymentForm');
    if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);
});

// ==========================================
// ورود به پنل مدیریت
// ==========================================
async function handleAdminToggle() {
    const adminSec = $('adminSection');
    const loginSec = $('loginSection');
    const typistSec = $('typistDashboardSection');
    const adminBtn = $('adminToggleBtn');

    if (!adminSec.classList.contains('hidden')) {
        adminSec.classList.add('hidden');
        if (currentTypist) {
            typistSec.classList.remove('hidden');
        } else {
            loginSec.classList.remove('hidden');
        }
        adminBtn.textContent = 'ورود به پنل مدیریت';
        return;
    }

    if (!isAdminLoggedIn) {
        const enteredPass = prompt('لطفاً رمز عبور ورود به پنل مدیریت را وارد کنید:');
        if (!enteredPass) return;

        const oldBtnText = adminBtn.textContent;
        adminBtn.textContent = 'در حال اعتبارسنجی...';

        try {
            const { data, error } = await client
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_password')
                .single();

            if (error || !data) {
                alert('خطا در دریافت رمز مدیر از پایگاه داده: ' + (error ? error.message : 'یافت نشد'));
                adminBtn.textContent = oldBtnText;
                return;
            }

            if (enteredPass.trim() !== data.value.trim()) {
                alert('رمز عبور وارد شده اشتباه است!');
                adminBtn.textContent = oldBtnText;
                return;
            }

            isAdminLoggedIn = true;
        } catch (err) {
            alert('خطای اتصال: ' + err.message);
            adminBtn.textContent = oldBtnText;
            return;
        }
    }

    loginSec.classList.add('hidden');
    typistSec.classList.add('hidden');
    adminSec.classList.remove('hidden');
    adminBtn.textContent = 'بازگشت به پنل کاربری';

    loadAdminData();
}

// بارگذاری داده‌ها و رندر همزمان جدول دسکتاپ و کارت موبایل
async function loadAdminData() {
    const tbody = $('adminTypistsTable');
    const cards = $('adminTypistsCards');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400">در حال دریافت داده‌ها...</td></tr>';
    if (cards) cards.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs">در حال بارگذاری اطلاعات...</div>';

    try {
        const { data, error } = await client
            .from('typists')
            .select(`
                *,
                typist_reports (*),
                payments (*)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            const errMsg = `خطا در دریافت اطلاعات: ${error.message}`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-500 font-semibold">${errMsg}</td></tr>`;
            if (cards) cards.innerHTML = `<div class="p-4 text-center text-rose-500 text-xs">${errMsg}</div>`;
            return;
        }

        allTypistsCache = data || [];

        if (allTypistsCache.length === 0) {
            const emptyMsg = 'تایپیستی ثبت نشده است. از دکمه «+ تایپیست جدید» برای شروع استفاده کنید.';
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">${emptyMsg}</td></tr>`;
            if (cards) cards.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">${emptyMsg}</div>`;
            return;
        }

        // 1. رندر جدول دسکتاپ
        if (tbody) {
            tbody.innerHTML = allTypistsCache.map(p => {
                const reps = p.typist_reports || [];
                const pays = p.payments || [];
                const totalPages = reps.reduce((sum, r) => sum + Number(r.pages_count || 0), 0);
                const totalWords = reps.reduce((sum, r) => sum + Number(r.words_count || 0), 0);
                const totalPaid = pays.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
                const hasFullSettle = pays.some(pay => (pay.notes || '').includes('تسویه کامل و نهایی'));

                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                        <td class="p-3">
                            <div class="font-bold text-slate-900">${p.name || '-'}</div>
                            <div class="text-[11px] text-slate-500">${p.title || 'تایپیست'}</div>
                        </td>
                        <td class="p-3 font-mono font-medium text-slate-700">${p.national_code || '-'}</td>
                        <td class="p-3">
                            <div class="flex items-center gap-1.5">
                                <span class="font-mono text-xs">${p.phone || '-'}</span>
                                ${p.phone ? `
                                    <a href="tel:${p.phone}" title="تماس تلفنی مستقیم" class="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                    </a>
                                ` : ''}
                            </div>
                        </td>
                        <td class="p-3 font-mono text-slate-600 text-[11px]" dir="ltr">${p.shaba_number || '-'}</td>
                        <td class="p-3">
                            <div class="font-mono font-bold text-teal-700">${totalPages} صفحه</div>
                            <div class="text-[11px] font-mono text-slate-500">${totalWords.toLocaleString()} کلمه</div>
                        </td>
                        <td class="p-3">
                            <div class="font-mono font-bold text-emerald-600">${totalPaid.toLocaleString()}</div>
                            ${hasFullSettle ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">تسویه نهایی شده</span>' : ''}
                        </td>
                        <td class="p-3 text-center">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="viewTypistWorks('${p.id}')" title="مشاهده کارکردها" class="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium text-xs">کارکردها (${reps.length})</button>
                                <button onclick="openPaymentModal('${p.id}', '${p.name}')" title="ثبت واریزی" class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 font-medium text-xs">تسویه</button>
                                <button onclick="editPersonByAdmin('${p.id}')" title="ویرایش اطلاعات" class="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-xs">ویرایش</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // 2. رندر کارت‌های موبایل
        if (cards) {
            cards.innerHTML = allTypistsCache.map(p => {
                const reps = p.typist_reports || [];
                const pays = p.payments || [];
                const totalPages = reps.reduce((sum, r) => sum + Number(r.pages_count || 0), 0);
                const totalWords = reps.reduce((sum, r) => sum + Number(r.words_count || 0), 0);
                const totalPaid = pays.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
                const hasFullSettle = pays.some(pay => (pay.notes || '').includes('تسویه کامل و نهایی'));

                return `
                    <div class="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2.5">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="font-bold text-slate-900 text-sm">${p.name || '-'}</span>
                                <span class="text-[11px] text-teal-700 font-medium mr-1.5">(${p.title || 'تایپیست'})</span>
                            </div>
                            ${hasFullSettle ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">تسویه کامل</span>' : ''}
                        </div>

                        <div class="grid grid-cols-2 gap-2 text-xs font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                            <div>کد ملی: <span class="text-slate-800 font-bold">${p.national_code || '-'}</span></div>
                            <div class="flex items-center justify-between">
                                <span>تماس:</span>
                                ${p.phone ? `<a href="tel:${p.phone}" class="text-emerald-600 font-bold hover:underline">📞 ${p.phone}</a>` : '<span>-</span>'}
                            </div>
                            <div class="col-span-2 text-[11px] truncate">شبا: <span dir="ltr" class="text-slate-700">${p.shaba_number || '-'}</span></div>
                        </div>

                        <div class="flex items-center justify-between text-xs px-1">
                            <div>کارکرد: <b class="text-teal-700 font-mono">${totalPages} صفحه</b> / <span class="font-mono text-slate-500">${totalWords.toLocaleString()} کلمه</span></div>
                            <div>پرداختی: <b class="text-emerald-600 font-mono">${totalPaid.toLocaleString()} تومان</b></div>
                        </div>

                        <div class="flex items-center gap-1.5 pt-1 border-t border-slate-200/60">
                            <button onclick="viewTypistWorks('${p.id}')" class="flex-1 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 text-center">مشاهده کارها (${reps.length})</button>
                            <button onclick="openPaymentModal('${p.id}', '${p.name}')" class="flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 text-center">ثبت تسویه</button>
                            <button onclick="editPersonByAdmin('${p.id}')" class="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-300">ویرایش</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

    } catch (err) {
        const errorText = `خطای نامشخص: ${err.message}`;
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-500 font-semibold">${errorText}</td></tr>`;
        if (cards) cards.innerHTML = `<div class="p-4 text-center text-rose-500 text-xs">${errorText}</div>`;
    }
}

// مشاهده کارکردهای تایپیست توسط مدیر
window.viewTypistWorks = function(id) {
    const person = allTypistsCache.find(p => p.id === id);
    if (!person) return;

    $('viewWorksName').textContent = `ریز کارکرد و گزارش‌های: ${person.name}`;
    
    const reps = person.typist_reports || [];
    const totalPages = reps.reduce((sum, r) => sum + Number(r.pages_count || 0), 0);
    const totalWords = reps.reduce((sum, r) => sum + Number(r.words_count || 0), 0);
    
    $('viewWorksStats').textContent = `مجموع: ${totalPages} صفحه | ${totalWords.toLocaleString()} کلمه | ${reps.length} دوره گزارش`;

    $('viewWorksContactLink').innerHTML = person.phone 
        ? `<a href="tel:${person.phone}" class="text-xs text-teal-700 font-semibold flex items-center justify-center gap-1 hover:underline">
            📞 برقراری تماس با تایپیست (${person.phone})
           </a>`
        : '';

    const tbody = $('viewWorksTableBody');
    if (reps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">هیچ گزارشی برای این تایپیست ثبت نشده است.</td></tr>';
    } else {
        tbody.innerHTML = reps.map(r => `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="p-2 sm:p-2.5 font-semibold text-slate-800">${r.period_name || 'دوره ۱۰ روزه'}</td>
                <td class="p-2 sm:p-2.5 font-mono text-teal-700 font-bold">${Number(r.pages_count).toLocaleString()}</td>
                <td class="p-2 sm:p-2.5 font-mono">${Number(r.words_count).toLocaleString()}</td>
                <td class="p-2 sm:p-2.5 font-mono text-slate-500 text-[11px]">${new Date(r.created_at).toLocaleDateString('fa-IR')}</td>
                <td class="p-2 sm:p-2.5 text-slate-600">${r.notes || '-'}</td>
            </tr>
        `).join('');
    }

    $('viewWorksModal').classList.remove('hidden');
};

// ورود تایپیست با کدملی و تلفن
async function handleTypistLogin(e) {
    e.preventDefault();
    const nc = $('loginNationalCode').value.trim();
    const phone = $('loginPhone').value.trim();
    const btn = $('loginSubmitBtn');

    if (!nc || !phone) {
        alert('لطفاً کدملی و شماره تماس را وارد کنید.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'در حال بررسی...';

    try {
        const { data, error } = await client
            .from('typists')
            .select('*')
            .eq('national_code', nc)
            .eq('phone', phone)
            .maybeSingle();

        if (error) {
            alert('خطای ارتباط: ' + error.message);
            return;
        }

        if (!data) {
            alert('کاربری با این مشخصات یافت نشد! لطفاً با مدیر سامانه تماس بگیرید.');
            return;
        }

        currentTypist = data;
        renderTypistDashboard();
    } catch (err) {
        alert('خطا: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'ورود به پنل کاربری';
    }
}

function renderTypistDashboard() {
    $('loginSection').classList.add('hidden');
    $('adminSection').classList.add('hidden');
    $('typistDashboardSection').classList.remove('hidden');
    $('logoutBtn').classList.remove('hidden');

    $('typistDisplayName').textContent = currentTypist.name || 'کاربر';
    $('typistDisplayTitle').textContent = currentTypist.title || 'تایپیست';
    $('typistAvatar').textContent = (currentTypist.name || 'ت').charAt(0);
    $('typistDisplayNC').textContent = currentTypist.national_code || '-';
    $('typistDisplayPhone').textContent = currentTypist.phone || '-';
    $('typistDisplayShaba').textContent = currentTypist.shaba_number || 'ثبت نشده';

    loadTypistReports();
}

function logoutTypist() {
    currentTypist = null;
    $('typistDashboardSection').classList.add('hidden');
    $('logoutBtn').classList.add('hidden');
    $('loginSection').classList.remove('hidden');
    $('typistLoginForm').reset();
}

// بارگذاری گزارش‌های تایپیست به دو فرمت دسکتاپ و کارت موبایل
async function loadTypistReports() {
    if (!currentTypist) return;
    const tbody = $('typistReportsTable');
    const cards = $('typistReportsCards');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">در حال دریافت سوابق...</td></tr>';
    if (cards) cards.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs">در حال دریافت سوابق...</div>';

    try {
        const { data, error } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypist.id)
            .order('created_at', { ascending: false });

        if (error) {
            const errText = `خطا: ${error.message}`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-500 font-semibold">${errText}</td></tr>`;
            if (cards) cards.innerHTML = `<div class="p-4 text-center text-rose-500 text-xs">${errText}</div>`;
            return;
        }

        if (!data || data.length === 0) {
            const emptyText = 'تاکنون گزارشی برای شما ثبت نشده است.';
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">${emptyText}</td></tr>`;
            if (cards) cards.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">${emptyText}</div>`;
            return;
        }

        // رندر جدول دسکتاپ
        if (tbody) {
            tbody.innerHTML = data.map(r => `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="p-3 font-semibold text-slate-800">${r.period_name || 'دوره ۱۰ روزه'}</td>
                    <td class="p-3 font-mono text-teal-600 font-bold">${Number(r.pages_count).toLocaleString()}</td>
                    <td class="p-3 font-mono">${Number(r.words_count).toLocaleString()}</td>
                    <td class="p-3 font-mono text-slate-500 text-[11px]">${new Date(r.created_at).toLocaleDateString('fa-IR')}</td>
                    <td class="p-3 text-slate-500">${r.notes || '-'}</td>
                </tr>
            `).join('');
        }

        // رندر کارت موبایل
        if (cards) {
            cards.innerHTML = data.map(r => `
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-xs text-slate-900">${r.period_name || 'دوره ۱۰ روزه'}</span>
                        <span class="text-[11px] font-mono text-slate-400">${new Date(r.created_at).toLocaleDateString('fa-IR')}</span>
                    </div>
                    <div class="flex items-center gap-4 text-xs font-mono">
                        <div>صفحات: <b class="text-teal-700">${Number(r.pages_count).toLocaleString()}</b></div>
                        <div>کلمات: <b class="text-slate-700">${Number(r.words_count).toLocaleString()}</b></div>
                    </div>
                    ${r.notes ? `<div class="text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">توضیح: ${r.notes}</div>` : ''}
                </div>
            `).join('');
        }

    } catch (err) {
        const errText = `خطا: ${err.message}`;
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-500">${errText}</td></tr>`;
        if (cards) cards.innerHTML = `<div class="p-4 text-center text-rose-500 text-xs">${errText}</div>`;
    }
}

// ویرایش پروفایل توسط تایپیست
function openProfileModal() {
    if (!currentTypist) return;
    $('profName').value = currentTypist.name || '';
    $('profNationalCode').value = currentTypist.national_code || '';
    $('profPhone').value = currentTypist.phone || '';
    $('profShaba').value = currentTypist.shaba_number || '';
    $('profTitle').value = currentTypist.title || '';
    $('profileModal').classList.remove('hidden');
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    if (!currentTypist) return;

    const updated = {
        name: $('profName').value.trim(),
        national_code: $('profNationalCode').value.trim(),
        phone: $('profPhone').value.trim(),
        shaba_number: $('profShaba').value.trim(),
        title: $('profTitle').value.trim()
    };

    try {
        const { error } = await client
            .from('typists')
            .update(updated)
            .eq('id', currentTypist.id);

        if (error) {
            alert('خطا در ذخیره پروفایل: ' + error.message);
            return;
        }

        currentTypist = { ...currentTypist, ...updated };
        alert('مشخصات شما با موفقیت بروزرسانی شد.');
        closeModal('profileModal');
        renderTypistDashboard();
    } catch (err) {
        alert('خطا: ' + err.message);
    }
}

// ثبت گزارش ۱۰ روزه
async function handleReportSubmit(e) {
    e.preventDefault();
    if (!currentTypist) return;

    const reportData = {
        typist_id: currentTypist.id,
        period_name: $('repPeriod').value,
        pages_count: parseInt($('repPages').value) || 0,
        words_count: parseInt($('repWords').value) || 0,
        notes: $('repNotes').value.trim()
    };

    try {
        const { error } = await client
            .from('typist_reports')
            .insert([reportData]);

        if (error) {
            alert('خطا در ثبت کارکرد: ' + error.message);
            return;
        }

        alert('کارکرد ۱۰ روزه با موفقیت ثبت شد.');
        closeModal('reportModal');
        $('reportForm').reset();
        loadTypistReports();
    } catch (err) {
        alert('خطا: ' + err.message);
    }
}

// افزودن تایپیست توسط مدیر
async function createNewTypistByAdmin() {
    const name = prompt('نام و نام خانوادگی تایپیست:');
    if (!name) return;

    const national_code = prompt('کد ملی (۱۰ رقم):');
    if (!national_code) return;

    const phone = prompt('شماره تماس (همراه):');
    if (!phone) return;

    const shaba = prompt('شماره شبا (اختیاری - با IR):') || '';
    const title = prompt('عنوان یا پروژه (اختیاری):') || '';

    try {
        const { error } = await client
            .from('typists')
            .insert([{
                name: name.trim(),
                national_code: national_code.trim(),
                phone: phone.trim(),
                shaba_number: shaba.trim(),
                title: title.trim()
            }]);

        if (error) {
            alert('خطا در ثبت: ' + error.message);
            return;
        }

        alert('تایپیست جدید با موفقیت اضافه شد.');
        loadAdminData();
    } catch (err) {
        alert('خطا: ' + err.message);
    }
}

// ویرایش تایپیست توسط مدیر
async function editPersonByAdmin(id) {
    const person = allTypistsCache.find(p => p.id === id);
    if (!person) return;

    const newName = prompt('نام و نام خانوادگی:', person.name || '');
    if (newName === null) return;

    const newNC = prompt('کد ملی:', person.national_code || '');
    if (newNC === null) return;

    const newPhone = prompt('شماره تماس:', person.phone || '');
    if (newPhone === null) return;

    const newShaba = prompt('شماره شبا:', person.shaba_number || '');
    if (newShaba === null) return;

    try {
        const { error } = await client
            .from('typists')
            .update({
                name: newName.trim(),
                national_code: newNC.trim(),
                phone: newPhone.trim(),
                shaba_number: newShaba.trim()
            })
            .eq('id', id);

        if (error) {
            alert('خطا در ویرایش: ' + error.message);
            return;
        }

        alert('تغییرات با موفقیت ذخیره شد.');
        loadAdminData();
    } catch (err) {
        alert('خطا: ' + err.message);
    }
}

// باز کردن مودال تسویه
window.openPaymentModal = function(id, name) {
    $('payTypistId').value = id;
    $('payTypistNameTitle').textContent = 'تسویه مالی برای: ' + name;
    $('payAmount').value = '';
    $('payNotes').value = '';
    $('payPeriodMonth').value = '';
    
    const monthlyRadio = document.querySelector('input[name="settleType"][value="monthly"]');
    if (monthlyRadio) monthlyRadio.checked = true;
    window.toggleSettleTypeUI();

    $('paymentModal').classList.remove('hidden');
};

async function handlePaymentSubmit(e) {
    e.preventDefault();
    const typistId = $('payTypistId').value;
    const amount = parseInt($('payAmount').value) || 0;
    const settleType = document.querySelector('input[name="settleType"]:checked')?.value;
    const periodMonth = $('payPeriodMonth').value.trim();
    const userNotes = $('payNotes').value.trim();

    if (!amount) {
        alert('لطفاً مبلغ پرداختی را وارد کنید.');
        return;
    }

    let finalNotes = '';
    if (settleType === 'full') {
        finalNotes = '[تسویه کامل و نهایی] ' + userNotes;
    } else {
        const monthDesc = periodMonth ? `(بابت ${periodMonth})` : '(تسویه ماهانه)';
        finalNotes = `[تسویه ماهانه ${monthDesc}] ` + userNotes;
    }

    try {
        const { error } = await client
            .from('payments')
            .insert([{
                typist_id: typistId,
                amount: amount,
                notes: finalNotes.trim()
            }]);

        if (error) {
            alert('خطا در ثبت تسویه: ' + error.message);
            return;
        }

        alert('تسویه با موفقیت ثبت شد.');
        closeModal('paymentModal');
        loadAdminData();
    } catch (err) {
        alert('خطای ارتباط: ' + err.message);
    }
}

// ==========================================
// خروجی استاندارد اکسل (دقیقاً ۵ ستون درخواستی)
// نام و نام خانوادگی | کد ملی | شماره تماس | مبلغ | شماره شبا
// ==========================================
function exportToExcel() {
    if (!allTypistsCache || allTypistsCache.length === 0) {
        alert('داده‌ای برای خروجی اکسل وجود ندارد.');
        return;
    }

    const headers = [
        "نام و نام خانوادگی",
        "کد ملی",
        "شماره تماس",
        "مبلغ",
        "شماره شبا"
    ];

    const rows = allTypistsCache.map(p => {
        const pays = p.payments || [];
        const totalPaid = pays.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);

        const name = `"${(p.name || '').replace(/"/g, '""')}"`;
        const nationalCode = `"\t${p.national_code || ''}"`;
        const phone = `"\t${p.phone || ''}"`;
        const amount = `${totalPaid}`;
        const shaba = `"\t${p.shaba_number || ''}"`;

        return [name, nationalCode, phone, amount, shaba].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `لیست_تسویه_حساب_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

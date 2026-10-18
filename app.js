// ==========================================
// تنظیمات اتصال Supabase
// ==========================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_32dg2CRsZ2Nws6qA6x8JgQ_Jgs3Ta-e';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// متغیرهای حالت برنامه (State)
// ==========================================
let currentTypist = null;
let isAdminLoggedIn = false;
let allTypistsCache = [];

// میانبر انتخاب المنتی
const $ = (id) => document.getElementById(id);

// بستن مودال‌ها
function closeModal(modalId) {
    const m = $(modalId);
    if (m) m.classList.add('hidden');
}

// ==========================================
// راه‌اندازی اولیه و رویدادها
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // رویداد دکمه تغییر حالت به ادمین و بالعکس
    const adminBtn = $('adminToggleBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', handleAdminToggle);
    }

    // دکمه خروج تایپیست
    const logoutBtn = $('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutTypist);
    }

    // فرم لاگین تایپیست با کدملی و تلفن
    const loginForm = $('typistLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleTypistLogin);
    }

    // فرم ویرایش پروفایل تایپیست
    const profileForm = $('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    // دکمه باز کردن مودال ویرایش پروفایل
    const editProfBtn = $('editProfileBtn');
    if (editProfBtn) {
        editProfBtn.addEventListener('click', openProfileModal);
    }

    // دکمه باز کردن مودال ثبت گزارش جدید
    const openRepBtn = $('openReportModalBtn');
    if (openRepBtn) {
        openRepBtn.addEventListener('click', () => {
            $('reportForm').reset();
            $('reportModal').classList.remove('hidden');
        });
    }

    // فرم ثبت گزارش ۱۰ روزه
    const repForm = $('reportForm');
    if (repForm) {
        repForm.addEventListener('submit', handleReportSubmit);
    }

    // دکمه تایپیست جدید در پنل مدیریت
    const newTypistBtn = $('newTypistBtn');
    if (newTypistBtn) {
        newTypistBtn.addEventListener('click', createNewTypistByAdmin);
    }

    // دکمه خروجی اکسل تسویه
    const exportExcelBtn = $('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }

    // فرم ثبت تسویه مالی
    const paymentForm = $('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }
});

// ==========================================
// ورود به پنل مدیریت (با رمز استعلامی از دیتابیس)
// ==========================================
async function handleAdminToggle() {
    const adminSec = $('adminSection');
    const loginSec = $('loginSection');
    const typistSec = $('typistDashboardSection');
    const adminBtn = $('adminToggleBtn');

    // اگر الان در پنل مدیریت است، بازگشت داده شود
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

    // اگر قبلاً لاگین نکرده است، رمز از کاربر و سپس از دیتابیس چک شود
    if (!isAdminLoggedIn) {
        const enteredPass = prompt('لطفاً رمز عبور ورود به پنل مدیریت را وارد کنید:');
        if (!enteredPass) return; // لغو شد

        const oldBtnText = adminBtn.textContent;
        adminBtn.textContent = 'در حال بررسی رمز...';

        try {
            // خواندن رمز از جدول app_settings در دیتابیس
            const { data, error } = await client
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_password')
                .single();

            if (error || !data) {
                alert('خطا در بررسی رمز عبور دیتابیس: ' + (error ? error.message : 'یافت نشد'));
                adminBtn.textContent = oldBtnText;
                return;
            }

            // چک کردن تطابق رمز
            if (enteredPass.trim() !== data.value.trim()) {
                alert('رمز عبور وارد شده اشتباه است!');
                adminBtn.textContent = oldBtnText;
                return;
            }

            // تایید لاگین ادمین
            isAdminLoggedIn = true;
        } catch (err) {
            alert('خطای اتصال به سرور: ' + err.message);
            adminBtn.textContent = oldBtnText;
            return;
        }
    }

    // ورود موفق به پنل مدیریت
    loginSec.classList.add('hidden');
    typistSec.classList.add('hidden');
    adminSec.classList.remove('hidden');
    adminBtn.textContent = 'بازگشت به پنل کاربری';

    loadAdminData();
}

// بارگذاری اطلاعات در جدول مدیریت
async function loadAdminData() {
    const tbody = $('adminTypistsTable');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">در حال دریافت داده‌ها از پایگاه داده...</td></tr>';

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
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-500 font-medium">خطا در دریافت اطلاعات: ${error.message}</td></tr>`;
            return;
        }

        allTypistsCache = data || [];

        if (allTypistsCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">هیچ تایپیستی ثبت نشده است. از دکمه «+ تایپیست جدید» برای شروع استفاده کنید.</td></tr>';
            return;
        }

        tbody.innerHTML = allTypistsCache.map(p => {
            const reps = p.typist_reports || [];
            const pays = p.payments || [];

            const totalPages = reps.reduce((sum, r) => sum + Number(r.pages_count || 0), 0);
            const totalWords = reps.reduce((sum, r) => sum + Number(r.words_count || 0), 0);
            const totalPaid = pays.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="p-3 font-bold text-slate-900">${p.name || '-'}</td>
                    <td class="p-3 font-mono">${p.national_code || '-'}</td>
                    <td class="p-3 font-mono">${p.phone || '-'}</td>
                    <td class="p-3 font-mono text-slate-500" dir="ltr">${p.shaba_number || '-'}</td>
                    <td class="p-3">${p.title || '-'}</td>
                    <td class="p-3 font-mono text-teal-600 font-semibold">${totalPages} ص / ${totalWords.toLocaleString()} ک</td>
                    <td class="p-3 font-mono font-bold text-emerald-600">${totalPaid.toLocaleString()}</td>
                    <td class="p-3 text-center space-x-1 space-x-reverse">
                        <button onclick="openPaymentModal('${p.id}', '${p.name}')" class="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 font-medium text-xs">تسویه</button>
                        <button onclick="editPersonByAdmin('${p.id}')" class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-xs">ویرایش</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-500 font-medium">خطای نامشخص: ${err.message}</td></tr>`;
    }
}

// ==========================================
// لاگین تایپیست با کدملی و شماره تماس
// ==========================================
async function handleTypistLogin(e) {
    e.preventDefault();
    const nc = $('loginNationalCode').value.trim();
    const phone = $('loginPhone').value.trim();
    const btn = $('loginSubmitBtn');

    if (!nc || !phone) {
        alert('لطفاً هم کدملی و هم شماره تماس را وارد کنید.');
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
            alert('خطای اتصال به سرور: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'ورود به پنل کاربری';
            return;
        }

        if (!data) {
            alert('کاربری با این مشخصات یافت نشد! لطفاً با مدیر سیستم هماهنگ فرمایید.');
            btn.disabled = false;
            btn.textContent = 'ورود به پنل کاربری';
            return;
        }

        // ورود موفق تایپیست
        currentTypist = data;
        renderTypistDashboard();
    } catch (err) {
        alert('خطای نامشخص رخ داد: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'ورود به پنل کاربری';
    }
}

// رندر صفحه داشبورد تایپیست
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

// خروج از حساب تایپیست
function logoutTypist() {
    currentTypist = null;
    $('typistDashboardSection').classList.add('hidden');
    $('logoutBtn').classList.add('hidden');
    $('loginSection').classList.remove('hidden');
    $('typistLoginForm').reset();
}

// لود گزارش‌های دوره ای تایپیست
async function loadTypistReports() {
    if (!currentTypist) return;
    const tbody = $('typistReportsTable');
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">در حال دریافت سوابق...</td></tr>';

    try {
        const { data, error } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypist.id)
            .order('created_at', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-500">خطا در بارگذاری سوابق: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">تاکنون گزارشی ثبت نکرده‌اید.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(r => `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="p-3 font-semibold text-slate-800">${r.period_name || 'دوره ۱۰ روزه'}</td>
                <td class="p-3 font-mono text-teal-600 font-bold">${Number(r.pages_count).toLocaleString()}</td>
                <td class="p-3 font-mono">${Number(r.words_count).toLocaleString()}</td>
                <td class="p-3 font-mono text-slate-500 text-[11px]">${new Date(r.created_at).toLocaleDateString('fa-IR')}</td>
                <td class="p-3 text-slate-500">${r.notes || '-'}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-500">خطای دریافت سوابق: ${err.message}</td></tr>`;
    }
}

// ویرایش پروفایل تایپیست
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
        alert('خطای غیرمنتظره: ' + err.message);
    }
}

// ثبت گزارش ۱۰ روزه جدید
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
            alert('خطا در ثبت گزارش: ' + error.message);
            return;
        }

        alert('گزارش ۱۰ روزه با موفقیت ثبت گردید.');
        closeModal('reportModal');
        $('reportForm').reset();
        loadTypistReports();
    } catch (err) {
        alert('خطای ثبت: ' + err.message);
    }
}

// ==========================================
// توابع عملیاتی پنل مدیریت
// ==========================================

// افزودن تایپیست جدید توسط ادمین
async function createNewTypistByAdmin() {
    const name = prompt('نام و نام خانوادگی تایپیست جدید را وارد کنید:');
    if (!name) return;

    const national_code = prompt('کد ملی تایپیست:');
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
            alert('خطا در افزودن تایپیست: ' + error.message);
            return;
        }

        alert('تایپیست جدید با موفقیت ثبت شد.');
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

        alert('ویرایش با موفقیت انجام شد.');
        loadAdminData();
    } catch (err) {
        alert('خطا: ' + err.message);
    }
}

// ثبت تسویه حساب مالی
window.openPaymentModal = function(id, name) {
    $('payTypistId').value = id;
    $('payTypistNameTitle').textContent = 'برای تایپیست: ' + name;
    $('payAmount').value = '';
    $('payNotes').value = '';
    $('paymentModal').classList.remove('hidden');
};

async function handlePaymentSubmit(e) {
    e.preventDefault();
    const typistId = $('payTypistId').value;
    const amount = parseInt($('payAmount').value) || 0;
    const notes = $('payNotes').value.trim();

    if (!amount) {
        alert('لطفاً مبلغ واریزی را به صورت معتبر وارد کنید.');
        return;
    }

    try {
        const { error } = await client
            .from('payments')
            .insert([{
                typist_id: typistId,
                amount: amount,
                notes: notes
            }]);

        if (error) {
            alert('خطا در ثبت تسویه: ' + error.message);
            return;
        }

        alert('واریزی با موفقیت ثبت شد.');
        closeModal('paymentModal');
        loadAdminData();
    } catch (err) {
        alert('خطا در ارتباط با سرور: ' + err.message);
    }
}

// ==========================================
// خروجی استاندارد اکسل (دقیقاً ۵ ستون درخواستی)
// نام نام خانوادگی | کد ملی | شماره تماس | مبلغ | شماره شبا
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

        // استفاده از \t و نقل قول برای جلوگیری از خراب شدن اعداد فارسی و ارقام طولانی در اکسل
        const name = `"${(p.name || '').replace(/"/g, '""')}"`;
        const nationalCode = `"\t${p.national_code || ''}"`;
        const phone = `"\t${p.phone || ''}"`;
        const amount = `${totalPaid}`;
        const shaba = `"\t${p.shaba_number || ''}"`;

        return [name, nationalCode, phone, amount, shaba].join(',');
    });

    // اضافه کردن BOM یوتی‌اف ۸ برای خواندن صحیح حروف فارسی در مایکروسافت اکسل
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `تسویه_حساب_تایپیست_ها_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==========================================================================
// ۱. پیکربندی اتصال به Supabase و تعریف متغیرهای سراسری
// ==========================================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';

// توکن عمومی معتبر anon سوپابیس خود را اینجا بگذارید
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDcxNjY4NTgsImV4cCI6MjAyMjc0Mjg1OH0.kIixZlq6jLhG-wX53fA7x_uN6rXg7u1tU_exampleKeyChangeMe';

// ساخت کلاینت پایگاه داده
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.db = db;
window.client = db;

// حالت‌های برنامه
let currentAdminLoggedIn = false;
let currentTypistUser = null;
let selectedTypistIdForAdmin = null;

// ==========================================================================
// ۲. توابع کمکی امنیتی، تبدیل اعداد (ضد NaN) و فرمت پول
// ==========================================================================
function safeNumber(val) {
    if (val === null || val === undefined || isNaN(Number(val))) return 0;
    return Number(val);
}

function formatToman(val) {
    return safeNumber(val).toLocaleString('fa-IR');
}

// راه‌اندازی تقویم پاپ‌آپ شمسی
function initPersianDatepickers() {
    if (window.$ && $.fn.persianDatepicker) {
        $('.pdate-field').persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            calendar: {
                persian: {
                    locale: 'fa'
                }
            }
        });
    }
}

// اجرای اولیه هنگام لود صفحه
document.addEventListener('DOMContentLoaded', () => {
    initPersianDatepickers();
    checkExistingSession();
});

function checkExistingSession() {
    const adminSess = sessionStorage.getItem('admin_logged');
    if (adminSess === 'true') {
        setAdminState(true);
        loadTypistsCards();
    }
}

// ==========================================================================
// ۳. سیستم احراز هویت تایپیست و مدیر
// ==========================================================================
async function handleTypistLogin() {
    const nationalCode = document.getElementById('loginNationalCode').value.trim();
    const phone = document.getElementById('loginPhone').value.trim();

    if (!nationalCode || !phone) {
        alert('لطفاً کد ملی و شماره همراه خود را وارد کنید.');
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
            alert('مشخصاتی با این کد ملی و شماره تلفن در سامانه یافت نشد.');
            return;
        }

        currentTypistUser = data;
        showTypistDashboard();
    } catch (err) {
        console.error(err);
        alert('خطا در بررسی مشخصات: ' + (err.message || 'خطای شبکه'));
    }
}

function showTypistDashboard() {
    document.getElementById('typistEntrySection').classList.add('hidden');
    document.getElementById('typistDashboardSection').classList.remove('hidden');

    document.getElementById('dashTypistName').textContent = currentTypistUser.name;
    document.getElementById('dashTypistSubInfo').textContent = 
        `کد ملی: ${currentTypistUser.national_code} | شبا: ${currentTypistUser.shaba || 'ثبت‌نشده'} | نرخ هر کلمه: ${formatToman(currentTypistUser.rate_per_word)} تومان`;

    loadTypistSelfReports();
}

function typistLogout() {
    currentTypistUser = null;
    document.getElementById('typistDashboardSection').classList.add('hidden');
    document.getElementById('typistEntrySection').classList.remove('hidden');
}

// مدیریت پاپ‌آپ لاگین ادمین
function openAdminLoginModal() {
    document.getElementById('adminLoginModal').classList.remove('hidden');
    document.getElementById('adminPasswordInput').focus();
}

function closeAdminLoginModal() {
    document.getElementById('adminLoginModal').classList.add('hidden');
    document.getElementById('adminPasswordInput').value = '';
}

async function submitAdminLogin() {
    const pwd = document.getElementById('adminPasswordInput').value;
    if (!pwd) {
        alert('رمز را وارد کنید.');
        return;
    }

    try {
        const { data, error } = await db
            .from('app_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single();

        if (error || !data) {
            alert('عدم دسترسی به پایگاه‌داده یا کلید admin_password در جدول app_settings تنظیم نشده است.');
            return;
        }

        if (String(data.value).trim() === String(pwd).trim()) {
            closeAdminLoginModal();
            sessionStorage.setItem('admin_logged', 'true');
            setAdminState(true);
            loadTypistsCards();
        } else {
            alert('رمز عبور مدیر نادرست است.');
        }
    } catch (err) {
        alert('خطای اتصال در اعتبارسنجی مدیر: ' + err.message);
    }
}

function setAdminState(isAdmin) {
    currentAdminLoggedIn = isAdmin;
    if (isAdmin) {
        document.getElementById('adminLoginBtn').classList.add('hidden');
        document.getElementById('adminLogoutBtn').classList.remove('hidden');
        document.getElementById('typistEntrySection').classList.add('hidden');
        document.getElementById('typistDashboardSection').classList.add('hidden');
        document.getElementById('adminDashboardSection').classList.remove('hidden');
    } else {
        document.getElementById('adminLoginBtn').classList.remove('hidden');
        document.getElementById('adminLogoutBtn').classList.add('hidden');
        document.getElementById('adminDashboardSection').classList.add('hidden');
        document.getElementById('typistEntrySection').classList.remove('hidden');
        sessionStorage.removeItem('admin_logged');
    }
}

function adminLogout() {
    setAdminState(false);
}

// ==========================================================================
// ۴. بخش تایپیست: ثبت و مشاهده گزارش کارکرد
// ==========================================================================
async function loadTypistSelfReports() {
    if (!currentTypistUser) return;
    const tBody = document.getElementById('typistReportsTableBody');
    tBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">در حال دریافت داده‌ها...</td></tr>';

    try {
        const { data, error } = await db
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypistUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">هنوز گزارشی ثبت نشده است.</td></tr>';
            return;
        }

        tBody.innerHTML = data.map((r, i) => {
            const pages = safeNumber(r.pages);
            const words = safeNumber(r.words);
            const isSettled = r.is_settled === true;
            return `
                <tr class="hover:bg-slate-50">
                    <td class="p-3">${i + 1}</td>
                    <td class="p-3 font-mono">${r.report_date || '-'}</td>
                    <td class="p-3">${pages.toLocaleString('fa-IR')}</td>
                    <td class="p-3 font-semibold text-slate-700">${words.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-slate-500">${r.description || '-'}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold ${isSettled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                            ${isSettled ? 'تسویه شده' : 'در انتظار تسویه'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-rose-500">خطا: ${e.message}</td></tr>`;
    }
}

async function submitNewReport() {
    if (!currentTypistUser) return;

    const reportDate = document.getElementById('reportDateInput').value.trim();
    const pages = safeNumber(document.getElementById('reportPagesInput').value);
    const words = safeNumber(document.getElementById('reportWordsInput').value);
    const desc = document.getElementById('reportDescInput').value.trim();

    if (!reportDate) {
        alert('لطفاً تاریخ گزارش را با کلیک روی فیلد از تقویم پاپ‌آپ انتخاب کنید.');
        return;
    }
    if (pages <= 0 && words <= 0) {
        alert('لطفاً تعداد صفحات یا تعداد کلمات را وارد کنید.');
        return;
    }

    const rate = safeNumber(currentTypistUser.rate_per_word);
    const calculatedTotal = words * rate;

    try {
        const { error } = await db
            .from('typist_reports')
            .insert([{
                typist_id: currentTypistUser.id,
                report_date: reportDate,
                pages: pages,
                words: words,
                rate_per_word: rate,
                total_amount: calculatedTotal,
                description: desc,
                is_settled: false,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        alert('گزارش کار با موفقیت ثبت گردید.');
        document.getElementById('reportPagesInput').value = '';
        document.getElementById('reportWordsInput').value = '';
        document.getElementById('reportDescInput').value = '';
        loadTypistSelfReports();
    } catch (err) {
        alert('خطا در ثبت گزارش: ' + err.message);
    }
}

// ==========================================================================
// ۵. بخش پنل مدیریت: رندر کارت‌ها و لیست تایپیست‌ها
// ==========================================================================
async function loadTypistsCards() {
    const grid = document.getElementById('typistsCardsGrid');
    grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-500">در حال واکشی اطلاعات...</div>';

    try {
        const { data: typists, error } = await db
            .from('typists')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!typists || typists.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">هنوز تایپیستی تعریف نشده است. از دکمه بالا برای ثبت استفاده کنید.</div>';
            return;
        }

        // واکشی گزارش‌های تسویه نشده جهت نمایش در کارت
        const { data: unsettledReports } = await db
            .from('typist_reports')
            .select('typist_id, words, pages')
            .eq('is_settled', false);

        grid.innerHTML = typists.map(t => {
            const myUnsettled = (unsettledReports || []).filter(r => r.typist_id === t.id);
            const pendingWords = myUnsettled.reduce((acc, cur) => acc + safeNumber(cur.words), 0);
            const pendingPages = myUnsettled.reduce((acc, cur) => acc + safeNumber(cur.pages), 0);
            const pendingPay = pendingWords * safeNumber(t.rate_per_word);

            return `
                <div class="bg-white border rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col justify-between border-slate-200">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h4 class="font-bold text-slate-800 text-base">${t.name}</h4>
                                <span class="text-[11px] text-slate-400 font-mono">کدملی: ${t.national_code || '-'}</span>
                            </div>
                            <button onclick="openEditTypistModal('${t.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg">
                                ✏️ ویرایش
                            </button>
                        </div>

                        <div class="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                            <div>📱 تلفن: <span class="font-mono">${t.phone || '-'}</span></div>
                            <div class="truncate">💳 شبا: <span class="font-mono">${t.shaba || 'ثبت‌نشده'}</span></div>
                            <div>💰 نرخ هر کلمه: <b>${formatToman(t.rate_per_word)} تومان</b></div>
                            <div>📅 تحویل: ${t.delivery_date || '-'}</div>
                        </div>

                        <!-- خلاصه کارکرد تسویه‌نشده -->
                        <div class="mt-4 p-3 rounded-xl ${pendingWords > 0 ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-slate-50 border border-slate-200 text-slate-600'} text-xs">
                            <div class="flex justify-between">
                                <span>کلمات مانده تسویه:</span>
                                <b>${pendingWords.toLocaleString('fa-IR')} کلمه</b>
                            </div>
                            <div class="flex justify-between mt-1">
                                <span>مبلغ قابل پرداخت:</span>
                                <b class="text-emerald-700 font-bold">${formatToman(pendingPay)} تومان</b>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                        <button onclick="selectTypistForReview('${t.id}')" class="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-1.5 rounded-lg text-xs transition">
                            مشاهده گزارش‌ها و تسویه
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        grid.innerHTML = `<div class="col-span-full text-center py-6 text-rose-500">خطا: ${e.message}</div>`;
    }
}

// انتخاب تایپیست برای مشاهده جزئیات و تسویه
async function selectTypistForReview(typistId) {
    selectedTypistIdForAdmin = typistId;
    const box = document.getElementById('adminSelectedTypistBox');
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth' });

    const { data: typist } = await db.from('typists').select('*').eq('id', typistId).single();
    if (typist) {
        document.getElementById('selectedTypistHeading').textContent = `گزارش‌های کارکرد: ${typist.name}`;
        document.getElementById('selectedTypistSubText').textContent = `نرخ هر کلمه: ${formatToman(typist.rate_per_word)} تومان | شماره شبا: ${typist.shaba || '-'}`;
    }

    loadAdminReportsTable(typistId);
}

async function loadAdminReportsTable(typistId) {
    const tBody = document.getElementById('adminReportsTableBody');
    tBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-400">در حال بارگذاری...</td></tr>';

    try {
        const { data: reports, error } = await db
            .from('typist_reports')
            .select('*')
            .eq('typist_id', typistId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reports || reports.length === 0) {
            tBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-400">هیچ گزارشی برای این تایپیست ثبت نشده است.</td></tr>';
            return;
        }

        tBody.innerHTML = reports.map(r => {
            const pages = safeNumber(r.pages);
            const words = safeNumber(r.words);
            const amount = safeNumber(r.total_amount);
            const isSettled = r.is_settled === true;

            return `
                <tr class="hover:bg-slate-50">
                    <td class="p-3 font-mono">${r.report_date || '-'}</td>
                    <td class="p-3">${pages.toLocaleString('fa-IR')}</td>
                    <td class="p-3 font-semibold">${words.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-emerald-700 font-bold">${formatToman(amount)} تومان</td>
                    <td class="p-3 text-slate-500">${r.description || '-'}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold ${isSettled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                            ${isSettled ? 'تسویه شده' : 'تسویه نشده'}
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <button onclick="deleteReport('${r.id}')" class="text-rose-600 hover:text-rose-800 text-xs">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-rose-500">خطا: ${e.message}</td></tr>`;
    }
}

async function deleteReport(reportId) {
    if (!confirm('آیا از حذف این گزارش مطمئن هستید؟')) return;
    try {
        await db.from('typist_reports').delete().eq('id', reportId);
        loadAdminReportsTable(selectedTypistIdForAdmin);
        loadTypistsCards();
    } catch (e) {
        alert('خطا در حذف گزارش: ' + e.message);
    }
}

// ==========================================================================
// ۶. منطق دقیق تسویه حساب: محاسبه خودکار از آخرین تسویه تا کنون
// ==========================================================================
async function runSettlement() {
    if (!selectedTypistIdForAdmin) {
        alert('لطفاً ابتدا یک تایپیست را انتخاب کنید.');
        return;
    }

    try {
        // ۱. دریافت اطلاعات تایپیست
        const { data: typist, error: tErr } = await db
            .from('typists')
            .select('*')
            .eq('id', selectedTypistIdForAdmin)
            .single();

        if (tErr || !typist) {
            alert('اطلاعات تایپیست یافت نشد.');
            return;
        }

        const ratePerWord = safeNumber(typist.rate_per_word);
        if (ratePerWord <= 0) {
            alert('نرخ کلمه برای این تایپیست ثبت نشده یا صفر است! ابتدا با کلیک روی «ویرایش»، نرخ کلمه را تعیین کنید.');
            return;
        }

        // ۲. واکشی کلیه گزارش‌های تسویه‌نشده (از آخرین تسویه تا امروز)
        const { data: pendingReports, error: rErr } = await db
            .from('typist_reports')
            .select('*')
            .eq('typist_id', selectedTypistIdForAdmin)
            .eq('is_settled', false);

        if (rErr) throw rErr;

        // ۳. بررسی شرط وجود کلمات
        if (!pendingReports || pendingReports.length === 0) {
            alert('هیچ گزارش یا کارکرد جدیدی پس از آخرین تسویه برای این تایپیست ثبت نشده است!');
            return;
        }

        let totalWords = 0;
        let totalPages = 0;
        const reportIds = [];

        pendingReports.forEach(r => {
            totalWords += safeNumber(r.words);
            totalPages += safeNumber(r.pages);
            reportIds.push(r.id);
        });

        // اگر کلمات صفر باشد اجازه تسویه داده نمی‌شود
        if (totalWords <= 0) {
            alert('خطای تسویه: تعداد کلمات ثبت‌شده در دوره‌های اخیر صفر است! کلمات را وارد یا ویرایش کنید.');
            return;
        }

        // ۴. محاسبه خودکار مبلغ
        const totalAmountPayable = totalWords * ratePerWord;

        // ۵. نمایش فاکتور دقیق برای تایید مدیر
        const promptText = 
            `صورت‌حساب تسویه برای: ${typist.name}\n` +
            `----------------------------------------\n` +
            `تعداد گزارش‌های تسویه‌نشده: ${pendingReports.length}\n` +
            `مجموع صفحات: ${totalPages.toLocaleString('fa-IR')}\n` +
            `مجموع کلمات کارکرد جدید: ${totalWords.toLocaleString('fa-IR')} کلمه\n` +
            `نرخ محاسبه هر کلمه: ${ratePerWord.toLocaleString('fa-IR')} تومان\n` +
            `مبلغ نهایی قابل پرداخت: ${totalAmountPayable.toLocaleString('fa-IR')} تومان\n` +
            `شماره شبا مقصد: ${typist.shaba || 'ثبت‌نشده'}\n\n` +
            `آیا تسویه حساب را تایید می‌فرمایید؟`;

        if (!confirm(promptText)) return;

        // ۶. علامت‌گذاری گزارش‌ها به عنوان تسویه‌شده
        const { error: settleErr } = await db
            .from('typist_reports')
            .update({ is_settled: true })
            .in('id', reportIds);

        if (settleErr) throw settleErr;

        // ۷. درج رکورد در جدول پرداخت‌ها (جهت آرشیو و خروجی اکسل)
        const todayFa = new persianDate().format('YYYY/MM/DD');
        await db.from('payments').insert([{
            typist_id: typist.id,
            typist_name: typist.name,
            national_code: typist.national_code,
            phone: typist.phone,
            shaba: typist.shaba,
            words_count: totalWords,
            amount: totalAmountPayable,
            settlement_date: todayFa,
            created_at: new Date().toISOString()
        }]);

        alert(`تسویه حساب ${typist.name} با مبلغ ${formatToman(totalAmountPayable)} تومان با موفقیت نهایی شد.`);

        // بروزرسانی UI
        loadTypistsCards();
        loadAdminReportsTable(selectedTypistIdForAdmin);

    } catch (err) {
        console.error(err);
        alert('خطا در انجام تسویه: ' + err.message);
    }
}

// ==========================================================================
// ۷. خروجی اکسل دقیق طبق فرمت ۵ ستونه بانکی با انکودینگ UTF-8 BOM
// ==========================================================================
async function exportSettleExcel() {
    try {
        // دریافت آخرین رکوردهای پرداخت یا تسویه‌نشده‌ها
        const { data: payments, error } = await db
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!payments || payments.length === 0) {
            alert('هنوز هیچ تسویه حسابی جهت خروجی اکسل ثبت نشده است.');
            return;
        }

        // ۵ ستون دقیق الزامی: نام و نام خانوادگی، کد ملی، شماره همراه، مبلغ، شماره شبا
        let csvContent = '\uFEFF'; // اضافه کردن BOM برای رفع به‌هم‌ریختگی زبان فارسی در اکسل
        csvContent += 'نام و نام خانوادگی\tکد ملی\tشماره همراه\tمبلغ (تومان)\tشماره شبا\n';

        payments.forEach(p => {
            const name = (p.typist_name || '-').replace(/\t/g, ' ');
            const nCode = `\t${p.national_code || ''}`; // کاراکتر تب برای حفظ صفرهای اول کد ملی
            const phone = `\t${p.phone || ''}`;
            const amount = safeNumber(p.amount);
            const shaba = `\t${p.shaba || ''}`;

            csvContent += `${name}\t${nCode}\t${phone}\t${amount}\t${shaba}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Settlement_Reports_${new persianDate().format('YYYY-MM-DD')}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        alert('خطا در تولید فایل اکسل: ' + e.message);
    }
}

// ==========================================================================
// ۸. مدیریت تایپیست: افزودن، ویرایش و تعریف پروژه جدید
// ==========================================================================
function openNewTypistModal() {
    document.getElementById('typistModalTitle').textContent = 'ثبت تایپیست جدید';
    document.getElementById('editTypistId').value = '';
    document.getElementById('mName').value = '';
    document.getElementById('mNationalCode').value = '';
    document.getElementById('mPhone').value = '';
    document.getElementById('mShaba').value = '';
    document.getElementById('mRate').value = '';
    document.getElementById('mStartDate').value = '';
    document.getElementById('mDeliveryDate').value = '';
    document.getElementById('typistModal').classList.remove('hidden');
    initPersianDatepickers();
}

async function openEditTypistModal(typistId) {
    try {
        const { data: t, error } = await db.from('typists').select('*').eq('id', typistId).single();
        if (error || !t) throw error;

        document.getElementById('typistModalTitle').textContent = `ویرایش تایپیست: ${t.name}`;
        document.getElementById('editTypistId').value = t.id;
        document.getElementById('mName').value = t.name || '';
        document.getElementById('mNationalCode').value = t.national_code || '';
        document.getElementById('mPhone').value = t.phone || '';
        document.getElementById('mShaba').value = t.shaba || '';
        document.getElementById('mRate').value = t.rate_per_word || '';
        document.getElementById('mStartDate').value = t.start_date || '';
        document.getElementById('mDeliveryDate').value = t.delivery_date || '';

        document.getElementById('typistModal').classList.remove('hidden');
        initPersianDatepickers();
    } catch (e) {
        alert('خطا در بارگذاری اطلاعات تایپیست: ' + e.message);
    }
}

function closeTypistModal() {
    document.getElementById('typistModal').classList.add('hidden');
}

async function saveTypistRecord() {
    const editId = document.getElementById('editTypistId').value;
    const name = document.getElementById('mName').value.trim();
    const nationalCode = document.getElementById('mNationalCode').value.trim();
    const phone = document.getElementById('mPhone').value.trim();
    const shaba = document.getElementById('mShaba').value.trim();
    const rate = safeNumber(document.getElementById('mRate').value);
    const startDate = document.getElementById('mStartDate').value.trim();
    const deliveryDate = document.getElementById('mDeliveryDate').value.trim();

    if (!name || !nationalCode || !phone) {
        alert('نام، کد ملی و شماره همراه الزامی است.');
        return;
    }

    const payload = {
        name: name,
        national_code: nationalCode,
        phone: phone,
        shaba: shaba,
        rate_per_word: rate,
        start_date: startDate,
        delivery_date: deliveryDate
    };

    try {
        if (editId) {
            // ویرایش
            const { error } = await db.from('typists').update(payload).eq('id', editId);
            if (error) throw error;
            alert('اطلاعات تایپیست با موفقیت بروزرسانی شد.');
        } else {
            // ثبت جدید
            payload.created_at = new Date().toISOString();
            const { error } = await db.from('typists').insert([payload]);
            if (error) throw error;
            alert('تایپیست جدید با موفقیت ثبت شد.');
        }

        closeTypistModal();
        loadTypistsCards();
    } catch (e) {
        alert('خطا در ذخیره سازی: ' + e.message);
    }
}

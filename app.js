// ==========================================================================
// ۱. تنظیمات اتصال و تعریف کلاینت دیتابیس Supabase
// ==========================================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'GAPGPTMASKTOKENflp885hy79bX0X';

// تابع دریافت یا ایجاد مطمئن کلاینت جهت جلوگیری از خطای اتصال
function getDbClient() {
    if (window.db && typeof window.db.from === 'function') {
        return window.db;
    }
    const supabaseLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (supabaseLib && typeof supabaseLib.createClient === 'function') {
        const client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.db = client;
        window.client = client;
        window.supabaseClient = client;
        return client;
    }
    return null;
}

// تلاش اولیه برای مقداردهی
let db = getDbClient();
window.db = db;
window.client = db;
window.supabaseClient = db;

// متغیرهای وضعیت
let currentAdminLoggedIn = false;
let currentTypistUser = null;
let selectedTypistIdForAdmin = null;

// ==========================================================================
// ۲. توابع عمومی و تبدیل امن مقادیر (حل قطعی مقادیر NaN و ارقام فارسی)
// ==========================================================================
function safeNumber(val) {
    if (val === null || val === undefined) return 0;
    const enVal = String(val)
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/,/g, '')
        .trim();
    const num = Number(enVal);
    return (isNaN(num) || !isFinite(num)) ? 0 : num;
}
window.safeNumber = safeNumber;

function formatToman(val) {
    return safeNumber(val).toLocaleString('fa-IR');
}
window.formatToman = formatToman;

function initPersianDatepickers() {
    if (window.$ && $.fn && $.fn.persianDatepicker) {
        $('.pdate-field').persianDatepicker({
            format: 'YYYY/MM/DD',
            autoClose: true,
            initialValue: false,
            calendar: {
                persian: { locale: 'fa' }
            }
        });
    }
}
window.initPersianDatepickers = initPersianDatepickers;

// ==========================================================================
// ۳. احراز هویت تایپیست و ادمین
// ==========================================================================
window.openAdminLoginModal = function() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('adminPasswordInput');
        if (input) input.focus();
    }
};

window.closeAdminLoginModal = function() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.add('hidden');
    const input = document.getElementById('adminPasswordInput');
    if (input) input.value = '';
};

window.submitAdminLogin = async function() {
    const passwordInput = document.getElementById('adminPasswordInput');
    const enteredPassword = passwordInput ? passwordInput.value.trim() : '';

    if (!enteredPassword) {
        alert('لطفاً رمز عبور را وارد کنید.');
        return;
    }

    const client = getDbClient();
    if (!client) {
        alert('کتابخانه Supabase هنوز لود نشده است!\nلطفاً مطمئن شوید تگ <script src="https://unpkg.com/@supabase/supabase-js@2"></script> در فایل HTML شما قرار دارد.');
        return;
    }

    try {
        const { data: isCorrect, error } = await client.rpc('check_admin_pass', {
            entered_pass: enteredPassword
        });

        if (error) {
            console.error('خطای سرور:', error);
            alert('خطا در اعتبارسنجی سرور: ' + (error.message || 'خطا در ارتباط'));
            return;
        }

        if (isCorrect === true) {
            sessionStorage.setItem('admin_logged', 'true');
            sessionStorage.setItem('admin_logged_in', 'true');
            localStorage.setItem('admin_logged', 'true');
            
            if (typeof window.closeAdminLoginModal === 'function') {
                window.closeAdminLoginModal();
            }
            window.setAdminState(true);
            window.loadTypistsCards();
        } else {
            alert('رمز عبور وارد شده اشتباه است.');
            if (passwordInput) passwordInput.value = '';
        }
    } catch (err) {
        console.error('خطا:', err);
        alert('خطا در برقراری ارتباط با سرور.');
    }
};

window.setAdminState = function(isAdmin) {
    currentAdminLoggedIn = isAdmin;
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const typistEntrySection = document.getElementById('typistEntrySection');
    const typistDashboardSection = document.getElementById('typistDashboardSection');
    const adminDashboardSection = document.getElementById('adminDashboardSection');

    if (isAdmin) {
        if (adminLoginBtn) adminLoginBtn.classList.add('hidden');
        if (adminLogoutBtn) adminLogoutBtn.classList.remove('hidden');
        if (typistEntrySection) typistEntrySection.classList.add('hidden');
        if (typistDashboardSection) typistDashboardSection.classList.add('hidden');
        if (adminDashboardSection) adminDashboardSection.classList.remove('hidden');
    } else {
        if (adminLoginBtn) adminLoginBtn.classList.remove('hidden');
        if (adminLogoutBtn) adminLogoutBtn.classList.add('hidden');
        if (adminDashboardSection) adminDashboardSection.classList.add('hidden');
        if (typistDashboardSection) typistDashboardSection.classList.add('hidden');
        if (typistEntrySection) typistEntrySection.classList.remove('hidden');
        sessionStorage.removeItem('admin_logged');
        sessionStorage.removeItem('admin_logged_in');
        localStorage.removeItem('admin_logged');
    }
};

window.adminLogout = function() {
    window.setAdminState(false);
    window.location.reload();
};

window.handleTypistLogin = async function() {
    const nationalCode = document.getElementById('loginNationalCode').value.trim();
    const phone = document.getElementById('loginPhone').value.trim();

    if (!nationalCode || !phone) {
        alert('لطفاً کد ملی و شماره همراه خود را وارد کنید.');
        return;
    }

    const client = getDbClient();
    if (!client) {
        alert('خطای اتصال به دیتابیس.');
        return;
    }

    try {
        const { data, error } = await client
            .from('typists')
            .select('*')
            .eq('national_code', nationalCode)
            .eq('phone', phone)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            alert('تایپیستی با این مشخصات یافت نشد.');
            return;
        }

        currentTypistUser = data;
        window.showTypistDashboard();
    } catch (err) {
        alert('خطای اتصال: ' + (err.message || 'شبکه در دسترس نیست'));
    }
};

window.showTypistDashboard = function() {
    document.getElementById('typistEntrySection').classList.add('hidden');
    document.getElementById('typistDashboardSection').classList.remove('hidden');

    document.getElementById('dashTypistName').textContent = currentTypistUser.name;
    document.getElementById('dashTypistSubInfo').textContent = 
        `کد ملی: ${currentTypistUser.national_code} | شبا: ${currentTypistUser.shaba || 'ثبت‌نشده'} | نرخ هر کلمه: ${formatToman(currentTypistUser.rate_per_word)} تومان`;

    window.loadTypistSelfReports();
    initPersianDatepickers();
};

window.typistLogout = function() {
    currentTypistUser = null;
    document.getElementById('typistDashboardSection').classList.add('hidden');
    document.getElementById('typistEntrySection').classList.remove('hidden');
};

// ==========================================================================
// ۴. بخش تایپیست: ثبت و مشاهده گزارش کارکرد
// ==========================================================================
window.loadTypistSelfReports = async function() {
    if (!currentTypistUser) return;
    const tBody = document.getElementById('typistReportsTableBody');
    if (!tBody) return;
    tBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">در حال دریافت داده‌ها...</td></tr>';

    const client = getDbClient();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypistUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">هنوز گزارشی ثبت نشده است.</td></tr>';
            return;
        }

        tBody.innerHTML = data.map((r, i) => {
            const pages = safeNumber(r.pages !== undefined ? r.pages : r.page_count);
            const words = safeNumber(r.words !== undefined ? r.words : r.word_count);
            const isSettled = r.is_settled === true;
            const courseTitle = r.course_title || r.title || 'ثبت عمومی';
            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-3">${i + 1}</td>
                    <td class="p-3 font-medium text-gray-800">${courseTitle}</td>
                    <td class="p-3 font-mono">${r.report_date || '-'}</td>
                    <td class="p-3">${pages.toLocaleString('fa-IR')}</td>
                    <td class="p-3 font-semibold text-gray-700">${words.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-gray-500">${r.description || '-'}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-xs font-bold ${isSettled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                            ${isSettled ? 'تسویه شده' : 'در انتظار تسویه'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">خطا: ${e.message}</td></tr>`;
    }
};

window.submitNewReport = async function() {
    if (!currentTypistUser) return;

    const reportDate = document.getElementById('reportDateInput').value.trim();
    const pages = safeNumber(document.getElementById('reportPagesInput').value);
    const words = safeNumber(document.getElementById('reportWordsInput').value);
    const desc = document.getElementById('reportDescInput').value.trim();
    const courseTitleInput = document.getElementById('reportCourseInput');
    const courseTitle = courseTitleInput ? courseTitleInput.value.trim() : '';

    if (!reportDate) {
        alert('لطفاً تاریخ گزارش را با کلیک روی فیلد از تقویم پاپ‌آپ انتخاب کنید.');
        return;
    }
    if (pages <= 0 && words <= 0) {
        alert('لطفاً تعداد صفحات یا تعداد کلمات را به عدد وارد کنید.');
        return;
    }

    const client = getDbClient();
    if (!client) {
        alert('خطای اتصال به دیتابیس.');
        return;
    }

    const rate = safeNumber(currentTypistUser.rate_per_word);
    const calculatedTotal = words * rate;

    try {
        const payload = {
            typist_id: currentTypistUser.id,
            report_date: reportDate,
            pages: pages,
            words: words,
            rate_per_word: rate,
            total_amount: calculatedTotal,
            description: desc,
            is_settled: false,
            created_at: new Date().toISOString()
        };

        if (courseTitle) payload.course_title = courseTitle;

        const { error } = await client.from('typist_reports').insert([payload]);

        if (error) throw error;

        alert('گزارش کار با موفقیت ثبت شد.');
        document.getElementById('reportPagesInput').value = '';
        document.getElementById('reportWordsInput').value = '';
        document.getElementById('reportDescInput').value = '';
        if (courseTitleInput) courseTitleInput.value = '';
        window.loadTypistSelfReports();
    } catch (err) {
        alert('خطا در ثبت گزارش: ' + err.message);
    }
};

// ==========================================================================
// ۵. بخش پنل مدیریت: رندر کارت‌ها و لیست تایپیست‌ها
// ==========================================================================
window.loadTypistsCards = async function() {
    const grid = document.getElementById('typistsCardsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">در حال واکشی اطلاعات...</div>';

    const client = getDbClient();
    if (!client) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-red-500">خطای دسترسی به دیتابیس</div>';
        return;
    }

    try {
        const { data: typists, error } = await client
            .from('typists')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!typists || typists.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">هیچ تایپیستی یافت نشد.</div>';
            return;
        }

        const { data: unsettledReports } = await client
            .from('typist_reports')
            .select('typist_id, words, pages')
            .eq('is_settled', false);

        grid.innerHTML = typists.map(t => {
            const myUnsettled = (unsettledReports || []).filter(r => r.typist_id === t.id);
            const pendingWords = myUnsettled.reduce((acc, cur) => {
                const w = (cur.words !== undefined) ? cur.words : cur.word_count;
                return acc + safeNumber(w);
            }, 0);
            const pendingPay = pendingWords * safeNumber(t.rate_per_word);

            return `
                <div class="bg-white border rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col justify-between border-gray-200">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <h4 class="font-bold text-gray-800 text-base">${t.name}</h4>
                                <span class="text-xs text-gray-400 font-mono">کدملی: ${t.national_code || '-'}</span>
                            </div>
                            <button onclick="window.openEditTypistModal('${t.id}')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg">
                                ✏️ ویرایش
                            </button>
                        </div>

                        <div class="space-y-1.5 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
                            <div>📱 تلفن: <span class="font-mono">${t.phone || '-'}</span></div>
                            <div class="truncate">💳 شبا: <span class="font-mono">${t.shaba || 'ثبت‌نشده'}</span></div>
                            <div>💰 نرخ هر کلمه: <b>${formatToman(t.rate_per_word)} تومان</b></div>
                            <div>📅 موعد تحویل: ${t.delivery_date || '-'}</div>
                        </div>

                        <div class="mt-4 p-3 rounded-xl ${pendingWords > 0 ? 'bg-yellow-50 border border-yellow-200 text-yellow-900' : 'bg-gray-50 border border-gray-200 text-gray-600'} text-xs">
                            <div class="flex justify-between">
                                <span>کلمات مانده تسویه:</span>
                                <b>${pendingWords.toLocaleString('fa-IR')} کلمه</b>
                            </div>
                            <div class="flex justify-between mt-1">
                                <span>مبلغ قابل پرداخت:</span>
                                <b class="text-green-700 font-bold">${formatToman(pendingPay)} تومان</b>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                        <button onclick="window.selectTypistForReview('${t.id}')" class="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-1.5 rounded-lg text-xs transition">
                            مشاهده گزارش‌ها و تسویه
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        grid.innerHTML = `<div class="col-span-full text-center py-6 text-red-500">خطا: ${e.message}</div>`;
    }
};

window.selectTypistForReview = async function(typistId) {
    selectedTypistIdForAdmin = typistId;
    const box = document.getElementById('adminSelectedTypistBox');
    if (box) {
        box.classList.remove('hidden');
        box.scrollIntoView({ behavior: 'smooth' });
    }

    const client = getDbClient();
    if (!client) return;

    const { data: typist } = await client.from('typists').select('*').eq('id', typistId).single();
    if (typist) {
        document.getElementById('selectedTypistHeading').textContent = `گزارش‌های کارکرد: ${typist.name}`;
        document.getElementById('selectedTypistSubText').textContent = `نرخ هر کلمه: ${formatToman(typist.rate_per_word)} تومان | شماره شبا: ${typist.shaba || '-'}`;
    }

    window.loadAdminReportsTable(typistId);
};

window.loadAdminReportsTable = async function(typistId) {
    const tBody = document.getElementById('adminReportsTableBody');
    if (!tBody) return;
    tBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">در حال بارگذاری...</td></tr>';

    const client = getDbClient();
    if (!client) return;

    try {
        const { data: reports, error } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', typistId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reports || reports.length === 0) {
            tBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-400">هیچ گزارشی برای این تایپیست ثبت نشده است.</td></tr>';
            return;
        }

        tBody.innerHTML = reports.map(r => {
            const pages = safeNumber(r.pages !== undefined ? r.pages : r.page_count);
            const words = safeNumber(r.words !== undefined ? r.words : r.word_count);
            const amount = safeNumber(r.total_amount);
            const isSettled = r.is_settled === true;

            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-3 font-mono">${r.report_date || '-'}</td>
                    <td class="p-3">${pages.toLocaleString('fa-IR')}</td>
                    <td class="p-3 font-semibold">${words.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-green-700 font-bold">${formatToman(amount)} تومان</td>
                    <td class="p-3 text-gray-500">${r.description || '-'}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded text-xs font-bold ${isSettled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                            ${isSettled ? 'تسویه شده' : 'تسویه نشده'}
                        </span>
                    </td>
                    <td class="p-3 text-center">
                        <button onclick="window.deleteReport('${r.id}')" class="text-red-600 hover:text-red-800 text-xs font-bold">حذف</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">خطا: ${e.message}</td></tr>`;
    }
};

window.deleteReport = async function(reportId) {
    if (!confirm('آیا از حذف این گزارش مطمئن هستید؟')) return;
    const client = getDbClient();
    if (!client) return;

    try {
        await client.from('typist_reports').delete().eq('id', reportId);
        window.loadAdminReportsTable(selectedTypistIdForAdmin);
        window.loadTypistsCards();
    } catch (e) {
        alert('خطا در حذف گزارش: ' + e.message);
    }
};

// ==========================================================================
// ۶. تسویه حساب هوشمند بر مبنای مجموع کلمات از آخرین تسویه تا کنون
// ==========================================================================
window.runSettlement = async function() {
    if (!selectedTypistIdForAdmin) {
        alert('لطفاً ابتدا یک تایپیست را انتخاب کنید.');
        return;
    }

    const client = getDbClient();
    if (!client) {
        alert('خطای اتصال به دیتابیس.');
        return;
    }

    try {
        const { data: typist, error: tErr } = await client
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
            alert('نرخ هر کلمه برای این تایپیست مشخص نشده یا صفر است! ابتدا با کلیک روی ویرایش، نرخ را تعیین کنید.');
            return;
        }

        const { data: pendingReports, error: rErr } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', selectedTypistIdForAdmin)
            .eq('is_settled', false);

        if (rErr) throw rErr;

        if (!pendingReports || pendingReports.length === 0) {
            alert('هیچ کارکرد یا گزارش جدیدی پس از آخرین تسویه برای این تایپیست ثبت نشده است!');
            return;
        }

        let totalWords = 0;
        let totalPages = 0;
        const reportIds = [];

        pendingReports.forEach(r => {
            const w = (r.words !== undefined) ? r.words : r.word_count;
            const p = (r.pages !== undefined) ? r.pages : r.page_count;
            totalWords += safeNumber(w);
            totalPages += safeNumber(p);
            reportIds.push(r.id);
        });

        if (totalWords <= 0) {
            alert('خطای تسویه: تعداد کلمات ثبت‌شده در دوره‌های اخیر صفر است! کلمات را وارد یا ویرایش کنید.');
            return;
        }

        const totalAmountPayable = totalWords * ratePerWord;

        const promptText = 
            `صورت‌حساب تسویه برای: ${typist.name}\n` +
            `----------------------------------------\n` +
            `مجموع صفحات کارکرد جدید: ${totalPages.toLocaleString('fa-IR')}\n` +
            `مجموع کلمات کارکرد جدید: ${totalWords.toLocaleString('fa-IR')} کلمه\n` +
            `نرخ محاسبه هر کلمه: ${ratePerWord.toLocaleString('fa-IR')} تومان\n` +
            `مبلغ نهایی قابل پرداخت: ${formatToman(totalAmountPayable)} تومان\n` +
            `شماره شبا مقصد: ${typist.shaba || 'ثبت‌نشده'}\n\n` +
            `آیا تسویه حساب را تایید می‌فرمایید؟`;

        if (!confirm(promptText)) return;

        const { error: settleErr } = await client
            .from('typist_reports')
            .update({ is_settled: true })
            .in('id', reportIds);

        if (settleErr) throw settleErr;

        const todayFa = (window.persianDate) ? new persianDate().format('YYYY/MM/DD') : new Date().toLocaleDateString('fa-IR');
        await client.from('payments').insert([{
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

        alert(`تسویه حساب ${typist.name} با مبلغ ${formatToman(totalAmountPayable)} تومان با موفقیت ثبت شد.`);

        window.loadTypistsCards();
        window.loadAdminReportsTable(selectedTypistIdForAdmin);

    } catch (err) {
        console.error(err);
        alert('خطا در تسویه: ' + err.message);
    }
};

// ==========================================================================
// ۷. خروجی اکسل دقیق طبق ۵ ستون الزامی با UTF-8 BOM
// ==========================================================================
window.exportSettleExcel = async function() {
    const client = getDbClient();
    if (!client) {
        alert('خطای اتصال به دیتابیس.');
        return;
    }

    try {
        const { data: payments, error } = await client
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!payments || payments.length === 0) {
            alert('هنوز هیچ تسویه حسابی جهت خروجی اکسل ثبت نشده است.');
            return;
        }

        let csvContent = '\uFEFF';
        csvContent += 'نام و نام خانوادگی\tکد ملی\tشماره همراه\tمبلغ\tشماره شبا\n';

        payments.forEach(p => {
            const name = (p.typist_name || '-').replace(/\t/g, ' ');
            const nCode = `\t${p.national_code || ''}`;
            const phone = `\t${p.phone || ''}`;
            const amount = safeNumber(p.amount);
            const shaba = `\t${p.shaba || ''}`;

            csvContent += `${name}\t${nCode}\t${phone}\t${amount}\t${shaba}\n`;
        });

        const dateSuffix = (window.persianDate) ? new persianDate().format('YYYY-MM-DD') : 'export';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Settlement_Reports_${dateSuffix}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        alert('خطا در خروجی اکسل: ' + e.message);
    }
};

// ==========================================================================
// ۸. ثبت و ویرایش مشخصات تایپیست
// ==========================================================================
window.openNewTypistModal = function() {
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
};

window.openEditTypistModal = async function(typistId) {
    const client = getDbClient();
    if (!client) return;

    try {
        const { data: t, error } = await client.from('typists').select('*').eq('id', typistId).single();
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
        alert('خطا در دریافت مشخصات تایپیست: ' + e.message);
    }
};

window.closeTypistModal = function() {
    document.getElementById('typistModal').classList.add('hidden');
};

window.saveTypistRecord = async function() {
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

    const client = getDbClient();
    if (!client) {
        alert('خطای دسترسی به دیتابیس.');
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
            const { error } = await client.from('typists').update(payload).eq('id', editId);
            if (error) throw error;
            alert('مشخصات تایپیست با موفقیت ویرایش شد.');
        } else {
            payload.created_at = new Date().toISOString();
            const { error } = await client.from('typists').insert([payload]);
            if (error) throw error;
            alert('تایپیست جدید با موفقیت ثبت شد.');
        }

        window.closeTypistModal();
        window.loadTypistsCards();
    } catch (e) {
        alert('خطا در ذخیره‌سازی: ' + e.message);
    }
};

// ==========================================================================
// ۹. راه‌اندازی پس از بارگذاری DOM و حفظ نشست ورود
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initPersianDatepickers();
    const adminSess = sessionStorage.getItem('admin_logged') || sessionStorage.getItem('admin_logged_in') || localStorage.getItem('admin_logged');
    if (adminSess === 'true') {
        window.setAdminState(true);
        window.loadTypistsCards();
    }
    console.log('سامانه مدیریت تایپیست‌ها آماده به کار است.');
});

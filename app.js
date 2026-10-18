// ==========================================================================
// ۱. تنظیمات اتصال و تعریف کلاینت دیتابیس Supabase بدون وابستگی به Storage
// ==========================================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


function getDbClient() {
    if (window.db && typeof window.db.from === 'function') {
        return window.db;
    }
    const supabaseLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (supabaseLib && typeof supabaseLib.createClient === 'function') {
        const client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
        window.db = client;
        window.client = client;
        return client;
    }
    return null;
}

let db = getDbClient();
window.db = db;
window.client = db;

// وضعیت‌های عمومی
let currentAdminLoggedIn = false;
let currentTypistUser = null;
let selectedTypistIdForAdmin = null;

// ==========================================================================
// ۲. توابع کمکی: ارقام فارسی، پاکسازی عدد (ریشه‌کن شدن کامل NaN) و تقویم
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

function sanitizeCell(text) {
    if (!text) return "";
    let clean = String(text).replace(/[\t\r\n]/g, " ").trim();
    if (/^[=+@-]$/.test(clean.charAt(0))) {
        clean = "'" + clean;
    }
    return clean;
}

// فعال‌سازی تقویم پاپ‌آپ شمسی
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
// ۳. احراز هویت ادمین و تایپیست
// ==========================================================================
window.openAdminLoginModal = function() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
        const input = document.getElementById('adminPasswordInput');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
};

window.closeAdminLoginModal = function() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.add('hidden');
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
        alert('کتابخانه پایگاه داده در دسترس نیست.');
        return;
    }

    try {
        const { data: isCorrect, error } = await client.rpc('check_admin_pass', {
            entered_pass: enteredPassword
        });

        if (error) {
            alert('خطا در اعتبارسنجی سرور: ' + error.message);
            return;
        }

        if (isCorrect === true) {
            try {
                sessionStorage.setItem('admin_logged', 'true');
            } catch (e) {}
            
            window.closeAdminLoginModal();
            window.setAdminState(true);
            window.loadTypistsCards();
        } else {
            alert('رمز عبور وارد شده اشتباه است.');
            if (passwordInput) passwordInput.value = '';
        }
    } catch (err) {
        alert('خطای اتصال به سرور.');
    }
};

window.setAdminState = function(isAdmin) {
    currentAdminLoggedIn = isAdmin;
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const typistLogoutBtn = document.getElementById('typistLogoutBtn');
    const typistEntrySection = document.getElementById('typistEntrySection');
    const typistDashboardSection = document.getElementById('typistDashboardSection');
    const adminDashboardSection = document.getElementById('adminDashboardSection');

    if (isAdmin) {
        if (adminLoginBtn) adminLoginBtn.classList.add('hidden');
        if (adminLogoutBtn) adminLogoutBtn.classList.remove('hidden');
        if (typistLogoutBtn) typistLogoutBtn.classList.add('hidden');
        if (typistEntrySection) typistEntrySection.classList.add('hidden');
        if (typistDashboardSection) typistDashboardSection.classList.add('hidden');
        if (adminDashboardSection) adminDashboardSection.classList.remove('hidden');
    } else {
        if (adminLoginBtn) adminLoginBtn.classList.remove('hidden');
        if (adminLogoutBtn) adminLogoutBtn.classList.add('hidden');
        if (adminDashboardSection) adminDashboardSection.classList.add('hidden');
        if (typistDashboardSection) typistDashboardSection.classList.add('hidden');
        if (typistEntrySection) typistEntrySection.classList.remove('hidden');
        try { sessionStorage.removeItem('admin_logged'); } catch (e) {}
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
        alert('خطای ارتباط با سرور: ' + (err.message || 'شبکه در دسترس نیست'));
    }
};

window.showTypistDashboard = function() {
    document.getElementById('typistEntrySection').classList.add('hidden');
    document.getElementById('adminDashboardSection').classList.add('hidden');
    document.getElementById('typistDashboardSection').classList.remove('hidden');
    document.getElementById('typistLogoutBtn').classList.remove('hidden');
    document.getElementById('adminLoginBtn').classList.add('hidden');

    document.getElementById('dashTypistName').textContent = currentTypistUser.name;
    document.getElementById('dashTypistSubInfo').textContent = 
        `کد ملی: ${currentTypistUser.national_code} | شبا: ${currentTypistUser.shaba || 'ثبت‌نشده'} | نرخ هر کلمه: ${formatToman(currentTypistUser.rate_per_word)} تومان`;

    window.loadTypistSelfReports();
    initPersianDatepickers();
};

window.typistLogout = function() {
    currentTypistUser = null;
    document.getElementById('typistDashboardSection').classList.add('hidden');
    document.getElementById('typistLogoutBtn').classList.add('hidden');
    document.getElementById('adminLoginBtn').classList.remove('hidden');
    document.getElementById('typistEntrySection').classList.remove('hidden');
};

// ==========================================================================
// ۴. بخش تایپیست: ثبت و مشاهده گزارش کارکرد (کاملاً هماهنگ با جدول و تاریخ)
// ==========================================================================
window.loadTypistSelfReports = async function() {
    if (!currentTypistUser) return;
    const tBody = document.getElementById('typistReportsTableBody');
    if (!tBody) return;
    tBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-400">در حال دریافت داده‌ها...</td></tr>';

    const client = getDbClient();
    if (!client) return;

    try {
        const { data: reports, error } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', currentTypistUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reports || reports.length === 0) {
            tBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-400">هنوز گزارشی ثبت نشده است.</td></tr>';
            document.getElementById('dashPendingWords').textContent = '۰';
            document.getElementById('dashPendingAmount').textContent = '۰';
            return;
        }

        let pendingWords = 0;
        let pendingAmount = 0;

        tBody.innerHTML = reports.map((r, i) => {
            const pages = safeNumber(r.pages !== undefined ? r.pages : r.pages_count);
            const words = safeNumber(r.words !== undefined ? r.words : r.words_count);
            const rate = safeNumber(r.rate_per_word !== undefined ? r.rate_per_word : currentTypistUser.rate_per_word);
            const amount = safeNumber(r.total_amount) || (words * rate);
            const isSettled = r.is_settled === true;
            const courseTitle = r.course_title || r.title || 'ثبت عمومی';
            const dateStr = r.report_date || '-';

            if (!isSettled) {
                pendingWords += words;
                pendingAmount += amount;
            }

            return `
                <tr class="${isSettled ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50 text-gray-800'} border-b">
                    <td class="p-3 text-center font-mono">${i + 1}</td>
                    <td class="p-3 font-medium">${courseTitle}</td>
                    <td class="p-3 text-center font-mono">${dateStr}</td>
                    <td class="p-3 text-center">${pages.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-center font-semibold">${words.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-center font-bold ${isSettled ? 'text-gray-500' : 'text-green-700'}">${formatToman(amount)} تومان</td>
                    <td class="p-3 text-gray-500 text-xs">${r.description || '-'}</td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 rounded text-xs font-bold ${isSettled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                            ${isSettled ? 'تسویه شده' : 'در انتظار تسویه'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('dashPendingWords').textContent = pendingWords.toLocaleString('fa-IR');
        document.getElementById('dashPendingAmount').textContent = formatToman(pendingAmount);

    } catch (e) {
        tBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">خطا: ${e.message}</td></tr>`;
    }
};

window.submitNewReport = async function() {
    if (!currentTypistUser) return;

    const reportDate = document.getElementById('reportDateInput').value.trim();
    const pages = safeNumber(document.getElementById('reportPagesInput').value);
    const words = safeNumber(document.getElementById('reportWordsInput').value);
    const desc = document.getElementById('reportDescInput').value.trim();
    const courseTitle = document.getElementById('reportCourseInput').value.trim();

    if (!reportDate) {
        alert('لطفاً تاریخ کارکرد را از تقویم پاپ‌آپ انتخاب کنید.');
        return;
    }
    if (words <= 0 && pages <= 0) {
        alert('لطفاً تعداد کلمات یا صفحات را معتبر وارد فرمایید.');
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
            course_title: courseTitle || 'ثبت عمومی',
            report_date: reportDate,
            pages: pages,
            words: words,
            pages_count: pages,
            words_count: words,
            rate_per_word: rate,
            total_amount: calculatedTotal,
            description: desc,
            is_settled: false,
            created_at: new Date().toISOString()
        };

        const { error } = await client.from('typist_reports').insert([payload]);
        if (error) throw error;

        alert('گزارش کار با موفقیت ثبت شد.');
        document.getElementById('reportPagesInput').value = '0';
        document.getElementById('reportWordsInput').value = '';
        document.getElementById('reportDescInput').value = '';
        document.getElementById('reportCourseInput').value = '';
        document.getElementById('reportDateInput').value = '';
        
        window.loadTypistSelfReports();
    } catch (err) {
        alert('خطا در ثبت گزارش: ' + err.message);
    }
};

// ==========================================================================
// ۵. بخش پنل مدیریت: رندر کارت‌ها و مشاهده کارکردها با تاریخ
// ==========================================================================
window.loadTypistsCards = async function() {
    const grid = document.getElementById('typistsCardsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">در حال دریافت داده‌ها...</div>';

    const client = getDbClient();
    if (!client) return;

    try {
        const { data: typists, error } = await client
            .from('typists')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!typists || typists.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-400">هیچ تایپیستی تعریف نشده است.</div>';
            return;
        }

        const { data: unsettledReports } = await client
            .from('typist_reports')
            .select('typist_id, words, words_count, total_amount')
            .eq('is_settled', false);

        grid.innerHTML = typists.map(t => {
            const myUnsettled = (unsettledReports || []).filter(r => r.typist_id === t.id);
            const pendingWords = myUnsettled.reduce((acc, cur) => {
                const w = (cur.words !== undefined) ? cur.words : cur.words_count;
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
                            <div>📱 همراه: <span class="font-mono">${t.phone || '-'}</span></div>
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
                                <span>مبلغ قابل تسویه:</span>
                                <b class="text-green-700 font-bold">${formatToman(pendingPay)} تومان</b>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-gray-100">
                        <button onclick="window.selectTypistForReview('${t.id}')" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 rounded-lg text-xs transition">
                            بررسی گزارش‌ها و تسویه حساب
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
    tBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-400">در حال بارگذاری...</td></tr>';

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
            tBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-400">هیچ گزارشی برای این تایپیست ثبت نشده است.</td></tr>';
            return;
        }

        tBody.innerHTML = reports.map(r => {
            const pages = safeNumber(r.pages !== undefined ? r.pages : r.pages_count);
            const words = safeNumber(r.words !== undefined ? r.words : r.words_count);
            const amount = safeNumber(r.total_amount);
            const isSettled = r.is_settled === true;
            const courseTitle = r.course_title || r.title || 'ثبت عمومی';
            const dateStr = r.report_date || '-';

            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-3 text-center font-mono">${dateStr}</td>
                    <td class="p-3 font-medium text-gray-800">${courseTitle}</td>
                    <td class="p-3 text-center">${pages.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-center font-semibold">${words.toLocaleString('fa-IR')}</td>
                    <td class="p-3 text-center text-green-700 font-bold">${formatToman(amount)} تومان</td>
                    <td class="p-3 text-gray-500 text-xs">${r.description || '-'}</td>
                    <td class="p-3 text-center">
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
        tBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">خطا: ${e.message}</td></tr>`;
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
        alert('خطا در حذف: ' + e.message);
    }
};

// ==========================================================================
// ۶. تسویه حساب تجمیعی هوشمند با تاریخ دقیق شمسی
// ==========================================================================
window.runSettlement = async function() {
    if (!selectedTypistIdForAdmin) {
        alert('لطفاً ابتدا یک تایپیست را انتخاب کنید.');
        return;
    }

    const client = getDbClient();
    if (!client) return;

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
            alert('نرخ هر کلمه صفر است! ابتدا در بخش ویرایش تایپیست، نرخ را وارد کنید.');
            return;
        }

        const { data: pendingReports, error: rErr } = await client
            .from('typist_reports')
            .select('*')
            .eq('typist_id', selectedTypistIdForAdmin)
            .eq('is_settled', false);

        if (rErr) throw rErr;
        if (!pendingReports || pendingReports.length === 0) {
            alert('هیچ کارکرد تسویه‌نشده‌ای برای این تایپیست وجود ندارد.');
            return;
        }

        let totalWords = 0;
        let totalPages = 0;
        const reportIds = [];

        pendingReports.forEach(r => {
            const w = (r.words !== undefined) ? r.words : r.words_count;
            const p = (r.pages !== undefined) ? r.pages : r.pages_count;
            totalWords += safeNumber(w);
            totalPages += safeNumber(p);
            reportIds.push(r.id);
        });

        if (totalWords <= 0) {
            alert('مجموع کلمات صفر است و قابل تسویه نیست.');
            return;
        }

        const totalAmountPayable = totalWords * ratePerWord;

        const confirmMsg = 
            `صورت‌حساب تسویه: ${typist.name}\n` +
            `----------------------------------\n` +
            `تعداد صفحات جدید: ${totalPages.toLocaleString('fa-IR')}\n` +
            `مجموع کلمات جدید: ${totalWords.toLocaleString('fa-IR')} کلمه\n` +
            `نرخ محاسبه: ${ratePerWord.toLocaleString('fa-IR')} تومان\n` +
            `مبلغ نهایی تسویه: ${formatToman(totalAmountPayable)} تومان\n` +
            `شماره شبا: ${typist.shaba || 'ثبت‌نشده'}\n\n` +
            `آیا تسویه حساب را قطعی می‌فرمایید؟`;

        if (!confirm(confirmMsg)) return;

        // به‌روزرسانی گزارش‌ها
        const { error: settleErr } = await client
            .from('typist_reports')
            .update({ is_settled: true })
            .in('id', reportIds);

        if (settleErr) throw settleErr;

        // درج در سوابق پرداخت با تاریخ شمسی
        const todayFa = (window.persianDate) ? new persianDate().format('YYYY/MM/DD') : new Intl.DateTimeFormat('fa-IR').format(new Date());
        await client.from('payments').insert([{
            typist_id: typist.id,
            typist_name: typist.name,
            national_code: typist.national_code,
            phone: typist.phone,
            shaba: typist.shaba,
            words_count: totalWords,
            amount: totalAmountPayable,
            settlement_date: todayFa,
            settlement_date_shamsi: todayFa,
            created_at: new Date().toISOString()
        }]);

        alert(`تسویه حساب با مبلغ ${formatToman(totalAmountPayable)} تومان با موفقیت ثبت شد.`);
        window.loadTypistsCards();
        window.loadAdminReportsTable(selectedTypistIdForAdmin);

    } catch (err) {
        alert('خطا در فرایند تسویه: ' + err.message);
    }
};

// ==========================================================================
// ۷. خروجی اکسل استاندارد بانکی (۵ ستون با ایمن‌سازی فرمول و UTF-8 BOM)
// ==========================================================================
window.exportSettleExcel = async function() {
    const client = getDbClient();
    if (!client) return;

    try {
        const { data: payments, error } = await client
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!payments || payments.length === 0) {
            alert('هنوز هیچ پرداختی برای دریافت اکسل ثبت نشده است.');
            return;
        }

        let tsvContent = '\uFEFF';
        tsvContent += 'نام و نام خانوادگی\tکد ملی\tشماره همراه\tمبلغ (تومان)\tشماره شبا\tتاریخ تسویه\n';

        payments.forEach(p => {
            const name = sanitizeCell(p.typist_name || '-');
            const nCode = `\t${sanitizeCell(p.national_code || '')}`;
            const phone = `\t${sanitizeCell(p.phone || '')}`;
            const amount = safeNumber(p.amount);
            const shaba = `\t${sanitizeCell(p.shaba || '')}`;
            const date = sanitizeCell(p.settlement_date || p.settlement_date_shamsi || '-');

            tsvContent += `${name}\t${nCode}\t${phone}\t${amount}\t${shaba}\t${date}\n`;
        });

        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Settlements_${Date.now()}.xls`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);

    } catch (e) {
        alert('خطا در دریافت فایل اکسل: ' + e.message);
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
        alert('خطا در دریافت مشخصات: ' + e.message);
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
    if (!client) return;

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
            alert('مشخصات با موفقیت ویرایش شد.');
        } else {
            payload.created_at = new Date().toISOString();
            const { error } = await client.from('typists').insert([payload]);
            if (error) throw error;
            alert('تایپیست با موفقیت افزوده شد.');
        }

        window.closeTypistModal();
        window.loadTypistsCards();
    } catch (e) {
        alert('خطا در ذخیره‌سازی: ' + e.message);
    }
};

// ==========================================================================
// ۹. اجرای برنامه در هنگام بارگذاری صفحه
// ==========================================================================
function startTypistApp() {
    initPersianDatepickers();

    let adminLogged = false;
    try {
        adminLogged = sessionStorage.getItem('admin_logged') === 'true';
    } catch (e) {}

    if (adminLogged) {
        window.setAdminState(true);
        window.loadTypistsCards();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTypistApp);
} else {
    startTypistApp();
}

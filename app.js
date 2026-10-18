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
// ۲. توابع کمکی: ارقام فارسی، پاکسازی عدد و تقویم
// ==========================================================================
function fixNumbers(str) {
    if (!str) return '';
    const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    const arabicNumbers  = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let output = str.toString().trim();
    for (let i = 0; i < 10; i++) {
        output = output.replace(persianNumbers[i], i).replace(arabicNumbers[i], i);
    }
    return output;
}
window.fixNumbers = fixNumbers;

function safeNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    const enVal = fixNumbers(String(val)).replace(/,/g, '').trim();
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
    // تبدیل ارقام فارسی به انگلیسی در هنگام لاگین (بسیار مهم)
    const nationalCode = fixNumbers(document.getElementById('loginNationalCode').value);
    const phone = fixNumbers(document.getElementById('loginPhone').value);

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

    const rate = safeNumber(currentTypistUser.rate_per_word) || safeNumber(currentTypistUser.rate) || 15;
    document.getElementById('dashTypistName').textContent = currentTypistUser.name;
    document.getElementById('dashTypistSubInfo').textContent = 
        `کد ملی: ${currentTypistUser.national_code} | شبا: ${currentTypistUser.shaba || 'ثبت‌نشده'} | نرخ هر کلمه: ${formatToman(rate)} تومان`;

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
// ۴. بخش تایپیست: ثبت و مشاهده گزارش کارکرد
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
            const rate = safeNumber(r.rate_per_word !== undefined ? r.rate_per_word : (r.rate || currentTypistUser.rate_per_word || 15));
            let amount = safeNumber(r.total_amount);
            if (amount === 0 && words > 0) amount = words * rate;

            const isSettled = r.is_settled === true;
            const courseTitle = r.course_title || r.title || (r.period ? `جلسه ${r.period}` : 'ثبت عمومی');
            
            // فرمت تاریخ بدون NaN
            let dateStr = '-';
            if (r.report_date) {
                dateStr = r.report_date;
            } else if (r.created_at) {
                try {
                    dateStr = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.created_at));
                } catch(e) { dateStr = r.created_at.substring(0, 10); }
            }

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

    const rate = safeNumber(currentTypistUser.rate_per_word) || safeNumber(currentTypistUser.rate) || 15;
    const calculatedTotal = words * rate;

    try {
        const payload = {
            typist_id: currentTypistUser.id,
            course_title: courseTitle || 'ثبت عمومی',
            report_date: reportDate,
            pages: pages,
            words: words,
            period: 1,
            period_number: 1,
            rate: rate,
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
// ۵. بخش پنل مدیریت: رندر کارت‌ها و مدیریت گزارش‌ها
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
            
            const rate = safeNumber(t.rate_per_word) || safeNumber(t.rate) || 15;
            const pendingPay = pendingWords * rate;

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
                            <div>💰 نرخ هر کلمه: <b>${formatToman(rate)} تومان</b></div>
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
        const rate = safeNumber(typist.rate_per_word) || safeNumber(typist.rate) || 15;
        document.getElementById('selectedTypistHeading').textContent = `گزارش‌های کارکرد: ${typist.name}`;
        document.getElementById('selectedTypistSubText').textContent = `نرخ هر کلمه: ${formatToman(rate)} تومان | شماره شبا: ${typist.shaba || '-'}`;
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
            const rate = safeNumber(r.rate) || safeNumber(r.rate_per_word) || 15;
            let amount = safeNumber(r.total_amount);
            if (amount === 0 && words > 0) amount = words * rate;

            const isSettled = r.is_settled === true;
            const courseTitle = r.course_title || r.title || (r.period ? `جلسه ${r.period}` : 'ثبت عمومی');
            
            let dateStr = '-';
            if (r.report_date) {
                dateStr = r.report_date;
            } else if (r.created_at) {
                try {
                    dateStr = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.created_at));
                } catch(e) { dateStr = r.created_at.substring(0, 10); }
            }

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
// ۶. تسویه حساب تجمیعی هوشمند
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

        const ratePerWord = safeNumber(typist.rate_per_word) || safeNumber(typist.rate) || 15;

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

        const { error: settleErr } = await client
            .from('typist_reports')
            .update({ is_settled: true })
            .in('id', reportIds);

        if (settleErr) throw settleErr;

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
// ۷. خروجی اکسل استاندارد بانکی
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
// ۸. ثبت و ویرایش مشخصات تایپیست (با پاکسازی اعداد فارسی و جلوگیری از عدم ذخیره کدملی)
// ==========================================================================
window.openNewTypistModal = function() {
    document.getElementById('typistModalTitle').textContent = 'ثبت تایپیست جدید';
    document.getElementById('editTypistId').value = '';
    document.getElementById('mName').value = '';
    document.getElementById('mNationalCode').value = '';
    document.getElementById('mPhone').value = '';
    document.getElementById('mShaba').value = '';
    document.getElementById('mRate').value = '15';
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
        document.getElementById('mRate').value = t.rate_per_word || t.rate || '15';
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
    // تبدیل ارقام فارسی به انگلیسی قبل از ارسال به دیتابیس
    const nationalCode = fixNumbers(document.getElementById('mNationalCode').value);
    const phone = fixNumbers(document.getElementById('mPhone').value);
    const shaba = fixNumbers(document.getElementById('mShaba').value);
    const rate = safeNumber(document.getElementById('mRate').value) || 15;
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
        rate: rate,
        rate_per_word: rate,
        start_date: startDate || null,
        delivery_date: deliveryDate || null
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
    
    try {
        if (sessionStorage.getItem('admin_logged') === 'true') {
            window.setAdminState(true);
            window.loadTypistsCards();
        } else {
            window.setAdminState(false);
        }
    } catch (e) {
        window.setAdminState(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    startTypistApp();
});

// =========================================================
// 1. SUPABASE CLIENT & STATE INITIALIZATION
// =========================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("🚀 Typist Payroll App initialized successfully.");

let currentLoginMode = 'admin'; // 'admin' | 'typist'
let currentUserRole = null;
let currentTypistId = null;
let allTypists = [];
let currentTypistDetail = null;
let selectedDatePickerTargetId = null;

// =========================================================
// 2. HELPER UTILITIES
// =========================================================

function toEnglishDigits(str) {
    if (!str) return '';
    return str.toString()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .trim();
}

function formatToman(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('fa-IR');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600';

    toast.className = `${bgClass} text-white px-4 py-3 rounded-lg shadow-xl text-sm font-bold pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 flex items-center gap-2`;
    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// =========================================================
// 3. ATTACH ALL FUNCTIONS DIRECTLY TO WINDOW
// =========================================================

window.toggleTheme = function() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        if (icon) icon.textContent = '🌙';
    } else {
        html.classList.add('dark');
        if (icon) icon.textContent = '☀️';
    }
};

window.switchLoginTab = function(mode) {
    currentLoginMode = mode;
    const tabAdmin = document.getElementById('tab-admin');
    const tabTypist = document.getElementById('tab-typist');
    const typistContainer = document.getElementById('typist-id-container');
    const identifierInput = document.getElementById('login-identifier');

    if (mode === 'admin') {
        tabAdmin.className = "flex-1 py-3 text-center text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600 transition";
        tabTypist.className = "flex-1 py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 border-b-2 border-transparent transition";
        if (typistContainer) typistContainer.classList.add('hidden');
        if (identifierInput) identifierInput.value = '';
    } else {
        tabTypist.className = "flex-1 py-3 text-center text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600 transition";
        tabAdmin.className = "flex-1 py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 border-b-2 border-transparent transition";
        if (typistContainer) typistContainer.classList.remove('hidden');
    }
};

window.hideAllViews = function() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-admin-dashboard').classList.add('hidden');
    document.getElementById('view-typist-detail').classList.add('hidden');
    document.getElementById('view-typist-dashboard').classList.add('hidden');
    document.getElementById('main-header').classList.add('hidden');
};

window.logout = function() {
    currentUserRole = null;
    currentTypistId = null;
    window.hideAllViews();
    document.getElementById('view-login').classList.remove('hidden');
    showToast('از سیستم خارج شدید', 'info');
};

// =========================================================
// 4. AUTHENTICATION (LOGIN)
// =========================================================

window.handleLogin = async function(e) {
    if (e) e.preventDefault();

    const passwordInput = document.getElementById('login-password').value;

    if (currentLoginMode === 'typist') {
        const identifierInput = document.getElementById('login-identifier').value;
        if (!identifierInput) {
            showToast('لطفا کد ملی یا شماره همراه را وارد کنید', 'error');
            return;
        }

        try {
            const { data, error } = await window.supabaseClient.rpc('verify_typist_password', {
                p_identifier: toEnglishDigits(identifierInput),
                p_password: toEnglishDigits(passwordInput)
            });

            if (error) throw error;

            if (data && data.success) {
                currentUserRole = 'typist';
                currentTypistId = data.typist_id;
                document.getElementById('user-welcome').textContent = `تایپیست: ${data.full_name}`;
                window.showTypistDashboardView();
                showToast(`خوش آمدید ${data.full_name}`, 'success');
            } else {
                showToast(data?.message || 'مشخصات ورود اشتباه است', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('خطا در لاگین تایپیست', 'error');
        }
    } else {
        // ADMIN LOGIN
        try {
            const { data, error } = await window.supabaseClient.rpc('verify_admin_password', {
                p_password: toEnglishDigits(passwordInput)
            });

            if (error) throw error;

            if (data && data.success) {
                currentUserRole = 'admin';
                document.getElementById('user-welcome').textContent = 'مدیریت سیستم';
                window.showDashboardView();
                showToast('ورود موفقیت‌آمیز به پنل مدیریت', 'success');
            } else {
                showToast(data?.message || 'رمز عبور مدیریت اشتباه است', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('خطا در لاگین مدیریت', 'error');
        }
    }
};

// =========================================================
// 5. ADMIN DASHBOARD
// =========================================================

window.showDashboardView = async function() {
    window.hideAllViews();
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('view-admin-dashboard').classList.remove('hidden');
    await window.loadDashboardData();
};

window.loadDashboardData = async function() {
    try {
        const { data, error } = await window.supabaseClient.rpc('get_dashboard_summary');
        if (error) throw error;

        allTypists = data.typists || [];
        const stats = data.stats || {};

        document.getElementById('stat-total-typists').textContent = `${stats.total_typists || 0} نفر`;
        document.getElementById('stat-total-earned').textContent = formatToman(stats.total_earned);
        document.getElementById('stat-total-paid').textContent = formatToman(stats.total_paid);
        document.getElementById('stat-total-balance').textContent = formatToman(stats.total_balance);

        window.renderTypistsTable(allTypists);
    } catch (err) {
        console.error("Dashboard Load Error:", err);
        showToast('خطا در دریافت اطلاعات داشبورد', 'error');
    }
};

window.renderTypistsTable = function(typists) {
    const tbody = document.getElementById('typists-table-body');
    tbody.innerHTML = '';

    if (!typists || typists.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400">هیچ تایپیستی ثبت نشده است</td></tr>`;
        return;
    }

    typists.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700/30 transition";

        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" value="${t.id}" data-phone="${t.phone}" onchange="window.updateGroupSmsCount()" class="typist-checkbox rounded text-indigo-600">
            </td>
            <td class="p-3 font-bold text-gray-800 dark:text-white">${t.first_name} ${t.last_name}</td>
            <td class="p-3">
                <div class="flex items-center space-x-2 space-x-reverse dir-ltr text-right">
                    <span class="text-xs text-gray-500">${t.phone || '-'}</span>
                    ${t.phone ? `
                        <a href="tel:${t.phone}" class="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200" title="تماس">📞</a>
                        <a href="sms:${t.phone}" class="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="پیامک">💬</a>
                    ` : ''}
                </div>
            </td>
            <td class="p-3 text-center">${formatToman(t.page_rate)}</td>
            <td class="p-3 text-center text-emerald-600 font-bold">${formatToman(t.total_earned)}</td>
            <td class="p-3 text-center text-blue-600 font-bold">${formatToman(t.total_paid)}</td>
            <td class="p-3 text-center font-bold ${t.balance > 0 ? 'text-amber-600' : 'text-gray-500'}">${formatToman(t.balance)}</td>
            <td class="p-3 text-center space-x-1 space-x-reverse">
                <button type="button" onclick="window.viewTypistDetail('${t.id}')" class="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded text-xs font-bold hover:bg-indigo-200">جزئیات</button>
                <button type="button" onclick="window.editTypist('${t.id}')" class="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded text-xs font-bold hover:bg-gray-200">ویرایش</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.filterTypists = function() {
    const query = toEnglishDigits(document.getElementById('typist-search').value.toLowerCase());
    const filtered = allTypists.filter(t => 
        t.first_name.toLowerCase().includes(query) ||
        t.last_name.toLowerCase().includes(query) ||
        t.phone.includes(query) ||
        t.national_id.includes(query)
    );
    window.renderTypistsTable(filtered);
};

window.toggleSelectAllTypists = function(master) {
    const checkboxes = document.querySelectorAll('.typist-checkbox');
    checkboxes.forEach(cb => cb.checked = master.checked);
    window.updateGroupSmsCount();
};

window.updateGroupSmsCount = function() {
    const checked = document.querySelectorAll('.typist-checkbox:checked');
    document.getElementById('selected-sms-count').textContent = checked.length;
};

window.sendGroupSMS = function() {
    const checked = document.querySelectorAll('.typist-checkbox:checked');
    if (checked.length === 0) {
        showToast('هیچ تایپیستی انتخاب نشده است', 'error');
        return;
    }

    const phones = Array.from(checked).map(cb => cb.getAttribute('data-phone')).filter(Boolean);
    if (phones.length === 0) {
        showToast('شماره تماسی یافت نشد', 'error');
        return;
    }

    const smsUrl = `sms:${phones.join(',')}?body=${encodeURIComponent('با سلام،')}`;
    window.location.href = smsUrl;
};

window.exportBankCSV = function() {
    if (!allTypists || allTypists.length === 0) {
        showToast('داده‌ای برای خروجی وجود ندارد', 'error');
        return;
    }

    let csvContent = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n";

    allTypists.forEach((t, idx) => {
        const remainingToman = t.balance > 0 ? t.balance : 0;
        const remainingRial = remainingToman * 10;

        const row = [
            idx + 1,
            `"${t.first_name || ''}"`,
            `"${t.last_name || ''}"`,
            `"${t.father_name || ''}"`,
            `"${t.national_id || ''}"`,
            `"${t.phone || ''}"`,
            `"${t.card_number || ''}"`,
            `"${t.iban || ''}"`,
            remainingRial
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `پرداخت_بانکی_تایپیست_ها.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('فایل CSV دانلود شد', 'success');
};

// =========================================================
// 6. TYPIST DETAIL VIEW (ADMIN)
// =========================================================

window.viewTypistDetail = async function(typistId) {
    currentTypistId = typistId;
    window.hideAllViews();
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('view-typist-detail').classList.remove('hidden');

    try {
        const { data, error } = await window.supabaseClient.rpc('get_typist_detail', { p_typist_id: typistId });
        if (error) throw error;

        currentTypistDetail = data;
        const prof = data.profile || {};

        document.getElementById('detail-typist-name').textContent = `${prof.first_name} ${prof.last_name}`;
        document.getElementById('detail-national-father').textContent = `کد ملی: ${prof.national_id || '-'} | پدر: ${prof.father_name || '-'}`;
        document.getElementById('detail-card-iban').textContent = `کارت: ${prof.card_number || '-'} | شبا: IR${prof.iban || '-'}`;
        document.getElementById('detail-financial-summary').textContent = `کارکرد: ${formatToman(prof.total_earned)} | دریافتی: ${formatToman(prof.total_paid)} | مانده: ${formatToman(prof.balance)} تومان`;

        window.renderReportsTable(data.reports || [], true);
        window.renderPaymentsTable(data.payments || []);
    } catch (err) {
        console.error(err);
        showToast('خطا در لود جزئیات تایپیست', 'error');
    }
};

window.renderReportsTable = function(reports, isAdmin = false) {
    const tbody = isAdmin ? document.getElementById('detail-reports-table-body') : document.getElementById('typist-self-reports-body');
    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 4}" class="p-4 text-center text-gray-400">هیچ گزارش کاری ثبت نشده است</td></tr>`;
        return;
    }

    reports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700/30 transition";

        if (isAdmin) {
            tr.innerHTML = `
                <td class="p-3 font-bold">${r.title}</td>
                <td class="p-3 text-center">${r.page_count}</td>
                <td class="p-3 text-center">${formatToman(r.rate_per_page)}</td>
                <td class="p-3 text-center text-emerald-600 font-bold">${formatToman(r.total_price)}</td>
                <td class="p-3 text-center dir-ltr">${r.delivery_date || '-'}</td>
                <td class="p-3 text-center"><span class="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs">ثبت شده</span></td>
                <td class="p-3 text-center">
                    <button type="button" onclick="window.deleteReport('${r.id}')" class="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200">حذف</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td class="p-3 font-bold">${r.title}</td>
                <td class="p-3 text-center">${r.page_count}</td>
                <td class="p-3 text-center dir-ltr">${r.delivery_date || '-'}</td>
                <td class="p-3 text-center"><span class="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs">ارسال شده</span></td>
            `;
        }
        tbody.appendChild(tr);
    });
};

window.renderPaymentsTable = function(payments) {
    const tbody = document.getElementById('detail-payments-table-body');
    tbody.innerHTML = '';

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">هیچ پرداختی ثبت نشده است</td></tr>`;
        return;
    }

    payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700/30 transition";

        tr.innerHTML = `
            <td class="p-3 font-bold text-emerald-600">${formatToman(p.amount)}</td>
            <td class="p-3 text-center dir-ltr">${p.payment_date}</td>
            <td class="p-3 text-gray-500">${p.description || '-'}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="window.deletePayment('${p.id}')" class="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200">حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// =========================================================
// 7. TYPIST DASHBOARD (LOGGED IN TYPIST)
// =========================================================

window.showTypistDashboardView = async function() {
    window.hideAllViews();
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('view-typist-dashboard').classList.remove('hidden');

    try {
        const { data, error } = await window.supabaseClient.rpc('get_typist_detail', { p_typist_id: currentTypistId });
        if (error) throw error;

        currentTypistDetail = data;
        const prof = data.profile || {};

        document.getElementById('typist-self-name').textContent = `سلام، ${prof.first_name} ${prof.last_name}`;
        document.getElementById('typist-self-father').textContent = prof.father_name || '-';
        document.getElementById('typist-self-national-id').textContent = prof.national_id || '-';
        document.getElementById('typist-self-phone').textContent = prof.phone || '-';
        document.getElementById('typist-self-card-iban').textContent = `کارت: ${prof.card_number || '-'} | شبا: IR${prof.iban || '-'}`;

        document.getElementById('typist-self-earned').textContent = `${formatToman(prof.total_earned)} تومان`;
        document.getElementById('typist-self-paid').textContent = `${formatToman(prof.total_paid)} تومان`;
        document.getElementById('typist-self-balance').textContent = `${formatToman(prof.balance)} تومان`;

        window.renderReportsTable(data.reports || [], false);
    } catch (err) {
        console.error(err);
        showToast('خطا در لود اطلاعات تایپیست', 'error');
    }
};

window.openSelfProfileModal = function() {
    const prof = currentTypistDetail?.profile || {};
    document.getElementById('self-first-name').value = prof.first_name || '';
    document.getElementById('self-last-name').value = prof.last_name || '';
    document.getElementById('self-father-name').value = prof.father_name || '';
    document.getElementById('self-national-id').value = prof.national_id || '';
    document.getElementById('self-phone').value = prof.phone || '';
    document.getElementById('self-card-number').value = prof.card_number || '';
    document.getElementById('self-iban').value = prof.iban || '';

    document.getElementById('modal-self-profile').classList.remove('hidden');
};

window.closeSelfProfileModal = function() {
    document.getElementById('modal-self-profile').classList.add('hidden');
};

window.saveSelfProfile = async function(e) {
    if (e) e.preventDefault();

    const payload = {
        p_id: currentTypistId,
        p_first_name: document.getElementById('self-first-name').value,
        p_last_name: document.getElementById('self-last-name').value,
        p_father_name: document.getElementById('self-father-name').value,
        p_national_id: toEnglishDigits(document.getElementById('self-national-id').value),
        p_phone: toEnglishDigits(document.getElementById('self-phone').value),
        p_card_number: toEnglishDigits(document.getElementById('self-card-number').value),
        p_iban: toEnglishDigits(document.getElementById('self-iban').value),
        p_page_rate: 0, // Preserve current rate in DB
        p_password: null
    };

    try {
        const { data, error } = await window.supabaseClient.rpc('upsert_typist', payload);
        if (error) throw error;

        window.closeSelfProfileModal();
        showToast('پروفایل شما با موفقیت بروزرسانی شد', 'success');
        window.showTypistDashboardView();
    } catch (err) {
        console.error(err);
        showToast('خطا در بروزرسانی پروفایل', 'error');
    }
};

// =========================================================
// 8. CRUD MODALS & ACTIONS
// =========================================================

window.openTypistModal = function() {
    document.getElementById('modal-typist-title').textContent = "افزودن تایپیست جدید";
    document.getElementById('typist-id').value = "";
    document.getElementById('typist-first-name').value = "";
    document.getElementById('typist-last-name').value = "";
    document.getElementById('typist-father-name').value = "";
    document.getElementById('typist-national-id').value = "";
    document.getElementById('typist-phone').value = "";
    document.getElementById('typist-page-rate').value = "";
    document.getElementById('typist-card-number').value = "";
    document.getElementById('typist-iban').value = "";
    document.getElementById('typist-password').value = "";

    document.getElementById('modal-typist').classList.remove('hidden');
};

window.closeTypistModal = function() {
    document.getElementById('modal-typist').classList.add('hidden');
};

window.editTypist = function(typistId) {
    const t = allTypists.find(x => x.id === typistId);
    if (!t) return;

    document.getElementById('modal-typist-title').textContent = "ویرایش اطلاعات تایپیست";
    document.getElementById('typist-id').value = t.id;
    document.getElementById('typist-first-name').value = t.first_name || "";
    document.getElementById('typist-last-name').value = t.last_name || "";
    document.getElementById('typist-father-name').value = t.father_name || "";
    document.getElementById('typist-national-id').value = t.national_id || "";
    document.getElementById('typist-phone').value = t.phone || "";
    document.getElementById('typist-page-rate').value = t.page_rate || "";
    document.getElementById('typist-card-number').value = t.card_number || "";
    document.getElementById('typist-iban').value = t.iban || "";
    document.getElementById('typist-password').value = "";

    document.getElementById('modal-typist').classList.remove('hidden');
};

window.saveTypist = async function(e) {
    if (e) e.preventDefault();

    const payload = {
        p_id: document.getElementById('typist-id').value || null,
        p_first_name: document.getElementById('typist-first-name').value,
        p_last_name: document.getElementById('typist-last-name').value,
        p_father_name: document.getElementById('typist-father-name').value,
        p_national_id: toEnglishDigits(document.getElementById('typist-national-id').value),
        p_phone: toEnglishDigits(document.getElementById('typist-phone').value),
        p_card_number: toEnglishDigits(document.getElementById('typist-card-number').value),
        p_iban: toEnglishDigits(document.getElementById('typist-iban').value),
        p_page_rate: Number(document.getElementById('typist-page-rate').value) || 0,
        p_password: toEnglishDigits(document.getElementById('typist-password').value) || null
    };

    try {
        const { data, error } = await window.supabaseClient.rpc('upsert_typist', payload);
        if (error) throw error;

        window.closeTypistModal();
        showToast('اطلاعات تایپیست ذخیره شد', 'success');
        window.loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('خطا در ذخیره اطلاعات تایپیست', 'error');
    }
};

window.openReportModal = function() {
    document.getElementById('report-title').value = "";
    document.getElementById('report-page-count').value = "";
    document.getElementById('report-delivery-date').value = "";
    document.getElementById('modal-report').classList.remove('hidden');
};

window.closeReportModal = function() {
    document.getElementById('modal-report').classList.add('hidden');
};

window.saveReport = async function(e) {
    if (e) e.preventDefault();

    const payload = {
        p_typist_id: currentTypistId,
        p_title: document.getElementById('report-title').value,
        p_page_count: Number(document.getElementById('report-page-count').value) || 0,
        p_delivery_date: document.getElementById('report-delivery-date').value
    };

    try {
        const { data, error } = await window.supabaseClient.rpc('add_typist_report', payload);
        if (error) throw error;

        window.closeReportModal();
        showToast('گزارش کار با موفقیت ثبت شد', 'success');

        if (currentUserRole === 'admin') {
            window.viewTypistDetail(currentTypistId);
        } else {
            window.showTypistDashboardView();
        }
    } catch (err) {
        console.error(err);
        showToast('خطا در ثبت گزارش کار', 'error');
    }
};

window.deleteReport = async function(reportId) {
    if (!confirm('آیا از حذف این گزارش کار مطمئن هستید؟')) return;

    try {
        const { data, error } = await window.supabaseClient.rpc('delete_typist_report', { p_report_id: reportId });
        if (error) throw error;

        showToast('گزارش کار حذف شد', 'success');
        window.viewTypistDetail(currentTypistId);
    } catch (err) {
        console.error(err);
        showToast('خطا در حذف گزارش کار', 'error');
    }
};

window.openPaymentModal = function() {
    document.getElementById('payment-amount').value = "";
    document.getElementById('payment-date').value = "1403/12/01";
    document.getElementById('payment-description').value = "";
    document.getElementById('modal-payment').classList.remove('hidden');
};

window.closePaymentModal = function() {
    document.getElementById('modal-payment').classList.add('hidden');
};

window.savePayment = async function(e) {
    if (e) e.preventDefault();

    const payload = {
        p_typist_id: currentTypistId,
        p_amount: Number(document.getElementById('payment-amount').value) || 0,
        p_payment_date: document.getElementById('payment-date').value,
        p_description: document.getElementById('payment-description').value
    };

    try {
        const { data, error } = await window.supabaseClient.rpc('add_payment', payload);
        if (error) throw error;

        window.closePaymentModal();
        showToast('پرداخت جدید ثبت شد', 'success');
        window.viewTypistDetail(currentTypistId);
    } catch (err) {
        console.error(err);
        showToast('خطا در ثبت پرداخت', 'error');
    }
};

window.deletePayment = async function(paymentId) {
    if (!confirm('آیا از حذف این پرداخت مطمئن هستید؟')) return;

    try {
        const { data, error } = await window.supabaseClient.rpc('delete_payment', { p_payment_id: paymentId });
        if (error) throw error;

        showToast('پرداخت حذف شد', 'success');
        window.viewTypistDetail(currentTypistId);
    } catch (err) {
        console.error(err);
        showToast('خطا در حذف پرداخت', 'error');
    }
};

window.openChangePasswordModal = function() {
    document.getElementById('pass-old').value = "";
    document.getElementById('pass-new').value = "";
    document.getElementById('modal-change-password').classList.remove('hidden');
};

window.closeChangePasswordModal = function() {
    document.getElementById('modal-change-password').classList.add('hidden');
};

window.saveChangePassword = async function(e) {
    if (e) e.preventDefault();

    const oldPass = document.getElementById('pass-old').value;
    const newPass = document.getElementById('pass-new').value;

    try {
        let result;
        if (currentUserRole === 'admin') {
            result = await window.supabaseClient.rpc('change_admin_password', {
                p_old_password: toEnglishDigits(oldPass),
                p_new_password: toEnglishDigits(newPass)
            });
        } else {
            result = await window.supabaseClient.rpc('change_typist_password', {
                p_typist_id: currentTypistId,
                p_old_password: toEnglishDigits(oldPass),
                p_new_password: toEnglishDigits(newPass)
            });
        }

        if (result.error) throw result.error;

        if (result.data && result.data.success) {
            window.closeChangePasswordModal();
            showToast('رمز عبور تغییر یافت', 'success');
        } else {
            showToast(result.data?.message || 'تغییر رمز نا‌موفق بود', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('خطا در تغییر رمز عبور', 'error');
    }
};

// =========================================================
// 9. SHAMSI DATEPICKER LOGIC
// =========================================================

window.openDatePicker = function(targetInputId) {
    selectedDatePickerTargetId = targetInputId;
    window.renderDatePickerDays();
    document.getElementById('modal-datepicker').classList.remove('hidden');
};

window.closeDatePicker = function() {
    document.getElementById('modal-datepicker').classList.add('hidden');
};

window.renderDatePickerDays = function() {
    const daysContainer = document.getElementById('datepicker-days');
    if (!daysContainer) return;

    daysContainer.innerHTML = '';
    for (let day = 1; day <= 31; day++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "p-2 bg-gray-100 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white rounded font-bold transition";
        btn.textContent = day;
        btn.onclick = () => window.selectDate(day);
        daysContainer.appendChild(btn);
    }
};

window.selectDate = function(day) {
    const year = document.getElementById('datepicker-year').value;
    const month = document.getElementById('datepicker-month').value;
    const dayStr = day < 10 ? `0${day}` : `${day}`;

    const formattedDate = `${year}/${month}/${dayStr}`;
    if (selectedDatePickerTargetId) {
        const targetInput = document.getElementById(selectedDatePickerTargetId);
        if (targetInput) targetInput.value = formattedDate;
    }

    window.closeDatePicker();
};

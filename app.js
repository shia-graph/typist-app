// ==========================================
// ۱. تنظیمات اتصال امن به دیتابیس Supabase
// ==========================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'GAPGPTMASKTOKEN8sawlhk45bhX0X';

// ایجاد کلاینت یکپارچه و ثبت روی window
const db = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
window.db = db;
window.client = db;

// متغیرهای وضعیت برنامه
let isAdmin = false;
let currentTypist = null;
let cachedTypists = [];

// ==========================================
// ۲. توابع کمکی تاریخ شمسی و محاسبات دوره‌ای
// ==========================================
function getTodayShamsi() {
    try {
        const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date()).split('/');
        
        // تبدیل اعداد فارسی به انگلیسی استاندارد برای ذخیره دیتابیس
        const toEn = str => str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        return `${toEn(parts[0])}/${toEn(parts[1])}/${toEn(parts[2])}`;
    } catch (e) {
        return '1403/01/01';
    }
}

function safeNum(val) {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

// ==========================================
// ۳. احراز هویت و ورود امن مدیر (صرفاً از دیتابیس)
// ==========================================
window.handleAdminLogin = async function() {
    if (!window.db) {
        alert('خطای اتصال به پایگاه داده.');
        return;
    }

    const inputPass = prompt('رمز عبور مدیریت را وارد نمایید:');
    if (!inputPass || !inputPass.trim()) return;

    try {
        const { data, error } = await window.db
            .from('app_settings')
            .select('value')
            .eq('key', 'admin_password')
            .maybeSingle();

        if (error) {
            alert('خطا در دسترسی به پایگاه‌داده: ' + error.message);
            return;
        }

        if (!data || !data.value) {
            alert('رمز عبور مدیریت در دیتابیس تعریف نشده است.');
            return;
        }

        if (inputPass.trim() === data.value.toString().trim()) {
            isAdmin = true;
            currentTypist = null;
            document.getElementById('landingSection').classList.add('hidden');
            document.getElementById('typistDashboard').classList.add('hidden');
            document.getElementById('adminDashboard').classList.remove('hidden');
            document.getElementById('btnLogout').classList.remove('hidden');
            document.getElementById('btnAdminAuth').classList.add('hidden');
            window.loadAdminDashboard();
        } else {
            alert('رمز عبور مدیریت نادرست است.');
        }
    } catch (err) {
        alert('خطا در اتصال به سرور جهت اعتبارسنجی مدیر.');
    }
};

window.handleLogout = function() {
    isAdmin = false;
    currentTypist = null;
    document.getElementById('landingSection').classList.remove('hidden');
    document.getElementById('typistDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('btnLogout').classList.add('hidden');
    document.getElementById('btnAdminAuth').classList.remove('hidden');
};

// ==========================================
// ۴. ورود و پنل تایپیست
// ==========================================
window.handleTypistLogin = async function(event) {
    event.preventDefault();
    const natCode = document.getElementById('typist_national_code').value.trim();
    const phone = document.getElementById('typist_phone').value.trim();

    try {
        const { data, error } = await window.db
            .from('typists')
            .select('*')
            .eq('national_code', natCode)
            .eq('phone', phone)
            .maybeSingle();

        if (error) {
            alert('خطا در استعلام اطلاعات: ' + error.message);
            return;
        }

        if (!data) {
            alert('تایپیستی با این مشخصات یافت نشد! لطفاً با مدیر هماهنگ کنید.');
            return;
        }

        currentTypist = data;
        isAdmin = false;
        document.getElementById('landingSection').classList.add('hidden');
        document.getElementById('adminDashboard').classList.add('hidden');
        document.getElementById('typistDashboard').classList.remove('hidden');
        document.getElementById('btnLogout').classList.remove('hidden');
        document.getElementById('btnAdminAuth').classList.add('hidden');

        window.renderTypistDashboardView();
    } catch (err) {
        alert('خطای اتصال به سرور.');
    }
};

window.renderTypistDashboardView = async function() {
    if (!currentTypist) return;
    const t = currentTypist;
    document.getElementById('typistWelcomeName').innerText = t.full_name || t.name || 'بدون نام';
    document.getElementById('typistBadgeTitle').innerText = t.title || t.course_title || '—';
    document.getElementById('typistAccountMeta').innerText = `شماره تماس: ${t.phone || '-'} | کد ملی: ${t.national_code || '-'} | شبا: IR${t.shaba || '-'}`;

    const { data: reports, error } = await window.db
        .from('typist_reports')
        .select('*')
        .eq('typist_id', t.id)
        .order('period_number', { ascending: true });

    const tbody = document.getElementById('typistReportsTbody');
    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">تاکنون گزارشی برای شما ثبت نشده است.</td></tr>`;
        return;
    }

    reports.forEach(r => {
        const pages = safeNum(r.pages);
        const words = safeNum(r.words);
        const amount = safeNum(r.total_amount || (words * (r.rate || t.rate_per_word || 15)));
        const settledBadge = r.is_settled 
            ? `<span class="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded font-bold">تسویه شده</span>`
            : `<span class="bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded font-bold">در انتظار تسویه</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 font-bold text-slate-700">دوره ${r.period_number || 1}</td>
                <td class="p-3 font-mono">${r.report_date || '-'}</td>
                <td class="p-3 font-mono">${pages.toLocaleString('fa-IR')}</td>
                <td class="p-3 font-mono">${words.toLocaleString('fa-IR')}</td>
                <td class="p-3 font-mono font-bold text-blue-700">${amount.toLocaleString('fa-IR')} تومان</td>
                <td class="p-3">${settledBadge}</td>
                <td class="p-3 text-slate-500 text-xs">${r.description || '-'}</td>
            </tr>
        `;
    });
};

// ویرایش پروفایل توسط تایپیست
window.openEditProfileModal = function() {
    if (!currentTypist) return;
    document.getElementById('prof_name').value = currentTypist.full_name || currentTypist.name || '';
    document.getElementById('prof_national_code').value = currentTypist.national_code || '';
    document.getElementById('prof_phone').value = currentTypist.phone || '';
    document.getElementById('prof_shaba').value = currentTypist.shaba || '';
    document.getElementById('profileModal').classList.remove('hidden');
};

window.closeEditProfileModal = function() {
    document.getElementById('profileModal').classList.add('hidden');
};

window.handleTypistSelfUpdate = async function(e) {
    e.preventDefault();
    const updates = {
        full_name: document.getElementById('prof_name').value.trim(),
        national_code: document.getElementById('prof_national_code').value.trim(),
        phone: document.getElementById('prof_phone').value.trim(),
        shaba: document.getElementById('prof_shaba').value.trim()
    };

    const { error } = await window.db.from('typists').update(updates).eq('id', currentTypist.id);
    if (error) {
        alert('خطا در به‌روزرسانی: ' + error.message);
    } else {
        alert('مشخصات شما با موفقیت ذخیره شد.');
        currentTypist = { ...currentTypist, ...updates };
        window.closeEditProfileModal();
        window.renderTypistDashboardView();
    }
};

// ==========================================
// ۵. داشبورد مدیریت و عملیات تایپیست‌ها
// ==========================================
window.loadAdminDashboard = async function() {
    try {
        const { data: typists, error } = await window.db
            .from('typists')
            .select('*, typist_reports(*)');

        if (error) {
            alert('خطا در دریافت لیست تایپیست‌ها: ' + error.message);
            return;
        }

        cachedTypists = typists || [];
        const container = document.getElementById('adminTypistsList');
        container.innerHTML = '';

        if (cachedTypists.length === 0) {
            container.innerHTML = `<div class="col-span-full p-8 text-center bg-white rounded-2xl text-slate-400">تایپیستی ثبت نشده است. از دکمه «+ ثبت تایپیست جدید» استفاده نمایید.</div>`;
            return;
        }

        cachedTypists.forEach(t => {
            const reports = t.typist_reports || [];
            let totalWords = 0;
            let totalPages = 0;
            let totalUnsettledAmount = 0;
            let maxPeriod = 0;

            reports.forEach(r => {
                const words = safeNum(r.words);
                const pages = safeNum(r.pages);
                const rate = safeNum(r.rate || t.rate_per_word || 15);
                const amount = safeNum(r.total_amount) || (words * rate);
                const period = safeNum(r.period_number);

                totalWords += words;
                totalPages += pages;
                if (!r.is_settled) {
                    totalUnsettledAmount += amount;
                }
                if (period > maxPeriod) maxPeriod = period;
            });

            // ذخیره مبلغ تسویه نشده برای خروجی اکسل
            t.total_unsettled_amount = totalUnsettledAmount;

            const courseTitle = t.title || t.course_title || '—';
            const statusBadge = t.is_settled
                ? `<span class="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded font-bold">تسویه نهایی شده</span>`
                : `<span class="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold">پروژه فعال (دوره ${maxPeriod || 1})</span>`;

            container.innerHTML += `
                <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer relative" onclick="window.openManageTypistModal('${t.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-black text-slate-900 text-base">${t.full_name || t.name || 'بدون نام'}</h4>
                            <div class="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block my-1 font-bold">
                                📚 ${courseTitle}
                            </div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <div class="space-y-1 text-xs text-slate-600 mt-2 border-t pt-2">
                        <div class="flex justify-between">
                            <span>📱 تلفن:</span>
                            <span class="font-mono">${t.phone || '-'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>💳 شماره شبا:</span>
                            <span class="font-mono">IR${t.shaba || '-'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>📅 تحویل کل:</span>
                            <span>${t.delivery_date || '-'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>📄 مجموع صفحات:</span>
                            <span class="font-bold text-slate-800">${totalPages.toLocaleString('fa-IR')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span>✍️ مجموع کلمات:</span>
                            <span class="font-bold text-slate-800">${totalWords.toLocaleString('fa-IR')}</span>
                        </div>
                    </div>

                    <div class="mt-4 pt-2 border-t flex justify-between items-center bg-slate-50 -mx-5 -mb-5 p-3 rounded-b-2xl">
                        <div>
                            <span class="text-[11px] text-slate-500 block">مانده تسویه نشده:</span>
                            <span class="font-black text-sm text-blue-700 font-mono">${totalUnsettledAmount.toLocaleString('fa-IR')} تومان</span>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm">
                            مدیریت و ثبت کارکرد ⚙️
                        </span>
                    </div>
                </div>
            `;
        });

    } catch (err) {
        alert('خطای بارگذاری داده‌های داشبورد.');
    }
};

// ==========================================
// ۶. مدیریت تایپیست (ویرایش، ثبت کارکرد خودکار، تسویه)
// ==========================================
window.openManageTypistModal = async function(typistId) {
    try {
        const { data: typist, error } = await window.db
            .from('typists')
            .select('*')
            .eq('id', typistId)
            .single();

        if (error || !typist) {
            alert('اطلاعات تایپیست یافت نشد.');
            return;
        }

        // پر کردن فیلدهای ویرایش
        document.getElementById('edit_typist_id').value = typist.id;
        document.getElementById('report_typist_id').value = typist.id;
        document.getElementById('modalTypistTitle').innerText = 'مدیریت: ' + (typist.full_name || typist.name);
        document.getElementById('edit_full_name').value = typist.full_name || typist.name || '';
        document.getElementById('edit_title').value = typist.title || typist.course_title || '';
        document.getElementById('edit_national_code').value = typist.national_code || '';
        document.getElementById('edit_phone').value = typist.phone || '';
        document.getElementById('edit_shaba').value = typist.shaba || '';
        document.getElementById('edit_rate').value = typist.rate_per_word || 15;
        document.getElementById('edit_delivery_date').value = typist.delivery_date || '';

        // پر کردن فیلدهای گزارش جدید
        document.getElementById('report_date').value = getTodayShamsi();
        document.getElementById('report_rate').value = typist.rate_per_word || 15;
        document.getElementById('report_pages').value = 0;
        document.getElementById('report_words').value = 0;
        document.getElementById('report_desc').value = '';
        document.getElementById('report_editing_id').value = '';
        document.getElementById('btnSubmitReport').innerText = 'ثبت نهایی گزارش دوره';

        // واکشی گزارش‌ها و تعیین خودکار شماره دوره بعدی
        const { data: reports } = await window.db
            .from('typist_reports')
            .select('*')
            .eq('typist_id', typist.id)
            .order('period_number', { ascending: false });

        const lastPeriod = (reports && reports.length > 0) ? safeNum(reports[0].period_number) : 0;
        document.getElementById('report_period').value = lastPeriod + 1;

        window.calculateReportTotal();
        window.renderAdminHistoryTable(reports || [], typist);
        window.switchModalTab('edit');
        document.getElementById('manageTypistModal').classList.remove('hidden');

    } catch (err) {
        alert('خطا در باز کردن پرونده تایپیست.');
    }
};

window.switchModalTab = function(tab) {
    const editForm = document.getElementById('editTypistForm');
    const reportForm = document.getElementById('addReportForm');
    const historySec = document.getElementById('historyReportsSection');
    const tabEdit = document.getElementById('tabEditBtn');
    const tabReport = document.getElementById('tabReportBtn');
    const tabHistory = document.getElementById('tabHistoryBtn');

    [editForm, reportForm, historySec].forEach(el => el.classList.add('hidden'));
    [tabEdit, tabReport, tabHistory].forEach(btn => btn.className = 'py-2.5 px-4 font-bold text-slate-500 text-xs md:text-sm');

    if (tab === 'edit') {
        editForm.classList.remove('hidden');
        tabEdit.className = 'py-2.5 px-4 font-bold border-b-2 border-emerald-600 text-emerald-700 text-xs md:text-sm';
    } else if (tab === 'report') {
        reportForm.classList.remove('hidden');
        tabReport.className = 'py-2.5 px-4 font-bold border-b-2 border-blue-600 text-blue-700 text-xs md:text-sm';
    } else {
        historySec.classList.remove('hidden');
        tabHistory.className = 'py-2.5 px-4 font-bold border-b-2 border-slate-800 text-slate-800 text-xs md:text-sm';
    }
};

window.closeManageModal = function() {
    document.getElementById('manageTypistModal').classList.add('hidden');
};

// محاسبه خودکار جمع مبلغ
window.calculateReportTotal = function() {
    const words = safeNum(document.getElementById('report_words').value);
    const rate = safeNum(document.getElementById('report_rate').value);
    const total = words * rate;
    document.getElementById('report_total_display').value = total.toLocaleString('fa-IR') + ' تومان';
};

// ذخیره مشخصات ویرایش شده توسط مدیر
window.handleUpdateTypist = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit_typist_id').value;
    const updates = {
        full_name: document.getElementById('edit_full_name').value.trim(),
        title: document.getElementById('edit_title').value.trim(),
        national_code: document.getElementById('edit_national_code').value.trim(),
        phone: document.getElementById('edit_phone').value.trim(),
        shaba: document.getElementById('edit_shaba').value.trim(),
        rate_per_word: safeNum(document.getElementById('edit_rate').value) || 15,
        delivery_date: document.getElementById('edit_delivery_date').value.trim()
    };

    const { error } = await window.db.from('typists').update(updates).eq('id', id);
    if (error) {
        alert('خطا در ذخیره مشخصات: ' + error.message);
    } else {
        alert('مشخصات تایپیست با موفقیت به‌روزرسانی شد.');
        window.closeManageModal();
        window.loadAdminDashboard();
    }
};

// ثبت یا ویرایش گزارش دوره
window.handleSaveReport = async function(e) {
    e.preventDefault();
    const typistId = document.getElementById('report_typist_id').value;
    const editingId = document.getElementById('report_editing_id').value;
    const words = safeNum(document.getElementById('report_words').value);
    const pages = safeNum(document.getElementById('report_pages').value);
    const rate = safeNum(document.getElementById('report_rate').value);
    const period = safeNum(document.getElementById('report_period').value) || 1;
    const date = document.getElementById('report_date').value;
    const desc = document.getElementById('report_desc').value;

    const reportData = {
        typist_id: typistId,
        report_date: date,
        period_number: period,
        pages: pages,
        words: words,
        rate: rate,
        total_amount: words * rate,
        description: desc
    };

    let error = null;
    if (editingId) {
        const res = await window.db.from('typist_reports').update(reportData).eq('id', editingId);
        error = res.error;
    } else {
        reportData.is_settled = false;
        const res = await window.db.from('typist_reports').insert([reportData]);
        error = res.error;
    }

    if (error) {
        alert('خطا در ذخیره گزارش: ' + error.message);
    } else {
        alert(`گزارش دوره ${period} با موفقیت ثبت گردید.`);
        window.closeManageModal();
        window.loadAdminDashboard();
    }
};

// نمایش جدول سوابق با امکان ویرایش گزارش و تغییر وضعیت تسویه
window.renderAdminHistoryTable = function(reports, typist) {
    const tbody = document.getElementById('adminTypistReportsTbody');
    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">سابقه‌ای ثبت نشده است.</td></tr>`;
        return;
    }

    reports.forEach(r => {
        const pages = safeNum(r.pages);
        const words = safeNum(r.words);
        const amount = safeNum(r.total_amount || (words * (r.rate || typist.rate_per_word || 15)));
        const settledText = r.is_settled ? '✅ تسویه شده' : '⏳ تسویه نشده';
        const settleBtnClass = r.is_settled ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-2 font-bold">دوره ${r.period_number}</td>
                <td class="p-2 font-mono">${r.report_date}</td>
                <td class="p-2 font-mono">${pages.toLocaleString('fa-IR')}</td>
                <td class="p-2 font-mono">${words.toLocaleString('fa-IR')}</td>
                <td class="p-2 font-mono font-bold text-blue-700">${amount.toLocaleString('fa-IR')}</td>
                <td class="p-2">${settledText}</td>
                <td class="p-2 flex gap-1 justify-center">
                    <button onclick="window.loadReportForEdit('${r.id}', ${r.period_number}, '${r.report_date}', ${pages}, ${words}, ${r.rate || typist.rate_per_word || 15}, '${(r.description || '').replace(/'/g, "\\'")}')" class="bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded text-[11px] font-bold">ویرایش</button>
                    <button onclick="window.toggleReportSettlement('${r.id}', ${!r.is_settled})" class="${settleBtnClass} px-2 py-1 rounded text-[11px] font-bold">
                        ${r.is_settled ? 'لغو تسویه' : 'تسویه این دوره'}
                    </button>
                </td>
            </tr>
        `;
    });
};

// انتقال گزارش به فرم جهت ویرایش
window.loadReportForEdit = function(id, period, date, pages, words, rate, desc) {
    document.getElementById('report_editing_id').value = id;
    document.getElementById('report_period').value = period;
    document.getElementById('report_date').value = date;
    document.getElementById('report_pages').value = pages;
    document.getElementById('report_words').value = words;
    document.getElementById('report_rate').value = rate;
    document.getElementById('report_desc').value = desc;
    document.getElementById('btnSubmitReport').innerText = 'ذخیره ویرایش گزارش';
    window.calculateReportTotal();
    window.switchModalTab('report');
};

// تغییر وضعیت تسویه یک گزارش
window.toggleReportSettlement = async function(reportId, targetStatus) {
    const { error } = await window.db.from('typist_reports').update({ is_settled: targetStatus }).eq('id', reportId);
    if (error) {
        alert('خطا در تغییر وضعیت تسویه: ' + error.message);
    } else {
        alert('وضعیت تسویه دوره با موفقیت تغییر کرد.');
        window.closeManageModal();
        window.loadAdminDashboard();
    }
};

// شروع کار و پروژه جدید پس از تسویه کامل
window.startNewProjectForTypist = async function() {
    const id = document.getElementById('edit_typist_id').value;
    const typistName = document.getElementById('edit_full_name').value;
    
    const newTitle = prompt(`عنوان دوره / کتاب جدید را برای ${typistName} وارد نمایید:`);
    if (!newTitle || !newTitle.trim()) return;

    if (!confirm('آیا مطمئن هستید؟ با این کار وضعیت تسویه نهایی آزاد شده و تایپیست آماده پروژه جدید می‌شود.')) return;

    const { error } = await window.db.from('typists').update({
        title: newTitle.trim(),
        is_settled: false,
        delivery_date: ''
    }).eq('id', id);

    if (error) {
        alert('خطا در آغاز پروژه جدید: ' + error.message);
    } else {
        alert('پروژه جدید با موفقیت فعال شد.');
        window.closeManageModal();
        window.loadAdminDashboard();
    }
};

// ==========================================
// ۷. ثبت تایپیست جدید توسط مدیر
// ==========================================
window.openNewTypistModal = function() {
    document.getElementById('newTypistModal').classList.remove('hidden');
};

window.closeNewTypistModal = function() {
    document.getElementById('newTypistModal').classList.add('hidden');
};

window.handleSaveNewTypist = async function(e) {
    e.preventDefault();
    const newTypist = {
        full_name: document.getElementById('new_full_name').value.trim(),
        title: document.getElementById('new_title').value.trim(),
        national_code: document.getElementById('new_national_code').value.trim(),
        phone: document.getElementById('new_phone').value.trim(),
        shaba: document.getElementById('new_shaba').value.trim(),
        rate_per_word: safeNum(document.getElementById('new_rate').value) || 15,
        delivery_date: document.getElementById('new_delivery_date').value.trim(),
        is_settled: false
    };

    const { error } = await window.db.from('typists').insert([newTypist]);
    if (error) {
        alert('خطا در ثبت تایپیست: ' + error.message);
    } else {
        alert('تایپیست جدید با موفقیت تعریف شد.');
        window.closeNewTypistModal();
        window.loadAdminDashboard();
    }
};

// ==========================================
// ۸. تولید خروجی اکسل استاندارد بانکی (دقیقاً ۵ ستون)
// ==========================================
window.handleBatchExcelExport = function() {
    if (!cachedTypists || cachedTypists.length === 0) {
        alert('هیچ تایپیستی برای صدور خروجی یافت نشد.');
        return;
    }

    // ساخت محتوای CSV با UTF-8 BOM جهت نمایش صحیح در نرم‌افزار Excel فارسی
    let csvContent = '\uFEFFنام و نام خانوادگی,کد ملی,شماره تماس,مبلغ,شماره شبا\n';

    cachedTypists.forEach(t => {
        const name = (t.full_name || t.name || '').replace(/,/g, ' ');
        const nationalCode = `\t${t.national_code || ''}`; // تب جهت حفظ صفر اول در اکسل
        const phone = `\t${t.phone || ''}`;
        const amount = safeNum(t.total_unsettled_amount);
        let shaba = t.shaba || '';
        if (shaba && !shaba.toUpperCase().startsWith('IR')) {
            shaba = 'IR' + shaba;
        }
        shaba = `\t${shaba}`;

        csvContent += `"${name}","${nationalCode}","${phone}","${amount}","${shaba}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تسویه_بانکی_تایپیست‌ها_${getTodayShamsi().replace(/\//g, '-')}.csv`;
    link.click();
};

// بارگذاری اولیه
window.addEventListener('DOMContentLoaded', () => {
    console.log('سامانه مدیریت تایپیست‌ها آماده به کار است.');
});

// ==========================================
// تنظیمات اتصال به SUPABASE
// ==========================================
const SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

// وضعیت فعلی
let currentTypist = null; // مشخصات تایپیست لاگین شده
let currentMode = 'login'; // 'login', 'typist', 'admin'
let allTypistsCache = [];

// تبدیل ارقام فارسی به انگلیسی برای ورود داده
function normalizeDigits(str) {
    if (!str) return '';
    const f = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const a = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
        str = str.replace(new RegExp(f[i], 'g'), i).replace(new RegExp(a[i], 'g'), i);
    }
    return str.trim();
}

// مقداردهی اولیه سال‌ها
function populateYears() {
    const yearSelect = $('repYear');
    yearSelect.innerHTML = '';
    const currentYear = 1403; // یا محاسبه پویا
    for (let y = currentYear - 1; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
}

// بررسی لاگین قبلی از LocalStorage
window.addEventListener('DOMContentLoaded', () => {
    populateYears();
    const saved = localStorage.getItem('logged_typist');
    if (saved) {
        try {
            currentTypist = JSON.parse(saved);
            showTypistDashboard();
        } catch (e) {
            localStorage.removeItem('logged_typist');
        }
    }
});

// ==========================================
// ورود و مدیریت نشست تایپیست
// ==========================================
$('typistLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nc = normalizeDigits($('loginNationalCode').value);
    const phone = normalizeDigits($('loginPhone').value);
    const errBox = $('loginErrorMsg');
    errBox.classList.add('hidden');

    if (!nc || !phone) {
        errBox.textContent = 'لطفاً کد ملی و شماره موبایل را کامل وارد کنید.';
        errBox.classList.remove('hidden');
        return;
    }

    // جستجوی تایپیست در پایگاه داده
    const { data, error } = await client
        .from('typists')
        .select('*')
        .eq('national_code', nc)
        .eq('phone', phone)
        .single();

    if (error || !data) {
        errBox.textContent = 'مشخصاتی با این کد ملی و شماره موبایل یافت نشد. با ادمین تماس بگیرید.';
        errBox.classList.remove('hidden');
        return;
    }

    currentTypist = data;
    localStorage.setItem('logged_typist', JSON.stringify(currentTypist));
    showTypistDashboard();
});

function showTypistDashboard() {
    currentMode = 'typist';
    $('loginSection').classList.add('hidden');
    $('adminSection').classList.add('hidden');
    $('typistDashboardSection').classList.remove('hidden');
    $('logoutBtn').classList.remove('hidden');
    $('viewToggleBtn').textContent = 'مشاهده پنل مدیریت';

    // نمایش اطلاعات پروفایل در بالای صفحه
    $('dashTypistName').textContent = currentTypist.name || 'بدون نام';
    $('dashTypistTitle').textContent = currentTypist.title || 'تایپیست';
    $('dashTypistNC').textContent = currentTypist.national_code || '-';
    $('dashTypistPhone').textContent = currentTypist.phone || '-';
    $('dashTypistShaba').textContent = currentTypist.shaba_number || 'ثبت نشده';

    loadMyReports();
}

window.logoutTypist = () => {
    localStorage.removeItem('logged_typist');
    currentTypist = null;
    $('typistDashboardSection').classList.add('hidden');
    $('logoutBtn').classList.add('hidden');
    $('loginSection').classList.remove('hidden');
    $('viewToggleBtn').textContent = 'ورود به پنل مدیریت';
    currentMode = 'login';
};

// جابجایی بین حالت مدیریت و صفحه ورود/پروفایل
window.toggleViewMode = () => {
    if (currentMode === 'admin') {
        if (currentTypist) {
            showTypistDashboard();
        } else {
            $('adminSection').classList.add('hidden');
            $('loginSection').classList.remove('hidden');
            $('viewToggleBtn').textContent = 'ورود به پنل مدیریت';
            currentMode = 'login';
        }
    } else {
        $('loginSection').classList.add('hidden');
        $('typistDashboardSection').classList.add('hidden');
        $('adminSection').classList.remove('hidden');
        $('viewToggleBtn').textContent = 'بازگشت به پنل تایپیست';
        currentMode = 'admin';
        loadAdminData();
    }
};

// ==========================================
// ویرایش اطلاعات پروفایل توسط خود تایپیست
// ==========================================
window.openEditProfileModal = () => {
    if (!currentTypist) return;
    $('myProfileName').value = currentTypist.name || '';
    $('myProfilePhone').value = currentTypist.phone || '';
    $('myProfileShaba').value = currentTypist.shaba_number || '';
    $('myProfileTitle').value = currentTypist.title || '';
    $('editProfileModal').classList.remove('hidden');
};

window.closeEditProfileModal = () => {
    $('editProfileModal').classList.add('hidden');
};

$('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updateData = {
        name: $('myProfileName').value.trim(),
        phone: normalizeDigits($('myProfilePhone').value),
        shaba_number: $('myProfileShaba').value.trim(),
        title: $('myProfileTitle').value.trim()
    };

    const { data, error } = await client
        .from('typists')
        .update(updateData)
        .eq('id', currentTypist.id)
        .select()
        .single();

    if (error) {
        alert('خطا در به‌روزرسانی اطلاعات: ' + error.message);
    } else {
        alert('اطلاعات پروفایل شما با موفقیت ویرایش شد.');
        currentTypist = data;
        localStorage.setItem('logged_typist', JSON.stringify(currentTypist));
        closeEditProfileModal();
        showTypistDashboard();
    }
});

// ==========================================
// ثبت و نمایش کارکردهای ۱۰ روزه تایپیست
// ==========================================
$('submitReportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentTypist) return;

    const payload = {
        typist_id: currentTypist.id,
        year: parseInt($('repYear').value),
        month: parseInt($('repMonth').value),
        period_type: $('repPeriod').value,
        pages_count: parseFloat($('repPages').value) || 0,
        words_count: parseInt($('repWords').value) || 0,
        notes: $('repNotes').value.trim()
    };

    const { error } = await client
        .from('typist_reports')
        .upsert(payload, { onConflict: 'typist_id,year,month,period_type' });

    if (error) {
        alert('خطا در ذخیره گزارش: ' + error.message);
    } else {
        alert('کارکرد این دوره با موفقیت ثبت شد.');
        $('repPages').value = '';
        $('repWords').value = '';
        $('repNotes').value = '';
        loadMyReports();
    }
});

async function loadMyReports() {
    if (!currentTypist) return;
    const { data, error } = await client
        .from('typist_reports')
        .select('*')
        .eq('typist_id', currentTypist.id)
        .order('created_at', { ascending: false });

    const tbody = $('userReportsTable');
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">هنوز کارکردی برای شما ثبت نشده است.</td></tr>';
        $('userTotalSummary').textContent = 'مجموع: ۰ صفحه | ۰ کلمه';
        return;
    }

    let totP = 0, totW = 0;
    const periodMap = {
        '1-10': 'دهه اول (۱ تا ۱۰)',
        '11-20': 'دهه دوم (۱۱ تا ۲۰)',
        '21-end': 'دهه سوم (۲۱ تا پایان)'
    };

    tbody.innerHTML = data.map(r => {
        totP += Number(r.pages_count || 0);
        totW += Number(r.words_count || 0);
        const dateStr = new Date(r.created_at).toLocaleDateString('fa-IR');
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 font-semibold text-teal-600">${r.year}/${r.month} - ${periodMap[r.period_type] || r.period_type}</td>
                <td class="p-3 font-mono font-bold">${r.pages_count}</td>
                <td class="p-3 font-mono">${Number(r.words_count).toLocaleString()}</td>
                <td class="p-3 text-slate-500">${r.notes || '-'}</td>
                <td class="p-3 text-slate-400 font-mono text-[11px]">${dateStr}</td>
            </tr>
        `;
    }).join('');

    $('userTotalSummary').textContent = `مجموع: ${totP.toLocaleString()} صفحه | ${totW.toLocaleString()} کلمه`;
}

// ==========================================
// بخش مدیریت (ADMIN)
// ==========================================
async function loadAdminData() {
    const tbody = $('adminTypistsTable');
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">در حال بارگذاری لیست...</td></tr>';

    const { data, error } = await client
        .from('typists')
        .select(`
            *,
            typist_reports (*),
            payments (*)
        `)
        .order('created_at', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-rose-500">خطا در دریافت اطلاعات</td></tr>';
        return;
    }

    allTypistsCache = data;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">تایپیستی ثبت نشده است.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(p => {
        const reps = p.typist_reports || [];
        const pays = p.payments || [];

        const totalPages = reps.reduce((sum, r) => sum + Number(r.pages_count || 0), 0);
        const totalWords = reps.reduce((sum, r) => sum + Number(r.words_count || 0), 0);
        const totalPaid = pays.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 font-bold">${p.name}</td>
                <td class="p-3 font-mono">${p.national_code || '-'}</td>
                <td class="p-3 font-mono">${p.phone || '-'}</td>
                <td class="p-3 font-mono text-slate-500" dir="ltr">${p.shaba_number || '-'}</td>
                <td class="p-3">${p.title || '-'}</td>
                <td class="p-3 font-mono text-teal-600 font-semibold">${totalPages} ص / ${totalWords} ک</td>
                <td class="p-3 font-mono font-bold text-emerald-600">${totalPaid.toLocaleString()}</td>
                <td class="p-3 text-center space-x-1 space-x-reverse">
                    <button onclick="openPaymentModal('${p.id}', '${p.name}')" class="px-2 py-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100">تسویه</button>
                    <button onclick="editPersonByAdmin('${p.id}')" class="px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">ویرایش</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ثبت / ویرایش تایپیست توسط ادمین
window.openPersonModal = () => {
    $('pId').value = '';
    $('pName').value = '';
    $('pNationalCode').value = '';
    $('pPhone').value = '';
    $('pShaba').value = '';
    $('pTitle').value = '';
    $('personModalTitle').textContent = 'تعریف تایپیست جدید';
    $('personModal').classList.remove('hidden');
};

window.closePersonModal = () => {
    $('personModal').classList.add('hidden');
};

window.editPersonByAdmin = (id) => {
    const p = allTypistsCache.find(x => x.id === id);
    if (!p) return;
    $('pId').value = p.id;
    $('pName').value = p.name || '';
    $('pNationalCode').value = p.national_code || '';
    $('pPhone').value = p.phone || '';
    $('pShaba').value = p.shaba_number || '';
    $('pTitle').value = p.title || '';
    $('personModalTitle').textContent = 'ویرایش مشخصات تایپیست';
    $('personModal').classList.remove('hidden');
};

$('personForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('pId').value;
    const payload = {
        name: $('pName').value.trim(),
        national_code: normalizeDigits($('pNationalCode').value),
        phone: normalizeDigits($('pPhone').value),
        shaba_number: $('pShaba').value.trim(),
        title: $('pTitle').value.trim()
    };

    let res;
    if (id) {
        res = await client.from('typists').update(payload).eq('id', id);
    } else {
        res = await client.from('typists').insert([payload]);
    }

    if (res.error) {
        alert('خطا در ذخیره‌سازی: ' + res.error.message);
    } else {
        alert('اطلاعات با موفقیت ذخیره شد.');
        closePersonModal();
        loadAdminData();
    }
});

// ثبت تسویه/پرداخت
window.openPaymentModal = (typistId, name) => {
    $('payTypistId').value = typistId;
    $('payTargetName').textContent = 'تایپیست: ' + name;
    $('payAmount').value = '';
    $('payTracking').value = '';
    $('paymentModal').classList.remove('hidden');
};

window.closePaymentModal = () => {
    $('paymentModal').classList.add('hidden');
};

$('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const typistId = $('payTypistId').value;
    const amount = parseFloat($('payAmount').value) || 0;
    const tracking = $('payTracking').value.trim();

    const { error } = await client.from('payments').insert([{
        typist_id: typistId,
        year: 1403,
        month: 1,
        amount: amount,
        tracking_code: tracking,
        payment_date: new Date().toLocaleDateString('fa-IR')
    }]);

    if (error) {
        alert('خطا در ثبت پرداخت: ' + error.message);
    } else {
        alert('پرداخت با موفقیت ثبت گردید.');
        closePaymentModal();
        loadAdminData();
    }
});

// =======================================================
// خروجی اکسل با فرمت دقیق مدنظر شما:
// نام و نام خانوادگی، کد ملی، شماره تماس، مبلغ، شماره شبا
// =======================================================
window.exportToExcel = () => {
    if (!allTypistsCache || allTypistsCache.length === 0) {
        alert("اطلاعاتی برای دانلود وجود ندارد.");
        return;
    }

    // هدر استاندارد UTF-8 BOM جهت نمایش سالم حروف در اکسل
    let csv = "\uFEFF";
    csv += "نام و نام خانوادگی,کد ملی,شماره تماس,مبلغ,شماره شبا\r\n";

    allTypistsCache.forEach(p => {
        const pays = p.payments || [];
        const totalAmount = pays.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);

        const name = (p.name || '').replace(/"/g, '""');
        const nationalCode = (p.national_code || '').replace(/"/g, '""');
        const phone = (p.phone || '').replace(/"/g, '""');
        const shaba = (p.shaba_number || '').replace(/"/g, '""');

        // سطر اطلاعات با کاراکتر تب برای حفظ صفرهای ابتدایی کد ملی و موبایل
        const row = [
            `"${name}"`,
            `\t"${nationalCode}"`,
            `\t"${phone}"`,
            totalAmount,
            `\t"${shaba}"`
        ];
        csv += row.join(",") + "\r\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `گزارش_تسویه_تایپیست_ها.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

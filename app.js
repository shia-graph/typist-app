/* ==========================================================================
   Typist Payroll & Task Management Application Logic (v4.2.0)
   ========================================================================== */

// 1. Supabase Initialization with Safe non-conflicting variable name
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

let supabaseClient = null;
let currentUser = null;
let isAdmin = false;
let allTypistsCache = [];

// دریافت ایمن کلاینت Supabase
function getSupabaseClient() {
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabaseClient;
}

// ۲. توابع کمکی و تبدیل اعداد
const toEnglishDigits = (str) => {
    if (str === null || str === undefined) return "";
    return str.toString()
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
};

const formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return new Intl.NumberFormat('fa-IR').format(num);
};

function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

// ۳. مدیریت ورود، خروج و جلسات کاربری (Auth)
async function login() {
    const rawId = document.getElementById('loginId').value.trim();
    const id = toEnglishDigits(rawId).toLowerCase();
    const pass = toEnglishDigits(document.getElementById('loginPass').value.trim());

    if (!id || !pass) {
        return alert("لطفاً نام کاربری (کد ملی) و رمز عبور را وارد کنید.");
    }

    showLoading(true);
    const client = getSupabaseClient();

    try {
        // ۱. بررسی ورود ادمین (جدول admin_settings)
        const { data: adminData, error: adminErr } = await client
            .from('admin_settings')
            .select('*')
            .eq('id', id);

        if (!adminErr && adminData && adminData.length > 0) {
            if (adminData[0].password === pass) {
                saveSession(adminData[0], true);
                return;
            }
        }

        // ۲. بررسی ورود تایپیست (جدول typists)
        const { data: tData, error: tErr } = await client
            .from('typists')
            .select('*')
            .eq('id', id);

        if (!tErr && tData && tData.length > 0) {
            const user = tData[0];
            const defaultPass = user.phone ? user.phone.slice(-4) : "1234";
            const actualPass = user.password || defaultPass;

            if (pass === actualPass || pass === defaultPass) {
                saveSession(user, false);
                return;
            }
        }

        alert("نام کاربری (کد ملی) یا رمز عبور اشتباه است.");
    } catch (err) {
        console.error("Login Error:", err);
        alert("خطا در برقراری ارتباط با سرور.");
    } finally {
        showLoading(false);
    }
}

function saveSession(user, adminStatus) {
    localStorage.setItem('typist_session', JSON.stringify({
        id: user.id,
        isAdmin: adminStatus
    }));
    currentUser = user;
    isAdmin = adminStatus;
    initApp();
}

async function checkSession() {
    const sessionStr = localStorage.getItem('typist_session');
    if (!sessionStr) {
        showSection('login');
        return;
    }

    try {
        const session = JSON.parse(sessionStr);
        showLoading(true);
        const client = getSupabaseClient();

        if (session.isAdmin) {
            const { data } = await client.from('admin_settings').select('*').eq('id', session.id);
            if (data && data.length > 0) {
                currentUser = data[0];
                isAdmin = true;
                initApp();
            } else {
                logoutSilent();
            }
        } else {
            const { data } = await client.from('typists').select('*').eq('id', session.id);
            if (data && data.length > 0) {
                currentUser = data[0];
                isAdmin = false;
                initApp();
            } else {
                alert("تایپیست در سیستم یافت نشد یا حذف شده است.");
                logoutSilent();
            }
        }
    } catch (e) {
        console.error("Session Check Error:", e);
        logoutSilent();
    } finally {
        showLoading(false);
    }
}

function logout() {
    if (confirm("آیا قصد خروج از سامانه را دارید؟")) {
        logoutSilent();
    }
}

function logoutSilent() {
    localStorage.removeItem('typist_session');
    currentUser = null;
    isAdmin = false;
    location.reload();
}

// ۴. سوئیت‌کننده صفحات و تب‌ها
function showSection(type) {
    document.getElementById('loginSection').classList.toggle('hidden', type !== 'login');
    document.getElementById('appSection').classList.toggle('hidden', type !== 'app');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });

    const targetTab = document.getElementById(tab + 'Tab');
    if (targetTab) targetTab.classList.remove('hidden');

    if (event && event.currentTarget && event.currentTarget.classList.contains('tab-btn')) {
        event.currentTarget.classList.remove('bg-gray-200', 'text-gray-700');
        event.currentTarget.classList.add('bg-blue-600', 'text-white');
    }

    if (tab === 'typists') loadTypists();
    if (tab === 'work') { loadTypistDropdowns(); loadWorks(); }
    if (tab === 'payments') { loadTypistDropdowns(); loadPayments(); }
    if (tab === 'reports') loadAdminReport();
}

// ۵. مقداردهی اولیه برنامه
async function initApp() {
    showSection('app');
    document.getElementById('userBadge').innerText = isAdmin ? "مدیر سیستم" : "پنل تایپیست";
    document.getElementById('userNameDisplay').innerText = `${currentUser.name || ''} ${currentUser.family || ''}`;

    if (isAdmin) {
        document.getElementById('adminNav').classList.remove('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('typistPanel').classList.add('hidden');
        switchTab('typists');
    } else {
        document.getElementById('adminNav').classList.add('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('typistPanel').classList.remove('hidden');
        loadTypistDashboard();
    }
}

// ۶. پنل و داشبورد خود تایپیست
async function loadTypistDashboard() {
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: stats, error: rpcErr } = await client.rpc('get_typist_report', { 
            p_typist_id: currentUser.id,
            p_start: null,
            p_end: null
        });

        if (!rpcErr && stats && stats[0]) {
            document.getElementById('tPages').innerText = formatCurrency(stats[0].total_pages || 0);
            document.getElementById('tPaid').innerText = formatCurrency(stats[0].total_payment || 0);
            document.getElementById('tBalance').innerText = formatCurrency(stats[0].remaining_balance || 0);
        }

        const { data: works } = await client
            .from('work_records')
            .select('*')
            .eq('typist_id', currentUser.id)
            .order('record_date', { ascending: false });

        const list = document.getElementById('myWorksList');
        if (works && works.length > 0) {
            list.innerHTML = works.map(w => `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="p-4 text-xs font-mono">${new Date(w.record_date).toLocaleDateString('fa-IR')}</td>
                    <td class="p-4 font-bold text-gray-800">${w.file_title}</td>
                    <td class="p-4 text-center font-bold text-blue-600">${w.pages}</td>
                    <td class="p-4 text-center">${w.is_delivered ? '<span class="text-green-600 font-bold">✔️ تحویل شده</span>' : '<span class="text-gray-400">❌ در حال انجام</span>'}</td>
                    <td class="p-4 text-center">${w.is_settled ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">✔️ تسویه کامل</span>' : '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-bold">⏳ در انتظار تسویه</span>'}</td>
                </tr>
            `).join('');
        } else {
            list.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">هیچ کاری برای شما ثبت نشده است.</td></tr>`;
        }

        document.getElementById('p_name').value = currentUser.name || '';
        document.getElementById('p_family').value = currentUser.family || '';
        document.getElementById('p_father').value = currentUser.father_name || '';
        document.getElementById('p_phone').value = currentUser.phone || '';
        document.getElementById('p_card').value = currentUser.card_number || '';
        document.getElementById('p_shaba').value = currentUser.shaba || '';

    } catch (e) {
        console.error("Dashboard Load Error:", e);
    } finally {
        showLoading(false);
    }
}

function enableProfileEdit() {
    const fields = ['p_name', 'p_family', 'p_father', 'p_phone', 'p_card', 'p_shaba'];
    fields.forEach(id => {
        const input = document.getElementById(id);
        input.readOnly = false;
        input.classList.remove('bg-gray-50');
        input.classList.add('bg-white', 'border-blue-400', 'ring-2', 'ring-blue-100');
    });

    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

async function saveTypistProfile() {
    const updateData = {
        name: document.getElementById('p_name').value.trim(),
        family: document.getElementById('p_family').value.trim(),
        father_name: document.getElementById('p_father').value.trim(),
        phone: toEnglishDigits(document.getElementById('p_phone').value.trim()),
        card_number: toEnglishDigits(document.getElementById('p_card').value.trim()),
        shaba: document.getElementById('p_shaba').value.trim()
    };

    if (!updateData.name) return alert("نام نمی‌تواند خالی باشد.");

    showLoading(true);
    const { error } = await getSupabaseClient()
        .from('typists')
        .update(updateData)
        .eq('id', currentUser.id);
    
    showLoading(false);

    if (error) {
        alert("خطا در ذخیره پروفایل.");
    } else {
        alert("پروفایل شما با موفقیت به روزرسانی شد.");
        currentUser = { ...currentUser, ...updateData };
        initApp();
    }
}

// ۷. پنل ادمین - مدیریت تایپیست‌ها
async function loadTypists() {
    showLoading(true);
    const { data, error } = await getSupabaseClient()
        .from('typists')
        .select('*')
        .order('created_at', { ascending: false });

    showLoading(false);
    if (error) return alert("خطا در دريافت لیست تایپیست‌ها.");

    allTypistsCache = data || [];
    renderTypistsTable(allTypistsCache);
}

function renderTypistsTable(listData) {
    const list = document.getElementById('typistsList');
    if (!listData || listData.length === 0) {
        list.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">هیچ تایپیستی یافت نشد.</td></tr>`;
        return;
    }

    list.innerHTML = listData.map(t => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 text-center">
                <input type="checkbox" class="typist-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-500" value="${t.phone || ''}" data-id="${t.id}">
            </td>
            <td class="p-4 font-mono font-bold text-gray-700">${t.id}</td>
            <td class="p-4 font-bold text-gray-900">${t.name} ${t.family || ''}</td>
            <td class="p-4 text-center font-bold text-blue-600">${formatCurrency(t.page_rate || 0)} تومان</td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${t.phone ? `<a href="tel:${t.phone}" class="bg-green-100 text-green-700 p-2 rounded-xl text-xs font-bold hover:bg-green-200" title="تماس تلفنی">📞 تماس</a>` : ''}
                    ${t.phone ? `<a href="sms:${t.phone}" class="bg-blue-100 text-blue-700 p-2 rounded-xl text-xs font-bold hover:bg-blue-200" title="ارسال پیامک">✉️ پیامک</a>` : ''}
                </div>
            </td>
            <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="openEditModal('${t.id}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl font-bold text-xs transition-all">✏️ ویرایش</button>
                    <button onclick="resetPasswordModal('${t.id}')" class="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-3 py-1.5 rounded-xl font-bold text-xs transition-all">🔑 ریست رمز</button>
                    <button onclick="deleteTypist('${t.id}')" class="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl font-bold text-xs transition-all">🗑️ حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterTypists() {
    const query = toEnglishDigits(document.getElementById('searchTypist').value.trim().toLowerCase());
    const filtered = allTypistsCache.filter(t => 
        (t.name && t.name.toLowerCase().includes(query)) ||
        (t.family && t.family.toLowerCase().includes(query)) ||
        (t.id && t.id.includes(query))
    );
    renderTypistsTable(filtered);
}

async function addTypist() {
    const id = toEnglishDigits(document.getElementById('t_id').value.trim());
    const name = document.getElementById('t_name').value.trim();
    const family = document.getElementById('t_family').value.trim();
    const phone = toEnglishDigits(document.getElementById('t_phone').value.trim());
    const pass = toEnglishDigits(document.getElementById('t_pass').value.trim());
    const rate = parseInt(toEnglishDigits(document.getElementById('t_rate').value.trim()));

    if (!id || !name || isNaN(rate)) {
        return alert("کد ملی، نام و نرخ صفحه الزامی هستند.");
    }

    showLoading(true);
    const defaultPass = phone ? phone.slice(-4) : "1234";

    const { error } = await getSupabaseClient()
        .from('typists')
        .insert([{
            id,
            name,
            family,
            phone,
            password: pass || defaultPass,
            page_rate: rate
        }]);

    showLoading(false);

    if (error) {
        alert("خطا در ثبت! احتمالاً این کد ملی قبلاً ثبت شده است.");
    } else {
        alert("تایپیست با موفقیت ثبت شد.");
        ['t_id','t_name','t_family','t_phone','t_pass','t_rate'].forEach(id => document.getElementById(id).value = '');
        loadTypists();
    }
}

async function deleteTypist(id) {
    if (!confirm(`آیا از حذف تایپیست با کد ملی ${id} و تمامی کارهای ثبت شده او مطمئن هستید؟`)) return;

    showLoading(true);
    const client = getSupabaseClient();
    try {
        await client.from('work_records').delete().eq('typist_id', id);
        await client.from('payments').delete().eq('typist_id', id);
        const { error } = await client.from('typists').delete().eq('id', id);

        if (error) alert("خطا در حذف تایپیست.");
        else loadTypists();
    } catch (e) {
        console.error(e);
    } finally {
        showLoading(false);
    }
}

// ۸. مودال ویرایش تایپیست توسط ادمین
function openEditModal(id) {
    const t = allTypistsCache.find(x => x.id === id);
    if (!t) return;

    document.getElementById('edit_t_id').value = t.id;
    document.getElementById('edit_t_name').value = t.name || '';
    document.getElementById('edit_t_family').value = t.family || '';
    document.getElementById('edit_t_father').value = t.father_name || '';
    document.getElementById('edit_t_phone').value = t.phone || '';
    document.getElementById('edit_t_rate').value = t.page_rate || 0;
    document.getElementById('edit_t_card').value = t.card_number || '';
    document.getElementById('edit_t_shaba').value = t.shaba || '';

    document.getElementById('editTypistModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editTypistModal').classList.add('hidden');
}

async function saveTypistModalEdit() {
    const id = document.getElementById('edit_t_id').value;
    const updateData = {
        name: document.getElementById('edit_t_name').value.trim(),
        family: document.getElementById('edit_t_family').value.trim(),
        father_name: document.getElementById('edit_t_father').value.trim(),
        phone: toEnglishDigits(document.getElementById('edit_t_phone').value.trim()),
        page_rate: parseInt(toEnglishDigits(document.getElementById('edit_t_rate').value.trim())),
        card_number: toEnglishDigits(document.getElementById('edit_t_card').value.trim()),
        shaba: document.getElementById('edit_t_shaba').value.trim()
    };

    showLoading(true);
    const { error } = await getSupabaseClient()
        .from('typists')
        .update(updateData)
        .eq('id', id);

    showLoading(false);
    if (error) alert("خطا در ویرایش تایپیست.");
    else {
        closeEditModal();
        loadTypists();
    }
}

// ۹. مودال تغییر رمز عبور
let targetPassResetId = null;

function openChangePassModal() {
    targetPassResetId = currentUser.id;
    document.getElementById('changePassModal').classList.remove('hidden');
}

function resetPasswordModal(typistId) {
    targetPassResetId = typistId;
    document.getElementById('changePassModal').classList.remove('hidden');
}

function closeChangePassModal() {
    targetPassResetId = null;
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('changePassModal').classList.add('hidden');
}

async function saveNewPassword() {
    const newPass = toEnglishDigits(document.getElementById('newPasswordInput').value.trim());
    if (!newPass) return alert("رمز عبور را وارد کنید.");

    showLoading(true);
    const client = getSupabaseClient();
    let err = null;

    if (targetPassResetId === currentUser.id && isAdmin) {
        const { error } = await client.from('admin_settings').update({ password: newPass }).eq('id', currentUser.id);
        err = error;
    } else {
        const { error } = await client.from('typists').update({ password: newPass }).eq('id', targetPassResetId);
        err = error;
    }

    showLoading(false);

    if (err) alert("خطا در تغییر رمز عبور.");
    else {
        alert("رمز عبور با موفقیت بروزرسانی شد.");
        closeChangePassModal();
    }
}

// ۱۰. ثبت و مدیریت کارها (Work Records)
async function loadTypistDropdowns() {
    const { data } = await getSupabaseClient().from('typists').select('id, name, family').order('name');
    if (!data) return;

    const options = data.map(t => `<option value="${t.id}">${t.name} ${t.family || ''} (${t.id})</option>`).join('');
    document.getElementById('w_typist').innerHTML = options;
    document.getElementById('p_typist').innerHTML = options;
}

async function loadWorks() {
    showLoading(true);
    const { data, error } = await getSupabaseClient()
        .from('work_records')
        .select('*, typists(name, family)')
        .order('record_date', { ascending: false })
        .limit(100);

    showLoading(false);
    if (error) return;

    const list = document.getElementById('workList');
    if (!data || data.length === 0) {
        list.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">هیچ کاری ثبت نشده است.</td></tr>`;
        return;
    }

    list.innerHTML = data.map(w => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 text-xs font-mono">${new Date(w.record_date).toLocaleDateString('fa-IR')}</td>
            <td class="p-4 font-bold text-gray-800">${w.typists?.name || ''} ${w.typists?.family || ''}</td>
            <td class="p-4">${w.file_title}</td>
            <td class="p-4 text-center font-bold text-blue-600">${w.pages}</td>
            <td class="p-4 text-center">
                <button onclick="toggleDelivered(${w.id}, ${!w.is_delivered})" class="px-2.5 py-1 rounded-lg text-xs font-bold ${w.is_delivered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
                    ${w.is_delivered ? '✔️ تحویل شد' : '❌ تحویل نشده'}
                </button>
            </td>
            <td class="p-4 text-center">
                <button onclick="toggleSettled(${w.id}, ${!w.is_settled})" class="px-2.5 py-1 rounded-lg text-xs font-bold ${w.is_settled ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${w.is_settled ? '✔️ تسویه کامل' : '⏳ تسویه نشده'}
                </button>
            </td>
            <td class="p-4 text-center">
                <button onclick="deleteWork(${w.id})" class="text-red-500 hover:text-red-700 p-1">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function addWork() {
    const typist_id = document.getElementById('w_typist').value;
    const file_title = document.getElementById('w_title').value.trim();
    const pages = parseInt(toEnglishDigits(document.getElementById('w_pages').value));
    const is_delivered = document.getElementById('w_delivered').checked;

    if (!typist_id || !file_title || isNaN(pages)) {
        return alert("تمام فیلدهای عنوان و تعداد صفحات را وارد کنید.");
    }

    showLoading(true);
    const client = getSupabaseClient();

    const { data: tData } = await client.from('typists').select('page_rate').eq('id', typist_id);
    const currentRate = (tData && tData.length > 0) ? tData[0].page_rate : 0;

    const { error } = await client.from('work_records').insert([{
        typist_id,
        file_title,
        pages,
        is_delivered,
        page_rate: currentRate
    }]);

    showLoading(false);

    if (error) alert("خطا در ثبت کار.");
    else {
        document.getElementById('w_title').value = '';
        document.getElementById('w_pages').value = '';
        document.getElementById('w_delivered').checked = false;
        loadWorks();
    }
}

async function toggleDelivered(id, newStatus) {
    await getSupabaseClient().from('work_records').update({ is_delivered: newStatus }).eq('id', id);
    loadWorks();
}

async function toggleSettled(id, newStatus) {
    await getSupabaseClient().from('work_records').update({ is_settled: newStatus }).eq('id', id);
    loadWorks();
}

async function deleteWork(id) {
    if (!confirm("آیا از حذف این کار ثبت شده اطمینان دارید؟")) return;
    await getSupabaseClient().from('work_records').delete().eq('id', id);
    loadWorks();
}

// ۱۱. ثبت و مدیریت پرداختی‌ها (Payments)
async function loadPayments() {
    showLoading(true);
    const { data, error } = await getSupabaseClient()
        .from('payments')
        .select('*, typists(name, family)')
        .order('payment_date', { ascending: false })
        .limit(100);

    showLoading(false);
    if (error) return;

    const list = document.getElementById('paymentsList');
    if (!data || data.length === 0) {
        list.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-400">هیچ پرداخت مالی ثبت نشده است.</td></tr>`;
        return;
    }

    list.innerHTML = data.map(p => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 text-xs font-mono">${new Date(p.payment_date).toLocaleDateString('fa-IR')}</td>
            <td class="p-4 font-bold text-gray-800">${p.typists?.name || ''} ${p.typists?.family || ''}</td>
            <td class="p-4 text-center font-mono font-bold text-green-600">${formatCurrency(p.amount)} ریال</td>
            <td class="p-4 text-center">
                <button onclick="deletePayment(${p.id})" class="text-red-500 hover:text-red-700 p-1">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function addPayment() {
    const typist_id = document.getElementById('p_typist').value;
    const amount = parseInt(toEnglishDigits(document.getElementById('p_amount').value));

    if (!typist_id || isNaN(amount) || amount <= 0) {
        return alert("مبلغ واریزی را به درستی وارد کنید.");
    }

    showLoading(true);
    const { error } = await getSupabaseClient()
        .from('payments')
        .insert([{ typist_id, amount }]);

    showLoading(false);

    if (error) alert("خطا در ثبت پرداخت.");
    else {
        document.getElementById('p_amount').value = '';
        loadPayments();
    }
}

async function deletePayment(id) {
    if (!confirm("آیا از حذف این تراکنش پرداختی اطمینان دارید؟")) return;
    await getSupabaseClient().from('payments').delete().eq('id', id);
    loadPayments();
}

// ۱۲. گزارش‌گیری جامع ادمین
async function loadAdminReport() {
    const start = document.getElementById('rep_start').value || null;
    const end = document.getElementById('rep_end').value || null;

    showLoading(true);
    const { data, error } = await getSupabaseClient().rpc('get_admin_report', { 
        p_start: start, 
        p_end: end 
    });
    showLoading(false);

    if (error) {
        console.error(error);
        return alert("خطا در دریافت گزارش محاسباتی.");
    }

    if (data && data[0]) {
        const r = data[0];
        document.getElementById('adminReportResults').innerHTML = `
            <div class="bg-blue-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-100">
                <p class="text-xs opacity-80 mb-1">کل صفحات تایپ شده</p>
                <h3 class="text-3xl font-black">${formatCurrency(r.total_pages || 0)}</h3>
            </div>
            <div class="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-indigo-100">
                <p class="text-xs opacity-80 mb-1">ارزش کل کارکرد (تومان)</p>
                <h3 class="text-3xl font-black">${formatCurrency((r.total_work_value || 0))}</h3>
            </div>
            <div class="bg-green-600 text-white p-6 rounded-2xl shadow-lg shadow-green-100">
                <p class="text-xs opacity-80 mb-1">کل پرداختی‌ها (ریال)</p>
                <h3 class="text-3xl font-black">${formatCurrency(r.total_paid || 0)}</h3>
            </div>
            <div class="bg-orange-500 text-white p-6 rounded-2xl shadow-lg shadow-orange-100">
                <p class="text-xs opacity-80 mb-1">کل بدهی سامانه به تایپیست‌ها (ریال)</p>
                <h3 class="text-3xl font-black">${formatCurrency(r.total_remaining || 0)}</h3>
            </div>
        `;
    }
}

// ۱۳. ابزارها و خروجی‌های CSV
function toggleSelectAll() {
    const master = document.getElementById('selectAll');
    document.querySelectorAll('.typist-checkbox').forEach(cb => cb.checked = master.checked);
}

function sendGroupSMS() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.typist-checkbox:checked'));
    const phones = selectedCheckboxes.map(cb => cb.value).filter(p => p && p.trim() !== '');

    if (phones.length === 0) {
        return alert("حداقل یک تایپیست دارای شماره تماس را انتخاب کنید.");
    }

    const body = encodeURIComponent("با سلام، لطفا وضعیت کارهای خود را در سامانه تایپ بررسی نمایید.");
    window.location.href = `sms:${phones.join(',')}?body=${body}`;
}

async function exportPersonnelCSV() {
    showLoading(true);
    const { data } = await getSupabaseClient().from('typists').select('*').order('name');
    showLoading(false);

    if (!data || data.length === 0) return alert("داده‌ای برای خروجی وجود ندارد.");

    let csvContent = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا\n";
    data.forEach((t, index) => {
        csvContent += `${index + 1},${t.name || ''},${t.family || ''},${t.father_name || ''},${t.id},${t.phone || ''},${t.card_number || ''},${t.shaba || ''}\n`;
    });

    downloadCSVFile(csvContent, "typists-list.csv");
}

async function exportBankCSV() {
    showLoading(true);
    const client = getSupabaseClient();
    const { data: typists } = await client.from('typists').select('*').order('name');

    if (!typists || typists.length === 0) {
        showLoading(false);
        return alert("تایپیستی یافت نشد.");
    }

    let csvContent = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ پرداختی به ریال\n";
    let count = 0;

    for (let i = 0; i < typists.length; i++) {
        const t = typists[i];
        const { data: stats } = await client.rpc('get_typist_report', { p_typist_id: t.id, p_start: null, p_end: null });
        const balanceRial = stats && stats[0] ? (stats[0].remaining_balance || 0) : 0;

        if (balanceRial > 0) {
            count++;
            csvContent += `${count},${t.name || ''},${t.family || ''},${t.father_name || ''},${t.id},${t.phone || ''},${t.card_number || ''},${t.shaba || ''},${balanceRial}\n`;
        }
    }

    showLoading(false);

    if (count === 0) {
        alert("هیچ تایپیستی مانده طلبکارانه ندارد.");
    } else {
        downloadCSVFile(csvContent, "bank-payments-paya.csv");
    }
}

function downloadCSVFile(content, fileName) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ۱۴. لیسنرها و شروع خودکار برنامه
document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
            closeChangePassModal();
        }
    });
});

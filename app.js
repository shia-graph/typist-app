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

function getSupabaseClient() {
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabaseClient;
}

// توابع کمکی تبدیل و فرمت
const toEnglishDigits = (str) => {
    if (str === null || str === undefined) return "";
    return str.toString()
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, d => "٠١٢٣٥٦٧٨٩".indexOf(d));
};

const formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return new Intl.NumberFormat('fa-IR').format(num);
};

function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

// توابع استخراج امن فیلدهای تایپیست
function getTypistFullName(t) {
    if (!t) return "کاربر سیستم";
    if (t.first_name || t.last_name) {
        return (t.first_name || '') + ' ' + (t.last_name || '');
    }
    return t.name || t.id || "تایپیست";
}

function getTypistPhone(t) {
    return t.phone || "";
}

function getTypistCard(t) {
    return t.card_number || t.account_number || "";
}

function getTypistSheba(t) {
    return t.sheba_number || t.shaba || t.iban || "";
}

function getTypistNationalId(t) {
    return t.national_id || t.national_code || t.id || "";
}

// سیستم لاگین هوشمند با پشتیبانی از کد ملی، شماره موبایل و شناسه GUID
async function login() {
    const rawId = document.getElementById('loginId').value.trim();
    const idInput = toEnglishDigits(rawId).toLowerCase();
    const passInput = toEnglishDigits(document.getElementById('loginPass').value.trim());

    if (!idInput || !passInput) {
        return alert("لطفاً نام کاربری (کد ملی یا شماره تماس) و رمز عبور را وارد کنید.");
    }

    showLoading(true);
    const client = getSupabaseClient();

    try {
        // ۱. بررسی لاگین ادمین
        if (idInput === 'admin') {
            const { data: adminData, error: adminErr } = await client
                .from('admin_settings')
                .select('*')
                .eq('id', 'admin');

            if (!adminErr && adminData && adminData.length > 0) {
                if (adminData[0].password === passInput) {
                    saveSession(adminData[0], true);
                    return;
                }
            }
        }

        // ۲. بررسی لاگین تایپیست‌ها
        const { data: typistsData, error: tErr } = await client
            .from('typists')
            .select('*');

        if (!tErr && typistsData && typistsData.length > 0) {
            const matchedUser = typistsData.find(t => {
                const phone = (t.phone || '').trim();
                const nationalId = (t.national_id || '').trim();
                const id = (t.id || '').trim();
                return (idInput === phone) || (idInput === nationalId) || (idInput === id);
            });

            if (matchedUser) {
                const phone = matchedUser.phone || '';
                const defaultPass = phone ? phone.slice(-4) : "1234";
                const actualPass = matchedUser.password || defaultPass;

                if (passInput === actualPass || passInput === defaultPass || passInput === "1234") {
                    saveSession(matchedUser, false);
                    return;
                }
            }
        }

        alert("نام کاربری (کد ملی / شماره تماس) یا رمز عبور اشتباه است.");
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
                alert("حساب کاربری یافت نشد یا تغییر یافته است.");
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

// ناوبری صفحات و تب‌ها
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

    if (window.event && window.event.currentTarget && window.event.currentTarget.classList.contains('tab-btn')) {
        window.event.currentTarget.classList.remove('bg-gray-200', 'text-gray-700');
        window.event.currentTarget.classList.add('bg-blue-600', 'text-white');
    }

    if (tab === 'typists') loadTypists();
    if (tab === 'work') { loadTypistDropdowns(); loadWorks(); }
    if (tab === 'payments') { loadTypistDropdowns(); loadPayments(); }
    if (tab === 'reports') loadAdminReport();
}

async function initApp() {
    showSection('app');
    document.getElementById('userBadge').innerText = isAdmin ? "مدیر سیستم" : "پنل تایپیست";
    document.getElementById('userNameDisplay').innerText = isAdmin ? (currentUser.name || "مدیر سیستم") : getTypistFullName(currentUser);

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

// پنل تایپیست
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
            .or(`typist_id.eq.${currentUser.id},person_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });

        const list = document.getElementById('myWorksList');
        if (works && works.length > 0) {
            let html = '';
            for (let i = 0; i < works.length; i++) {
                const w = works[i];
                const title = w.title || w.file_title || 'بدون عنوان';
                const pages = w.page_count || w.quantity || w.pages || 0;
                const dateStr = w.record_date || w.created_at;
                const isDelivered = w.is_delivered || w.completed || (w.status === 'completed');
                const isSettled = w.is_settled || false;
                const dDate = new Date(dateStr).toLocaleDateString('fa-IR');

                const delTag = isDelivered ? '<span class="text-green-600 font-bold">✔️ تحویل شده</span>' : '<span class="text-gray-400">❌ در حال انجام</span>';
                const setTag = isSettled ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">✔️ تسویه کامل</span>' : '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-bold">⏳ در انتظار تسویه</span>';

                html += '<tr class="hover:bg-gray-50 transition-colors">';
                html += '<td class="p-4 text-xs font-mono">' + dDate + '</td>';
                html += '<td class="p-4 font-bold text-gray-800">' + title + '</td>';
                html += '<td class="p-4 text-center font-bold text-blue-600">' + pages + '</td>';
                html += '<td class="p-4 text-center">' + delTag + '</td>';
                html += '<td class="p-4 text-center">' + setTag + '</td>';
                html += '</tr>';
            }
            list.innerHTML = html;
        } else {
            list.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400">هیچ کاری برای شما ثبت نشده است.</td></tr>';
        }

        document.getElementById('p_name').value = currentUser.first_name || currentUser.name || '';
        document.getElementById('p_family').value = currentUser.last_name || currentUser.family || '';
        document.getElementById('p_father').value = currentUser.father_name || '';
        document.getElementById('p_phone').value = getTypistPhone(currentUser);
        document.getElementById('p_card').value = getTypistCard(currentUser);
        document.getElementById('p_shaba').value = getTypistSheba(currentUser);

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
        first_name: document.getElementById('p_name').value.trim(),
        last_name: document.getElementById('p_family').value.trim(),
        name: (document.getElementById('p_name').value.trim() + ' ' + document.getElementById('p_family').value.trim()).trim(),
        father_name: document.getElementById('p_father').value.trim(),
        phone: toEnglishDigits(document.getElementById('p_phone').value.trim()),
        card_number: toEnglishDigits(document.getElementById('p_card').value.trim()),
        sheba_number: toEnglishDigits(document.getElementById('p_shaba').value.trim())
    };

    showLoading(true);
    const { error } = await getSupabaseClient()
        .from('typists')
        .update(updateData)
        .eq('id', currentUser.id);
    
    showLoading(false);

    if (error) {
        alert("خطا در ذخیره اطلاعات پروفایل.");
    } else {
        alert("پروفایل شما با موفقیت بروزرسانی شد.");
        currentUser = { ...currentUser, ...updateData };
        initApp();
    }
}

// پنل مدیریت تایپیست‌ها توسط ادمین
async function loadTypists() {
    showLoading(true);
    const { data, error } = await getSupabaseClient()
        .from('typists')
        .select('*')
        .order('created_at', { ascending: false });

    showLoading(false);
    if (error) return alert("خطا در دریافت لیست تایپیست‌ها.");

    allTypistsCache = data || [];
    renderTypistsTable(allTypistsCache);
}

function renderTypistsTable(listData) {
    const list = document.getElementById('typistsList');
    if (!listData || listData.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-gray-400">هیچ تایپیستی یافت نشد.</td></tr>';
        return;
    }

    let html = '';
    for (let i = 0; i < listData.length; i++) {
        const t = listData[i];
        const fullName = getTypistFullName(t);
        const phone = getTypistPhone(t);
        const nationalId = getTypistNationalId(t);
        const rate = t.page_rate || t.rate_per_word || t.default_page_rate || 0;

        let callBtn = '';
        if (phone) {
            callBtn = '<a href="tel:' + phone + '" class="bg-green-100 text-green-700 p-2 rounded-xl text-xs font-bold hover:bg-green-200">📞 تماس</a>';
        }
        let smsBtn = '';
        if (phone) {
            smsBtn = '<a href="sms:' + phone + '" class="bg-blue-100 text-blue-700 p-2 rounded-xl text-xs font-bold hover:bg-blue-200">✉️ پیامک</a>';
        }

        html += '<tr class="hover:bg-gray-50 transition-colors">';
        html += '<td class="p-4 text-center"><input type="checkbox" class="typist-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-500" value="' + phone + '" data-id="' + t.id + '"></td>';
        html += '<td class="p-4 font-mono font-bold text-gray-700 text-xs">' + nationalId + '</td>';
        html += '<td class="p-4 font-bold text-gray-900">' + fullName + '</td>';
        html += '<td class="p-4 text-center font-bold text-blue-600">' + formatCurrency(rate) + ' تومان</td>';
        html += '<td class="p-4 text-center"><div class="flex items-center justify-center gap-2">' + callBtn + ' ' + smsBtn + '</div></td>';
        html += '<td class="p-4 text-center">';
        html += '<div class="flex items-center justify-center gap-2">';
        html += '<button onclick="openEditModal(\'' + t.id + '\')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl font-bold text-xs">✏️ ویرایش</button>';
        html += '<button onclick="resetPasswordModal(\'' + t.id + '\')" class="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-3 py-1.5 rounded-xl font-bold text-xs">🔑 ریست رمز</button>';
        html += '<button onclick="deleteTypist(\'' + t.id + '\')" class="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl font-bold text-xs">🗑️ حذف</button>';
        html += '</div></td></tr>';
    }
    list.innerHTML = html;
}

function filterTypists() {
    const query = toEnglishDigits(document.getElementById('searchTypist').value.trim().toLowerCase());
    const filtered = allTypistsCache.filter(t => {
        const fullName = getTypistFullName(t).toLowerCase();
        const phone = getTypistPhone(t);
        const nationalId = getTypistNationalId(t);
        return fullName.includes(query) || phone.includes(query) || nationalId.includes(query);
    });
    renderTypistsTable(filtered);
}

async function addTypist() {
    const national_id = toEnglishDigits(document.getElementById('t_id').value.trim());
    const first_name = document.getElementById('t_name').value.trim();
    const last_name = document.getElementById('t_family').value.trim();
    const phone = toEnglishDigits(document.getElementById('t_phone').value.trim());
    const pass = toEnglishDigits(document.getElementById('t_pass').value.trim());
    const rate = parseInt(toEnglishDigits(document.getElementById('t_rate').value.trim()));

    if (!first_name || isNaN(rate)) {
        return alert("نام تایپیست و نرخ صفحه الزامی هستند.");
    }

    showLoading(true);
    const defaultPass = phone ? phone.slice(-4) : "1234";

    const { error } = await getSupabaseClient()
        .from('typists')
        .insert([{
            national_id: national_id,
            first_name: first_name,
            last_name: last_name,
            name: (first_name + ' ' + last_name).trim(),
            phone: phone,
            password: pass || defaultPass,
            page_rate: rate
        }]);

    showLoading(false);

    if (error) {
        alert("خطا در ثبت تایپیست جدید.");
    } else {
        alert("تایپیست با موفقیت ثبت شد.");
        ['t_id','t_name','t_family','t_phone','t_pass','t_rate'].forEach(id => document.getElementById(id).value = '');
        loadTypists();
    }
}

async function deleteTypist(id) {
    if (!confirm("آیا از حذف این تایپیست و کارهای ثبت‌شده او اطمینان دارید؟")) return;

    showLoading(true);
    const client = getSupabaseClient();
    try {
        await client.from('work_records').delete().or(`typist_id.eq.${id},person_id.eq.${id}`);
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

// ویرایش مودال تایپیست
function openEditModal(id) {
    const t = allTypistsCache.find(x => x.id === id);
    if (!t) return;

    document.getElementById('edit_t_id').value = t.id;
    document.getElementById('edit_t_name').value = t.first_name || t.name || '';
    document.getElementById('edit_t_family').value = t.last_name || t.family || '';
    document.getElementById('edit_t_father').value = t.father_name || '';
    document.getElementById('edit_t_phone').value = getTypistPhone(t);
    document.getElementById('edit_t_rate').value = t.page_rate || t.rate_per_word || 0;
    document.getElementById('edit_t_card').value = getTypistCard(t);
    document.getElementById('edit_t_shaba').value = getTypistSheba(t);

    document.getElementById('editTypistModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editTypistModal').classList.add('hidden');
}

async function saveTypistModalEdit() {
    const id = document.getElementById('edit_t_id').value;
    const fName = document.getElementById('edit_t_name').value.trim();
    const lName = document.getElementById('edit_t_family').value.trim();

    const updateData = {
        first_name: fName,
        last_name: lName,
        name: (fName + ' ' + lName).trim(),
        father_name: document.getElementById('edit_t_father').value.trim(),
        phone: toEnglishDigits(document.getElementById('edit_t_phone').value.trim()),
        page_rate: parseInt(toEnglishDigits(document.getElementById('edit_t_rate').value.trim())),
        card_number: toEnglishDigits(document.getElementById('edit_t_card').value.trim()),
        sheba_number: toEnglishDigits(document.getElementById('edit_t_shaba').value.trim())
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

// تغییر رمز عبور
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
        const { error } = await client.from('admin_settings').update({ password: newPass }).eq('id', 'admin');
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

// ثبت کارکردها
async function loadTypistDropdowns() {
    const { data } = await getSupabaseClient().from('typists').select('*').order('name');
    if (!data) return;

    let options = '';
    for (let i = 0; i < data.length; i++) {
        const t = data[i];
        options += '<option value="' + t.id + '">' + getTypistFullName(t) + ' (' + getTypistPhone(t) + ')</option>';
    }
    document.getElementById('w_typist').innerHTML = options;
    document.getElementById('p_typist').innerHTML = options;
}

async function loadWorks() {
    showLoading(true);
    const { data, error } = await getSupabaseClient()
        .from('work_records')
        .select('*, typists(name, first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(100);

    showLoading(false);
    if (error) return;

    const list = document.getElementById('workList');
    if (!data || data.length === 0) {
        list.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-400">هیچ کاری ثبت نشده است.</td></tr>';
        return;
    }

    let html = '';
    for (let i = 0; i < data.length; i++) {
        const w = data[i];
        const typistName = w.typists ? getTypistFullName(w.typists) : 'ناشناس';
        const title = w.title || w.file_title || 'بدون عنوان';
        const pages = w.page_count || w.quantity || w.pages || 0;
        const dateStr = w.record_date || w.created_at;
        const isDelivered = w.is_delivered || w.completed || (w.status === 'completed');
        const isSettled = w.is_settled || false;
        const dDate = new Date(dateStr).toLocaleDateString('fa-IR');

        const delClass = isDelivered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500';
        const delText = isDelivered ? '✔️ تحویل شد' : '❌ تحویل نشده';

        const setClass = isSettled ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';
        const setText = isSettled ? '✔️ تسویه کامل' : '⏳ تسویه نشده';

        html += '<tr class="hover:bg-gray-50 transition-colors">';
        html += '<td class="p-4 text-xs font-mono">' + dDate + '</td>';
        html += '<td class="p-4 font-bold text-gray-800">' + typistName + '</td>';
        html += '<td class="p-4">' + title + '</td>';
        html += '<td class="p-4 text-center font-bold text-blue-600">' + pages + '</td>';
        html += '<td class="p-4 text-center"><button onclick="toggleDelivered(\'' + w.id + '\', ' + (!isDelivered) + ')" class="px-2.5 py-1 rounded-lg text-xs font-bold ' + delClass + '">' + delText + '</button></td>';
        html += '<td class="p-4 text-center"><button onclick="toggleSettled(\'' + w.id + '\', ' + (!isSettled) + ')" class="px-2.5 py-1 rounded-lg text-xs font-bold ' + setClass + '">' + setText + '</button></td>';
        html += '<td class="p-4 text-center"><button onclick="deleteWork(\'' + w.id + '\')" class="text-red-500 hover:text-red-700 p-1">🗑️</button></td>';
        html += '</tr>';
    }
    list.innerHTML = html;
}

async function addWork() {
    const typist_id = document.getElementById('w_typist').value;
    const title = document.getElementById('w_title').value.trim();
    const pages = parseInt(toEnglishDigits(document.getElementById('w_pages').value));
    const is_delivered = document.getElementById('w_delivered').checked;

    if (!typist_id || !title || isNaN(pages)) {
        return alert("تمام فیلدهای عنوان و تعداد صفحات را وارد کنید.");
    }

    showLoading(true);
    const client = getSupabaseClient();

    const { data: tData } = await client.from('typists').select('*').eq('id', typist_id);
    const currentRate = (tData && tData.length > 0) ? (tData[0].page_rate || tData[0].rate_per_word || 0) : 0;

    const { error } = await client.from('work_records').insert([{
        typist_id: typist_id,
        person_id: typist_id,
        title: title,
        file_title: title,
        page_count: pages,
        quantity: pages,
        is_delivered: is_delivered,
        completed: is_delivered,
        page_rate: currentRate,
        unit_rate: currentRate
    }]);

    showLoading(false);

    if (error) alert("خطا در ثبت کار جدید.");
    else {
        document.getElementById('w_title').value = '';
        document.getElementById('w_pages').value = '';
        document.getElementById('w_delivered').checked = false;
        loadWorks();
    }
}

async function toggleDelivered(id, newStatus) {
    await getSupabaseClient().from('work_records').update({ is_delivered: newStatus, completed: newStatus }).eq('id', id);
    loadWorks();
}

async function toggleSettled(id, newStatus) {
    await getSupabaseClient().from('work_records').update({ is_settled: newStatus }).eq('id', id);
    loadWorks();
}

async function deleteWork(id) {
    if (!confirm("آیا از حذف این کار ثبت‌شده اطمینان دارید؟")) return;
    await getSupabaseClient().from('work_records').delete().eq('id', id);
    loadWorks();
}

// پرداختی‌ها
async function loadPayments() {
    showLoading(true);
    const { data, error } = await getSupabaseClient()
        .from('payments')
        .select('*, typists(name, first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(100);

    showLoading(false);
    if (error) return;

    const list = document.getElementById('paymentsList');
    if (!data || data.length === 0) {
        list.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400">هیچ پرداخت مالی ثبت نشده است.</td></tr>';
        return;
    }

    let html = '';
    for (let i = 0; i < data.length; i++) {
        const p = data[i];
        const typistName = p.typists ? getTypistFullName(p.typists) : 'ناشناس';
        const dateStr = p.payment_date || p.created_at;
        const dDate = new Date(dateStr).toLocaleDateString('fa-IR');

        html += '<tr class="hover:bg-gray-50 transition-colors">';
        html += '<td class="p-4 text-xs font-mono">' + dDate + '</td>';
        html += '<td class="p-4 font-bold text-gray-800">' + typistName + '</td>';
        html += '<td class="p-4 text-center font-mono font-bold text-green-600">' + formatCurrency(p.amount) + ' ریال</td>';
        html += '<td class="p-4 text-center"><button onclick="deletePayment(\'' + p.id + '\')" class="text-red-500 hover:text-red-700 p-1">🗑️</button></td>';
        html += '</tr>';
    }
    list.innerHTML = html;
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

// گزارشات مالی جامع
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
        document.getElementById('adminReportResults').innerHTML = 
            '<div class="bg-blue-600 text-white p-6 rounded-2xl shadow-lg"><p class="text-xs opacity-80 mb-1">کل صفحات تایپ شده</p><h3 class="text-3xl font-black">' + formatCurrency(r.total_pages || 0) + '</h3></div>' +
            '<div class="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg"><p class="text-xs opacity-80 mb-1">ارزش کل کارکرد (تومان)</p><h3 class="text-3xl font-black">' + formatCurrency(r.total_work_value || 0) + '</h3></div>' +
            '<div class="bg-green-600 text-white p-6 rounded-2xl shadow-lg"><p class="text-xs opacity-80 mb-1">کل پرداختی‌ها (ریال)</p><h3 class="text-3xl font-black">' + formatCurrency(r.total_paid || 0) + '</h3></div>' +
            '<div class="bg-orange-500 text-white p-6 rounded-2xl shadow-lg"><p class="text-xs opacity-80 mb-1">کل بدهی سامانه به تایپیست‌ها (ریال)</p><h3 class="text-3xl font-black">' + formatCurrency(r.total_remaining || 0) + '</h3></div>';
    }
}

// ابزارها، پیامک گروهی و خروجی CSV
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
    window.location.href = 'sms:' + phones.join(',') + '?body=' + body;
}

async function exportPersonnelCSV() {
    showLoading(true);
    const { data } = await getSupabaseClient().from('typists').select('*').order('name');
    showLoading(false);

    if (!data || data.length === 0) return alert("داده‌ای برای خروجی وجود ندارد.");

    let csvContent = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا\n";
    for (let i = 0; i < data.length; i++) {
        const t = data[i];
        const fName = t.first_name || (t.name ? t.name.split(' ')[0] : '');
        const lName = t.last_name || (t.name ? t.name.split(' ').slice(1).join(' ') : '');
        const father = t.father_name || '';
        const nationalId = getTypistNationalId(t);
        const phone = getTypistPhone(t);
        const card = getTypistCard(t);
        const sheba = getTypistSheba(t);

        csvContent += (i + 1) + ',' + fName + ',' + lName + ',' + father + ',' + nationalId + ',' + phone + ',' + card + ',' + sheba + '\n';
    }

    downloadCSVFile(csvContent, "Personnel_List.csv");
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
        const balanceRial = stats && stats[0] ? ((stats[0].remaining_balance || 0) * 10) : 0;

        if (balanceRial > 0) {
            count++;
            const fName = t.first_name || (t.name ? t.name.split(' ')[0] : '');
            const lName = t.last_name || (t.name ? t.name.split(' ').slice(1).join(' ') : '');
            const father = t.father_name || '';
            const nationalId = getTypistNationalId(t);
            const phone = getTypistPhone(t);
            const card = getTypistCard(t);
            const sheba = getTypistSheba(t);

            csvContent += count + ',' + fName + ',' + lName + ',' + father + ',' + nationalId + ',' + phone + ',' + card + ',' + sheba + ',' + balanceRial + '\n';
        }
    }

    showLoading(false);

    if (count === 0) {
        alert("هیچ تایپیستی مانده طلبکارانه ندارد.");
    } else {
        downloadCSVFile(csvContent, "Bank_Payments_Paya.csv");
    }
}

// بکاپ جامع تمام دیتابیس (JSON)
async function exportFullDatabase() {
    showLoading(true);
    try {
        const client = getSupabaseClient();
        
        const { data: admins } = await client.from('admin_settings').select('*');
        const { data: typists } = await client.from('typists').select('*');
        const { data: works } = await client.from('work_records').select('*');
        const { data: payments } = await client.from('payments').select('*');

        const fullBackup = {
            export_date: new Date().toISOString(),
            export_date_jalali: new Date().toLocaleDateString('fa-IR'),
            summary: {
                total_admin_settings: admins?.length || 0,
                total_typists: typists?.length || 0,
                total_work_records: works?.length || 0,
                total_payments: payments?.length || 0
            },
            tables: {
                admin_settings: admins || [],
                typists: typists || [],
                work_records: works || [],
                payments: payments || []
            }
        };
        
        const jsonString = JSON.stringify(fullBackup, null, 4);
        downloadCSVFile(jsonString, "Database_Backup_" + new Date().toLocaleDateString('fa-IR') + ".json", "application/json;charset=utf-8;");
        
        alert("✅ بکاپ کامل دیتابیس دریافت شد.");
    } catch (error) {
        console.error("Backup Error:", error);
        alert("❌ خطا در دریافت بکاپ دیتابیس.");
    } finally {
        showLoading(false);
    }
}

function downloadCSVFile(content, fileName, mimeType = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// لیسنرها و مقداردهی اولیه
document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEditModal();
            closeChangePassModal();
        }
    });
});

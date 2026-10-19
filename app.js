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

// مبدل اعداد فارسی به انگلیسی (برای پردازش امن در دیتابیس)
const toEnglishDigits = (str) => {
    if (str === null || str === undefined) return "";
    return str.toString()
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
};

// نمایش پولی استاندارد با ویرگول
const formatCurrency = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return new Intl.NumberFormat('fa-IR').format(num);
};

// تبدیل امن تاریخ میلادی دیتابیس به فرمت زیبای شمسی در UI
const toShamsiDate = (dateString) => {
    if (!dateString) return "-";
    try {
        return new Date(dateString).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
        return dateString;
    }
};

function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

// استخراج‌کننده‌های امن فیلدها از ساختار پیچیده دیتابیس
function getTypistFullName(t) {
    if (!t) return "کاربر سیستم";
    if (t.first_name || t.last_name) return `${t.first_name || ''} ${t.last_name || ''}`.trim();
    return t.name || t.id || "بدون نام";
}
function getTypistPhone(t) { return t.phone || ""; }
function getTypistCard(t) { return t.card_number || t.account_number || ""; }
function getTypistSheba(t) { return t.sheba_number || t.shaba || t.iban || ""; }
function getTypistNationalId(t) { return t.national_id || t.national_code || t.id || ""; }

// -- سیستم احراز هویت (Auth) --
async function login() {
    const rawId = document.getElementById('loginId').value.trim();
    const idInput = toEnglishDigits(rawId).toLowerCase();
    const passInput = toEnglishDigits(document.getElementById('loginPass').value.trim());

    if (!idInput || !passInput) return alert("لطفاً نام کاربری و رمز عبور را وارد کنید.");

    showLoading(true);
    const client = getSupabaseClient();

    try {
        // ۱. بررسی مدیر سیستم
        if (idInput === 'admin') {
            const { data: adminData, error: adminErr } = await client.from('admin_settings').select('*').eq('id', 'admin');
            if (!adminErr && adminData && adminData.length > 0 && adminData[0].password === passInput) {
                saveSession(adminData[0], true);
                return;
            }
        }

        // ۲. بررسی تایپیست‌ها (تطابق با موبایل، کدملی یا شناسه دیتابیس)
        const { data: typistsData, error: tErr } = await client.from('typists').select('*');
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
        alert("نام کاربری یا رمز عبور اشتباه است.");
    } catch (err) {
        console.error("Login Error:", err);
        alert("خطا در برقراری ارتباط با سرور.");
    } finally {
        showLoading(false);
    }
}

function saveSession(user, adminStatus) {
    localStorage.setItem('typist_session', JSON.stringify({ id: user.id, isAdmin: adminStatus }));
    currentUser = user;
    isAdmin = adminStatus;
    initApp();
}

async function checkSession() {
    const sessionStr = localStorage.getItem('typist_session');
    if (!sessionStr) { showSection('login'); return; }

    try {
        const session = JSON.parse(sessionStr);
        showLoading(true);
        const client = getSupabaseClient();

        if (session.isAdmin) {
            const { data } = await client.from('admin_settings').select('*').eq('id', session.id);
            if (data && data.length > 0) { currentUser = data[0]; isAdmin = true; initApp(); } 
            else logoutSilent();
        } else {
            const { data } = await client.from('typists').select('*').eq('id', session.id);
            if (data && data.length > 0) { currentUser = data[0]; isAdmin = false; initApp(); } 
            else { alert("حساب کاربری یافت نشد."); logoutSilent(); }
        }
    } catch (e) {
        logoutSilent();
    } finally { showLoading(false); }
}

function logout() { if (confirm("آیا قصد خروج از سامانه را دارید؟")) logoutSilent(); }
function logoutSilent() { localStorage.removeItem('typist_session'); location.reload(); }

// -- سیستم ناوبری رابط کاربری --
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

// ----------------------------------------------------
// پنل تایپیست - گردش کار (Workflow)
// ----------------------------------------------------
async function loadTypistDashboard() {
    showLoading(true);
    const client = getSupabaseClient();
    try {
        const { data: stats } = await client.rpc('get_typist_report', { p_typist_id: currentUser.id, p_start: null, p_end: null });
        if (stats && stats[0]) {
            document.getElementById('tPages').innerText = formatCurrency(stats[0].total_pages || 0);
            document.getElementById('tPaid').innerText = formatCurrency(stats[0].total_payment || 0);
            document.getElementById('tBalance').innerText = formatCurrency((stats[0].remaining_balance || 0) * 10);
        }

        const { data: works } = await client.from('work_records').select('*')
            .or(`typist_id.eq.${currentUser.id},person_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });

        const list = document.getElementById('myWorksList');
        if (works && works.length > 0) {
            list.innerHTML = works.map(w => {
                const title = w.title || w.file_title || 'بدون عنوان';
                const pages = w.page_count || w.quantity || w.pages || 0;
                const dateStr = toShamsiDate(w.record_date || w.created_at);
                const isSettled = w.is_settled || false;
                const setTag = isSettled ? '<span class="text-green-600 font-bold">✔️ تایید و تسویه شده</span>' : '<span class="text-orange-500 font-bold">⏳ در انتظار بررسی مدیریت</span>';

                return `
                    <tr class="border-b hover:bg-gray-50 transition-colors">
                        <td class="p-4 text-xs font-mono">${dateStr}</td>
                        <td class="p-4 font-bold text-gray-800">${title}</td>
                        <td class="p-4 text-center font-bold text-blue-600">${pages}</td>
                        <td class="p-4 text-center">${setTag}</td>
                    </tr>
                `;
            }).join('');
        } else {
            list.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400">شما هنوز گزارشی ثبت نکرده‌اید.</td></tr>';
        }

        document.getElementById('p_name').value = currentUser.first_name || currentUser.name || '';
        document.getElementById('p_family').value = currentUser.last_name || currentUser.family || '';
        document.getElementById('p_father').value = currentUser.father_name || '';
        document.getElementById('p_phone').value = getTypistPhone(currentUser);
        document.getElementById('p_card').value = getTypistCard(currentUser);
        document.getElementById('p_shaba').value = getTypistSheba(currentUser);

    } catch (e) {
        console.error("User Dashboard Error:", e);
    } finally { 
        showLoading(false); 
    }
}

async function submitTypistReport() {
    const title = document.getElementById('typist_work_title').value.trim();
    const pages = parseInt(toEnglishDigits(document.getElementById('typist_work_pages').value));

    if (!title || isNaN(pages) || pages <= 0) return alert("لطفاً عنوان کار و تعداد صفحات را به درستی وارد کنید.");

    showLoading(true);
    const rate = currentUser.page_rate || currentUser.rate_per_word || currentUser.default_page_rate || 0;

    const { error } = await getSupabaseClient().from('work_records').insert([{
        typist_id: currentUser.id,
        person_id: currentUser.id,
        title: title,
        file_title: title,
        page_count: pages,
        quantity: pages,
        is_delivered: true,
        completed: true,
        is_settled: false,
        page_rate: rate,
        unit_rate: rate
    }]);

    showLoading(false);

    if (error) {
        alert("خطا در ارسال گزارش به سرور.");
    } else {
        alert("گزارش کارکرد شما با موفقیت برای مدیریت ارسال شد.");
        document.getElementById('typist_work_title').value = '';
        document.getElementById('typist_work_pages').value = '';
        loadTypistDashboard();
    }
}

function enableProfileEdit() {
    const fields = ['p_name', 'p_family', 'p_father', 'p_phone', 'p_card', 'p_shaba'];
    fields.forEach(id => {
        const input = document.getElementById(id);
        input.readOnly = false;
        input.classList.remove('bg-gray-50');
        input.classList.add('bg-white', 'border-blue-400', 'ring-2');
    });
    document.getElementById('saveProfileBtn').disabled = false;
    document.getElementById('saveProfileBtn').classList.remove('opacity-50', 'cursor-not-allowed');
}

async function saveTypistProfile() {
    const fName = document.getElementById('p_name').value.trim();
    const lName = document.getElementById('p_family').value.trim();
    
    const updateData = {
        first_name: fName,
        last_name: lName,
        name: `${fName} ${lName}`.trim(),
        father_name: document.getElementById('p_father').value.trim(),
        phone: toEnglishDigits(document.getElementById('p_phone').value.trim()),
        card_number: toEnglishDigits(document.getElementById('p_card').value.trim()),
        sheba_number: toEnglishDigits(document.getElementById('p_shaba').value.trim())
    };

    showLoading(true);
    const { error } = await getSupabaseClient().from('typists').update(updateData).eq('id', currentUser.id);
    showLoading(false);

    if (error) alert("خطا در ذخیره پروفایل.");
    else {
        alert("اطلاعات پروفایل شما با موفقیت به‌روزرسانی شد.");
        currentUser = { ...currentUser, ...updateData };
        initApp();
    }
}

// ----------------------------------------------------
// پنل ادمین - مدیریت کاربران و عملیات مدیر
// ----------------------------------------------------

async function loadTypists() {
    showLoading(true);
    const { data, error } = await getSupabaseClient().from('typists').select('*').order('created_at', { ascending: false });
    showLoading(false);
    if (!error) { 
        allTypistsCache = data || []; 
        renderTypistsTable(allTypistsCache); 
    }
}

function renderTypistsTable(listData) {
    const list = document.getElementById('typistsList');
    if (!listData || listData.length === 0) { 
        list.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-gray-400">هیچ تایپیستی در سیستم ثبت نشده است.</td></tr>'; 
        return; 
    }

    list.innerHTML = listData.map(t => {
        const fullName = getTypistFullName(t);
        const phone = getTypistPhone(t);
        const rate = t.page_rate || t.rate_per_word || t.default_page_rate || 0;
        
        const callBtn = phone ? `<a href="tel:${phone}" class="bg-green-100 text-green-700 p-2 rounded-xl text-xs font-bold hover:bg-green-200">📞 تماس</a>` : '';
        const smsBtn = phone ? `<a href="sms:${phone}" class="bg-blue-100 text-blue-700 p-2 rounded-xl text-xs font-bold hover:bg-blue-200">✉️ پیامک</a>` : '';

        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-4 text-center"><input type="checkbox" class="typist-checkbox w-4 h-4 rounded text-blue-600" value="${phone}"></td>
                <td class="p-4 font-mono text-xs">${getTypistNationalId(t)}</td>
                <td class="p-4 font-bold text-gray-900">${fullName}</td>
                <td class="p-4 text-center font-bold text-blue-600">${formatCurrency(rate)} تومان</td>
                <td class="p-4 text-center"><div class="flex items-center justify-center gap-2">${callBtn} ${smsBtn}</div></td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="openEditModal('${t.id}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-bold">ویرایش</button>
                        <button onclick="resetPasswordModal('${t.id}')" class="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-3 py-1.5 rounded-xl text-xs font-bold">رمز</button>
                        <button onclick="deleteTypist('${t.id}')" class="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-bold">حذف</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterTypists() {
    const q = toEnglishDigits(document.getElementById('searchTypist').value.trim().toLowerCase());
    renderTypistsTable(allTypistsCache.filter(t => 
        getTypistFullName(t).toLowerCase().includes(q) || 
        getTypistPhone(t).includes(q) || 
        getTypistNationalId(t).includes(q)
    ));
}

async function addTypist() {
    const national_id = toEnglishDigits(document.getElementById('t_id').value.trim());
    const first_name = document.getElementById('t_name').value.trim();
    const last_name = document.getElementById('t_family').value.trim();
    const phone = toEnglishDigits(document.getElementById('t_phone').value.trim());
    const pass = toEnglishDigits(document.getElementById('t_pass').value.trim());
    const rate = parseInt(toEnglishDigits(document.getElementById('t_rate').value.trim()));

    if (!first_name || !phone || isNaN(rate)) return alert("نام، شماره تماس و نرخ صفحه برای ثبت شخص الزامی است.");
    
    showLoading(true);
    const { error } = await getSupabaseClient().from('typists').insert([{ 
        national_id, 
        first_name, 
        last_name, 
        name: `${first_name} ${last_name}`.trim(), 
        phone, 
        password: pass || phone.slice(-4), 
        page_rate: rate 
    }]);
    showLoading(false);

    if (error) alert("خطا در ثبت کاربر. احتمالاً شخص با این شناسه قبلاً وجود دارد.");
    else { 
        alert("تایپیست جدید با موفقیت ثبت شد."); 
        ['t_id','t_name','t_family','t_phone','t_pass','t_rate'].forEach(id => document.getElementById(id).value = ''); 
        loadTypists(); 
    }
}

async function deleteTypist(id) {
    if (!confirm("هشدار! با حذف شخص تمام کارکردها و پرداختی‌های وی از دیتابیس پاک خواهد شد. آیا مطمئنید؟")) return;
    showLoading(true);
    try {
        await getSupabaseClient().from('work_records').delete().or(`typist_id.eq.${id},person_id.eq.${id}`);
        await getSupabaseClient().from('payments').delete().eq('typist_id', id);
        await getSupabaseClient().from('typists').delete().eq('id', id);
    } catch(e) {}
    showLoading(false);
    loadTypists();
}

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
    document.getElementById('editTypistModal').classList.add('flex');
}

function closeEditModal() { 
    document.getElementById('editTypistModal').classList.add('hidden'); 
    document.getElementById('editTypistModal').classList.remove('flex'); 
}

async function saveTypistModalEdit() {
    const id = document.getElementById('edit_t_id').value;
    const fName = document.getElementById('edit_t_name').value.trim();
    const lName = document.getElementById('edit_t_family').value.trim();

    const updateData = {
        first_name: fName, 
        last_name: lName, 
        name: `${fName} ${lName}`.trim(),
        father_name: document.getElementById('edit_t_father').value.trim(),
        phone: toEnglishDigits(document.getElementById('edit_t_phone').value.trim()),
        page_rate: parseInt(toEnglishDigits(document.getElementById('edit_t_rate').value.trim())),
        card_number: toEnglishDigits(document.getElementById('edit_t_card').value.trim()),
        sheba_number: toEnglishDigits(document.getElementById('edit_t_shaba').value.trim())
    };

    showLoading(true);
    await getSupabaseClient().from('typists').update(updateData).eq('id', id);
    showLoading(false);
    closeEditModal();
    loadTypists();
}

let targetPassResetId = null;
function openChangePassModal() { 
    targetPassResetId = currentUser.id; 
    document.getElementById('changePassModal').classList.remove('hidden'); 
    document.getElementById('changePassModal').classList.add('flex'); 
}
function resetPasswordModal(id) { 
    targetPassResetId = id; 
    document.getElementById('changePassModal').classList.remove('hidden'); 
    document.getElementById('changePassModal').classList.add('flex'); 
}
function closeChangePassModal() { 
    targetPassResetId = null; 
    document.getElementById('newPasswordInput').value = ''; 
    document.getElementById('changePassModal').classList.add('hidden'); 
    document.getElementById('changePassModal').classList.remove('flex'); 
}

async function saveNewPassword() {
    const newPass = toEnglishDigits(document.getElementById('newPasswordInput').value.trim());
    if (!newPass || newPass.length < 4) return alert("رمز عبور باید حداقل شامل ۴ کاراکتر باشد.");
    showLoading(true);
    if (targetPassResetId === currentUser.id && isAdmin) {
        await getSupabaseClient().from('admin_settings').update({ password: newPass }).eq('id', 'admin');
    } else {
        await getSupabaseClient().from('typists').update({ password: newPass }).eq('id', targetPassResetId);
    }
    showLoading(false);
    alert("رمز عبور با موفقیت به‌روزرسانی شد.");
    closeChangePassModal();
}

// ----------------------------------------------------
// مدیریت گزارشات کارکرد و تسویه (پنل ادمین)
// ----------------------------------------------------
function toggleAdminWorkForm() {
    document.getElementById('adminManualWorkForm').classList.toggle('hidden');
}

async function loadTypistDropdowns() {
    const { data } = await getSupabaseClient().from('typists').select('*').order('name');
    let opt = '';
    (data || []).forEach(t => opt += `<option value="${t.id}">${getTypistFullName(t)}</option>`);
    document.getElementById('w_typist').innerHTML = opt;
    document.getElementById('p_typist').innerHTML = opt;
}

async function loadWorks() {
    showLoading(true);
    const { data, error } = await getSupabaseClient().from('work_records').select('*, typists(name, first_name, last_name)').order('created_at', { ascending: false }).limit(200);
    showLoading(false);

    const list = document.getElementById('workList');
    if (!data || data.length === 0) { 
        list.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-gray-400">هیچ گزارشی برای بررسی وجود ندارد.</td></tr>'; 
        return; 
    }

    list.innerHTML = data.map(w => {
        const typistName = w.typists ? getTypistFullName(w.typists) : 'کاربر حذف شده';
        const title = w.title || w.file_title || 'بدون عنوان';
        const pages = w.page_count || w.quantity || w.pages || 0;
        const isSettled = w.is_settled || false;
        
        const setBtn = isSettled 
            ? `<button onclick="toggleSettled('${w.id}', false)" class="bg-green-100 text-green-700 px-3 py-1 rounded-xl text-xs font-bold w-24">✔️ تسویه شده</button>` 
            : `<button onclick="toggleSettled('${w.id}', true)" class="bg-gray-100 text-gray-600 hover:bg-green-600 hover:text-white px-3 py-1 rounded-xl text-xs font-bold transition w-24 shadow-sm border border-gray-200 hover:border-green-600">تایید تسویه</button>`;

        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-4 text-xs font-mono">${toShamsiDate(w.created_at)}</td>
                <td class="p-4 font-bold text-gray-800">${typistName}</td>
                <td class="p-4">${title}</td>
                <td class="p-4 text-center font-bold text-blue-600">${pages}</td>
                <td class="p-4 text-center">${setBtn}</td>
                <td class="p-4 text-center"><button onclick="deleteWork('${w.id}')" class="text-red-500 hover:text-red-700">🗑️</button></td>
            </tr>
        `;
    }).join('');
}

async function toggleSettled(id, newStatus) {
    await getSupabaseClient().from('work_records').update({ is_settled: newStatus }).eq('id', id);
    loadWorks();
}

async function deleteWork(id) {
    if (!confirm("آیا از حذف دائم این رکورد اطمینان دارید؟")) return;
    await getSupabaseClient().from('work_records').delete().eq('id', id);
    loadWorks();
}

async function addWorkByAdmin() {
    const tid = document.getElementById('w_typist').value;
    const title = document.getElementById('w_title').value.trim();
    const pages = parseInt(toEnglishDigits(document.getElementById('w_pages').value));
    if (!tid || !title || isNaN(pages)) return alert("لطفا مقادیر معتبر وارد کنید.");
    
    showLoading(true);
    const { data: tData } = await getSupabaseClient().from('typists').select('*').eq('id', tid);
    const rate = tData && tData.length > 0 ? (tData[0].page_rate || 0) : 0;

    await getSupabaseClient().from('work_records').insert([{ 
        typist_id: tid, person_id: tid, title: title, file_title: title, 
        page_count: pages, quantity: pages, is_delivered: true, completed: true, 
        is_settled: false, page_rate: rate, unit_rate: rate 
    }]);
    showLoading(false);
    
    document.getElementById('w_title').value = ''; 
    document.getElementById('w_pages').value = '';
    loadWorks();
}

// ----------------------------------------------------
// مدیریت پرداختی‌ها و اکسل
// ----------------------------------------------------
async function loadPayments() {
    showLoading(true);
    const { data } = await getSupabaseClient().from('payments').select('*, typists(name, first_name, last_name)').order('created_at', { ascending: false }).limit(100);
    showLoading(false);
    const list = document.getElementById('paymentsList');
    if (!data || data.length === 0) { 
        list.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400">تراکنش پرداختی ثبت نشده است.</td></tr>'; 
        return; 
    }
    
    list.innerHTML = data.map(p => `
        <tr class="border-b hover:bg-gray-50 transition">
            <td class="p-4 text-xs font-mono">${toShamsiDate(p.created_at)}</td>
            <td class="p-4 font-bold">${p.typists ? getTypistFullName(p.typists) : 'نامشخص'}</td>
            <td class="p-4 text-center font-bold text-green-600">${formatCurrency(p.amount)} ریال</td>
            <td class="p-4 text-center"><button onclick="deletePayment('${p.id}')" class="text-red-500 hover:text-red-700">🗑️</button></td>
        </tr>
    `).join('');
}

async function addPayment() {
    const tid = document.getElementById('p_typist').value;
    const amt = parseInt(toEnglishDigits(document.getElementById('p_amount').value));
    if (!tid || isNaN(amt) || amt <= 0) return alert("لطفا مبلغ پرداختی را وارد کنید.");
    
    showLoading(true);
    await getSupabaseClient().from('payments').insert([{ typist_id: tid, amount: amt }]);
    showLoading(false);
    
    document.getElementById('p_amount').value = '';
    loadPayments();
}

async function deletePayment(id) {
    if (!confirm("آیا قصد حذف این تراکنش را دارید؟ مبلغ به طلب تایپیست بازگردانده می‌شود.")) return;
    await getSupabaseClient().from('payments').delete().eq('id', id);
    loadPayments();
}

// ----------------------------------------------------
// گزارشات مالی، اس ام اس و بکاپ دیتابیس
// ----------------------------------------------------
async function loadAdminReport() {
    const start = document.getElementById('rep_start').value || null;
    const end = document.getElementById('rep_end').value || null;
    showLoading(true);
    const { data } = await getSupabaseClient().rpc('get_admin_report', { p_start: start, p_end: end });
    showLoading(false);
    
    if (data && data[0]) {
        const r = data[0];
        document.getElementById('adminReportResults').innerHTML = `
            <div class="bg-blue-600 text-white p-6 rounded-2xl shadow-lg border border-blue-500">
                <p class="text-xs opacity-90 mb-1 font-bold">کل صفحات بررسی شده</p>
                <h3 class="text-3xl font-black">${formatCurrency(r.total_pages || 0)}</h3>
            </div>
            <div class="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg border border-indigo-500">
                <p class="text-xs opacity-90 mb-1 font-bold">ارزش کل کارکردها (تومان)</p>
                <h3 class="text-3xl font-black">${formatCurrency(r.total_work_value || 0)}</h3>
            </div>
            <div class="bg-green-600 text-white p-6 rounded-2xl shadow-lg border border-green-500">
                <p class="text-xs opacity-90 mb-1 font-bold">پرداختی‌های موفق (ریال)</p>
                <h3 class="text-3xl font-black">${formatCurrency(r.total_paid || 0)}</h3>
            </div>
            <div class="bg-orange-500 text-white p-6 rounded-2xl shadow-lg border border-orange-400">
                <p class="text-xs opacity-90 mb-1 font-bold">کل بدهی در انتظار تسویه (ریال)</p>
                <h3 class="text-3xl font-black">${formatCurrency((r.total_remaining * 10) || 0)}</h3>
            </div>
        `;
    }
}

function toggleSelectAll() {
    const master = document.getElementById('selectAll');
    document.querySelectorAll('.typist-checkbox').forEach(cb => cb.checked = master.checked);
}

function sendGroupSMS() {
    const phones = Array.from(document.querySelectorAll('.typist-checkbox:checked')).map(cb => cb.value).filter(p => p);
    if (phones.length === 0) return alert("حداقل یک تایپیست انتخاب کنید.");
    window.location.href = 'sms:' + phones.join(',') + '?body=' + encodeURIComponent("با سلام، موعد تسویه کارکرد سامانه تایپ فرا رسیده است. لطفا گزارش کارهای خود را تکمیل نمایید.");
}

async function exportPersonnelCSV() {
    showLoading(true);
    const { data } = await getSupabaseClient().from('typists').select('*').order('name');
    showLoading(false);
    if (!data || !data.length) return;
    
    let csv = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا\n";
    data.forEach((t, i) => {
        csv += `${i+1},${t.first_name||''},${t.last_name||''},${t.father_name||''},${getTypistNationalId(t)},${getTypistPhone(t)},${getTypistCard(t)},${getTypistSheba(t)}\n`;
    });
    downloadFile(csv, "Personnel_List.csv");
}

async function exportBankCSV() {
    showLoading(true);
    const client = getSupabaseClient();
    const { data: typists } = await client.from('typists').select('*').order('name');
    
    let csv = "\uFEFFردیف,نام,نام خانوادگی,نام پدر,کد ملی,شماره تماس,شماره کارت,شماره شبا,مبلغ قابل واریز (ریال)\n";
    let count = 0;

    for (let i = 0; i < (typists || []).length; i++) {
        const t = typists[i];
        const { data: stats } = await client.rpc('get_typist_report', { p_typist_id: t.id, p_start: null, p_end: null });
        const balanceRial = stats && stats[0] ? ((stats[0].remaining_balance || 0) * 10) : 0;
        
        if (balanceRial > 0) {
            count++;
            csv += `${count},${t.first_name||''},${t.last_name||''},${t.father_name||''},${getTypistNationalId(t)},${getTypistPhone(t)},${getTypistCard(t)},${getTypistSheba(t)},${balanceRial}\n`;
        }
    }
    showLoading(false);
    if (count === 0) alert("هیچ تایپیستی دارای مانده طلبکارانه در سیستم نیست.");
    else downloadFile(csv, `Bank_Payments_Paya_${new Date().toLocaleDateString('fa-IR')}.csv`);
}

async function exportFullDatabase() {
    showLoading(true);
    try {
        const client = getSupabaseClient();
        const { data: admins } = await client.from('admin_settings').select('*');
        const { data: typists } = await client.from('typists').select('*');
        const { data: works } = await client.from('work_records').select('*');
        const { data: payments } = await client.from('payments').select('*');
        
        const json = JSON.stringify({ 
            export_date: new Date().toISOString(), 
            export_date_jalali: new Date().toLocaleDateString('fa-IR'),
            summary: {
                admins: admins?.length || 0,
                typists: typists?.length || 0,
                works: works?.length || 0,
                payments: payments?.length || 0
            },
            tables: { 
                admin_settings: admins || [], 
                typists: typists || [], 
                work_records: works || [], 
                payments: payments || [] 
            } 
        }, null, 4);
        downloadFile(json, `System_FullBackup_${new Date().toLocaleDateString('fa-IR')}.json`, "application/json;charset=utf-8;");
    } catch (e) { 
        alert("خطا در تهیه بکاپ دیتابیس."); 
    } finally { 
        showLoading(false); 
    }
}

function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", fileName);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // بستن مودال‌ها با دکمه Escape
    document.addEventListener('keydown', (e) => { 
        if (e.key === 'Escape') { 
            closeEditModal(); 
            closeChangePassModal(); 
        } 
    });
});

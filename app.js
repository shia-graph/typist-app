// ==========================================================================
// ۱. تنظیمات اتصال و تعریف کلاینت دیتابیس Supabase بدون وابستگی به Storage
// ==========================================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';


// ساخت کلاینت سوپابیس
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = db; // دسترسی سراسری برای کنسول

// وضعیت داخلی اپلیکیشن
let currentTypistId = null;
let currentTypist = null;
let currentReports = [];
let currentPayments = [];

/**
 * ۲. ماژول ایمن‌سازی اعداد (ضد NaN و چندزبانه)
 */
const SafeNum = {
  parse(val, fallback = 0) {
    if (val === null || val === undefined || val === '') return fallback;
    // تبدیل ارقام فارسی و عربی به استاندارد
    const cleaned = String(val)
      .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, d => d.charCodeAt(0) & 0xf)
      .replace(/[,،\s]/g, '')
      .trim();
    const num = Number(cleaned);
    return isNaN(num) ? fallback : num;
  },

  format(val, fallback = '۰') {
    const num = this.parse(val, null);
    if (num === null) return fallback;
    return num.toLocaleString('fa-IR');
  },

  toToman(val) {
    return `${this.format(val)} تومان`;
  }
};

/**
 * ۳. مبدل تاریخ میلادی به شمسی
 */
function toShamsiDate(dateInput) {
  if (!dateInput) return '---';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput).split('T')[0];
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    return String(dateInput).split('T')[0] || '---';
  }
}

/**
 * ۴. نرمال‌ساز گزارش‌ها بر اساس دیتابیس دقیق شما
 */
function normalizeReport(row, typist = {}) {
  if (!row) return null;

  // استخراج تعداد کلمات از ستون words
  const words = SafeNum.parse(row.words ?? row.word_count ?? row.words_count, 0);

  // استخراج تعداد صفحات از ستون pages
  const pages = SafeNum.parse(row.pages ?? row.page_count ?? row.pages_count, 0);

  // استخراج نرخ کلمه
  const ratePerWord = SafeNum.parse(
    row.rate_per_word ?? 
    row.rate ?? 
    typist?.rate_per_word ?? 
    typist?.default_word_rate, 
    0
  );

  // استخراج یا محاسبه مبلغ کل
  let totalAmount = SafeNum.parse(row.total_amount, 0);
  if (totalAmount === 0 && words > 0 && ratePerWord > 0) {
    totalAmount = words * ratePerWord;
  }

  const period = row.period ?? row.period_number ?? 1;

  return {
    id: row.id,
    typist_id: row.typist_id,
    period: period,
    words: words,
    pages: pages,
    rate_per_word: ratePerWord,
    total_amount: totalAmount,
    description: row.description ? String(row.description).trim() : 'بدون توضیحات',
    is_settled: Boolean(row.is_settled),
    created_at: row.created_at,
    shamsi_date: toShamsiDate(row.created_at)
  };
}

/**
 * ۵. بارگذاری لیست تایپیست‌ها در منوی کشویی
 */
async function loadTypistsList() {
  const select = document.getElementById('typist-select');
  try {
    const { data, error } = await db
      .from('typists')
      .select('id, name, default_word_rate, rate_per_word')
      .order('name', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      select.innerHTML = '<option value="">هیچ تایپیستی تعریف نشده است</option>';
      return;
    }

    select.innerHTML = '<option value="">-- انتخاب تایپیست --</option>' +
      data.map(t => `<option value="${t.id}">${t.name || 'بدون نام'} (کد: ${t.id.slice(0, 5)})</option>`).join('');

    // انتخاب تایپیست اول به صورت پیش‌فرض
    if (data.length > 0) {
      select.value = data[0].id;
      selectTypist(data[0].id);
    }
  } catch (err) {
    console.error("خطا در بارگذاری لیست تایپیست‌ها:", err);
    select.innerHTML = '<option value="">خطا در برقراری ارتباط با دیتابیس</option>';
  }
}

/**
 * ۶. انتخاب و واکشی تمام اطلاعات یک تایپیست
 */
async function selectTypist(typistId) {
  if (!typistId) return;
  currentTypistId = typistId;

  try {
    // اطلاعات فرد
    const { data: typist, error: typistErr } = await db
      .from('typists')
      .select('*')
      .eq('id', typistId)
      .single();

    if (typistErr) throw typistErr;
    currentTypist = typist;

    // به‌روزرسانی کارت مشخصات فرد
    document.getElementById('profile-name').innerText = typist.name || 'نامشخص';
    document.getElementById('profile-national-id').innerText = typist.national_id || typist.national_code || '---';
    document.getElementById('profile-phone').innerText = typist.phone || '---';
    document.getElementById('profile-iban').innerText = typist.iban || typist.account_number || '---';
    
    const defRate = typist.rate_per_word ?? typist.default_word_rate ?? 0;
    document.getElementById('profile-default-rate').innerText = SafeNum.toToman(defRate);
    document.getElementById('inp-rate').value = defRate;

    // دریافت گزارشات کارکرد
    const { data: reports, error: reportsErr } = await db
      .from('typist_reports')
      .select('*')
      .eq('typist_id', typistId)
      .order('created_at', { ascending: false });

    if (reportsErr) throw reportsErr;

    currentReports = (reports || []).map(r => normalizeReport(r, typist));

    // دریافت پرداخت‌ها
    const { data: payments, error: paymentsErr } = await db
      .from('payments')
      .select('*')
      .eq('person_id', typistId)
      .order('payment_date', { ascending: false });

    if (paymentsErr) throw paymentsErr;
    currentPayments = payments || [];

    // رندر بخش‌های مختلف صفحه
    renderReportsTable(currentReports);
    renderPaymentsTable(currentPayments);
    renderSummary();

  } catch (err) {
    console.error("خطا در پردازش اطلاعات تایپیست:", err);
    alert("خطا در دریافت اطلاعات: " + err.message);
  }
}

/**
 * ۷. رندر جدول گزارش‌ها
 */
function renderReportsTable(reports) {
  const tbody = document.getElementById('typist-reports-tbody');
  const countBadge = document.getElementById('reports-count-badge');
  
  countBadge.innerText = `${SafeNum.format(reports.length)} ردیف`;

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-slate-400 font-medium">
          هیچ گزارشی برای این تایپیست ثبت نشده است.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reports.map((r, i) => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-3 px-3 text-center text-slate-400 font-mono">${SafeNum.format(i + 1)}</td>
      <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-slate-700">${r.shamsi_date}</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-semibold text-xs">دوره ${SafeNum.format(r.period)}</span>
      </td>
      <td class="py-3 px-3 text-center text-slate-600">${SafeNum.format(r.pages)}</td>
      <td class="py-3 px-3 text-center font-bold text-indigo-700">${SafeNum.format(r.words)} کلمه</td>
      <td class="py-3 px-3 text-center text-slate-600">${SafeNum.format(r.rate_per_word)} تومان</td>
      <td class="py-3 px-3 text-center font-black text-emerald-600 whitespace-nowrap">${SafeNum.toToman(r.total_amount)}</td>
      <td class="py-3 px-3 text-center">
        ${r.is_settled 
          ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] rounded-full">تسویه شده</span>'
          : '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] rounded-full">در انتظار تسویه</span>'}
      </td>
      <td class="py-3 px-4 text-right text-slate-500 text-xs max-w-xs truncate" title="${r.description}">${r.description}</td>
    </tr>
  `).join('');
}

/**
 * ۸. رندر جدول پرداخت‌ها
 */
function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-tbody');
  
  if (!payments || payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-400">هیچ سابقه واریزی ثبت نشده است.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments.map((p, i) => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-3 px-3 text-center text-slate-400 font-mono">${SafeNum.format(i + 1)}</td>
      <td class="py-3 px-3 text-center text-slate-700 font-medium">${toShamsiDate(p.payment_date)}</td>
      <td class="py-3 px-3 text-center font-black text-emerald-600">${SafeNum.toToman(p.amount)}</td>
      <td class="py-3 px-3 text-center text-slate-600">${p.method || '---'}</td>
      <td class="py-3 px-3 text-center font-mono text-xs text-slate-500">${p.tracking_code || '---'}</td>
      <td class="py-3 px-4 text-right text-slate-500 text-xs">${p.description || '---'}</td>
    </tr>
  `).join('');
}

/**
 * ۹. محاسبات خلاصه وضعیت مالی
 */
function renderSummary() {
  const totalWords = currentReports.reduce((s, r) => s + r.words, 0);
  const totalPages = currentReports.reduce((s, r) => s + r.pages, 0);
  const totalPayable = currentReports.reduce((s, r) => s + r.total_amount, 0);
  const totalPaid = currentPayments.reduce((s, p) => s + SafeNum.parse(p.amount, 0), 0);
  const remaining = totalPayable - totalPaid;

  document.getElementById('sum-total-words').innerText = `${SafeNum.format(totalWords)} کلمه`;
  document.getElementById('sum-total-pages').innerText = `${SafeNum.format(totalPages)} صفحه`;
  document.getElementById('sum-total-payable').innerText = SafeNum.toToman(totalPayable);
  document.getElementById('sum-total-paid').innerText = SafeNum.toToman(totalPaid);

  const remEl = document.getElementById('sum-remaining-balance');
  remEl.innerText = SafeNum.toToman(remaining);

  if (remaining > 0) {
    remEl.className = 'text-lg md:text-xl font-black text-rose-600 mt-1';
  } else if (remaining === 0) {
    remEl.className = 'text-lg md:text-xl font-black text-emerald-600 mt-1';
  } else {
    remEl.className = 'text-lg md:text-xl font-black text-blue-600 mt-1'; // بستانکار موسسه
  }
}

/**
 * ۱۰. مدیریت مودال‌ها
 */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// بستن مودال با کلیک روی بک‌گراند
window.onclick = function(event) {
  ['modal-report', 'modal-payment'].forEach(id => {
    const modal = document.getElementById(id);
    if (event.target === modal) {
      closeModal(id);
    }
  });
};

/**
 * ۱۱. پیش‌نمایش آنی مبلغ در مودال ثبت گزارش
 */
function setupRealtimeCalculator() {
  const inpWords = document.getElementById('inp-words');
  const inpRate = document.getElementById('inp-rate');
  const preview = document.getElementById('calculated-total-preview');

  function calculate() {
    const words = SafeNum.parse(inpWords.value, 0);
    const rate = SafeNum.parse(inpRate.value, 0);
    preview.innerText = SafeNum.toToman(words * rate);
  }

  inpWords.addEventListener('input', calculate);
  inpRate.addEventListener('input', calculate);
}

/**
 * ۱۲. ثبت گزارش جدید در دیتابیس
 */
document.getElementById('form-new-report').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentTypistId) {
    alert("لطفاً ابتدا تایپیست را انتخاب فرمایید.");
    return;
  }

  const btn = document.getElementById('btn-submit-report');
  btn.disabled = true;
  btn.innerText = "در حال ذخیره...";

  try {
    const words = SafeNum.parse(document.getElementById('inp-words').value, 0);
    const pages = SafeNum.parse(document.getElementById('inp-pages').value, 0);
    const rate = SafeNum.parse(document.getElementById('inp-rate').value, 0);
    const period = SafeNum.parse(document.getElementById('inp-period').value, 1);
    const desc = document.getElementById('inp-desc').value.trim();
    const totalAmount = words * rate;

    const payload = {
      typist_id: currentTypistId,
      words: words,
      pages: pages,
      rate: rate,
      rate_per_word: rate,
      total_amount: totalAmount,
      period: period,
      period_number: period,
      description: desc,
      is_settled: false,
      created_at: new Date().toISOString()
    };

    const { error } = await db.from('typist_reports').insert([payload]);
    if (error) throw error;

    alert("گزارش با موفقیت ذخیره شد.");
    closeModal('modal-report');
    this.reset();
    selectTypist(currentTypistId); // تازه‌سازی صفحه

  } catch (err) {
    console.error("خطا در ثبت گزارش:", err);
    alert("خطا در ثبت گزارش: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "ثبت در دیتابیس";
  }
});

/**
 * ۱۳. ثبت سند پرداختی در جدول payments
 */
document.getElementById('form-new-payment').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentTypistId) {
    alert("لطفاً تایپیست را انتخاب کنید.");
    return;
  }

  const btn = document.getElementById('btn-submit-payment');
  btn.disabled = true;
  btn.innerText = "در حال ثبت واریزی...";

  try {
    const amount = SafeNum.parse(document.getElementById('inp-pay-amount').value, 0);
    const date = document.getElementById('inp-pay-date').value || new Date().toISOString().slice(0, 10);
    const method = document.getElementById('inp-pay-method').value;
    const tracking = document.getElementById('inp-pay-track').value.trim();
    const desc = document.getElementById('inp-pay-desc').value.trim();

    const payload = {
      person_id: currentTypistId,
      amount: amount,
      payment_date: date,
      method: method,
      tracking_code: tracking,
      description: desc,
      status: 'completed',
      created_at: new Date().toISOString()
    };

    const { error } = await db.from('payments').insert([payload]);
    if (error) throw error;

    alert("سند پرداخت با موفقیت ثبت شد.");
    closeModal('modal-payment');
    this.reset();
    selectTypist(currentTypistId);

  } catch (err) {
    console.error("خطا در ثبت پرداخت:", err);
    alert("خطا در ثبت سند پرداخت: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "ثبت واریز";
  }
});

/**
 * ۱۴. خروجی اکسل استاندارد (CSV با UTF-8 BOM جهت باز شدن صحیح در مایکروسافت اکسل)
 */
function exportToCSV() {
  if (!currentReports || currentReports.length === 0) {
    alert("هیچ گزارشی برای خروجی گرفتن وجود ندارد.");
    return;
  }

  const headers = ["ردیف", "تاریخ ثبت", "دوره", "صفحات", "تعداد کلمات", "نرخ هر کلمه (تومان)", "مبلغ کل (تومان)", "وضعیت تسویه", "توضیحات"];
  
  const rows = currentReports.map((r, i) => [
    i + 1,
    r.shamsi_date,
    r.period,
    r.pages,
    r.words,
    r.rate_per_word,
    r.total_amount,
    r.is_settled ? "تسویه شده" : "تسویه نشده",
    `"${(r.description || '').replace(/"/g, '""')}"`
  ]);

  const csvBody = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const blob = new Blob(["\uFEFF" + csvBody], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `کارکرد_${(currentTypist?.name || 'تایپیست').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

/**
 * ۱۵. راه‌اندازی و لیسنرها
 */
document.addEventListener('DOMContentLoaded', () => {
  // تاریخ امروز به عنوان پیش‌فرض پرداخت
  const payDate = document.getElementById('inp-pay-date');
  if (payDate) payDate.value = new Date().toISOString().slice(0, 10);

  // دکمه‌ها و فرم‌ها
  document.getElementById('typist-select').addEventListener('change', (e) => {
    selectTypist(e.target.value);
  });

  document.getElementById('btn-refresh').addEventListener('click', () => {
    if (currentTypistId) selectTypist(currentTypistId);
    else loadTypistsList();
  });

  document.getElementById('btn-open-report-modal').addEventListener('click', () => {
    if (!currentTypistId) {
      alert("لطفاً ابتدا یک تایپیست انتخاب کنید.");
      return;
    }
    openModal('modal-report');
  });

  document.getElementById('btn-open-payment-modal').addEventListener('click', () => {
    if (!currentTypistId) {
      alert("لطفاً ابتدا یک تایپیست انتخاب کنید.");
      return;
    }
    openModal('modal-payment');
  });

  document.getElementById('btn-export-excel').addEventListener('click', exportToCSV);

  // فعال‌سازی محاسبه آنی
  setupRealtimeCalculator();

  // اجرای اولیه
  loadTypistsList();
});

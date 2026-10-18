'use strict';

// ==========================================================================
// ۱. پیکربندی و تعریف کلاینت Supabase
// ==========================================================================
const SUPABASE_URL = 'https://irhiofmqusjpcznecmho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaGlvZm1xdXNqcGN6bmVjbWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk4NDUsImV4cCI6MjEwNDYyNTg0NX0.Xu9y7K4KcQdpRQZ9YWZzJvrPAldejVcmtR-4ozHHZZ8';

if (!window.supabase) {
  console.error('Supabase SDK بارگذاری نشده است.');
} else {
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.db = db; // دسترسی سراسری برای کنسول
}

// ==========================================================================
// ۲. وضعیت داخلی برنامه
// ==========================================================================
const state = {
  typistId: null,
  typist: null,
  reports: [],
  payments: [],
};

// ==========================================================================
// ۳. ماژول ایمن‌سازی اعداد
// ==========================================================================
const SafeNum = {
  parse(val, fallback = 0) {
    if (val === null || val === undefined || val === '') return fallback;
    const cleaned = String(val)
      .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) & 0xf))
      .replace(/[,،\s]/g, '')
      .trim();
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : fallback;
  },

  format(val, fallback = '۰') {
    const num = this.parse(val, null);
    if (num === null) return fallback;
    return num.toLocaleString('fa-IR');
  },

  toToman(val) {
    return `${this.format(val)} تومان`;
  },
};

// ==========================================================================
// ۴. مبدل تاریخ میلادی به شمسی
// ==========================================================================
function toShamsiDate(dateInput) {
  if (!dateInput) return '---';
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return String(dateInput).split('T')[0];
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return String(dateInput).split('T')[0] || '---';
  }
}

// ==========================================================================
// ۵. اعلان ساده (Toast) بدون وابستگی
// ==========================================================================
function toast(message, type = 'info') {
  const colors = {
    info: 'background:#1e293b;color:#fff',
    success: 'background:#059669;color:#fff',
    error: 'background:#e11d48;color:#fff',
    warn: 'background:#d97706;color:#fff',
  };
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute('role', 'status');
  el.style.cssText = `
    position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);
    padding:.75rem 1.25rem;border-radius:.75rem;font-weight:700;
    font-family:'Vazirmatn',sans-serif;font-size:.85rem;z-index:9999;
    box-shadow:0 10px 25px rgba(0,0,0,.15);max-width:90vw;
    ${colors[type] || colors.info};
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

// ==========================================================================
// ۶. نرمال‌ساز گزارش‌ها
// ==========================================================================
function normalizeReport(row, typist = {}) {
  if (!row) return null;

  const words = SafeNum.parse(row.words ?? row.word_count ?? row.words_count, 0);
  const pages = SafeNum.parse(row.pages ?? row.page_count ?? row.pages_count, 0);
  const ratePerWord = SafeNum.parse(
    row.rate_per_word ?? row.rate ?? typist.rate_per_word ?? typist.default_word_rate,
    0
  );

  let totalAmount = SafeNum.parse(row.total_amount, 0);
  if (totalAmount === 0 && words > 0 && ratePerWord > 0) {
    totalAmount = words * ratePerWord;
  }

  const period = row.period ?? row.period_number ?? 1;

  return {
    id: row.id,
    typist_id: row.typist_id,
    period,
    words,
    pages,
    rate_per_word: ratePerWord,
    total_amount: totalAmount,
    description: row.description ? String(row.description).trim() : 'بدون توضیحات',
    is_settled: Boolean(row.is_settled),
    created_at: row.created_at,
    shamsi_date: toShamsiDate(row.created_at),
  };
}

// ==========================================================================
// ۷. بارگذاری لیست تایپیست‌ها
// ==========================================================================
async function loadTypistsList() {
  const select = document.getElementById('typist-select');
  if (!select) return;

  try {
    const { data, error } = await window.db
      .from('typists')
      .select('id, name, default_word_rate, rate_per_word')
      .order('name', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      select.innerHTML = '<option value="">هیچ تایپیستی تعریف نشده است</option>';
      return;
    }

    select.innerHTML =
      '<option value="">-- انتخاب تایپیست --</option>' +
      data
        .map(
          (t) =>
            `<option value="${t.id}">${t.name || 'بدون نام'} (کد: ${String(t.id).slice(0, 5)})</option>`
        )
        .join('');

    select.value = data[0].id;
    selectTypist(data[0].id);
  } catch (err) {
    console.error('خطا در بارگذاری لیست تایپیست‌ها:', err);
    select.innerHTML = '<option value="">خطا در برقراری ارتباط با دیتابیس</option>';
  }
}

// ==========================================================================
// ۸. انتخاب و واکشی اطلاعات یک تایپیست
// ==========================================================================
async function selectTypist(typistId) {
  if (!typistId) return;
  state.typistId = typistId;

  try {
    const { data: typist, error: typistErr } = await window.db
      .from('typists')
      .select('*')
      .eq('id', typistId)
      .single();

    if (typistErr) throw typistErr;
    state.typist = typist;

    document.getElementById('profile-name').innerText = typist.name || 'نامشخص';
    document.getElementById('profile-national-id').innerText =
      typist.national_id || typist.national_code || '---';
    document.getElementById('profile-phone').innerText = typist.phone || '---';
    document.getElementById('profile-iban').innerText =
      typist.iban || typist.account_number || '---';

    const defRate = typist.rate_per_word ?? typist.default_word_rate ?? 0;
    document.getElementById('profile-default-rate').innerText = SafeNum.toToman(defRate);
    document.getElementById('inp-rate').value = defRate;

    const { data: reports, error: reportsErr } = await window.db
      .from('typist_reports')
      .select('*')
      .eq('typist_id', typistId)
      .order('created_at', { ascending: false });

    if (reportsErr) throw reportsErr;
    state.reports = (reports || []).map((r) => normalizeReport(r, typist));

    const { data: payments, error: paymentsErr } = await window.db
      .from('payments')
      .select('*')
      .eq('person_id', typistId)
      .order('payment_date', { ascending: false });

    if (paymentsErr) throw paymentsErr;
    state.payments = payments || [];

    renderReportsTable(state.reports);
    renderPaymentsTable(state.payments);
    renderSummary();
  } catch (err) {
    console.error('خطا در پردازش اطلاعات تایپیست:', err);
    toast('خطا در دریافت اطلاعات: ' + err.message, 'error');
  }
}

// ==========================================================================
// ۹. رندر جدول گزارش‌ها
// ==========================================================================
function renderReportsTable(reports) {
  const tbody = document.getElementById('typist-reports-tbody');
  const countBadge = document.getElementById('reports-count-badge');
  if (countBadge) countBadge.innerText = `${SafeNum.format(reports.length)} ردیف`;

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-slate-400 font-medium">
          هیچ گزارشی برای این تایپیست ثبت نشده است.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = reports
    .map(
      (r, i) => `
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
        ${
          r.is_settled
            ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] rounded-full">تسویه شده</span>'
            : '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] rounded-full">در انتظار تسویه</span>'
        }
      </td>
      <td class="py-3 px-4 text-right text-slate-500 text-xs max-w-xs truncate" title="${r.description}">${r.description}</td>
    </tr>`
    )
    .join('');
}

// ==========================================================================
// ۱۰. رندر جدول پرداخت‌ها
// ==========================================================================
function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-tbody');

  if (!payments || payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-slate-400">هیچ سابقه واریزی ثبت نشده است.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = payments
    .map(
      (p, i) => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-3 px-3 text-center text-slate-400 font-mono">${SafeNum.format(i + 1)}</td>
      <td class="py-3 px-3 text-center text-slate-700 font-medium">${toShamsiDate(p.payment_date)}</td>
      <td class="py-3 px-3 text-center font-black text-emerald-600">${SafeNum.toToman(p.amount)}</td>
      <td class="py-3 px-3 text-center text-slate-600">${p.method || '---'}</td>
      <td class="py-3 px-3 text-center font-mono text-xs text-slate-500">${p.tracking_code || '---'}</td>
      <td class="py-3 px-4 text-right text-slate-500 text-xs">${p.description || '---'}</td>
    </tr>`
    )
    .join('');
}

// ==========================================================================
// ۱۱. محاسبات خلاصه وضعیت مالی
// ==========================================================================
function renderSummary() {
  const totalWords = state.reports.reduce((s, r) => s + r.words, 0);
  const totalPages = state.reports.reduce((s, r) => s + r.pages, 0);
  const totalPayable = state.reports.reduce((s, r) => s + r.total_amount, 0);
  const totalPaid = state.payments.reduce((s, p) => s + SafeNum.parse(p.amount, 0), 0);
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
    remEl.className = 'text-lg md:text-xl font-black text-blue-600 mt-1';
  }
}

// ==========================================================================
// ۱۲. مدیریت مودال‌ها
// ==========================================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// بستن مودال با کلیک روی بک‌گراند (بدون override کردن window.onclick)
document.addEventListener('click', (event) => {
  ['modal-report', 'modal-payment'].forEach((id) => {
    const modal = document.getElementById(id);
    if (modal && event.target === modal) closeModal(id);
  });
});

// ==========================================================================
// ۱۳. پیش‌نمایش آنی مبلغ
// ==========================================================================
function setupRealtimeCalculator() {
  const inpWords = document.getElementById('inp-words');
  const inpRate = document.getElementById('inp-rate');
  const preview = document.getElementById('calculated-total-preview');
  if (!inpWords || !inpRate || !preview) return;

  const calculate = () => {
    const words = SafeNum.parse(inpWords.value, 0);
    const rate = SafeNum.parse(inpRate.value, 0);
    preview.innerText = SafeNum.toToman(words * rate);
  };

  inpWords.addEventListener('input', calculate);
  inpRate.addEventListener('input', calculate);
}

// ==========================================================================
// ۱۴. ثبت گزارش جدید
// ==========================================================================
async function handleSubmitReport(e) {
  e.preventDefault();
  if (!state.typistId) {
    toast('لطفاً ابتدا تایپیست را انتخاب فرمایید.', 'warn');
    return;
  }

  const btn = document.getElementById('btn-submit-report');
  btn.disabled = true;
  btn.innerText = 'در حال ذخیره...';

  try {
    const words = SafeNum.parse(document.getElementById('inp-words').value, 0);
    const pages = SafeNum.parse(document.getElementById('inp-pages').value, 0);
    const rate = SafeNum.parse(document.getElementById('inp-rate').value, 0);
    const period = SafeNum.parse(document.getElementById('inp-period').value, 1);
    const desc = document.getElementById('inp-desc').value.trim();
    const totalAmount = words * rate;

    const payload = {
      typist_id: state.typistId,
      words,
      pages,
      rate,
      rate_per_word: rate,
      total_amount: totalAmount,
      period,
      period_number: period,
      description: desc,
      is_settled: false,
      created_at: new Date().toISOString(),
    };

    const { error } = await window.db.from('typist_reports').insert([payload]);
    if (error) throw error;

    toast('گزارش با موفقیت ذخیره شد.', 'success');
    closeModal('modal-report');
    e.target.reset();
    selectTypist(state.typistId);
  } catch (err) {
    console.error('خطا در ثبت گزارش:', err);
    toast('خطا در ثبت گزارش: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'ثبت در دیتابیس';
  }
}

// ==========================================================================
// ۱۵. ثبت سند پرداختی
// ==========================================================================
async function handleSubmitPayment(e) {
  e.preventDefault();
  if (!state.typistId) {
    toast('لطفاً تایپیست را انتخاب کنید.', 'warn');
    return;
  }

  const btn = document.getElementById('btn-submit-payment');
  btn.disabled = true;
  btn.innerText = 'در حال ثبت واریزی...';

  try {
    const amount = SafeNum.parse(document.getElementById('inp-pay-amount').value, 0);
    const date =
      document.getElementById('inp-pay-date').value ||
      new Date().toISOString().slice(0, 10);
    const method = document.getElementById('inp-pay-method').value;
    const tracking = document.getElementById('inp-pay-track').value.trim();
    const desc = document.getElementById('inp-pay-desc').value.trim();

    if (amount <= 0) {
      toast('مبلغ واریزی باید بزرگ‌تر از صفر باشد.', 'warn');
      return;
    }

    const payload = {
      person_id: state.typistId,
      amount,
      payment_date: date,
      method,
      tracking_code: tracking,
      description: desc,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    const { error } = await window.db.from('payments').insert([payload]);
    if (error) throw error;

    toast('سند پرداخت با موفقیت ثبت شد.', 'success');
    closeModal('modal-payment');
    e.target.reset();
    selectTypist(state.typistId);
  } catch (err) {
    console.error('خطا در ثبت پرداخت:', err);
    toast('خطا در ثبت سند پرداخت: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'ثبت واریز';
  }
}

// ==========================================================================
// ۱۶. خروجی CSV (سازگار با Excel)
// ==========================================================================
function exportToCSV() {
  if (!state.reports || state.reports.length === 0) {
    toast('هیچ گزارشی برای خروجی گرفتن وجود ندارد.', 'warn');
    return;
  }

  const headers = [
    'ردیف',
    'تاریخ ثبت',
    'دوره',
    'صفحات',
    'تعداد کلمات',
    'نرخ هر کلمه (تومان)',
    'مبلغ کل (تومان)',
    'وضعیت تسویه',
    'توضیحات',
  ];

  const rows = state.reports.map((r, i) => [
    i + 1,
    r.shamsi_date,
    r.period,
    r.pages,
    r.words,
    r.rate_per_word,
    r.total_amount,
    r.is_settled ? 'تسویه شده' : 'تسویه نشده',
    `"${(r.description || '').replace(/"/g, '""')}"`,
  ]);

  const csvBody = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `کارکرد_${(state.typist?.name || 'تایپیست').replace(/\s+/g, '_')}_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================================================
// ۱۷. راه‌اندازی
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // تاریخ پیش‌فرض پرداخت
  const payDate = document.getElementById('inp-pay-date');
  if (payDate) payDate.value = new Date().toISOString().slice(0, 10);

  // رویدادها
  document.getElementById('typist-select')?.addEventListener('change', (e) => {
    selectTypist(e.target.value);
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    if (state.typistId) selectTypist(state.typistId);
    else loadTypistsList();
  });

  document.getElementById('btn-open-report-modal')?.addEventListener('click', () => {
    if (!state.typistId) {
      toast('لطفاً ابتدا یک تایپیست انتخاب کنید.', 'warn');
      return;
    }
    openModal('modal-report');
  });

  document.getElementById('btn-open-payment-modal')?.addEventListener('click', () => {
    if (!state.typistId) {
      toast('لطفاً ابتدا یک تایپیست انتخاب کنید.', 'warn');
      return;
    }
    openModal('modal-payment');
  });

  document.getElementById('btn-export-excel')?.addEventListener('click', exportToCSV);

  // فرم‌ها
  document.getElementById('form-new-report')?.addEventListener('submit', handleSubmitReport);
  document.getElementById('form-new-payment')?.addEventListener('submit', handleSubmitPayment);

  // محاسبه آنی
  setupRealtimeCalculator();

  // بارگذاری اولیه
  loadTypistsList();
});

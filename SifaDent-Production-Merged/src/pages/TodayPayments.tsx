```tsx
import { useEffect, useMemo, useState } from 'react';
import { Banknote, Plus, RefreshCw, Search } from 'lucide-react';
import { apiFetch, formatKES, todayISO } from '../lib/helpers';
import {
  Card,
  PageHeader,
  Btn,
  Field,
  Input,
  Select,
  Empty,
  Spinner,
} from '../components/ui';

interface Payment {
  id: number;
  invoice_id: number;
  patient_id: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  received_by?: string | null;
  reference_number?: string | null;
  notes?: string | null;
}

interface AvailableInvoice {
  id: number;
  invoice_number: string;
  patient_id: number;
  patient_name: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  issue_date: string;
  status: string;
}

function normalisePayments(data: unknown): Payment[] {
  if (Array.isArray(data)) {
    return data as Payment[];
  }

  if (
    data &&
    typeof data === 'object' &&
    'payments' in data &&
    Array.isArray((data as { payments?: unknown }).payments)
  ) {
    return (data as { payments: Payment[] }).payments;
  }

  return [];
}

function normaliseInvoices(data: unknown): AvailableInvoice[] {
  if (Array.isArray(data)) {
    return data as AvailableInvoice[];
  }

  if (
    data &&
    typeof data === 'object' &&
    'invoices' in data &&
    Array.isArray((data as { invoices?: unknown }).invoices)
  ) {
    return (data as { invoices: AvailableInvoice[] }).invoices;
  }

  return [];
}

export default function TodayPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<AvailableInvoice[]>([]);
  const [form, setForm] = useState({
    invoice_number: '',
    amount: '',
    payment_method: 'mpesa',
    reference_number: '',
    notes: '',
  });

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [paymentsResponse, invoicesResponse] = await Promise.all([
        apiFetch('/api/payments'),
        apiFetch('/api/payments?available_invoices=1'),
      ]);

      setPayments(normalisePayments(paymentsResponse));
      setInvoices(normaliseInvoices(invoicesResponse));
    } catch (e) {
      console.error('Today's Payments load error:', e);

      setError(
        e instanceof Error
          ? e.message
          : 'Failed to load payments. Please refresh and try again.'
      );

      setPayments([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();

    return invoices
      .filter((invoice) => {
        const invoiceNumber = String(
          invoice.invoice_number ?? ''
        ).toLowerCase();

        const patientName = String(
          invoice.patient_name ?? ''
        ).toLowerCase();

        return (
          !q ||
          invoiceNumber.includes(q) ||
          patientName.includes(q)
        );
      })
      .sort((a, b) => {
        const dateA = String(a.issue_date ?? '');
        const dateB = String(b.issue_date ?? '');

        return dateB.localeCompare(dateA) || b.id - a.id;
      });
  }, [invoices, invoiceSearch]);

  const selected = invoices.find(
    (invoice) => invoice.invoice_number === form.invoice_number
  );

  const save = async () => {
    setError('');
    setMsg('');

    if (!form.invoice_number || !(Number(form.amount) > 0)) {
      setError(
        'Select an invoice and enter a payment amount greater than zero.'
      );
      return;
    }

    if (
      selected &&
      Number(form.amount) > Number(selected.balance) + 0.000001
    ) {
      setError(
        `Amount exceeds current amount due of ${formatKES(
          selected.balance
        )}.`
      );
      return;
    }

    setBusy(true);

    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoice_number: form.invoice_number,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          payment_date: todayISO(),
          reference_number:
            form.reference_number.trim() || null,
          notes: form.notes.trim() || null,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      setForm({
        invoice_number: '',
        amount: '',
        payment_method: 'mpesa',
        reference_number: '',
        notes: '',
      });

      setInvoiceSearch('');
      setMsg('Payment recorded successfully.');

      await load();
    } catch (e) {
      console.error('Record payment error:', e);

      setError(
        e instanceof Error
          ? e.message
          : 'Failed to record payment.'
      );
    } finally {
      setBusy(false);
    }
  };

  const total = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Today's Payments"
        subtitle={`${todayISO()} · ${formatKES(total)} received`}
        actions={
          <Btn variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Btn>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Banknote className="h-4 w-4" />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Record payment
              </h2>

              <p className="text-xs text-slate-500">
                Today only
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {msg && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {msg}
            </div>
          )}

          <div className="space-y-3">
            <Field label="Search invoice or patient">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <Input
                  className="pl-9"
                  value={invoiceSearch}
                  onChange={(e) =>
                    setInvoiceSearch(e.target.value)
                  }
                  placeholder="Search by invoice or patient…"
                />
              </div>
            </Field>

            <Field label="Invoice *">
              <Select
                value={form.invoice_number}
                onChange={(e) => {
                  const value = e.target.value;

                  const invoice = invoices.find(
                    (item) =>
                      item.invoice_number === value
                  );

                  setForm((current) => ({
                    ...current,
                    invoice_number: value,
                    amount: invoice
                      ? String(invoice.balance)
                      : '',
                  }));
                }}
              >
                <option value="">Select invoice…</option>

                {filtered.map((invoice) => (
                  <option
                    key={invoice.id}
                    value={invoice.invoice_number}
                  >
                    {invoice.invoice_number} —{' '}
                    {invoice.patient_name} —{' '}
                    {formatKES(invoice.balance)} due —{' '}
                    {invoice.issue_date}
                  </option>
                ))}
              </Select>
            </Field>

            {selected && (
              <div className="rounded-xl border border-fuchsia-100 bg-pink-50 p-3 text-sm">
                <div className="font-bold text-slate-900">
                  {selected.patient_name}
                </div>

                <div className="text-xs text-slate-600">
                  {selected.invoice_number} · Current amount due:{' '}
                  <b>{formatKES(selected.balance)}</b>
                </div>
              </div>
            )}

            <Field label="Amount received (KES) *">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    amount: e.target.value,
                  }))
                }
              />
            </Field>

            <Field label="Payment method">
              <Select
                value={form.payment_method}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    payment_method: e.target.value,
                  }))
                }
              >
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank transfer</option>
                <option value="insurance">Insurance</option>
              </Select>
            </Field>

            <Field label="M-Pesa reference / code">
              <Input
                value={form.reference_number}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    reference_number: e.target.value,
                  }))
                }
                placeholder="Optional for cash/card"
              />
            </Field>

            <Field label="Payment notes">
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    notes: e.target.value,
                  }))
                }
              />
            </Field>

            <Btn
              className="w-full"
              onClick={save}
              loading={busy}
            >
              <Plus className="h-4 w-4" />
              Record payment
            </Btn>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Only invoices with an outstanding amount are available.
            Receptionists can record today's payments and see the
            current amount due for the selected invoice.
          </p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Payments recorded today
            </h2>

            <span className="text-sm font-extrabold text-slate-900">
              {formatKES(total)}
            </span>
          </div>

          {loading ? (
            <Spinner label="Loading payments…" />
          ) : payments.length === 0 ? (
            <Empty title="No payments recorded today" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="px-2 py-2">Invoice</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Method</th>
                    <th className="px-2 py-2">Reference</th>
                    <th className="px-2 py-2">Recorded by</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-2 py-2.5 font-semibold">
                        #{payment.invoice_id}
                      </td>

                      <td className="px-2 py-2.5 font-bold">
                        {formatKES(payment.amount)}
                      </td>

                      <td className="px-2 py-2.5 capitalize">
                        {String(
                          payment.payment_method ?? ''
                        ).replaceAll('_', ' ')}
                      </td>

                      <td className="px-2 py-2.5">
                        {payment.reference_number || '—'}
                      </td>

                      <td className="px-2 py-2.5 text-xs text-slate-500">
                        {payment.received_by || 'Staff'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
```

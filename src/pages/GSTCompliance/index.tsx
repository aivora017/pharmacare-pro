import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileJson, Calculator, GitMerge, Zap, Truck,
  Download, RefreshCw, AlertTriangle, CheckCircle, Lock, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { gstService, Gstr1Result, Gstr3bResult } from '@/services/gstService';
import { useSettingsStore } from '@/store/settingsStore';

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

type Tab = 'gstr1' | 'gstr3b' | 'gstr2b' | 'einvoice' | 'ewaybill';

function MonthYearPicker({
  month, year, onMonth, onYear,
}: { month: string; year: string; onMonth: (m: string) => void; onYear: (y: string) => void }) {
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  return (
    <div className="flex gap-2 items-center">
      <select value={month} onChange={e => onMonth(e.target.value)}
        className="h-9 border border-slate-200 rounded-lg px-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
        {MONTHS.map((m, i) => (
          <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>
      <select value={year} onChange={e => onYear(e.target.value)}
        className="h-9 border border-slate-200 rounded-lg px-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

function Gstr1Tab() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<Gstr1Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gstService.getGstr1(month, year);
      setData(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load GSTR-1');
    } finally { setLoading(false); }
  }, [month, year]);

  const exportJson = async () => {
    setExporting(true);
    try {
      const result = await gstService.exportGstr1Json(month, year);
      toast.success(`Exported ${result.invoice_count} invoices → ${result.path}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally { setExporting(false); }
  };

  const total = data?.invoices.reduce((s, i) => ({
    taxable: s.taxable + i.taxable_amount,
    cgst: s.cgst + i.cgst_amount,
    sgst: s.sgst + i.sgst_amount,
    igst: s.igst + i.igst_amount,
    total: s.total + i.total_amount,
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Load
          </button>
          <button onClick={exportJson} disabled={!data || exporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {total && data && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Taxable', val: total.taxable },
            { label: 'CGST', val: total.cgst },
            { label: 'SGST', val: total.sgst },
            { label: 'IGST', val: total.igst },
            { label: 'Total', val: total.total },
          ].map(({ label, val }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="font-bold text-slate-800">₹{val.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Bill No','Date','Customer','Medicine','HSN','GST%','Taxable','CGST','SGST','IGST','Total'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.invoices.map((inv, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-blue-700">{inv.bill_number}</td>
                  <td className="px-3 py-2">{inv.bill_date.slice(0, 10)}</td>
                  <td className="px-3 py-2">{inv.customer_name}</td>
                  <td className="px-3 py-2">{inv.medicine_name}</td>
                  <td className="px-3 py-2">{inv.hsn_code}</td>
                  <td className="px-3 py-2">{inv.gst_rate}%</td>
                  <td className="px-3 py-2">₹{inv.taxable_amount.toFixed(2)}</td>
                  <td className="px-3 py-2">₹{inv.cgst_amount.toFixed(2)}</td>
                  <td className="px-3 py-2">₹{inv.sgst_amount.toFixed(2)}</td>
                  <td className="px-3 py-2">₹{inv.igst_amount.toFixed(2)}</td>
                  <td className="px-3 py-2 font-semibold">₹{inv.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.invoices.length === 0 && (
            <div className="text-center py-12 text-slate-400">No invoices for this period</div>
          )}
        </div>
      )}
    </div>
  );
}

function Gstr3bTab() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<Gstr3bResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gstService.getGstr3b(month, year);
      setData(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load GSTR-3B');
    } finally { setLoading(false); }
  }, [month, year]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Compute
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-3">3.1 Outward Supplies (Sales)</h3>
            <div className="grid grid-cols-5 gap-3 text-sm">
              {[
                { label: 'Taxable', val: data.outward_supplies.taxable },
                { label: 'CGST', val: data.outward_supplies.cgst },
                { label: 'SGST', val: data.outward_supplies.sgst },
                { label: 'IGST', val: data.outward_supplies.igst },
                { label: 'Total', val: data.outward_supplies.total },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="font-bold">₹{val.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <h3 className="font-semibold text-green-800 mb-3">4. ITC Available (Purchases)</h3>
            <div className="grid grid-cols-4 gap-3 text-sm">
              {[
                { label: 'Taxable', val: data.itc_available.taxable },
                { label: 'CGST', val: data.itc_available.cgst },
                { label: 'SGST', val: data.itc_available.sgst },
                { label: 'IGST', val: data.itc_available.igst },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="font-bold text-green-700">₹{val.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
            <h3 className="font-semibold text-orange-800 mb-3">6.1 Net GST Payable</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: 'CGST Payable', val: data.net_gst_payable.cgst },
                { label: 'SGST Payable', val: data.net_gst_payable.sgst },
                { label: 'IGST Payable', val: data.net_gst_payable.igst },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="font-bold text-orange-700 text-lg">₹{val.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Gstr2bTab() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<Awaited<ReturnType<typeof gstService.getPurchaseBillsForRecon>> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gstService.getPurchaseBillsForRecon(month, year);
      setData(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load purchase data');
    } finally { setLoading(false); }
  }, [month, year]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Load Purchases
        </button>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Upload GSTR-2B JSON from GST portal to match against your purchase records. Portal reconciliation requires IRP credentials configured in Settings.</span>
        </div>
      </div>
      {data && (
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Invoice No','Date','Supplier','GSTIN','Amount'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.purchases.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{p.invoice_number}</td>
                  <td className="px-3 py-2">{p.purchase_date.slice(0, 10)}</td>
                  <td className="px-3 py-2">{p.supplier_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.supplier_gstin || '—'}</td>
                  <td className="px-3 py-2">₹{p.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.purchases.length === 0 && (
            <div className="text-center py-12 text-slate-400">No purchases for this period</div>
          )}
        </div>
      )}
    </div>
  );
}

function EInvoiceTab() {
  const [billId, setBillId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof gstService.generateEinvoice>> | null>(null);

  const generate = async () => {
    if (!billId) { toast.error('Enter a bill ID'); return; }
    setLoading(true);
    try {
      const r = await gstService.generateEinvoice(Number(billId));
      setResult(r);
      if (r.irn) toast.success('IRN generated!'); else toast(r.message, { icon: 'ℹ️' });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'E-Invoice failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Sandbox mode active.</strong> IRN generated will be test-only. Switch to Production in Settings → GST Compliance when ready.
      </div>
      <div className="flex gap-3">
        <input value={billId} onChange={e => setBillId(e.target.value)} placeholder="Bill ID"
          className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          <Zap className="w-4 h-4" />
          {loading ? 'Generating…' : 'Generate IRN'}
        </button>
      </div>
      {result && (
        <div className={`rounded-xl p-4 border text-sm space-y-1.5 ${(result as Record<string,unknown>).irn ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div><strong>Bill:</strong> {(result as Record<string,unknown>).bill_number as string}</div>
          <div><strong>Status:</strong> <span className="capitalize">{(result as Record<string,unknown>).status as string}</span>
            {(result as Record<string,unknown>).sandbox && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">sandbox</span>}
          </div>
          {(result as Record<string,unknown>).irn && (
            <>
              <div><strong>IRN:</strong> <code className="text-xs break-all">{(result as Record<string,unknown>).irn as string}</code></div>
              {(result as Record<string,unknown>).ack_no && <div><strong>Ack No:</strong> {(result as Record<string,unknown>).ack_no as string}</div>}
              {(result as Record<string,unknown>).ack_date && <div><strong>Ack Date:</strong> {(result as Record<string,unknown>).ack_date as string}</div>}
            </>
          )}
          {!(result as Record<string,unknown>).irn && <div className="text-slate-500">{(result as Record<string,unknown>).message as string}</div>}
        </div>
      )}
    </div>
  );
}

function EWayBillTab() {
  const [billId, setBillId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof gstService.generateEwaybill>> | null>(null);

  const generate = async () => {
    if (!billId) { toast.error('Enter a bill ID'); return; }
    setLoading(true);
    try {
      const r = await gstService.generateEwaybill(Number(billId));
      setResult(r);
      if (r.ewb_no) toast.success('E-Way Bill generated!'); else toast(r.message, { icon: 'ℹ️' });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'E-Way Bill failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Sandbox mode active.</strong> EWB generated will be test-only. Only required for bills ≥ ₹50,000.
      </div>
      <div className="flex gap-3">
        <input value={billId} onChange={e => setBillId(e.target.value)} placeholder="Bill ID"
          className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          <Truck className="w-4 h-4" />
          {loading ? 'Generating…' : 'Generate EWB'}
        </button>
      </div>
      {result && (
        <div className={`rounded-xl p-4 border text-sm space-y-1.5 ${(result as Record<string,unknown>).ewb_no ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div><strong>Bill:</strong> {(result as Record<string,unknown>).bill_number as string}</div>
          <div><strong>Status:</strong> <span className="capitalize">{(result as Record<string,unknown>).status as string}</span>
            {(result as Record<string,unknown>).sandbox && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">sandbox</span>}
          </div>
          {(result as Record<string,unknown>).ewb_no && (
            <>
              <div><strong>EWB No:</strong> {(result as Record<string,unknown>).ewb_no as string}</div>
              {(result as Record<string,unknown>).ewb_date && <div><strong>EWB Date:</strong> {(result as Record<string,unknown>).ewb_date as string}</div>}
              {(result as Record<string,unknown>).valid_until && <div><strong>Valid Until:</strong> {(result as Record<string,unknown>).valid_until as string}</div>}
            </>
          )}
          {!(result as Record<string,unknown>).ewb_no && <div className="text-slate-500">{(result as Record<string,unknown>).message as string}</div>}
        </div>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'gstr1',   label: 'GSTR-1',   icon: <FileJson className="w-4 h-4" /> },
  { id: 'gstr3b',  label: 'GSTR-3B',  icon: <Calculator className="w-4 h-4" /> },
  { id: 'gstr2b',  label: 'GSTR-2B',  icon: <GitMerge className="w-4 h-4" /> },
  { id: 'einvoice',label: 'E-Invoice', icon: <Zap className="w-4 h-4" /> },
  { id: 'ewaybill',label: 'E-Way Bill',icon: <Truck className="w-4 h-4" /> },
];

export default function GSTCompliancePage() {
  const [tab, setTab] = useState<Tab>('gstr1');
  const { gstEnabled } = useSettingsStore();
  const navigate = useNavigate();

  if (!gstEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 px-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5">
          <Lock size={28} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">GST Features Locked</h2>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          Add your GSTIN in Settings to unlock GSTR filing, E-Invoice, E-Way Bill, and all GST compliance features.
        </p>
        <div className="space-y-3">
          <button onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
            Go to Settings <ArrowRight size={16} />
          </button>
          <p className="text-xs text-slate-400">Settings → Business Profile → GST Registration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">GST Filing</h1>
        <p className="text-slate-500 text-sm mt-1">GSTR-1 · GSTR-3B · GSTR-2B Reconciliation · E-Invoice · E-Way Bill</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'gstr1'    && <Gstr1Tab />}
        {tab === 'gstr3b'   && <Gstr3bTab />}
        {tab === 'gstr2b'   && <Gstr2bTab />}
        {tab === 'einvoice' && <EInvoiceTab />}
        {tab === 'ewaybill' && <EWayBillTab />}
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import {
  BookOpen, ClipboardList, Shield, Pill,
  Plus, Trash2, Edit2, Save, X, Search, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  complianceService,
  NarcoticEntry, NarcoticEntryCreate,
  PrescriptionEntry, PrescriptionEntryCreate,
  LicenceAlert, LicenceSettings,
  DrugInteractionRow, InteractionStats,
} from '@/services/complianceService';
import { useAuthStore } from '@/store/authStore';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Narcotic Register Tab ─────────────────────────────────────
const BLANK_NARC: NarcoticEntryCreate = {
  entry_date: todayISO(), bill_id: null, bill_number: '', patient_name: '',
  patient_address: '', patient_age: '', doctor_name: '', doctor_reg_no: '',
  medicine_name: '', medicine_id: null, batch_number: '', quantity_dispensed: 0,
  unit: 'TAB', opening_balance: 0, quantity_received: 0, closing_balance: 0,
  supplier_name: '', purchase_invoice_no: '', remarks: '',
};

function NarcoticTab() {
  const { user } = useAuthStore();
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [entries, setEntries] = useState<NarcoticEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NarcoticEntry | null>(null);
  const [form, setForm] = useState<NarcoticEntryCreate>(BLANK_NARC);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complianceService.listNarcotic(from, to);
      setEntries(data.entries);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(BLANK_NARC); setShowForm(true); };
  const openEdit = (e: NarcoticEntry) => {
    setEditing(e);
    setForm({
      entry_date: e.entry_date, bill_id: e.bill_id, bill_number: e.bill_number,
      patient_name: e.patient_name, patient_address: e.patient_address, patient_age: e.patient_age,
      doctor_name: e.doctor_name, doctor_reg_no: e.doctor_reg_no,
      medicine_name: e.medicine_name, medicine_id: e.medicine_id,
      batch_number: e.batch_number, quantity_dispensed: e.quantity_dispensed, unit: e.unit,
      opening_balance: e.opening_balance, quantity_received: e.quantity_received,
      closing_balance: e.closing_balance, supplier_name: e.supplier_name,
      purchase_invoice_no: e.purchase_invoice_no, remarks: e.remarks,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await complianceService.updateNarcoticEntry(editing.id, form); toast.success('Updated'); }
      else { await complianceService.createNarcoticEntry(form, user?.id ?? 1); toast.success('Entry added'); }
      setShowForm(false); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try { await complianceService.deleteNarcoticEntry(id); toast.success('Deleted'); load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="h-9 border border-slate-200 rounded-lg px-2 text-sm" />
          <span className="text-slate-400">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="h-9 border border-slate-200 rounded-lg px-2 text-sm" />
          <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-slate-700">{editing ? 'Edit' : 'New'} Narcotic Entry</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Entry Date', key: 'entry_date', type: 'date' },
              { label: 'Patient Name', key: 'patient_name' },
              { label: 'Patient Age', key: 'patient_age' },
              { label: 'Patient Address', key: 'patient_address' },
              { label: 'Doctor Name', key: 'doctor_name' },
              { label: 'Doctor Reg No', key: 'doctor_reg_no' },
              { label: 'Medicine Name', key: 'medicine_name' },
              { label: 'Batch Number', key: 'batch_number' },
              { label: 'Unit', key: 'unit' },
              { label: 'Qty Dispensed', key: 'quantity_dispensed', type: 'number' },
              { label: 'Opening Balance', key: 'opening_balance', type: 'number' },
              { label: 'Qty Received', key: 'quantity_received', type: 'number' },
              { label: 'Closing Balance', key: 'closing_balance', type: 'number' },
              { label: 'Supplier', key: 'supplier_name' },
              { label: 'Invoice No', key: 'purchase_invoice_no' },
            ].map(({ label, key, type = 'text' }) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <input type={type}
                  value={(form as Record<string, unknown>)[key] as string ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Remarks</label>
            <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Date','Bill No','Patient','Doctor','Medicine','Batch','Qty','Remarks',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{e.entry_date}</td>
                <td className="px-3 py-2 text-blue-700">{e.bill_number}</td>
                <td className="px-3 py-2">{e.patient_name}</td>
                <td className="px-3 py-2">{e.doctor_name}</td>
                <td className="px-3 py-2 font-medium">{e.medicine_name}</td>
                <td className="px-3 py-2">{e.batch_number}</td>
                <td className="px-3 py-2">{e.quantity_dispensed} {e.unit}</td>
                <td className="px-3 py-2 text-slate-400">{e.remarks}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(e)} className="p-1 hover:bg-slate-200 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(e.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">No entries for this period</div>
        )}
      </div>
    </div>
  );
}

// ── Prescription Register Tab ─────────────────────────────────
const BLANK_PRESC: PrescriptionEntryCreate = {
  entry_date: todayISO(), bill_id: null, bill_number: '',
  patient_name: '', patient_age: '', patient_address: '',
  doctor_name: '', doctor_reg_no: '', medicine_name: '',
  medicine_id: null, schedule: 'H', batch_number: '',
  quantity: 0, unit: 'TAB', remarks: '',
};

function PrescriptionTab() {
  const { user } = useAuthStore();
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [entries, setEntries] = useState<PrescriptionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PrescriptionEntry | null>(null);
  const [form, setForm] = useState<PrescriptionEntryCreate>(BLANK_PRESC);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complianceService.listPrescription(from, to);
      setEntries(data.entries);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(BLANK_PRESC); setShowForm(true); };
  const openEdit = (e: PrescriptionEntry) => {
    setEditing(e);
    setForm({ entry_date: e.entry_date, bill_id: e.bill_id, bill_number: e.bill_number,
      patient_name: e.patient_name, patient_age: e.patient_age, patient_address: e.patient_address,
      doctor_name: e.doctor_name, doctor_reg_no: e.doctor_reg_no, medicine_name: e.medicine_name,
      medicine_id: e.medicine_id, schedule: e.schedule, batch_number: e.batch_number,
      quantity: e.quantity, unit: e.unit, remarks: e.remarks });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await complianceService.updatePrescriptionEntry(editing.id, form); toast.success('Updated'); }
      else { await complianceService.createPrescriptionEntry(form, user?.id ?? 1); toast.success('Entry added'); }
      setShowForm(false); load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try { await complianceService.deletePrescriptionEntry(id); toast.success('Deleted'); load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="h-9 border border-slate-200 rounded-lg px-2 text-sm" />
          <span className="text-slate-400">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="h-9 border border-slate-200 rounded-lg px-2 text-sm" />
          <button onClick={load} className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-slate-700">{editing ? 'Edit' : 'New'} Form 16 Entry</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Entry Date', key: 'entry_date', type: 'date' },
              { label: 'Patient Name', key: 'patient_name' },
              { label: 'Patient Age', key: 'patient_age' },
              { label: 'Doctor Name', key: 'doctor_name' },
              { label: 'Doctor Reg No', key: 'doctor_reg_no' },
              { label: 'Medicine Name', key: 'medicine_name' },
              { label: 'Schedule', key: 'schedule' },
              { label: 'Batch Number', key: 'batch_number' },
              { label: 'Quantity', key: 'quantity', type: 'number' },
            ].map(({ label, key, type = 'text' }) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <input type={type}
                  value={(form as Record<string, unknown>)[key] as string ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Date','Bill No','Patient','Doctor','Medicine','Sched','Qty',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{e.entry_date}</td>
                <td className="px-3 py-2 text-blue-700">{e.bill_number}</td>
                <td className="px-3 py-2">{e.patient_name}</td>
                <td className="px-3 py-2">{e.doctor_name}</td>
                <td className="px-3 py-2 font-medium">{e.medicine_name}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">{e.schedule}</span>
                </td>
                <td className="px-3 py-2">{e.quantity} {e.unit}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(e)} className="p-1 hover:bg-slate-200 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(e.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">No entries for this period</div>
        )}
      </div>
    </div>
  );
}

// ── Drug Licence Tab ──────────────────────────────────────────
function LicenceTab() {
  const [alerts, setAlerts] = useState<LicenceAlert[]>([]);
  const [settings, setSettings] = useState<LicenceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([complianceService.getLicenceAlerts(), complianceService.getLicenceSettings()]);
      setAlerts(a.alerts); setSettings(s);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await complianceService.saveLicenceSettings(settings, user?.id ?? 1);
      toast.success('Licence settings saved');
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const levelColour: Record<string, string> = {
    expired: 'bg-red-100 border-red-300 text-red-700',
    critical: 'bg-red-50 border-red-200 text-red-600',
    warning: 'bg-amber-50 border-amber-200 text-amber-600',
    info: 'bg-blue-50 border-blue-200 text-blue-600',
  };

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-700">Active Alerts</h3>
          {alerts.map(a => (
            <div key={a.key} className={`flex items-center justify-between rounded-xl p-4 border ${levelColour[a.level] ?? ''}`}>
              <div>
                <div className="font-medium">{a.label}</div>
                <div className="text-xs mt-0.5">Expires: {a.expiry_date} · {a.days_left <= 0 ? 'EXPIRED' : `${a.days_left} days left`}</div>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded">{a.level}</span>
            </div>
          ))}
        </div>
      )}

      {settings && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-700">Licence Details</h3>
          <div className="grid grid-cols-2 gap-4">
            {([
              ['Drug Licence No', 'drug_licence_no'],
              ['Drug Licence Expiry', 'drug_licence_expiry'],
              ['FSSAI Licence No', 'fssai_licence_no'],
              ['FSSAI Licence Expiry', 'fssai_licence_expiry'],
              ['Schedule X Licence No', 'schedule_x_licence_no'],
              ['Schedule X Licence Expiry', 'schedule_x_licence_expiry'],
            ] as [string, keyof LicenceSettings][]).map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <input
                  type={key.includes('expiry') ? 'date' : 'text'}
                  value={settings[key]}
                  onChange={e => setSettings(s => s ? { ...s, [key]: e.target.value } : s)}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm" />
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Licence Details'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Drug Interactions Tab ─────────────────────────────────────
function InteractionsTab() {
  const [stats, setStats] = useState<InteractionStats | null>(null);
  const [interactions, setInteractions] = useState<DrugInteractionRow[]>([]);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<DrugInteractionRow, 'id'>>({ drug1: '', drug2: '', severity: 'moderate', description: '', management: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        complianceService.getInteractionStats(),
        complianceService.listInteractions(search, severity || undefined),
      ]);
      setStats(s); setInteractions(d.interactions);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally { setLoading(false); }
  }, [search, severity]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await complianceService.createInteraction(form);
      toast.success('Interaction added');
      setShowForm(false);
      setForm({ drug1: '', drug2: '', severity: 'moderate', description: '', management: '' });
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try { await complianceService.deleteInteraction(id); toast.success('Deleted'); load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const sevColour: Record<string, string> = {
    major: 'bg-red-100 text-red-700',
    moderate: 'bg-amber-100 text-amber-700',
    minor: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Pairs', val: stats.total, cls: 'text-slate-700' },
            { label: 'Major', val: stats.major, cls: 'text-red-600' },
            { label: 'Moderate', val: stats.moderate, cls: 'text-amber-600' },
            { label: 'Minor', val: stats.minor, cls: 'text-green-600' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
              <div className="text-xs text-slate-500">{label}</div>
              <div className={`text-2xl font-bold ${cls}`}>{val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search drug…"
              className="h-9 pl-8 pr-3 border border-slate-200 rounded-lg text-sm w-52 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            className="h-9 border border-slate-200 rounded-lg px-2 text-sm bg-white">
            <option value="">All severities</option>
            <option value="major">Major</option>
            <option value="moderate">Moderate</option>
            <option value="minor">Minor</option>
          </select>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Pair
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-slate-700">New Drug Interaction</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Drug 1</label>
              <input value={form.drug1} onChange={e => setForm(f => ({ ...f, drug1: e.target.value }))}
                className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Drug 2</label>
              <input value={form.drug2} onChange={e => setForm(f => ({ ...f, drug2: e.target.value }))}
                className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as 'major' | 'moderate' | 'minor' }))}
                className="w-full h-8 border border-slate-200 rounded px-2 text-sm bg-white">
                <option value="major">Major</option>
                <option value="moderate">Moderate</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Management</label>
            <input value={form.management} onChange={e => setForm(f => ({ ...f, management: e.target.value }))}
              className="w-full h-8 border border-slate-200 rounded px-2 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Drug 1','Drug 2','Severity','Description','Management',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {interactions.map(i => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{i.drug1}</td>
                <td className="px-3 py-2 font-medium">{i.drug2}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${sevColour[i.severity] ?? ''}`}>
                    {i.severity.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{i.description}</td>
                <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{i.management}</td>
                <td className="px-3 py-2">
                  <button onClick={() => del(i.id)} className="p-1 hover:bg-red-100 rounded text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {interactions.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">No interactions found</div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
type Tab = 'narcotic' | 'prescription' | 'licence' | 'interactions';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'narcotic',      label: 'Narcotic Register', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'prescription',  label: 'Form 16 / Rx Reg',  icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'licence',       label: 'Drug Licence',       icon: <Shield className="w-4 h-4" /> },
  { id: 'interactions',  label: 'Drug Interactions',  icon: <Pill className="w-4 h-4" /> },
];

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>('narcotic');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Compliance</h1>
        <p className="text-slate-500 text-sm mt-1">NDPS Register · Form 16 · Drug Licence Tracking · Drug Interactions</p>
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
        {tab === 'narcotic'     && <NarcoticTab />}
        {tab === 'prescription' && <PrescriptionTab />}
        {tab === 'licence'      && <LicenceTab />}
        {tab === 'interactions' && <InteractionsTab />}
      </div>
    </div>
  );
}

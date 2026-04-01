import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { invoke } from '@tauri-apps/api/core';

interface GstComplianceSettings {
  pharmacy_state_code: string;
  irp_username: string;
  irp_password: string;
  irp_app_key: string;
  irp_sandbox_mode: string;
  ewb_username: string;
  ewb_password: string;
  ewb_sandbox_mode: string;
  drug_licence_no: string;
  drug_licence_expiry: string;
  fssai_licence_no: string;
  fssai_licence_expiry: string;
}

const STATE_CODES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' }, { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)' },
];

const DEFAULTS: GstComplianceSettings = {
  pharmacy_state_code: '27',
  irp_username: '', irp_password: '', irp_app_key: '', irp_sandbox_mode: 'true',
  ewb_username: '', ewb_password: '', ewb_sandbox_mode: 'true',
  drug_licence_no: '', drug_licence_expiry: '',
  fssai_licence_no: '', fssai_licence_expiry: '',
};

export function GstComplianceTab() {
  const [form, setForm] = useState<GstComplianceSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showIrpPwd, setShowIrpPwd] = useState(false);
  const [showEwbPwd, setShowEwbPwd] = useState(false);

  useEffect(() => {
    const keys = Object.keys(DEFAULTS) as (keyof GstComplianceSettings)[];
    Promise.all(
      keys.map(k =>
        invoke<string | null>('settings_get', { key: k })
          .then(v => [k, v ? v.replace(/^"|"$/g, '') : ''] as const)
          .catch(() => [k, ''] as const)
      )
    ).then(pairs => {
      setForm(Object.fromEntries(pairs) as GstComplianceSettings);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await invoke('settings_set', { key, value: `"${value}"`, userId: 0 });
      }
      toast.success('GST Compliance settings saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full h-10 border border-slate-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="text-sm text-slate-600 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );

  if (loading) return <div className="flex justify-center py-16 text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* State Code */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">GST State Settings</h3>
        <Field label="Pharmacy State Code">
          <select
            value={form.pharmacy_state_code}
            onChange={e => setForm(f => ({ ...f, pharmacy_state_code: e.target.value }))}
            className={`${inp} bg-white`}>
            {STATE_CODES.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Drug Licence */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Drug Licence Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Drug Licence Number">
            <input value={form.drug_licence_no} onChange={e => setForm(f => ({ ...f, drug_licence_no: e.target.value }))}
              className={inp} placeholder="e.g. MH-MUM-12345" />
          </Field>
          <Field label="Drug Licence Expiry">
            <input type="date" value={form.drug_licence_expiry}
              onChange={e => setForm(f => ({ ...f, drug_licence_expiry: e.target.value }))} className={inp} />
          </Field>
          <Field label="FSSAI Licence Number">
            <input value={form.fssai_licence_no} onChange={e => setForm(f => ({ ...f, fssai_licence_no: e.target.value }))}
              className={inp} placeholder="14-digit FSSAI number" />
          </Field>
          <Field label="FSSAI Licence Expiry">
            <input type="date" value={form.fssai_licence_expiry}
              onChange={e => setForm(f => ({ ...f, fssai_licence_expiry: e.target.value }))} className={inp} />
          </Field>
        </div>
      </div>

      {/* IRP (E-Invoice) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">IRP Credentials (E-Invoice)</h3>
            <p className="text-sm text-slate-500 mt-0.5">Invoice Registration Portal — required for turnover &gt; ₹5 Crore</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Sandbox</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, irp_sandbox_mode: f.irp_sandbox_mode === 'true' ? 'false' : 'true' }))}
              className={`w-10 h-5 rounded-full relative transition-colors ${form.irp_sandbox_mode === 'true' ? 'bg-amber-400' : 'bg-green-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.irp_sandbox_mode === 'true' ? 'left-0.5' : 'left-5'}`} />
            </button>
          </div>
        </div>
        {form.irp_sandbox_mode === 'true' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">Sandbox mode active. Switch off for live production. Register at einvoice1.gst.gov.in.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="IRP Username" hint="Your GST portal login / IRP registered username">
            <input value={form.irp_username} onChange={e => setForm(f => ({ ...f, irp_username: e.target.value }))}
              className={inp} placeholder="e.g. 27AAAPA1234A1Z5" />
          </Field>
          <Field label="IRP Password">
            <div className="relative">
              <input type={showIrpPwd ? 'text' : 'password'} value={form.irp_password}
                onChange={e => setForm(f => ({ ...f, irp_password: e.target.value }))} className={`${inp} pr-10`} />
              <button type="button" onClick={() => setShowIrpPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showIrpPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <Field label="App Key (Client ID)" hint="From IRP developer registration">
            <input value={form.irp_app_key} onChange={e => setForm(f => ({ ...f, irp_app_key: e.target.value }))}
              className={inp} placeholder="Application Key" />
          </Field>
        </div>
      </div>

      {/* E-Way Bill */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">E-Way Bill Credentials (NIC)</h3>
            <p className="text-sm text-slate-500 mt-0.5">Required for goods movement &gt; ₹50,000 — ewaybillgst.gov.in</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Sandbox</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, ewb_sandbox_mode: f.ewb_sandbox_mode === 'true' ? 'false' : 'true' }))}
              className={`w-10 h-5 rounded-full relative transition-colors ${form.ewb_sandbox_mode === 'true' ? 'bg-amber-400' : 'bg-green-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.ewb_sandbox_mode === 'true' ? 'left-0.5' : 'left-5'}`} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="E-Way Bill Username" hint="Your GSTIN or username on ewaybillgst.gov.in">
            <input value={form.ewb_username} onChange={e => setForm(f => ({ ...f, ewb_username: e.target.value }))}
              className={inp} />
          </Field>
          <Field label="E-Way Bill Password">
            <div className="relative">
              <input type={showEwbPwd ? 'text' : 'password'} value={form.ewb_password}
                onChange={e => setForm(f => ({ ...f, ewb_password: e.target.value }))} className={`${inp} pr-10`} />
              <button type="button" onClick={() => setShowEwbPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showEwbPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : 'Save GST Compliance Settings'}
      </button>
    </div>
  );
}

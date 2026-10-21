import React, { useState, useMemo } from 'react';
import {
  Users,
  FileSpreadsheet,
  Layers,
  FileText,
  History as HistoryIcon,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Building2,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TABLE_1_MINORS } from '../DepartmentBilling/table1SeedData';
import SubContractorBillSheet from './SubContractorBillSheet';
import BackToBackReconciliation from './BackToBackReconciliation';
import SubContractorLedger from './SubContractorLedger';
import { getRMBills } from '../../utils/storageManager';

const DEFAULT_SUB_CONTRACTORS = [
  'Apex Engineering & Infrastructure',
  'Shree Ram Construction Co.',
  'Kalyan Earthmovers & Piping',
  'Balaji Pipeline Infrastructure',
  'Omkar Infratech Projects',
  'Sai Krupa Engineering Works'
];

const formatCurrency = (val: number) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹ ' + Math.round(val).toLocaleString('en-IN');
};

export default function RM2() {
  const [activeTab, setActiveTab] = useState<'generate' | 'reconcile' | 'ledger'>('generate');

  // Sub-contractor selection
  const [selectedSubContractor, setSelectedSubContractor] = useState(DEFAULT_SUB_CONTRACTORS[0]);
  const [selectedMinor, setSelectedMinor] = useState('injewada');

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute aggregate numbers from all sub-contractor bills
  const subBills = useMemo(() => {
    return getRMBills().filter(b => b.billType === 'Actual');
  }, [refreshKey]);

  const totalGrossBilled = subBills.reduce((sum, b) => sum + (b.grossAmount || b.billAmount || 0), 0);
  const totalNetPaid = subBills.reduce((sum, b) => sum + (b.billAmount || 0), 0);
  const totalDeductions = totalGrossBilled - totalNetPaid;
  const totalContractorMargin = subBills.reduce((sum, b) => sum + (b.totalMargin || 0), 0);

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-4 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen">
      {/* Top Header Card */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 tracking-wider">
                Table 1 Back-to-Back Flow
              </span>
              <span className="text-xs text-gray-400 font-mono">Sub-Contractor Work Packages</span>
            </div>
            <h1 className="text-base sm:text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="text-purple-600 shrink-0" size={22} />
              Sub-Contractor Billing (RM2) — Measurement & Leak Prevention
            </h1>
            <p className="text-xs text-gray-500 max-w-4xl">
              Manage work orders, piece-rate item billing, material/advance deductions, and <strong>back-to-back safety checks</strong> against Department certified quantities across all minors.
            </p>
          </div>

          {/* Sub-Contractor & Minor Selection Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Sub-Contractor
              </label>
              <select
                value={selectedSubContractor}
                onChange={e => setSelectedSubContractor(e.target.value)}
                className="text-xs font-bold px-3 py-2 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:outline-none min-w-[220px]"
              >
                {DEFAULT_SUB_CONTRACTORS.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Assigned Minor Scope
              </label>
              <select
                value={selectedMinor}
                onChange={e => setSelectedMinor(e.target.value)}
                className="text-xs font-bold px-3 py-2 border border-gray-300 rounded-xl bg-purple-50 text-purple-900 border-purple-200 focus:ring-2 focus:ring-purple-500 focus:outline-none min-w-[180px]"
              >
                {TABLE_1_MINORS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.rd})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Aggregate KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Total Sub Billed (Gross)</span>
            <div className="text-base sm:text-lg font-black text-purple-950 font-mono mt-0.5">
              {formatCurrency(totalGrossBilled)}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5">{subBills.length} bills generated</div>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Recoveries & Deductions</span>
            <div className="text-base sm:text-lg font-black text-amber-950 font-mono mt-0.5">
              - {formatCurrency(totalDeductions)}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">Material, advance, retention, TDS</div>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Net Paid to Subs</span>
            <div className="text-base sm:text-lg font-black text-emerald-950 font-mono mt-0.5">
              {formatCurrency(totalNetPaid)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Approved vouchers</div>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Gross Margin Secured</span>
            <div className="text-base sm:text-lg font-black text-indigo-950 font-mono mt-0.5">
              +{formatCurrency(totalContractorMargin)}
            </div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Dept Rate vs Sub Rate Margin</div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-xl border border-gray-200 shadow-xs">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'generate'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FileText size={15} />
          Generate Sub Bill
        </button>

        <button
          onClick={() => setActiveTab('reconcile')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'reconcile'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <ShieldCheck size={15} />
          Back-to-Back Reconciliation & Leak Guard
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <HistoryIcon size={15} />
          Sub-Contractor Ledger ({subBills.length})
        </button>
      </div>

      {/* Tab Views */}
      {activeTab === 'generate' && (
        <SubContractorBillSheet
          selectedSubContractor={selectedSubContractor}
          selectedMinor={selectedMinor}
          onBillGenerated={() => {
            setRefreshKey(prev => prev + 1);
            setActiveTab('ledger');
          }}
        />
      )}

      {activeTab === 'reconcile' && (
        <BackToBackReconciliation selectedMinor={selectedMinor} />
      )}

      {activeTab === 'ledger' && (
        <SubContractorLedger onRefresh={() => setRefreshKey(prev => prev + 1)} />
      )}
    </div>
  );
}

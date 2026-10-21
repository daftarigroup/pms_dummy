import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Layers,
  FileText,
  History as HistoryIcon,
  Download,
  RotateCcw,
  Sliders,
  CheckCircle2,
  TrendingUp,
  Percent,
  Building2,
  MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateTable1, CalculationOptions } from './billingEngine';
import DepartmentAbstractMatrix from './DepartmentAbstractMatrix';
import DepartmentRAGenerator from './DepartmentRAGenerator';
import DepartmentBillHistory from './DepartmentBillHistory';
import { exportTable1ToExcel } from './table1ExcelExporter';

export default function RM1() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'generate' | 'history'>('matrix');
  const [selectedMinor, setSelectedMinor] = useState('ALL');

  // Calculation Engine options
  const [useFixes, setUseFixes] = useState(false); // default: false to match exact raw spreadsheet values

  const calcOptions: CalculationOptions = useMemo(() => ({
    includeDudhara: true,
    fixKesalwadaBedding: useFixes,
    useStrict5YearOm: useFixes,
    fixFlowMeter1200: useFixes
  }), [useFixes]);

  const calcResult = useMemo(() => {
    return calculateTable1(undefined, calcOptions);
  }, [calcOptions]);

  const handleExportExcel = () => {
    try {
      exportTable1ToExcel(calcResult);
      toast.success('Table 1 exported to Excel!');
    } catch (e) {
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-4 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen">
      {/* Top Header Card */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 tracking-wider">
                Table 1 Logic
              </span>
              <span className="text-xs text-gray-400 font-mono">Sheet: "Table 1"</span>
            </div>
            <h1 className="text-base sm:text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Building2 className="text-indigo-600 shrink-0" size={22} />
              Department Billing (RM1) — Quantity Abstract & Client RA Billing
            </h1>
            <p className="text-xs text-gray-500 max-w-4xl">
              Construction of Pipe Distribution Network on Minors along with CADWM from RD 0 to 10000 m on Main Canal of Surewada Lift Irrigation Scheme (2073 Ha).
              Comparing <strong>Tender (Schedule B)</strong> vs <strong>Design</strong> quantities & amounts.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Formula Fixes vs Raw Parity */}
            <button
              onClick={() => {
                setUseFixes(!useFixes);
                toast(useFixes ? 'Switched to Raw Excel Parity mode' : 'Applied S31 Bedding & 5-Yr O&M formula fixes', { icon: '⚙️' });
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                useFixes
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Toggle between raw Excel sheet numbers and corrected bedding/O&M formulas"
            >
              <Sliders size={14} />
              {useFixes ? 'Formula Fixes: ON' : 'Raw Sheet Parity'}
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Download size={14} /> Export Table 1 (.xlsx)
            </button>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Tender Grand Total</span>
            <div className="text-base sm:text-lg font-black text-blue-950 font-mono mt-0.5">
              ₹ {(calcResult.tenderGrandTotal / 10000000).toFixed(2)} Cr
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">
              ₹ {Math.round(calcResult.tenderCostPerHa).toLocaleString('en-IN')} / Ha ({calcResult.tenderCcaHa.toFixed(1)} Ha)
            </div>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Design Grand Total</span>
            <div className="text-base sm:text-lg font-black text-indigo-950 font-mono mt-0.5">
              ₹ {(calcResult.designGrandTotal / 10000000).toFixed(2)} Cr
            </div>
            <div className="text-[10px] text-indigo-600 mt-0.5">
              ₹ {Math.round(calcResult.designCostPerHa).toLocaleString('en-IN')} / Ha ({calcResult.designCcaHa.toFixed(1)} Ha)
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${calcResult.diffGrandTotal >= 0 ? 'bg-rose-50/60 border-rose-100' : 'bg-emerald-50/60 border-emerald-100'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${calcResult.diffGrandTotal >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              Variation (Design - Tender)
            </span>
            <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${calcResult.diffGrandTotal >= 0 ? 'text-rose-950' : 'text-emerald-950'}`}>
              {calcResult.diffGrandTotal >= 0 ? '+ ' : '- '}₹ {Math.abs(calcResult.diffGrandTotal / 10000000).toFixed(2)} Cr
            </div>
            <div className={`text-[10px] font-bold mt-0.5 ${calcResult.diffGrandTotal >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {calcResult.pctDiffGrandTotal >= 0 ? `+${calcResult.pctDiffGrandTotal.toFixed(2)}%` : `${calcResult.pctDiffGrandTotal.toFixed(2)}%`}
            </div>
          </div>

          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">HDPE Pipe Supply Diff</span>
            <div className="text-base sm:text-lg font-black text-amber-950 font-mono mt-0.5">
              +{calcResult.hdpeSupplyDiffMeters.toLocaleString('en-IN')} m
            </div>
            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
              +{calcResult.hdpeSupplyDiffPct.toFixed(2)}% (Tnd: {calcResult.hdpeSupplyTenderMeters.toLocaleString('en-IN')}m)
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Minor Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet size={15} />
            Table 1 Abstract Matrix
          </button>

          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={15} />
            Generate RA Bill
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HistoryIcon size={15} />
            Billing History
          </button>
        </div>

        {/* Minor Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-tight flex items-center gap-1">
            <MapPin size={13} className="text-indigo-600" />
            Minor Focus:
          </span>
          <select
            value={selectedMinor}
            onChange={e => setSelectedMinor(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 border border-gray-300 rounded-lg bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Minors (8 Minors RD 0 - 10,000m)</option>
            {calcResult.minors.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.rd})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'matrix' && (
        <DepartmentAbstractMatrix calcResult={calcResult} selectedMinorFilter={selectedMinor} />
      )}

      {activeTab === 'generate' && (
        <DepartmentRAGenerator calcResult={calcResult} onBillGenerated={() => setActiveTab('history')} />
      )}

      {activeTab === 'history' && (
        <DepartmentBillHistory onRefresh={() => {}} />
      )}
    </div>
  );
}

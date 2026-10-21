import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { FileText, Calculator, ShieldCheck, Printer, CheckCircle2, DollarSign } from 'lucide-react';
import { getTodayDate } from '../../utils/helpers';
import ModalForm from '../../components/ModalForm';
import { computeBillFromExecutionEntries } from './dynamicBillCalculator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bill: any;
  onSubmitBill: (billId: string, payload: any) => void;
}

const formatCurrency = (val: number) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹ ' + Math.round(val).toLocaleString('en-IN');
};

export default function GenerateBillModal({ isOpen, onClose, bill, onSubmitBill }: Props) {
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(getTodayDate());
  const [remarks, setRemarks] = useState('');
  const [overrideRates, setOverrideRates] = useState<Record<string, number>>({});

  // Deduction configs
  const [securityDepositPct, setSecurityDepositPct] = useState(5);
  const [tdsPct, setTdsPct] = useState(2);
  const [gstTdsPct, setGstTdsPct] = useState(2);
  const [labourCessPct, setLabourCessPct] = useState(1);

  useEffect(() => {
    if (isOpen && bill) {
      setBillNo(bill.billNo || bill.rmNo?.replace(/^RM-/i, 'RA-') || 'RA-01');
      setBillDate(bill.billDate || getTodayDate());
      setRemarks(bill.billRemarks || '');
      setOverrideRates({});
    }
  }, [isOpen, bill]);

  // Compute live Table 1 bill from sent execution entries
  const calculation = useMemo(() => {
    if (!bill) return null;
    return computeBillFromExecutionEntries(bill, overrideRates, {
      securityDepositPct,
      tdsPct,
      gstTdsPct,
      labourCessPct
    });
  }, [bill, overrideRates, securityDepositPct, tdsPct, gstTdsPct, labourCessPct]);

  if (!isOpen || !bill || !calculation) return null;

  const handleRateChange = (itemId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setOverrideRates(prev => ({ ...prev, [itemId]: num }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billNo.trim()) {
      toast.error('Bill Number is required');
      return;
    }
    if (calculation.netPayable <= 0 && calculation.grossAmount <= 0) {
      toast.error('Bill amount must be greater than zero');
      return;
    }

    const payload = {
      billNo: billNo.trim(),
      billDate,
      billRemarks: remarks,
      grossAmount: calculation.grossAmount,
      billAmount: calculation.netPayable,
      totalLengthMeters: calculation.totalLengthMeters,
      deductions: calculation.deductions,
      itemBreakdown: calculation.lineItems,
      pipeDiaBreakdown: calculation.pipeDiaBreakdown,
      status: 'billed'
    };

    onSubmitBill(bill.id, payload);
    toast.success(`Department RA Bill ${billNo} generated successfully!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200">
                Table 1 Logic Calculation
              </span>
              <span className="font-mono text-xs text-slate-400">Ref: {bill.rmNo}</span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">
              Generate Department RA Bill — {bill.projectName || bill.projectNo}
              {bill.minorName && <span className="text-indigo-300"> ({bill.minorName})</span>}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1 text-[10px]">RA Bill Number *</label>
              <input
                type="text"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                placeholder="e.g. RA-01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1 text-[10px]">Bill Date *</label>
              <input
                type="date"
                value={billDate}
                onChange={e => setBillDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1 text-[10px]">Remarks / Note</label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Optional remarks"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* Table 1 Computed Item Breakdown */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-2.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700 uppercase">
              <span>Itemized Abstract from Sent Execution Entries ({bill.entries?.length || 0} entries)</span>
              <span className="font-mono text-indigo-700">{calculation.totalLengthMeters.toLocaleString('en-IN')} m Total Length</span>
            </div>

            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-800 text-white sticky top-0 text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-2 text-center w-14">Unit</th>
                    <th className="py-2 px-2 text-right w-24">Executed Qty</th>
                    <th className="py-2 px-2 text-right w-28">Rate (₹)</th>
                    <th className="py-2 px-3 text-right w-32">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                  {calculation.lineItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-sans font-medium text-gray-900 leading-tight">
                        {item.description}
                        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 font-sans">{item.unit}</td>
                      <td className="py-2 px-2 text-right font-bold text-indigo-900">{item.quantity.toLocaleString('en-IN')}</td>

                      {/* Inline Rate Edit */}
                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={e => handleRateChange(item.id, e.target.value)}
                          className="w-24 px-1.5 py-0.5 text-right font-bold text-gray-800 border rounded focus:ring-1 focus:ring-indigo-500"
                          step="0.01"
                        />
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-gray-950">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statutory Recoveries Section */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800 uppercase">
              <span className="flex items-center gap-1.5"><Calculator size={14} className="text-indigo-600" /> Government Statutory Deductions</span>
              <span className="text-[10px] text-gray-500">Calculated on Gross Work Done</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                  <span>Security Deposit (5%)</span>
                  <input
                    type="number"
                    value={securityDepositPct}
                    onChange={e => setSecurityDepositPct(parseFloat(e.target.value) || 0)}
                    className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                  />
                </div>
                <div className="text-xs font-bold text-rose-700 mt-1">- {formatCurrency(calculation.deductions.securityDeposit)}</div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                  <span>IT TDS (u/s 194C)</span>
                  <input
                    type="number"
                    value={tdsPct}
                    onChange={e => setTdsPct(parseFloat(e.target.value) || 0)}
                    className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                  />
                </div>
                <div className="text-xs font-bold text-rose-700 mt-1">- {formatCurrency(calculation.deductions.tdsAmount)}</div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                  <span>GST TDS (2%)</span>
                  <input
                    type="number"
                    value={gstTdsPct}
                    onChange={e => setGstTdsPct(parseFloat(e.target.value) || 0)}
                    className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                  />
                </div>
                <div className="text-xs font-bold text-rose-700 mt-1">- {formatCurrency(calculation.deductions.gstTdsAmount)}</div>
              </div>

              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                  <span>Labour Cess (1%)</span>
                  <input
                    type="number"
                    value={labourCessPct}
                    onChange={e => setLabourCessPct(parseFloat(e.target.value) || 0)}
                    className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                  />
                </div>
                <div className="text-xs font-bold text-rose-700 mt-1">- {formatCurrency(calculation.deductions.labourCess)}</div>
              </div>
            </div>
          </div>

          {/* Grand Totals Summary Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Gross Work Done</div>
                <div className="text-lg font-black text-white font-mono">{formatCurrency(calculation.grossAmount)}</div>
              </div>
              <div className="h-8 w-px bg-slate-700 hidden sm:block" />
              <div>
                <div className="text-[10px] font-bold text-rose-400 uppercase">Total Deductions</div>
                <div className="text-lg font-black text-rose-300 font-mono">- {formatCurrency(calculation.deductions.totalDeductions)}</div>
              </div>
              <div className="h-8 w-px bg-slate-700 hidden sm:block" />
              <div>
                <div className="text-[10px] font-bold text-emerald-400 uppercase">Net Payable Amount</div>
                <div className="text-xl font-black text-emerald-300 font-mono">{formatCurrency(calculation.netPayable)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} /> Certify & Save RA Bill
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  FileText,
  Calculator,
  ShieldCheck,
  Printer,
  CheckCircle2,
  DollarSign,
  Tag,
  Building2,
  Users,
  Percent,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { getTodayDate } from '../../utils/helpers';
import { computeBillFromExecutionEntries } from './dynamicBillCalculator';
import { getAvailablePOsForProject, resolvePoNumberForProject } from './table1RateMaster';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bill: any;
  onSubmitBill: (billId: string, payload: any) => void;
  mode?: 'DEPARTMENT' | 'SUBCONTRACTOR';
}

const formatCurrency = (val: number) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹ ' + Math.round(val).toLocaleString('en-IN');
};

export default function GenerateBillModal({ isOpen, onClose, bill, onSubmitBill, mode }: Props) {
  // Determine if this is Department Billing (Schedule - B) or Sub-Contractor Billing (PO)
  const isSubContractor = (mode || (bill?.billType === 'Actual' ? 'SUBCONTRACTOR' : 'DEPARTMENT')) === 'SUBCONTRACTOR';

  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(getTodayDate());
  const [remarks, setRemarks] = useState('');
  const [overrideRates, setOverrideRates] = useState<Record<string, number>>({});

  // Sub-Contractor PO details
  const [selectedPoNumber, setSelectedPoNumber] = useState('');
  const [subContractorName, setSubContractorName] = useState('');

  // Department Statutory Deductions
  const [securityDepositPct, setSecurityDepositPct] = useState(5);
  const [deptTdsPct, setDeptTdsPct] = useState(2);
  const [gstTdsPct, setGstTdsPct] = useState(2);
  const [labourCessPct, setLabourCessPct] = useState(1);

  // Sub-Contractor Commercial Deductions
  const [retentionPct, setRetentionPct] = useState(5);
  const [subTdsPct, setSubTdsPct] = useState(1); // 1% for individual, 2% for company
  const [advanceRecoveryPct, setAdvanceRecoveryPct] = useState(0);
  const [materialRecovery, setMaterialRecovery] = useState(0);
  const [dieselCharges, setDieselCharges] = useState(0);
  const [otherDebits, setOtherDebits] = useState(0);

  // Available POs for selection
  const availablePOs = useMemo(() => {
    if (!bill) return [];
    return getAvailablePOsForProject(bill.projectNo, bill.subContractorName || bill.contractorName);
  }, [bill]);

  useEffect(() => {
    if (isOpen && bill) {
      const defaultBillNo = isSubContractor
        ? (bill.billNo || bill.rmNo?.replace(/^RM-/i, 'SUB-RA-') || 'SUB-RA-01')
        : (bill.billNo || bill.rmNo?.replace(/^RM-/i, 'RA-') || 'RA-01');

      setBillNo(defaultBillNo);
      setBillDate(bill.billDate || getTodayDate());
      setRemarks(bill.billRemarks || '');
      setOverrideRates({});

      const initialSubName = bill.subContractorName || bill.contractorName || 'Sub-Contractor';
      setSubContractorName(initialSubName);

      const resolvedPo = (
        bill.poNumber ||
        resolvePoNumberForProject(bill.projectNo, initialSubName) ||
        (availablePOs.length > 0 ? availablePOs[0].poNumber : '')
      ).trim();
      setSelectedPoNumber(resolvedPo);

      // Load existing deductions if editing
      if (bill.deductions) {
        if (isSubContractor) {
          if (bill.deductions.retentionPct !== undefined) setRetentionPct(bill.deductions.retentionPct);
          if (bill.deductions.tdsPct !== undefined) setSubTdsPct(bill.deductions.tdsPct);
          if (bill.deductions.materialIssuesRecovery !== undefined) setMaterialRecovery(bill.deductions.materialIssuesRecovery);
          if (bill.deductions.advanceRecoveryPct !== undefined) setAdvanceRecoveryPct(bill.deductions.advanceRecoveryPct);
          if (bill.deductions.dieselCharges !== undefined) setDieselCharges(bill.deductions.dieselCharges);
          if (bill.deductions.otherDebits !== undefined) setOtherDebits(bill.deductions.otherDebits);
        } else {
          if (bill.deductions.securityDepositPct !== undefined) setSecurityDepositPct(bill.deductions.securityDepositPct);
          if (bill.deductions.tdsPct !== undefined) setDeptTdsPct(bill.deductions.tdsPct);
          if (bill.deductions.gstTdsPct !== undefined) setGstTdsPct(bill.deductions.gstTdsPct);
          if (bill.deductions.labourCessPct !== undefined) setLabourCessPct(bill.deductions.labourCessPct);
        }
      }
    }
  }, [isOpen, bill, isSubContractor, availablePOs]);

  // Compute live bill from sent entries with dual rate logic:
  // - Department: Schedule - B Report rates
  // - Sub-Contractor: PO rates
  const calculation = useMemo(() => {
    if (!bill) return null;

    return computeBillFromExecutionEntries(bill, {
      rateMode: isSubContractor ? 'PO' : 'SCHEDULE_B',
      poNumber: selectedPoNumber,
      subContractorName,
      overrideRates,
      deductionConfig: isSubContractor
        ? {
            retentionPct,
            tdsPct: subTdsPct,
            advanceRecoveryPct,
            materialIssuesRecovery: materialRecovery,
            dieselCharges,
            otherDebits
          }
        : {
            securityDepositPct,
            tdsPct: deptTdsPct,
            gstTdsPct,
            labourCessPct
          }
    });
  }, [
    bill,
    isSubContractor,
    selectedPoNumber,
    subContractorName,
    overrideRates,
    securityDepositPct,
    deptTdsPct,
    gstTdsPct,
    labourCessPct,
    retentionPct,
    subTdsPct,
    advanceRecoveryPct,
    materialRecovery,
    dieselCharges,
    otherDebits
  ]);

  if (!isOpen || !bill || !calculation) return null;

  const handleRateChange = (itemId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setOverrideRates(prev => ({ ...prev, [itemId]: num }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billNo.trim()) {
      toast.error('Bill / Voucher Number is required');
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
      poNumber: isSubContractor ? selectedPoNumber : undefined,
      subContractorName: isSubContractor ? subContractorName : undefined,
      rateMode: isSubContractor ? 'PO' : 'SCHEDULE_B',
      grossAmount: calculation.grossAmount,
      billAmount: calculation.netPayable,
      totalLengthMeters: calculation.totalLengthMeters,
      deductions: calculation.deductions,
      itemBreakdown: calculation.lineItems,
      pipeDiaBreakdown: calculation.pipeDiaBreakdown,
      contractorMargin: calculation.contractorMargin,
      contractorMarginPct: calculation.contractorMarginPct,
      status: 'billed'
    };

    onSubmitBill(bill.id, payload);
    toast.success(
      isSubContractor
        ? `Sub-Contractor Voucher ${billNo} generated successfully!`
        : `Department RA Bill ${billNo} generated successfully!`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          className={`p-4 sm:p-5 text-white flex items-center justify-between border-b ${
            isSubContractor
              ? 'bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border-purple-900'
              : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${
                  isSubContractor ? 'bg-purple-500/30 text-purple-200' : 'bg-indigo-500/30 text-indigo-200'
                }`}
              >
                {isSubContractor ? 'Sub-Contractor Billing • Rate from PO' : 'Department Billing • Rate from Schedule - B'}
              </span>
              <span className="font-mono text-xs text-slate-400">Ref: {bill.rmNo}</span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">
              {isSubContractor ? 'Generate Sub-Contractor Payment Voucher' : 'Generate Department RA Bill'} —{' '}
              {bill.projectName || bill.projectNo}
              {bill.minorName && (
                <span className={isSubContractor ? 'text-purple-300' : 'text-indigo-300'}>
                  {' '}
                  ({bill.minorName})
                </span>
              )}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1 text-[10px]">
                {isSubContractor ? 'Sub-Contractor Voucher No *' : 'RA Bill Number *'}
              </label>
              <input
                type="text"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                placeholder={isSubContractor ? 'e.g. SUB-RA-01' : 'e.g. RA-01'}
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

            {/* PO Selection (Sub-Contractor mode) or Project/Contractor Info */}
            {isSubContractor ? (
              <div>
                <label className="block font-bold text-purple-900 uppercase mb-1 text-[10px] flex items-center justify-between">
                  <span>Linked PO Number *</span>
                  <span className="text-[9px] text-purple-700 font-normal">Rates loaded from PO</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedPoNumber}
                    onChange={e => setSelectedPoNumber(e.target.value)}
                    placeholder="Enter or select PO #"
                    list="po-options"
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono font-bold bg-purple-50/30 text-purple-950"
                    required
                  />
                  <datalist id="po-options">
                    {availablePOs.map(p => (
                      <option key={p.poNumber} value={p.poNumber}>
                        {p.poNumber} ({p.vendorName})
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1 text-[10px]">Rate Source</label>
                <div className="px-3 py-2 border border-indigo-200 bg-indigo-50/50 rounded-lg text-indigo-900 font-semibold truncate text-[11px] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-indigo-600 shrink-0" />
                  <span>Schedule - B Report</span>
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1 text-[10px]">
                {isSubContractor ? 'Sub-Contractor Party' : 'Remarks / Note'}
              </label>
              {isSubContractor ? (
                <input
                  type="text"
                  value={subContractorName}
                  onChange={e => setSubContractorName(e.target.value)}
                  placeholder="Subcontractor Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white font-medium"
                />
              ) : (
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              )}
            </div>
          </div>

          {/* Computed Item Breakdown Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-2.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700 uppercase">
              <span className="flex items-center gap-2">
                <span>
                  Itemized Work Done ({bill.entries?.length || 0} entries sent from{' '}
                  {isSubContractor ? 'Actual Details' : 'Execution Details'})
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSubContractor
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {isSubContractor ? `Rates from PO #${selectedPoNumber || 'Auto'}` : 'Rates from Schedule - B'}
                </span>
              </span>
              <span className="font-mono text-indigo-700">
                {calculation.totalLengthMeters.toLocaleString('en-IN')} m Total Length
              </span>
            </div>

            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-800 text-white sticky top-0 text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-2 text-center w-14">Unit</th>
                    <th className="py-2 px-2 text-right w-24">Executed Qty</th>
                    <th className="py-2 px-2 text-right w-36">
                      {isSubContractor ? 'PO Rate (₹)' : 'Schedule B Rate (₹)'}
                    </th>
                    <th className="py-2 px-3 text-right w-32">Amount (₹)</th>
                    {isSubContractor && (
                      <th className="py-2 px-2 text-right w-28 text-emerald-300 font-bold">
                        Contractor Margin
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                  {calculation.lineItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-sans font-medium text-gray-900 leading-tight">
                        <div>{item.description}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 font-mono">
                            {item.code}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-medium ${
                              isSubContractor
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {item.rateSource}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 font-sans">{item.unit}</td>
                      <td className="py-2 px-2 text-right font-bold text-indigo-900">
                        {item.quantity.toLocaleString('en-IN')}
                      </td>

                      {/* Inline Rate Edit */}
                      <td className="py-1 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={item.rate}
                            onChange={e => handleRateChange(item.id, e.target.value)}
                            className="w-24 px-1.5 py-0.5 text-right font-bold text-gray-800 border rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                            step="0.01"
                          />
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-gray-950">
                        {formatCurrency(item.amount)}
                      </td>

                      {/* Contractor Gross Margin column in Sub-Contractor mode */}
                      {isSubContractor && (
                        <td className="py-2 px-2 text-right font-bold text-emerald-700 bg-emerald-50/20">
                          +{formatCurrency(item.margin || 0)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deductions Section: Tailored for Department or Sub-Contractor */}
          {isSubContractor ? (
            /* Sub-Contractor Deductions Panel */
            <div className="bg-purple-50/40 p-3.5 rounded-xl border border-purple-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900 uppercase">
                <span className="flex items-center gap-1.5">
                  <Calculator size={14} className="text-purple-700" /> Sub-Contractor Deductions & Recoveries
                </span>
                <span className="text-[10px] text-purple-600">Material issue debit & statutory withholding</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                {/* Retention Money */}
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium">
                    <span>Retention</span>
                    <input
                      type="number"
                      value={retentionPct}
                      onChange={e => setRetentionPct(parseFloat(e.target.value) || 0)}
                      className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                    />
                  </div>
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.retentionAmount || 0)}
                  </div>
                </div>

                {/* TDS u/s 194C */}
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium">
                    <span>TDS (194C)</span>
                    <input
                      type="number"
                      value={subTdsPct}
                      onChange={e => setSubTdsPct(parseFloat(e.target.value) || 0)}
                      className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                    />
                  </div>
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.tdsAmount || 0)}
                  </div>
                </div>

                {/* Material Issues Recovery */}
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <span className="block text-[10px] text-gray-600 font-medium">Material Recovery</span>
                  <input
                    type="number"
                    value={materialRecovery}
                    onChange={e => setMaterialRecovery(parseFloat(e.target.value) || 0)}
                    placeholder="₹ 0"
                    className="w-full px-1.5 py-0.5 text-[11px] font-bold border rounded text-right text-rose-700 mt-1"
                  />
                </div>

                {/* Mobilization Advance Recovery */}
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium">
                    <span>Adv. Rec %</span>
                    <input
                      type="number"
                      value={advanceRecoveryPct}
                      onChange={e => setAdvanceRecoveryPct(parseFloat(e.target.value) || 0)}
                      className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                    />
                  </div>
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.advanceRecovery || 0)}
                  </div>
                </div>

                {/* Diesel / Machinery Debits */}
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <span className="block text-[10px] text-gray-600 font-medium">Diesel / Mach.</span>
                  <input
                    type="number"
                    value={dieselCharges}
                    onChange={e => setDieselCharges(parseFloat(e.target.value) || 0)}
                    placeholder="₹ 0"
                    className="w-full px-1.5 py-0.5 text-[11px] font-bold border rounded text-right text-rose-700 mt-1"
                  />
                </div>

                {/* Other Debits */}
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <span className="block text-[10px] text-gray-600 font-medium">Other Debits</span>
                  <input
                    type="number"
                    value={otherDebits}
                    onChange={e => setOtherDebits(parseFloat(e.target.value) || 0)}
                    placeholder="₹ 0"
                    className="w-full px-1.5 py-0.5 text-[11px] font-bold border rounded text-right text-rose-700 mt-1"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Department Statutory Deductions Panel */
            <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-800 uppercase">
                <span className="flex items-center gap-1.5">
                  <Calculator size={14} className="text-indigo-600" /> Government Statutory Deductions
                </span>
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
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.securityDeposit || 0)}
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                    <span>IT TDS (u/s 194C)</span>
                    <input
                      type="number"
                      value={deptTdsPct}
                      onChange={e => setDeptTdsPct(parseFloat(e.target.value) || 0)}
                      className="w-10 px-1 py-0.5 text-[10px] border rounded text-right"
                    />
                  </div>
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.tdsAmount || 0)}
                  </div>
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
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.gstTdsAmount || 0)}
                  </div>
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
                  <div className="text-xs font-bold text-rose-700 mt-1">
                    - {formatCurrency(calculation.deductions.labourCess || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grand Totals Summary Card */}
          <div
            className={`p-4 rounded-xl text-white flex flex-wrap items-center justify-between gap-4 ${
              isSubContractor
                ? 'bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900'
                : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900'
            }`}
          >
            <div className="flex flex-wrap items-center gap-5 sm:gap-6">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  {isSubContractor ? 'Sub Gross (PO Rate)' : 'Gross Work Done'}
                </div>
                <div className="text-lg font-black text-white font-mono">
                  {formatCurrency(calculation.grossAmount)}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-700 hidden sm:block" />

              <div>
                <div className="text-[10px] font-bold text-rose-400 uppercase">Total Deductions</div>
                <div className="text-lg font-black text-rose-300 font-mono">
                  - {formatCurrency(calculation.deductions.totalDeductions)}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-700 hidden sm:block" />

              <div>
                <div className="text-[10px] font-bold text-emerald-400 uppercase">Net Payable Amount</div>
                <div className="text-xl font-black text-emerald-300 font-mono">
                  {formatCurrency(calculation.netPayable)}
                </div>
              </div>

              {isSubContractor && (
                <>
                  <div className="h-8 w-px bg-slate-700 hidden sm:block" />
                  <div>
                    <div className="text-[10px] font-bold text-indigo-300 uppercase flex items-center gap-1">
                      <TrendingUp size={12} /> Contractor Margin
                    </div>
                    <div className="text-lg font-black text-indigo-200 font-mono">
                      +{formatCurrency(calculation.contractorMargin || 0)}{' '}
                      <span className="text-xs font-normal text-indigo-300">
                        ({calculation.contractorMarginPct || 0}%)
                      </span>
                    </div>
                  </div>
                </>
              )}
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
                className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 ${
                  isSubContractor
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <CheckCircle2 size={15} />{' '}
                {isSubContractor ? 'Certify & Save Sub Voucher' : 'Certify & Save RA Bill'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

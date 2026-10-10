import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getTodayDate } from '../../utils/helpers';
import ModalForm from '../../components/ModalForm';

// Generate Bill action for one pending RM record - Bill No / Amount / Remarks / Date. Submitting
// moves the RM bill from Pending to History (see RM1.jsx's handleGenerateBill).
export default function GenerateBillModal({ isOpen, onClose, bill, onSubmitBill }) {
  const [billNo, setBillNo] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [billDate, setBillDate] = useState(getTodayDate());

  useEffect(() => {
    if (isOpen) {
      setBillNo('');
      setAmount('');
      setRemarks('');
      setBillDate(getTodayDate());
    }
  }, [isOpen, bill]);

  if (!isOpen || !bill) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!billNo.trim()) {
      toast.error('Bill No is required');
      return;
    }
    if (!String(amount).trim() || Number.isNaN(Number(amount))) {
      toast.error('Please enter a valid Amount');
      return;
    }
    if (!billDate) {
      toast.error('Date is required');
      return;
    }

    onSubmitBill(bill.id, { billNo: billNo.trim(), billAmount: amount, billRemarks: remarks, billDate });
    toast.success('Bill generated');
    onClose();
  };

  return (
    <ModalForm isOpen={isOpen} onClose={onClose} title={`Generate Bill - ${bill.rmNo}`} onSubmit={handleSubmit} submitText="Submit">
      <div className="space-y-1">
        <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tighter">Bill No *</label>
        <input
          type="text"
          value={billNo}
          onChange={(e) => setBillNo(e.target.value)}
          placeholder="Enter bill no"
          className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[12px] md:text-[13px] h-[34px] md:h-[38px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tighter">Amount *</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[12px] md:text-[13px] h-[34px] md:h-[38px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tighter">Date *</label>
        <input
          type="date"
          value={billDate}
          onChange={(e) => setBillDate(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[12px] md:text-[13px] h-[34px] md:h-[38px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tighter">Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter remarks"
          rows={3}
          className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[12px] md:text-[13px]"
        />
      </div>
    </ModalForm>
  );
}

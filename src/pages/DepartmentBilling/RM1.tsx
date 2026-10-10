import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Receipt, Search, Eye, RotateCcw, Clock, History as HistoryIcon,
  Check, FileSpreadsheet, ExternalLink, Calendar
} from 'lucide-react';
import {
  getProjects,
  getRMBills,
  addRMBill,
  updateRMBill,
  getProjectOrMinor,
  getMobilizationForProject,
  getSentPOForProject,
  getExecutions
} from '../../utils/storageManager';
import { amountInWords, getTodayDate, generateId, buildChainageDiffMap } from '../../utils/helpers';
import { generateRMNo } from './rmUtils';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';

// Format YYYY-MM-DD -> DD/MM/YYYY for display
const formatDate = (val) => {
  if (!val) return '-';
  const parts = String(val).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return val;
};

const getSubContractorsForProject = (projectNo) => {
  const mob = getMobilizationForProject(projectNo);
  const po = getSentPOForProject(projectNo);
  const list = [];
  if (mob?.consultants && Array.isArray(mob.consultants)) {
    mob.consultants.forEach(c => { if (c.name?.trim()) list.push(c.name.trim()); });
  }
  if (po?.consultants && Array.isArray(po.consultants)) {
    po.consultants.forEach(c => { if (c.name?.trim()) list.push(c.name.trim()); });
  }
  return Array.from(new Set(list));
};

const initialFilters = { searchQuery: '', projectName: '', contractorName: '', projectLocation: '' };

export default function RM1() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [bills, setBills] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'billed'
  const [formProject, setFormProject] = useState(null);
  const [filters, setFilters] = useState({ ...initialFilters });

  // Form State
  const [billNo, setBillNo] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(getTodayDate());
  const [billRemarks, setBillRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const refresh = () => {
    const allBills = getRMBills();
    setBills(allBills);

    // Eligible items: ONLY entries explicitly sent for payment via "Send for Payment" in Execution Details
    const executionBills = allBills.filter(b => b.billType === 'Execution');

    const eligible = executionBills.map(bill => {
      const projOrMinor = getProjectOrMinor(bill.projectNo);
      return {
        ...(projOrMinor || {}),
        billId: bill.id,
        id: bill.id,
        rmNo: bill.rmNo,
        serialNo: bill.projectNo,
        projectName: bill.minorName && projOrMinor?.originalProjectName
          ? `${projOrMinor.originalProjectName} (${bill.minorName})`
          : (projOrMinor?.projectName || bill.projectName),
        originalProjectName: projOrMinor?.originalProjectName || bill.projectName,
        minorName: bill.minorName || projOrMinor?.minorName || '',
        isMinor: !!(bill.minorName || projOrMinor?.isMinor),
        contractorName: bill.contractorName || projOrMinor?.contractorName || '-',
        projectType: bill.projectType || projOrMinor?.projectType || '-',
        billNo: bill.billNo || '',
        billAmount: bill.billAmount || '',
        billDate: bill.billDate || '',
        billRemarks: bill.billRemarks || '',
        status: bill.status || 'pending',
        entries: bill.entries || [],
        bill
      };
    });

    setProjects(eligible);
  };

  useEffect(() => {
    refresh();
  }, []);

  const getBillFor = (itemOrProjectNo) => {
    if (itemOrProjectNo && typeof itemOrProjectNo === 'object') {
      if (itemOrProjectNo.bill) return itemOrProjectNo.bill;
      if (itemOrProjectNo.billId) return bills.find(b => b.id === itemOrProjectNo.billId) || null;
      return bills.find(b => b.projectNo === itemOrProjectNo.serialNo && b.billType === 'Execution') || null;
    }
    return bills.find(b => b.projectNo === itemOrProjectNo && b.billType === 'Execution') || null;
  };

  const isBilled = (itemOrProjectNo) => {
    if (itemOrProjectNo && typeof itemOrProjectNo === 'object') {
      return itemOrProjectNo.status === 'billed' || itemOrProjectNo.bill?.status === 'billed';
    }
    const b = getBillFor(itemOrProjectNo);
    return b && b.status === 'billed';
  };

  const pendingProjects = projects.filter(p => !isBilled(p)).reverse();
  const historyProjects = projects.filter(p => isBilled(p)).reverse();

  const list = activeTab === 'pending' ? pendingProjects : historyProjects;

  const filteredList = list.filter(p => {
    if (filters.projectName && p.projectName !== filters.projectName) return false;
    if (filters.contractorName && p.contractorName !== filters.contractorName) return false;
    if (filters.projectLocation && p.projectLocation !== filters.projectLocation) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const b = getBillFor(p);
      return (
        p.serialNo.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.contractorName.toLowerCase().includes(q) ||
        (p.contractorPhone || '').toLowerCase().includes(q) ||
        (p.contractorEmail || '').toLowerCase().includes(q) ||
        (p.projectLocation || '').toLowerCase().includes(q) ||
        (p.rmNo || '').toLowerCase().includes(q) ||
        (b?.billNo || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginated = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const openBillModal = (item) => {
    const existing = getBillFor(item);
    if (existing && existing.status === 'billed') {
      setBillNo(existing.billNo || '');
      setBillAmount(existing.billAmount || '');
      setBillDate(existing.billDate || getTodayDate());
      setBillRemarks(existing.billRemarks || '');
    } else {
      setBillNo(existing?.billNo || '');
      // Auto-calculate total quantity: sum of chainage diffs from bill entries
      let autoQty = '';
      const billEntries = existing?.entries || [];
      if (billEntries.length > 0) {
        const allExecs = getExecutions().filter(e => e.projectNo === item.serialNo)
          .sort((a, b) => (a.serialNo ?? 0) - (b.serialNo ?? 0));
        const diffMap = buildChainageDiffMap(allExecs, s => s.execution?.chainage, s => s.id);
        const total = billEntries.reduce((sum, e) => {
          const diff = diffMap.get(e.sourceId);
          return diff !== undefined ? sum + diff : sum;
        }, 0);
        autoQty = total > 0 ? parseFloat(total.toFixed(3)) : '';
      }
      setBillAmount(existing?.billAmount || autoQty || '');
      setBillDate(existing?.billDate || getTodayDate());
      setBillRemarks(existing?.billRemarks || '');
    }
    setFormProject(item);
  };

  const handleSubmitBill = (e) => {
    e.preventDefault();
    if (!billNo.trim()) {
      toast.error('Bill No is required');
      return;
    }
    if (!String(billAmount).trim() || Number.isNaN(Number(billAmount))) {
      toast.error('Please enter a valid Bill Amount');
      return;
    }
    if (!billDate) {
      toast.error('Bill Date is required');
      return;
    }

    setLoading(true);
    const existing = getBillFor(formProject);
    if (existing) {
      updateRMBill(existing.id, {
        billNo: billNo.trim(),
        billAmount,
        billDate,
        billRemarks,
        status: 'billed'
      });
    } else {
      const newBill = {
        id: generateId(),
        rmNo: generateRMNo(bills),
        createdAt: new Date().toISOString(),
        projectNo: formProject.serialNo,
        projectName: formProject.projectName,
        projectType: formProject.projectType || '',
        contractorName: formProject.contractorName || '',
        minorName: formProject.minorName || '',
        billType: 'Execution',
        status: 'billed',
        billNo: billNo.trim(),
        billAmount,
        billDate,
        billRemarks,
        entries: formProject.entries || []
      };
      addRMBill(newBill);
    }

    setLoading(false);
    setFormProject(null);
    refresh();
    toast.success(`${formProject.projectName || formProject.serialNo} department bill generated — moved to Sub Contractor Billing`);
  };

  const tableHeaders = [
    "Action", "Project No", "Project Type", "Project Name", "Agreement Number", "Contractor Name", "Contractor Phone No",
    "Contractor Gmail", "Project Location", "Village", "District", "State", "Start Date", "Planned End Date",
    "Work Order", "Work Order Date", "Irrigation Capacity", "Tender ID", "Tender Amount", "Accepted Amount",
    "Work Period", "Maintenance Period", "Sub Contractor(s)", "Bill No", "Total Quantity", "Bill Date", "Status"
  ];

  const renderRow = (item) => {
    const bill = getBillFor(item);
    const subContractors = getSubContractorsForProject(item.parentProjectNo || item.serialNo);
    const billed = isBilled(item);

    const handleRowClick = () => {
      if (bill?.id) {
        navigate(`/rm-bill/${encodeURIComponent(bill.id)}`);
      }
    };

    return (
      <tr
        key={item.billId || item.serialNo}
        onClick={handleRowClick}
        className="hover:bg-indigo-50/40 transition-colors border-b border-gray-100 cursor-pointer group"
      >
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openBillModal(item);
              }}
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                billed
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Receipt size={12} /> {billed ? 'View / Edit Bill' : 'Generate Bill'}
            </button>
            {bill && bill.entries && bill.entries.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/rm-bill/${encodeURIComponent(bill.id)}`);
                }}
                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                title="View RM line items"
              >
                <Eye size={14} />
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">
          <div>{item.serialNo}</div>
          {item.rmNo && (
            <div className="text-[10px] text-indigo-500 font-medium">({item.rmNo})</div>
          )}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.projectType || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-900 font-medium whitespace-nowrap">{item.projectName}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.agreementNumber || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">{item.contractorName}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.contractorPhone}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.contractorEmail}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.projectLocation || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.village || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.district || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.state || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.startDate)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.plannedEndDate)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.workOrder || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{formatDate(item.workOrderDate)}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.irrigationCapacity || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.tenderId || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">
          <div>{item.tenderAmount || '-'}</div>
          {amountInWords(item.tenderAmount) && (
            <div className="text-[9px] text-gray-400 italic truncate max-w-[160px] mx-auto" title={amountInWords(item.tenderAmount)}>{amountInWords(item.tenderAmount)}</div>
          )}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">
          <div>{item.acceptedAmount || '-'}</div>
          {amountInWords(item.acceptedAmount) && (
            <div className="text-[9px] text-gray-400 italic truncate max-w-[160px] mx-auto" title={amountInWords(item.acceptedAmount)}>{amountInWords(item.acceptedAmount)}</div>
          )}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.workPeriod || '-'}</td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{item.maintenancePeriod || '-'}</td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {subContractors.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-center max-w-[200px] mx-auto">
              {subContractors.map((sub, idx) => (
                <span key={idx} className="inline-block text-[10px] font-medium px-2 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 truncate max-w-[180px]">
                  {sub}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-gray-400 italic">None</span>
          )}
        </td>
        <td className="px-4 py-3 text-center text-[13px] font-bold text-gray-800 whitespace-nowrap">
          {bill?.billNo || '-'}
        </td>
        <td className="px-4 py-3 text-center text-[13px] font-bold text-gray-800 whitespace-nowrap">
          {bill?.billAmount ?? '-'}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">
          {formatDate(bill?.billDate)}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {billed ? (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">
              Billed
            </span>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-200">
              Pending
            </span>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const bill = getBillFor(item);
    const subContractors = getSubContractorsForProject(item.parentProjectNo || item.serialNo);
    const billed = isBilled(item);

    const handleCardClick = () => {
      if (bill?.id) {
        navigate(`/rm-bill/${encodeURIComponent(bill.id)}`);
      }
    };

    return (
      <div
        key={item.billId || item.serialNo}
        onClick={handleCardClick}
        className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2 cursor-pointer active:bg-indigo-50/40 hover:border-indigo-300 transition-all group"
      >
        <div className="flex justify-between items-start border-b border-gray-100 pb-2">
          <div>
            <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest block mb-1 text-left">
              {item.serialNo} {item.rmNo ? `(${item.rmNo})` : ''}
            </span>
            <h4 className="text-sm text-gray-900 leading-tight">{item.projectName}</h4>
          </div>
          {billed ? (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">
              Billed
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-200">
              Pending
            </span>
          )}
        </div>

        <div className="bg-slate-50 rounded p-2 text-[10px] space-y-1">
          {item.agreementNumber && (
            <div className="flex justify-between">
              <span className="text-gray-500">Agreement No:</span>
              <span className="text-gray-700">{item.agreementNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Contractor:</span>
            <span className="text-gray-700">{item.contractorName}</span>
          </div>
          {subContractors.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Sub Contractor:</span>
              <span className="text-indigo-600 font-medium truncate max-w-[150px]">{subContractors.join(', ')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Location:</span>
            <span className="text-gray-700">{item.projectLocation || '-'}</span>
          </div>
          {(item.village || item.district || item.state) && (
            <div className="flex justify-between">
              <span className="text-gray-500">Village/Dist/State:</span>
              <span className="text-gray-700 text-right">{[item.village, item.district, item.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Bill No:</span>
            <span className="text-gray-900 font-bold">{bill?.billNo || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Quantity:</span>
            <span className="text-gray-900 font-bold">{bill?.billAmount ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Bill Date:</span>
            <span className="text-gray-700">{formatDate(bill?.billDate)}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            openBillModal(item);
          }}
          className={`w-full border py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors ${
            billed
              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <Receipt size={12} /> {billed ? 'View / Edit Bill' : 'Generate Bill'}
        </button>
      </div>
    );
  };

  const currentSubs = formProject ? getSubContractorsForProject(formProject.serialNo) : [];

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-3 md:space-y-6 flex flex-col h-full min-h-0">
      {/* Tabs + Filters */}
      <div className="space-y-3 flex-shrink-0 px-2 sm:px-0">
        <div className="flex items-center justify-between border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
              className={`pb-2 text-xs md:text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'pending' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock size={14} /> Pending ({pendingProjects.length})
              {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
            <button
              onClick={() => { setActiveTab('billed'); setCurrentPage(1); }}
              className={`pb-2 text-xs md:text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'billed' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <HistoryIcon size={14} /> History ({historyProjects.length})
              {activeTab === 'billed' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full">
          <div className="flex-1 flex flex-wrap items-center gap-2 md:gap-3 min-w-0">
            <div className="flex-1 min-w-[160px] relative">
              <Search className="absolute left-2.5 top-[9px] md:top-[11px] text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search projects / bill no..."
                value={filters.searchQuery}
                onChange={(e) => { setFilters(prev => ({ ...prev, searchQuery: e.target.value })); setCurrentPage(1); }}
                className="w-full bg-white border border-gray-300 rounded-lg md:rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-indigo-500 text-xs md:text-sm h-[32px] md:h-[38px]"
              />
            </div>

            <div className="w-[140px] md:w-[170px]">
              <SearchableDropdown
                options={Array.from(new Set(projects.map(p => p.projectName).filter(Boolean)))}
                value={filters.projectName}
                onChange={(val) => { setFilters(prev => ({ ...prev, projectName: val })); setCurrentPage(1); }}
                placeholder="Project Name"
              />
            </div>

            <div className="w-[140px] md:w-[170px]">
              <SearchableDropdown
                options={Array.from(new Set(projects.map(p => p.contractorName).filter(Boolean)))}
                value={filters.contractorName}
                onChange={(val) => { setFilters(prev => ({ ...prev, contractorName: val })); setCurrentPage(1); }}
                placeholder="Contractor"
              />
            </div>

            <div className="w-[140px] md:w-[170px]">
              <SearchableDropdown
                options={Array.from(new Set(projects.map(p => p.projectLocation).filter(Boolean)))}
                value={filters.projectLocation}
                onChange={(val) => { setFilters(prev => ({ ...prev, projectLocation: val })); setCurrentPage(1); }}
                placeholder="Location"
              />
            </div>
          </div>

          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center gap-1 border border-gray-300 rounded-lg md:rounded hover:bg-gray-100 text-gray-600 transition h-[32px] md:h-[38px] px-3 flex-shrink-0"
            title="Clear filters"
          >
            <RotateCcw size={14} />
            <span className="sm:hidden text-xs font-semibold">Clear Filters</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col mx-2 sm:mx-0">
        <DataTable
          headers={tableHeaders}
          data={paginated}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="3100px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredList.length}
        />
      </div>

      {/* Department Bill Modal */}
      <ModalForm
        isOpen={!!formProject}
        onClose={() => setFormProject(null)}
        title={formProject ? `Department Bill — ${formProject.serialNo}` : ''}
        onSubmit={handleSubmitBill}
        submitText={loading ? 'Saving...' : 'Submit Department Bill'}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Project Summary Header */}
          {formProject && (
            <div className="bg-slate-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Name</p>
                  <p className="text-gray-700 truncate font-medium">{formProject.projectName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Agreement Number</p>
                  <p className="text-gray-700 truncate">{formProject.agreementNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Contractor</p>
                  <p className="text-gray-700 truncate">{formProject.contractorName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Location</p>
                  <p className="text-gray-700 truncate">{formProject.projectLocation || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Registered Sub Contractors</p>
                  <p className="text-indigo-600 truncate font-semibold">
                    {currentSubs.length > 0 ? currentSubs.join(', ') : 'None registered'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Accepted Amount</p>
                  <p className="text-gray-700 truncate font-medium">₹ {formProject.acceptedAmount || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Bill Form Fields */}
          <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-white shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[12px] md:text-[13px] font-semibold text-gray-700 uppercase tracking-tight">
                  Bill No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="e.g. BILL-DEP-001"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] h-[34px] md:h-[38px] bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] md:text-[13px] font-semibold text-gray-700 uppercase tracking-tight">
                  Total Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="Enter total quantity"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] h-[34px] md:h-[38px] bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] md:text-[13px] font-semibold text-gray-700 uppercase tracking-tight">
                  Bill Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] h-[34px] md:h-[38px] bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[12px] md:text-[13px] font-semibold text-gray-700 uppercase tracking-tight">
                  Bill Remarks
                </label>
                <textarea
                  value={billRemarks}
                  onChange={(e) => setBillRemarks(e.target.value)}
                  placeholder="Add any department bill remarks (optional)"
                  rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] resize-none bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

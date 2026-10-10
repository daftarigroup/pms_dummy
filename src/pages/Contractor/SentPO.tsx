import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileCheck2, Hash, Calendar, IndianRupee, UploadCloud, Check, Eye, Clock, History as HistoryIcon, Search, RotateCcw, Users, Ruler, ChevronDown, User, Phone, FileText } from 'lucide-react';
import {
  getProjects,
  getMobilizations,
  isMobilizationComplete,
  getSentPOs,
  upsertSentPO,
  isSentPOComplete
} from '../../utils/storageManager';
import { amountInWords, fileToBase64, compressImageToBase64 } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import InfoPopover from '../../components/InfoPopover';

// Format YYYY-MM-DD -> DD/MM/YYYY for display
const formatDate = (val) => {
  if (!val) return '-';
  const parts = val.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return val;
};

const initialFormData = {
  consultants: []
};

// One-line summary of a sub contractor's PO for table popovers.
const formatSentPOSummary = (c) => {
  const parts = [c.name, c.number];
  if (c.workingUnit) parts.push(c.workingUnit);
  if (c.poNumber) parts.push(`PO: ${c.poNumber}`);
  if (c.poAmount) parts.push(`₹${c.poAmount}`);
  return parts.join(' · ');
};

const initialFilters = { searchQuery: '', projectName: '', contractorName: '', projectLocation: '' };

export default function SentPO({ embedded = false }) {
  const [projects, setProjects] = useState([]);
  const [mobilizationRecords, setMobilizationRecords] = useState([]);
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [formProject, setFormProject] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const refresh = () => {
    // Only projects whose Mobilization action is complete (sitting in Contractor page's History tab)
    // are eligible to have a PO sent.
    const mobilizations = getMobilizations();
    const eligibleProjects = getProjects().filter(p => {
      const rec = mobilizations.find(m => m.projectNo === p.serialNo);
      return isMobilizationComplete(rec);
    });
    setProjects(eligibleProjects);
    setMobilizationRecords(mobilizations);
    setRecords(getSentPOs());
  };

  useEffect(() => { refresh(); }, []);

  const mobilizationFor = (projectNo) => mobilizationRecords.find(m => m.projectNo === projectNo) || null;
  const finalizeFor = mobilizationFor; // alias for existing references
  const recordFor = (projectNo) => records.find(r => r.projectNo === projectNo) || null;

  const pendingProjects = projects.filter(p => !isSentPOComplete(recordFor(p.serialNo))).reverse();
  const historyProjects = projects.filter(p => isSentPOComplete(recordFor(p.serialNo))).reverse();

  const list = activeTab === 'pending' ? pendingProjects : historyProjects;

  const filteredList = list.filter(p => {
    if (filters.projectName && p.projectName !== filters.projectName) return false;
    if (filters.contractorName && p.contractorName !== filters.contractorName) return false;
    if (filters.projectLocation && p.projectLocation !== filters.projectLocation) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return (
        p.serialNo.toLowerCase().includes(q) ||
        p.projectName.toLowerCase().includes(q) ||
        p.contractorName.toLowerCase().includes(q) ||
        (p.contractorPhone || '').toLowerCase().includes(q) ||
        (p.contractorEmail || '').toLowerCase().includes(q) ||
        p.projectLocation.toLowerCase().includes(q)
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

  const openForm = (project) => {
    const rec = recordFor(project.serialNo);
    const mob = mobilizationFor(project.serialNo);
    const finalized = (mob?.consultants && mob.consultants.length > 0)
      ? mob.consultants
      : (rec?.consultants || []);
    const consultants = finalized.map((c, idx) => {
      const saved = rec?.consultants?.find(s => s.id === c.id) || rec?.consultants?.[idx];
      return {
        id: c.id || `c-${idx}-${Date.now()}`,
        name: c.name || '',
        number: c.number || '',
        workingUnit: saved?.workingUnit || c.workingUnit || '',
        poNumber: saved?.poNumber || c.poNumber || '',
        poAmount: saved?.poAmount || c.poAmount || '',
        poDate: saved?.poDate || c.poDate || '',
        poDocument: saved?.poDocument || c.poDocument || '',
        poDocumentName: saved?.poDocumentName || c.poDocumentName || '',
        remarks: saved?.remarks || c.remarks || ''
      };
    });
    setFormData({ consultants });
    setFormProject(project);
  };

  const updateSentConsultantRow = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      consultants: prev.consultants.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const handlePODocument = async (id, file) => {
    if (!file) return;

    const MAX_UPLOAD = 50 * 1024 * 1024; // 50MB - accepted at selection time
    const MAX_STORED = 2 * 1024 * 1024;  // 2MB - what actually gets saved

    if (file.size > MAX_UPLOAD) {
      toast.error('File size must be less than 50MB');
      return;
    }

    try {
      if (file.type.startsWith('image/')) {
        const { base64, size } = await compressImageToBase64(file, { maxBytes: MAX_STORED });
        updateSentConsultantRow(id, 'poDocument', base64);
        updateSentConsultantRow(id, 'poDocumentName', file.name);
        toast.success(
          size <= MAX_STORED
            ? `Attached (compressed to ${(size / 1024 / 1024).toFixed(2)}MB)`
            : `Attached (${(size / 1024 / 1024).toFixed(2)}MB - could not compress further)`
        );
      } else {
        if (file.size > MAX_STORED) {
          toast.error('PDF files cannot be auto-compressed - please upload a PDF under 2MB, or use an image instead');
          return;
        }
        const base64 = await fileToBase64(file);
        updateSentConsultantRow(id, 'poDocument', base64);
        updateSentConsultantRow(id, 'poDocumentName', file.name);
        toast.success('PO document attached');
      }
    } catch (error) {
      toast.error('Error reading file');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    for (const c of formData.consultants) {
      if (!c.poNumber.trim()) { toast.error(`PO Number is required for ${c.name}`); return; }
      if (!c.poDate) { toast.error(`PO Date is required for ${c.name}`); return; }
    }

    setLoading(true);
    upsertSentPO({ projectNo: formProject.serialNo, consultants: formData.consultants });
    setLoading(false);
    setFormProject(null);
    refresh();

    toast.success(`${formProject.serialNo} PO sent — moved to History`);
  };

  const tableHeaders = [
    "Action", "Project No", "Project Type", "Project Name", "Agreement Number", "Contractor Name", "Contractor Phone No",
    "Contractor Gmail", "Project Location", "Village", "District", "State", "Start Date", "Planned End Date",
    "Work Order", "Work Order Date", "Irrigation Capacity", "Tender ID", "Tender Amount", "Accepted Amount",
    "Work Period", "Maintenance Period", "Finalized Consultant", "PO Status"
  ];

  const renderRow = (item) => {
    const finalize = finalizeFor(item.serialNo);
    const rec = recordFor(item.serialNo);
    return (
      <tr key={item.serialNo} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <button
            onClick={() => openForm(item)}
            className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide hover:bg-indigo-100 transition-colors"
          >
            <FileCheck2 size={12} /> {activeTab === 'history' ? 'View' : 'Send PO'}
          </button>
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">{item.serialNo}</td>
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
        <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {finalize?.consultants?.length > 0 ? (
            <InfoPopover
              items={finalize.consultants.map(c => `${c.name} · ${c.number}`)}
              title={`Sub Contractors — ${item.serialNo}`}
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 cursor-help hover:bg-indigo-100">
                <Users size={12} /> {finalize.consultants.length}
              </span>
            </InfoPopover>
          ) : '-'}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {rec && isSentPOComplete(rec) ? (
            <InfoPopover
              items={rec.consultants.map(formatSentPOSummary)}
              title={`PO Sent — ${item.serialNo}`}
            >
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200 cursor-help hover:bg-emerald-200/60">Sent ({rec.consultants.length})</span>
            </InfoPopover>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">Pending</span>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const finalize = finalizeFor(item.serialNo);
    const rec = recordFor(item.serialNo);
    return (
      <div key={item.serialNo} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2">
        <div className="flex justify-between items-start border-b border-gray-100 pb-2">
          <div>
            <span className="text-[9px] text-indigo-500 uppercase tracking-widest leading-none block mb-1">{item.serialNo}</span>
            <h4 className="text-sm text-gray-900 leading-tight">{item.projectName}</h4>
          </div>
          {item.projectType && (
            <span className="text-[8px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-tight whitespace-nowrap flex-shrink-0">
              {item.projectType}
            </span>
          )}
        </div>

        <div className="bg-slate-50 rounded p-2 text-[10px] space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Contractor:</span>
            <span className="text-gray-700">{item.contractorName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Phone:</span>
            <span className="text-gray-700">{item.contractorPhone || '-'}</span>
          </div>
          {item.agreementNumber && (
            <div className="flex justify-between">
              <span className="text-gray-500">Agreement No:</span>
              <span className="text-gray-700">{item.agreementNumber}</span>
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
            <span className="text-gray-500">Start / End:</span>
            <span className="text-gray-700">{formatDate(item.startDate)} - {formatDate(item.plannedEndDate)}</span>
          </div>
          {item.tenderAmount && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tender Amount:</span>
              <span className="text-gray-700">{item.tenderAmount}</span>
            </div>
          )}
          {item.acceptedAmount && (
            <div className="flex justify-between">
              <span className="text-gray-500">Accepted Amount:</span>
              <span className="text-gray-700">{item.acceptedAmount}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Sub Contractor(s):</span>
            <span className="text-gray-700 truncate max-w-[140px]">
              {finalize?.consultants?.length > 0 ? finalize.consultants.map(c => c.name).join(', ') : '-'}
            </span>
          </div>
        </div>

        <div className="text-[10px]" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-400 uppercase tracking-tighter text-[8px] mb-0.5">PO Status</p>
          {rec && isSentPOComplete(rec) ? (
            <InfoPopover
              items={rec.consultants.map(formatSentPOSummary)}
              title={`PO Sent — ${item.serialNo}`}
            >
              <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200 cursor-help">Sent ({rec.consultants.length})</span>
            </InfoPopover>
          ) : (
            <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">Pending</span>
          )}
        </div>

        <button
          onClick={() => openForm(item)}
          className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5"
        >
          <FileCheck2 size={12} /> {activeTab === 'history' ? 'View' : 'Send PO'}
        </button>
      </div>
    );
  };

  return (
    <div className={`${embedded ? 'p-0' : 'p-0 sm:p-2 md:p-6'} space-y-3 md:space-y-6 flex flex-col h-full min-h-0`}>
      {/* Tabs + Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 px-2 sm:px-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-3 h-[34px] rounded-lg text-xs md:text-sm font-semibold border transition-colors ${
              activeTab === 'pending'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Clock size={14} /> Pending ({pendingProjects.length})
          </button>
          <button
            onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-3 h-[34px] rounded-lg text-xs md:text-sm font-semibold border transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <HistoryIcon size={14} /> History ({historyProjects.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
        <div className="flex-1 min-w-[160px] relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.searchQuery}
            onChange={(e) => { setFilters({ ...filters, searchQuery: e.target.value }); setCurrentPage(1); }}
            className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-xs sm:text-sm h-[34px]"
          />
        </div>
        <div className="w-full sm:w-44 flex-shrink-0">
          <SearchableDropdown
            options={Array.from(new Set(projects.map(p => p.projectName))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
            value={filters.projectName}
            onChange={(val) => { setFilters({ ...filters, projectName: val }); setCurrentPage(1); }}
            placeholder="All Project Name"
            height="h-[34px]"
          />
        </div>
        <div className="w-full sm:w-44 flex-shrink-0">
          <SearchableDropdown
            options={Array.from(new Set(projects.map(p => p.contractorName))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
            value={filters.contractorName}
            onChange={(val) => { setFilters({ ...filters, contractorName: val }); setCurrentPage(1); }}
            placeholder="All Contractor Name"
            height="h-[34px]"
          />
        </div>
        <div className="w-full sm:w-44 flex-shrink-0">
          <SearchableDropdown
            options={Array.from(new Set(projects.map(p => p.projectLocation))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
            value={filters.projectLocation}
            onChange={(val) => { setFilters({ ...filters, projectLocation: val }); setCurrentPage(1); }}
            placeholder="All Location"
            height="h-[34px]"
          />
        </div>
        <button
          onClick={handleClearFilters}
          className="flex items-center justify-center gap-1.5 bg-gray-50 text-gray-500 border border-gray-200 rounded-lg w-full sm:w-[34px] h-[34px] hover:bg-gray-100 transition-colors shadow-sm flex-shrink-0"
          title="Clear Filters"
        >
          <RotateCcw size={16} />
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
          minWidth="3000px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredList.length}
        />
      </div>

      {/* Sent PO Modal */}
      <ModalForm
        isOpen={!!formProject}
        onClose={() => setFormProject(null)}
        title={formProject ? `Sent PO — ${formProject.serialNo}` : ''}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : 'Save'}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-3">
          {/* Project Info (read-only, pre-filled from the selected project) */}
          {formProject && (
            <div className="bg-slate-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{formProject.projectName}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Type</p>
                  <p className="text-gray-700 truncate">{formProject.projectType || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Contractor</p>
                  <p className="text-gray-700 truncate">{formProject.contractorName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Contractor Phone</p>
                  <p className="text-gray-700 truncate">{formProject.contractorPhone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Tender Amount</p>
                  <p className="text-gray-700 truncate">{formProject.tenderAmount || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Accepted Amount</p>
                  <p className="text-gray-700 truncate">{formProject.acceptedAmount || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Finalized Sub Contractor(s)</p>
                  <p className="text-gray-700 truncate">
                    {finalizeFor(formProject.serialNo)?.consultants?.map(c => c.name).join(', ') || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PO Details — one block per finalized sub contractor */}
          {formData.consultants.length === 0 ? (
            <p className="text-[13px] text-gray-400 italic">No finalized sub contractors found for this project.</p>
          ) : (
            <div className="space-y-3">
              {formData.consultants.map((c) => (
                <div key={c.id} className="bg-slate-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-gray-200">
                    <User size={14} className="text-indigo-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] md:text-[15px] font-semibold text-gray-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1"><Phone size={10} className="text-gray-400" /> {c.number}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">PO Number *</label>
                      <div className="relative">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          value={c.poNumber}
                          onChange={(e) => updateSentConsultantRow(c.id, 'poNumber', e.target.value)}
                          placeholder="Enter PO number"
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">PO Date *</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        <input
                          type="date"
                          value={c.poDate}
                          onChange={(e) => updateSentConsultantRow(c.id, 'poDate', e.target.value)}
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">PO Amount</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="number"
                          value={c.poAmount}
                          onChange={(e) => updateSentConsultantRow(c.id, 'poAmount', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="Enter PO amount"
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white"
                        />
                      </div>
                      {amountInWords(c.poAmount) && (
                        <p className="text-[9px] text-gray-400 italic truncate">{amountInWords(c.poAmount)}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Working Unit</label>
                      <div className="relative">
                        <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        <select
                          value={c.workingUnit}
                          onChange={(e) => updateSentConsultantRow(c.id, 'workingUnit', e.target.value)}
                          className="w-full appearance-none border border-gray-300 rounded pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white"
                        >
                          <option value="" disabled>Select</option>
                          <option value="Hectares">Hectares</option>
                          <option value="Pipe Dia">Pipe Dia</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Upload PO Document</label>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer block flex-1">
                        <div className={`flex items-center gap-2 border border-dashed rounded px-2.5 h-[34px] md:h-[38px] transition-all ${
                          c.poDocumentName ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-gray-300 text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}>
                          {c.poDocumentName ? <Check size={14} className="flex-shrink-0" /> : <UploadCloud size={14} className="flex-shrink-0" />}
                          <span className="text-[13px] md:text-[15px] truncate">
                            {c.poDocumentName || 'Click to browse (Image up to 50MB, auto-compressed to 2MB / PDF up to 2MB)'}
                          </span>
                        </div>
                        <input
                          type="file"
                          onChange={(e) => handlePODocument(c.id, e.target.files?.[0])}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                      </label>
                      {c.poDocument && (
                        <a
                          href={c.poDocument}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-indigo-600 hover:text-indigo-800"
                        >
                          <Eye size={12} /> View
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Remarks</label>
                    <div className="relative">
                      <FileText className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                      <textarea
                        value={c.remarks}
                        onChange={(e) => updateSentConsultantRow(c.id, 'remarks', e.target.value)}
                        placeholder="Add any remarks (optional)"
                        rows={2}
                        className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] resize-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalForm>
    </div>
  );
}

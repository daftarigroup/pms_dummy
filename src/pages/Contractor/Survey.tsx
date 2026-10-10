import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Compass, Calendar, Check, X, Clock, History as HistoryIcon, Search, RotateCcw } from 'lucide-react';
import {
  getProjects,
  getSentPOs,
  isSentPOComplete,
  getSurveys,
  upsertSurvey,
  isSurveyComplete
} from '../../utils/storageManager';
import { amountInWords } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';

// Format YYYY-MM-DD -> DD/MM/YYYY for display
const formatDate = (val) => {
  if (!val) return '-';
  const parts = val.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return val;
};

const initialFormData = {
  surveyStatus: 'No',
  remarks: ''
};

const initialFilters = { searchQuery: '', projectName: '', contractorName: '', projectLocation: '' };

export default function Survey({ embedded = false }) {
  const [projects, setProjects] = useState([]);
  const [poRecords, setPoRecords] = useState([]);
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [formProject, setFormProject] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const refresh = () => {
    // Only projects with a sent PO (sitting in that page's History tab) are eligible for survey.
    const pos = getSentPOs();
    const eligibleProjects = getProjects().filter(p => {
      const rec = pos.find(po => po.projectNo === p.serialNo);
      return isSentPOComplete(rec);
    });
    setProjects(eligibleProjects);
    setPoRecords(pos);
    setRecords(getSurveys());
  };

  useEffect(() => { refresh(); }, []);

  const poFor = (projectNo) => poRecords.find(p => p.projectNo === projectNo) || null;
  const recordFor = (projectNo) => records.find(r => r.projectNo === projectNo) || null;

  const pendingProjects = projects.filter(p => !isSurveyComplete(recordFor(p.serialNo))).reverse();
  const historyProjects = projects.filter(p => isSurveyComplete(recordFor(p.serialNo))).reverse();

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
    setFormData(rec ? {
      surveyStatus: rec.surveyStatus || (isSurveyComplete(rec) ? 'Yes' : 'No'),
      remarks: rec.remarks || ''
    } : { ...initialFormData });
    setFormProject(project);
  };

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.surveyStatus) { toast.error('Survey Status is required'); return; }

    setLoading(true);
    upsertSurvey({ projectNo: formProject.serialNo, ...formData });
    setLoading(false);
    setFormProject(null);
    refresh();

    if (formData.surveyStatus === 'Yes') {
      toast.success(`${formProject.serialNo} survey completed — moved to Final Approval`);
    } else {
      toast.success(`${formProject.serialNo} survey saved`);
    }
  };

  const tableHeaders = [
    "Action", "Project No", "Project Type", "Project Name", "Agreement Number", "Contractor Name", "Contractor Phone No",
    "Contractor Gmail", "Project Location", "Village", "District", "State", "Start Date", "Planned End Date",
    "Work Order", "Work Order Date", "Irrigation Capacity", "Tender ID", "Tender Amount", "Accepted Amount",
    "Work Period", "Maintenance Period", "PO Number", "Survey Status"
  ];

  const renderRow = (item) => {
    const po = poFor(item.serialNo);
    const rec = recordFor(item.serialNo);
    return (
      <tr key={item.serialNo} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <button
            onClick={() => openForm(item)}
            className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide hover:bg-indigo-100 transition-colors"
          >
            <Compass size={12} /> {activeTab === 'history' ? 'View' : 'Survey'}
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
        <td className="px-4 py-3 text-center text-[13px] text-gray-600 whitespace-nowrap">{po?.poNumber || '-'}</td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {rec && isSurveyComplete(rec) ? (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">Yes</span>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">No</span>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const po = poFor(item.serialNo);
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
          <div className="flex justify-between">
            <span className="text-gray-500">PO Number:</span>
            <span className="text-gray-700 truncate max-w-[140px]">{po?.poNumber || '-'}</span>
          </div>
        </div>

        <div className="text-[10px]">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px] mb-0.5">Survey Status</p>
          {rec && isSurveyComplete(rec) ? (
            <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">Yes</span>
          ) : (
            <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">No</span>
          )}
        </div>

        <button
          onClick={() => openForm(item)}
          className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5"
        >
          <Compass size={12} /> {activeTab === 'history' ? 'View' : 'Survey'}
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

      {/* Survey Modal */}
      <ModalForm
        isOpen={!!formProject}
        onClose={() => setFormProject(null)}
        title={formProject ? `Survey — ${formProject.serialNo}` : ''}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : 'Save'}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          {/* Project Info (read-only, pre-filled from the selected project) */}
          {formProject && (
            <div className="bg-slate-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Name</p>
                  <p className="text-gray-700 truncate">{formProject.projectName || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Type</p>
                  <p className="text-gray-700 truncate">{formProject.projectType || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Location</p>
                  <p className="text-gray-700 truncate">{formProject.projectLocation || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Department</p>
                  <p className="text-gray-700 truncate">{formProject.department || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Division</p>
                  <p className="text-gray-700 truncate">{formProject.division || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Sub Division</p>
                  <p className="text-gray-700 truncate">{formProject.subDivision || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Survey Details */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Compass size={14} className="text-indigo-600" />
              <span className="text-[12px] md:text-[13px] font-semibold text-gray-800 uppercase tracking-tight">Survey Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">
                  Survey Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.surveyStatus}
                  onChange={(e) => handleChange('surveyStatus', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Remarks</label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Add any remarks (optional)"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </ModalForm>
    </div>
  );
}

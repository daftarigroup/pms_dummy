import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Clock, History as HistoryIcon, Search, RotateCcw,
  Check, Eye, ExternalLink
} from 'lucide-react';
import {
  getProjects,
  getDrawingUploads,
  isDrawingUploadComplete,
  getDesignByProject,
  getMinors,
  getSentPOForProject,
  getMobilizationForProject,
  isUploadDesignComplete,
  isDepartmentBillingComplete
} from '../../utils/storageManager';
import { amountInWords } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';

// Format YYYY-MM-DD -> DD/MM/YYYY for display
const formatDate = (val) => {
  if (!val) return '-';
  const parts = val.split('-');
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

export default function UploadDesignPage({ embedded = false }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [drawingUploads, setDrawingUploads] = useState([]);
  const [minors, setMinors] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const refresh = () => {
    // Only projects that have completed the Drawing Upload stage (or already have minors/design)
    // are eligible for Upload Design.
    const drawings = getDrawingUploads();
    const allMinors = getMinors();
    const eligibleProjects = getProjects().filter(p => {
      const dRec = drawings.find(d => d.projectNo === p.serialNo);
      const hasMinors = allMinors.some(m => m.projectNo === p.serialNo);
      return isDrawingUploadComplete(dRec) || isUploadDesignComplete(p.serialNo) || hasMinors;
    });
    setProjects(eligibleProjects);
    setDrawingUploads(drawings);
    setMinors(allMinors);
  };

  useEffect(() => { refresh(); }, []);

  const drawingFor = (projectNo) => drawingUploads.find(u => u.projectNo === projectNo) || null;

  // Projects in Upload Design:
  // Pending = Arrived from Drawing Upload, pending Department Billing
  // History = Department Billing completed (moved to Sub Contractor Billing)
  const pendingProjects = projects.filter(p => !isDepartmentBillingComplete(p.serialNo)).reverse();
  const historyProjects = projects.filter(p => isDepartmentBillingComplete(p.serialNo)).reverse();

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

  const tableHeaders = [
    "Project No", "Project Type", "Project Name", "Agreement Number", "Contractor Name", "Contractor Phone No",
    "Contractor Gmail", "Project Location", "Village", "District", "State", "Start Date", "Planned End Date",
    "Work Order", "Work Order Date", "Irrigation Capacity", "Tender ID", "Tender Amount", "Accepted Amount",
    "Work Period", "Maintenance Period", "Sub Contractor(s)", "Drawing Status", "Minors & Design"
  ];

  const renderRow = (item) => {
    const drawing = drawingFor(item.serialNo);
    const pMinors = minors.filter(m => m.projectNo === item.serialNo);
    const totalDesignRows = pMinors.reduce((sum, m) => sum + getDesignByProject(m.id).length, 0) + getDesignByProject(item.serialNo).length;
    const subContractors = getSubContractorsForProject(item.serialNo);

    return (
      <tr
        key={item.serialNo}
        onClick={() => navigate(`/project-minors/${encodeURIComponent(item.serialNo)}`)}
        className="hover:bg-indigo-50/40 transition-colors border-b border-gray-100 cursor-pointer group"
      >
        <td className="px-4 py-3 text-center text-[13px] text-indigo-600 font-bold whitespace-nowrap">
          <span
            className="hover:underline font-bold text-indigo-600 inline-flex items-center justify-center gap-1 mx-auto"
            title="Click to view/manage project minors"
          >
            {item.serialNo} <ExternalLink size={11} className="text-gray-400 group-hover:text-indigo-600" />
          </span>
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
        <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {drawing && isDrawingUploadComplete(drawing) ? (
            <div className="space-y-0.5">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">Uploaded</span>
              <div className="text-[10px] text-gray-500">{formatDate(drawing.drawingDate)}</div>
              {drawing.drawingFile && (
                <a
                  href={drawing.drawingFile}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline"
                >
                  <Eye size={10} /> View Drawing
                </a>
              )}
            </div>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">Pending</span>
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {pMinors.length > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200"
              title="Click row to view/manage minors"
            >
              <Check size={11} /> {pMinors.length} Minor{pMinors.length > 1 ? 's' : ''} ({totalDesignRows} rows)
            </span>
          ) : totalDesignRows > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">
              <Check size={11} /> {totalDesignRows} rows
            </span>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">Pending</span>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const drawing = drawingFor(item.serialNo);
    const pMinors = minors.filter(m => m.projectNo === item.serialNo);
    const totalDesignRows = pMinors.reduce((sum, m) => sum + getDesignByProject(m.id).length, 0) + getDesignByProject(item.serialNo).length;
    const subContractors = getSubContractorsForProject(item.serialNo);

    return (
      <div
        key={item.serialNo}
        onClick={() => navigate(`/project-minors/${encodeURIComponent(item.serialNo)}`)}
        className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-2 cursor-pointer active:bg-indigo-50/40 hover:border-indigo-300 transition-all group"
      >
        <div className="flex justify-between items-start border-b border-gray-100 pb-2">
          <div>
            <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest block mb-1 text-left flex items-center gap-1 group-hover:underline">
              {item.serialNo} <ExternalLink size={10} />
            </span>
            <h4 className="text-sm text-gray-900 leading-tight">{item.projectName}</h4>
          </div>
          {item.projectType && (
            <span className="text-[8px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-tight whitespace-nowrap flex-shrink-0">
              {item.projectType}
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
            <span className="text-gray-500">Start / End:</span>
            <span className="text-gray-700">{formatDate(item.startDate)} - {formatDate(item.plannedEndDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Minors &amp; Design:</span>
            <span className={pMinors.length > 0 || totalDesignRows > 0 ? 'text-emerald-600 font-semibold' : 'text-gray-500 font-semibold'}>
              {pMinors.length > 0 ? `${pMinors.length} Minor(s) • ${totalDesignRows} rows` : (totalDesignRows > 0 ? `${totalDesignRows} rows` : 'Pending')}
            </span>
          </div>
        </div>

        <div className="text-[10px]">
          <p className="text-gray-400 uppercase tracking-tighter text-[8px] mb-0.5">Drawing Status</p>
          {drawing && isDrawingUploadComplete(drawing) ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">Uploaded</span>
                <span className="text-gray-500 ml-1.5">{formatDate(drawing.drawingDate)}</span>
              </div>
              {drawing.drawingFile && (
                <a
                  href={drawing.drawingFile}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[9px] text-indigo-600 hover:underline"
                >
                  <Eye size={10} /> View
                </a>
              )}
            </div>
          ) : (
            <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">Pending</span>
          )}
        </div>
      </div>
    );
  };

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
              onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
              className={`pb-2 text-xs md:text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'history' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <HistoryIcon size={14} /> History ({historyProjects.length})
              {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
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
                placeholder="Search projects..."
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
            className="flex items-center justify-center gap-1 border border-gray-300 rounded-lg md:rounded hover:bg-gray-100 text-gray-600 transition h-[32px] md:h-[38px] px-3 flex-shrink-0 cursor-pointer"
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
          minWidth="2800px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredList.length}
        />
      </div>
    </div>
  );
}

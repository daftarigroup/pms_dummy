import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, MapPin, Calendar, Tag, Search, RotateCcw, Hammer, Ruler, ListChecks, Check, GitCompare, Mountain, Layers, Workflow, FileUp, UploadCloud, User, Sliders, Package, CheckSquare, CalendarClock, Download, ExternalLink, X, FileText, Table, Loader2 } from 'lucide-react';
import { getDesignByProject, getExecutions, getActuals, getMinors, getProjectOrMinor, getScheduleForMinor, saveScheduleForMinor, getDrawingUploadForProject } from '../../utils/storageManager';
import { getFileFromIndexedDB, getMemoryFile, saveFileToIndexedDB, setMemoryFile } from '../../utils/fileStorage';
import { parsePdfTableFile } from '../../utils/pdfTableParser';
import { buildChainageDiffMap } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import SearchableDropdown from '../../components/SearchableDropdown';
import { DESIGN_COLUMNS } from './UploadDesign';
import UploadDesign from './UploadDesign';
import Execution from './Execution';
import Actual from './Actual';

// Show the value as-is (0 included) - only fall back to '-' when it's actually empty.
// Numeric values are shown with 3 digits after the decimal point; non-numeric text is untouched.
const displayVal = (v) => {
  if (v === undefined || v === null || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : v;
};

export default function ViewDesign() {
  const { projectNo } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [rows, setRows] = useState([]);
  const [showUploadDesignModal, setShowUploadDesignModal] = useState(false);
  const [execRow, setExecRow] = useState(null);
  const [actualRow, setActualRow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [actuals, setActuals] = useState([]);

  // Schedule Report Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState(null);
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState('');
  const [loadingSchedulePdf, setLoadingSchedulePdf] = useState(false);
  const [scheduleActiveTab, setScheduleActiveTab] = useState('pdf'); // 'pdf' | 'table'
  const [scheduleTableSearch, setScheduleTableSearch] = useState('');

  const resolvePdfUrl = async (fileUrlOrId, fileIdFallback) => {
    if (!fileUrlOrId && !fileIdFallback) return '';

    const toBlobUrl = (dataUri) => {
      try {
        const base64Data = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
        const binary = atob(base64Data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch {
        return dataUri;
      }
    };

    if (typeof fileUrlOrId === 'string') {
      if (fileUrlOrId.startsWith('blob:') || fileUrlOrId.startsWith('http')) {
        return fileUrlOrId;
      }
      if (fileUrlOrId.startsWith('data:application/pdf')) {
        return toBlobUrl(fileUrlOrId);
      }
      if (fileUrlOrId.startsWith('data:')) {
        return fileUrlOrId;
      }
    }

    const id = typeof fileUrlOrId === 'string' && fileUrlOrId.startsWith('idb:')
      ? fileUrlOrId.replace('idb:', '')
      : (fileIdFallback || fileUrlOrId);

    if (id) {
      const mem = getMemoryFile(id);
      if (mem) {
        if (typeof mem === 'string' && mem.startsWith('data:application/pdf')) {
          return toBlobUrl(mem);
        }
        return mem;
      }

      try {
        const data = await getFileFromIndexedDB(id);
        if (data) {
          if (typeof data === 'string' && data.startsWith('data:application/pdf')) {
            return toBlobUrl(data);
          }
          return data;
        }
      } catch (e) {
        console.warn('Failed to load schedule from IndexedDB:', e);
      }
    }

    return '';
  };

  const handleOpenScheduleReport = async () => {
    if (!project) return;
    setLoadingSchedulePdf(true);
    setShowScheduleModal(true);
    setScheduleTableSearch('');

    let sched = getScheduleForMinor(project.serialNo);

    if (!sched && (project.scheduleFile || project.scheduleFileId || (project.scheduleRows && project.scheduleRows.length > 0))) {
      sched = {
        minorId: project.serialNo,
        fileName: project.scheduleFileName || '',
        fileUrl: project.scheduleFile || '',
        fileId: project.scheduleFileId || '',
        rows: project.scheduleRows || [],
        headers: project.scheduleHeaders || []
      };
    }

    if (!sched && project.parentProjectNo) {
      sched = getScheduleForMinor(project.parentProjectNo);
    }

    if (!sched) {
      const drawRecord = getDrawingUploadForProject(project.serialNo) || (project.parentProjectNo ? getDrawingUploadForProject(project.parentProjectNo) : null);
      if (drawRecord?.drawingFile || drawRecord?.drawingFileName) {
        sched = {
          minorId: project.serialNo,
          fileName: drawRecord.drawingFileName || 'Drawing_Schedule.pdf',
          fileUrl: drawRecord.drawingFile || '',
          fileId: drawRecord.drawingFileId || '',
          rows: [],
          headers: []
        };
      }
    }

    if (!sched) {
      const allMinors = getMinors();
      const m = allMinors.find(min => min.id === project.serialNo || (project.minorName && min.minorName === project.minorName));
      if (m && (m.scheduleFile || m.scheduleFileId || m.scheduleFileName)) {
        sched = {
          minorId: m.id,
          fileName: m.scheduleFileName || '',
          fileUrl: m.scheduleFile || '',
          fileId: m.scheduleFileId || '',
          rows: m.scheduleRows || [],
          headers: m.scheduleHeaders || []
        };
      }
    }

    setScheduleData(sched || null);

    if (sched && (sched.fileUrl || sched.fileId)) {
      const url = await resolvePdfUrl(sched.fileUrl, sched.fileId);
      setResolvedPdfUrl(url);
      if (url) {
        setScheduleActiveTab('pdf');
      } else if (sched.rows && sched.rows.length > 0) {
        setScheduleActiveTab('table');
      }
    } else if (sched?.rows && sched.rows.length > 0) {
      setResolvedPdfUrl('');
      setScheduleActiveTab('table');
    } else {
      setResolvedPdfUrl('');
      setScheduleActiveTab('pdf');
    }

    setLoadingSchedulePdf(false);
  };

  const handleDownloadPdf = (url, fileName) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'Schedule_Report.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadScheduleInModal = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    const toastId = toast.loading('Reading & parsing PDF schedule...');
    try {
      const fileId = `sched_${project.serialNo}_${Date.now()}`;
      const blobUrl = URL.createObjectURL(file);
      setMemoryFile(fileId, blobUrl);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          if (typeof reader.result === 'string') {
            await saveFileToIndexedDB(fileId, reader.result);
          } else {
            await saveFileToIndexedDB(fileId, file);
          }
        } catch (err) {
          console.warn('Could not save to IDB:', err);
        }
      };
      reader.readAsDataURL(file);

      let parsedRows = [];
      let parsedHeaders = [];
      try {
        const parsed = await parsePdfTableFile(file);
        parsedRows = parsed.rows || [];
        parsedHeaders = parsed.headers || [];
      } catch (err) {
        console.warn('Could not parse table from PDF:', err);
      }

      const schedulePayload = {
        minorId: project.serialNo,
        fileName: file.name,
        fileUrl: `idb:${fileId}`,
        fileId,
        rows: parsedRows,
        headers: parsedHeaders
      };

      saveScheduleForMinor(project.serialNo, schedulePayload);
      setScheduleData(schedulePayload);
      setResolvedPdfUrl(blobUrl);
      setScheduleActiveTab('pdf');
      toast.success('Schedule PDF attached successfully!', { id: toastId });
    } catch (err) {
      toast.error('Failed to process PDF', { id: toastId });
    }
  };

  const filteredScheduleRows = (scheduleData?.rows || []).filter(r => {
    if (!scheduleTableSearch.trim()) return true;
    const q = scheduleTableSearch.toLowerCase();
    return Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q));
  });

  const initialFilters = { searchQuery: '', alignment: '', pipeDia: '' };
  const [filters, setFilters] = useState({ ...initialFilters });

  useEffect(() => {
    const decodedNo = decodeURIComponent(projectNo || '');
    const found = getProjectOrMinor(decodedNo);
    setProject(found || null);
    setRows(getDesignByProject(decodedNo));
    setExecutions(getExecutions());
    setActuals(getActuals());
  }, [projectNo]);

  // Every design row's permanent Serial No = its position in the original uploaded order,
  // independent of any search/filter - this is what gets carried into Execution/Actual/Auto Comparison
  const rowIndexMap = new Map(rows.map((r, i) => [r, i + 1]));

  // Identify a design row by all of its own values (Alignment + 7 measurement fields)
  const rowKey = (row) => DESIGN_COLUMNS.map(col => String(row[col.key] ?? '')).join('|');
  // Rebuild the same key from a saved Execution/Actual entry's Alignment + Design snapshot
  const entryDesignKey = (entry) => DESIGN_COLUMNS
    .map(col => String(col.key === 'alignment' ? entry.alignment : entry.design?.[col.key] ?? ''))
    .join('|');

  const executedKeys = new Set(
    executions.filter(e => e.projectNo === project?.serialNo).map(entryDesignKey)
  );
  const actualDoneKeys = new Set(
    actuals.filter(e => e.projectNo === project?.serialNo).map(entryDesignKey)
  );

  // Unique Pipe Dia values across all uploaded design rows, sorted ascending (small to high) -
  // rendered as extra headers after "Actual Measurement"
  const uniquePipeDias = Array.from(new Set(rows.map(r => r.pipeDia)))
    .filter(v => v !== undefined && v !== null && v !== '')
    .sort((a, b) => Number(a) - Number(b));

  // Value shown under a row's matching Pipe Dia column: this row's Chainage minus the
  // upper (previous) row's Chainage - see buildChainageDiffMap for the 0/missing-Chainage rule.
  const chainageDiffMap = buildChainageDiffMap(rows, r => r.chainage, r => r);

  const tableHeaders = ["Serial No", ...DESIGN_COLUMNS.map(col => col.label), "Execution Entry", "Actual Measurement", ...uniquePipeDias.map(String)];

  const handleClearFilters = () => {
    setFilters({ ...initialFilters });
    toast.success('Filters cleared');
  };

  const filteredRows = rows.filter(row => {
    if (filters.alignment && row.alignment !== filters.alignment) return false;
    if (filters.pipeDia && String(row.pipeDia) !== String(filters.pipeDia)) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      return DESIGN_COLUMNS.some(col => String(row[col.key] ?? '').toLowerCase().includes(q));
    }
    return true;
  });

  // Totals row: sum of each Pipe Dia column's values across the currently filtered rows
  const pipeDiaTotals = uniquePipeDias.map(dia =>
    filteredRows.reduce((sum, row) => {
      if (String(row.pipeDia) !== String(dia)) return sum;
      const diff = chainageDiffMap.get(row);
      return diff !== undefined ? sum + diff : sum;
    }, 0)
  );
  const totalRow = [
    'Total',
    ...DESIGN_COLUMNS.map(() => ''),
    '',
    '',
    ...pipeDiaTotals.map(t => t.toFixed(3))
  ];

  const renderRow = (item, idx) => {
    const key = rowKey(item);
    const isExecuted = executedKeys.has(key);
    const isActualDone = actualDoneKeys.has(key);
    const serialNo = rowIndexMap.get(item);

    return (
      <tr key={idx} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center text-sm text-gray-500 font-semibold whitespace-nowrap leading-none">
          {serialNo}
        </td>
        {DESIGN_COLUMNS.map(col => (
          <td key={col.key} className="px-4 py-3 text-center text-sm text-gray-700 whitespace-nowrap leading-none">
            {col.key === 'valve'
              ? (item[col.key] !== undefined && item[col.key] !== null && String(item[col.key]).trim() !== ''
                  ? String(item[col.key])
                  : '-')
              : displayVal(item[col.key])}
          </td>
        ))}
        <td className="px-2 py-2 text-center whitespace-nowrap">
          <button
            onClick={() => setExecRow({ ...item, __serialNo: serialNo })}
            disabled={isExecuted}
            className={`flex items-center justify-center gap-1.5 border w-full h-[30px] rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              isExecuted
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            {isExecuted ? <Check size={12} /> : <Hammer size={12} />} {isExecuted ? 'Done' : 'Execution'}
          </button>
        </td>
        <td className="px-2 py-2 text-center whitespace-nowrap">
          <button
            onClick={() => setActualRow({ ...item, __serialNo: serialNo })}
            disabled={isActualDone}
            className={`flex items-center justify-center gap-1.5 border w-full h-[30px] rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              isActualDone
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {isActualDone ? <Check size={12} /> : <Ruler size={12} />} {isActualDone ? 'Done' : 'Actual'}
          </button>
        </td>
        {uniquePipeDias.map(dia => {
          const isMatch = String(item.pipeDia) === String(dia);
          const diff = chainageDiffMap.get(item);
          const value = isMatch && diff !== undefined ? diff : null;
          return (
            <td key={`dia-${dia}`} className={`px-4 py-3 text-center text-sm whitespace-nowrap leading-none ${value !== null ? 'text-gray-700 font-semibold' : 'text-gray-300'}`}>
              {value !== null ? value.toFixed(3) : '-'}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderCard = (item, idx) => {
    const key = rowKey(item);
    const isExecuted = executedKeys.has(key);
    const isActualDone = actualDoneKeys.has(key);
    const serialNo = rowIndexMap.get(item);

    return (
      <div key={idx} className="bg-white rounded-lg border border-indigo-50 shadow-sm p-3 space-y-1.5">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-500">Serial No:</span>
          <span className="text-gray-800 font-semibold">{serialNo}</span>
        </div>
        {DESIGN_COLUMNS.map(col => (
          <div key={col.key} className="flex justify-between text-[10px]">
            <span className="text-gray-500">{col.label}:</span>
            <span className="text-gray-800">
              {col.key === 'valve'
                ? (item[col.key] !== undefined && item[col.key] !== null && String(item[col.key]).trim() !== ''
                    ? String(item[col.key])
                    : '-')
                : displayVal(item[col.key])}
            </span>
          </div>
        ))}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => setExecRow({ ...item, __serialNo: serialNo })}
            disabled={isExecuted}
            className={`flex-1 border py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1 ${
              isExecuted
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200'
            }`}
          >
            {isExecuted ? <Check size={11} /> : <Hammer size={11} />} {isExecuted ? 'Done' : 'Execution'}
          </button>
          <button
            onClick={() => setActualRow({ ...item, __serialNo: serialNo })}
            disabled={isActualDone}
            className={`flex-1 border py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1 ${
              isActualDone
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}
          >
            {isActualDone ? <Check size={11} /> : <Ruler size={11} />} {isActualDone ? 'Done' : 'Actual'}
          </button>
        </div>
      </div>
    );
  };

  if (!project) {
    return (
      <div className="p-6 space-y-4">
        <button
          onClick={() => project?.isMinor ? navigate(`/project-minors/${encodeURIComponent(project.parentProjectNo)}`) : navigate('/upload-design')}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-semibold"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500 text-sm">
          Project not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-3 md:space-y-6 flex flex-col h-full min-h-0">
      {/* Row 1: Back + Search + Filters + Add Requirement */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full px-2 sm:px-0">
        <button
          onClick={() => project?.isMinor ? navigate(`/project-minors/${encodeURIComponent(project.parentProjectNo)}`) : navigate('/upload-design')}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-semibold w-fit flex-shrink-0"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex-1 flex flex-wrap items-center gap-2 md:gap-3 min-w-0">
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-2.5 top-[9px] md:top-[11px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search design rows..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg md:rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-xs md:text-sm h-[32px] md:h-[38px]"
            />
          </div>
          <div className="w-40 md:w-56 flex-shrink-0">
            <SearchableDropdown
              options={Array.from(new Set(rows.map(r => r.alignment))).filter(Boolean).sort().map(v => ({ value: v, label: String(v) }))}
              value={filters.alignment}
              onChange={(val) => setFilters({ ...filters, alignment: val })}
              placeholder="All Alignment"
              height="h-[32px] md:h-[38px]"
            />
          </div>
          <div className="w-32 md:w-44 flex-shrink-0">
            <SearchableDropdown
              options={Array.from(new Set(rows.map(r => r.pipeDia)))
                .filter(v => v !== undefined && v !== null && v !== '')
                .sort((a, b) => Number(a) - Number(b))
                .map(v => ({ value: v, label: String(v) }))}
              value={filters.pipeDia}
              onChange={(val) => setFilters({ ...filters, pipeDia: val })}
              placeholder="All Pipe Dia"
              height="h-[32px] md:h-[38px]"
            />
          </div>
          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg md:rounded w-[32px] h-[32px] md:w-[38px] md:h-[38px] hover:bg-gray-100 transition-colors shadow-sm flex-shrink-0"
            title="Clear Filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Row 2: Product IMF + Valve Report + Execution Details + Excavation & Murum + Actual Details + Auto Comparison */}
      <div className="flex items-center justify-end gap-2 flex-wrap w-full px-2 sm:px-0">
        <button
          onClick={() => navigate(`/product-imf/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-blue-50 transition"
        >
          <Package size={16} /> Sub Contractor IMF
        </button>
        <button
          onClick={() => navigate(`/valve-report/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-teal-200 text-teal-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-teal-50 transition"
        >
          <Sliders size={16} /> Valve Report
        </button>
        <button
          onClick={handleOpenScheduleReport}
          className="flex items-center justify-center gap-2 bg-white border border-rose-200 text-rose-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-rose-50 transition"
        >
          <CalendarClock size={16} /> Schedule Report
        </button>
        <button
          onClick={() => navigate(`/execution-details/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-indigo-50 transition"
        >
          <ListChecks size={16} /> Execution Details
        </button>
        <button
          onClick={() => navigate(`/excavation-murum/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-amber-200 text-amber-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-amber-50 transition"
        >
          <Mountain size={16} /> Excavation
        </button>
        <button
          onClick={() => navigate(`/murum/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-orange-200 text-orange-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-orange-50 transition"
        >
          <Layers size={16} /> Murum
        </button>
        <button
          onClick={() => navigate(`/actual-details/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-emerald-50 transition"
        >
          <ListChecks size={16} /> Actual Details
        </button>
        <button
          onClick={() => navigate(`/auto-comparison/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-purple-200 text-purple-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-purple-50 transition"
        >
          <GitCompare size={16} /> Auto Comparison
        </button>
        <button
          onClick={() => navigate(`/back-filling-report/${encodeURIComponent(project.serialNo)}`)}
          className="flex items-center justify-center gap-2 bg-white border border-sky-200 text-sky-600 rounded-lg px-3 h-[32px] md:h-[38px] text-xs md:text-sm font-semibold shadow-sm hover:bg-sky-50 transition"
        >
          <CheckSquare size={16} /> Back Filling Report
        </button>
      </div>

      {/* Project Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 mx-2 sm:mx-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex items-start gap-2 min-w-0">
            <Building2 size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wide">Project Name</p>
              <p className="text-base md:text-lg text-gray-900 font-bold truncate">{project.originalProjectName || project.projectName}</p>
            </div>
          </div>
          {project.isMinor && (
            <div className="flex items-start gap-2 min-w-0">
              <Tag size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wide">Minor Name</p>
                <p className="text-base md:text-lg text-indigo-600 font-bold truncate">{project.minorName}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 min-w-0">
            <User size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wide">Contractor</p>
              <p className="text-base md:text-lg text-gray-900 font-bold truncate">{project.contractorName || '-'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <Calendar size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wide">Start Date</p>
              <p className="text-base md:text-lg text-gray-900 font-bold truncate">{project.startDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <Calendar size={20} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] md:text-xs font-bold text-gray-500 uppercase tracking-wide">Planned End Date</p>
              <p className="text-base md:text-lg text-gray-900 font-bold truncate">{project.plannedEndDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Design Table */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col mx-2 sm:mx-0">
        <DataTable
          headers={tableHeaders}
          data={filteredRows}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="1550px"
          totalRow={totalRow}
        />
      </div>



      {/* Upload Design Modal */}
      <UploadDesign
        isOpen={showUploadDesignModal}
        onClose={() => setShowUploadDesignModal(false)}
        project={project}
        onUploaded={() => { setShowUploadDesignModal(false); setRows(getDesignByProject(project.serialNo)); }}
      />

      {/* Execution Entry Modal */}
      <Execution
        isOpen={!!execRow}
        onClose={() => setExecRow(null)}
        project={project}
        designRow={execRow}
        onSaved={() => { setExecRow(null); setExecutions(getExecutions()); }}
      />

      {/* Actual Measurement Modal */}
      <Actual
        isOpen={!!actualRow}
        onClose={() => setActualRow(null)}
        project={project}
        designRow={actualRow}
        onSaved={() => { setActualRow(null); setActuals(getActuals()); }}
      />

      {/* Schedule Report PDF & Table Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-100 shadow-2xs">
                  <CalendarClock size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-gray-900">Schedule Report</h2>
                    {project?.isMinor && (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-100 truncate max-w-xs">
                        {project.minorName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {scheduleData?.fileName ? `Document: ${scheduleData.fileName}` : 'Drawing & Design Upload Schedule'}
                  </p>
                </div>
              </div>

              {/* Center Tab Switcher */}
              <div className="hidden sm:flex items-center bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScheduleActiveTab('pdf')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    scheduleActiveTab === 'pdf'
                      ? 'bg-white text-rose-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText size={14} /> PDF Viewer
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleActiveTab('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    scheduleActiveTab === 'table'
                      ? 'bg-white text-rose-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Table size={14} /> Parsed Table {scheduleData?.rows?.length ? `(${scheduleData.rows.length})` : ''}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer transition">
                  <UploadCloud size={14} />
                  <span className="hidden md:inline">{scheduleData?.fileUrl ? 'Replace PDF' : 'Upload PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleUploadScheduleInModal}
                  />
                </label>

                {resolvedPdfUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => window.open(resolvedPdfUrl, '_blank')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                      title="Open PDF in new tab"
                    >
                      <ExternalLink size={14} />
                      <span className="hidden md:inline">Open in Tab</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(resolvedPdfUrl, scheduleData?.fileName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                      title="Download PDF"
                    >
                      <Download size={14} />
                      <span className="hidden md:inline">Download</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex sm:hidden items-center justify-center bg-gray-50 border-b border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setScheduleActiveTab('pdf')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg ${
                  scheduleActiveTab === 'pdf' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-600'
                }`}
              >
                <FileText size={14} /> PDF Viewer
              </button>
              <button
                type="button"
                onClick={() => setScheduleActiveTab('table')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-lg ${
                  scheduleActiveTab === 'table' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-600'
                }`}
              >
                <Table size={14} /> Parsed Table {scheduleData?.rows?.length ? `(${scheduleData.rows.length})` : ''}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 bg-gray-100 overflow-hidden flex flex-col">
              {loadingSchedulePdf ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-rose-500" size={36} />
                  <p className="text-sm font-medium text-gray-600">Loading schedule document...</p>
                </div>
              ) : scheduleActiveTab === 'pdf' ? (
                resolvedPdfUrl ? (
                  <div className="flex-1 h-full flex flex-col bg-slate-900 relative">
                    <iframe
                      src={resolvedPdfUrl}
                      title="Schedule Report PDF"
                      className="w-full flex-1 border-0 bg-white"
                    />
                    <div className="bg-slate-800 text-slate-300 text-xs px-4 py-2 flex items-center justify-between border-t border-slate-700">
                      <span className="truncate max-w-md">
                        Document: <strong className="text-white">{scheduleData?.fileName || 'Schedule Document.pdf'}</strong>
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => window.open(resolvedPdfUrl, '_blank')}
                          className="text-rose-300 hover:text-white underline cursor-pointer"
                        >
                          Open in full tab
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(resolvedPdfUrl, scheduleData?.fileName)}
                          className="text-rose-300 hover:text-white underline cursor-pointer"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
                    <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4 border border-rose-100 shadow-2xs">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">No Schedule PDF Found</h3>
                    <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
                      No schedule document has been uploaded for this minor in Drawing & Design Upload. You can attach the PDF now to view it here and extract its table data.
                    </p>
                    <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-md cursor-pointer transition">
                      <UploadCloud size={18} /> Upload Schedule PDF
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={handleUploadScheduleInModal}
                      />
                    </label>
                  </div>
                )
              ) : (
                /* Tabular View */
                scheduleData?.rows && scheduleData.rows.length > 0 ? (
                  <div className="flex-1 flex flex-col min-h-0 bg-white p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="relative flex-1 max-w-sm">
                        <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search schedule rows..."
                          value={scheduleTableSearch}
                          onChange={(e) => setScheduleTableSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-rose-500"
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        {filteredScheduleRows.length} of {scheduleData.rows.length} rows
                      </span>
                    </div>
                    <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 uppercase font-bold text-[11px] z-10">
                          <tr>
                            <th className="px-3 py-2 border-r border-gray-200 w-12 text-center bg-gray-50">#</th>
                            {(scheduleData.headers || []).map((h, i) => (
                              <th key={i} className="px-3 py-2 border-r border-gray-200 whitespace-nowrap bg-gray-50">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredScheduleRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-rose-50/40 transition">
                              <td className="px-3 py-1.5 border-r border-gray-200 text-center text-gray-400 font-mono">
                                {idx + 1}
                              </td>
                              {(scheduleData.headers || []).map((h, i) => (
                                <td key={i} className="px-3 py-1.5 border-r border-gray-200 whitespace-nowrap text-gray-800">
                                  {row[h] !== undefined && row[h] !== null && String(row[h]).trim() !== '' ? String(row[h]) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 text-center">
                    <Table size={40} className="text-gray-300 mb-2" />
                    <h4 className="text-base font-bold text-gray-700">No Structured Table Rows</h4>
                    <p className="text-xs text-gray-500 max-w-sm mt-1">
                      No tabular data was extracted from this schedule PDF, but the full document is available in the PDF Viewer tab.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Clock, History as HistoryIcon, ClipboardCheck, User, Phone, Users, Plus, Trash2, Search, RotateCcw,
  Hash, Calendar, FileText, UploadCloud, Check, Eye, Info, IndianRupee, Ruler, ChevronDown,
  Truck, FileCheck2, Compass, Sparkles
} from 'lucide-react';
import {
  getProjects,
  getMobilizations,
  upsertMobilization,
  isMobilizationComplete,
  getSentPOs,
  upsertSentPO,
  isSentPOComplete,
  getSurveys,
  upsertSurvey,
  isSurveyComplete,
  getExternalPurchaseOrders,
  syncExternalPurchaseOrdersFromMaster
} from '../../utils/storageManager';
import { fetchPoMaster } from '@/services/poService';
import { toInputDateFormat } from '@/lib/utils';
import { amountInWords, generateId, fileToBase64, compressImageToBase64 } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import SearchableDropdown from '../../components/SearchableDropdown';
import InfoPopover from '../../components/InfoPopover';

const MAX_PO_UPLOAD = 50 * 1024 * 1024; // 50MB - accepted at selection time
const MAX_PO_STORED = 2 * 1024 * 1024;  // 2MB - what actually gets saved

const blankConsultant = () => ({
  id: generateId(),
  higherType: 'Sub Contractor',
  poNumber: '',
  name: '',
  number: '',
  workingUnit: '',
  poAmount: '',
  poDate: '',
  poDocument: '',
  poDocumentName: '',
  remarks: '',
  isCustomPo: false
});

const formatConsultantSummary = (c) => {
  const parts = [c.name, c.number];
  if (c.workingUnit) parts.push(c.workingUnit);
  if (c.poNumber) parts.push(`PO: ${c.poNumber}`);
  if (c.poAmount) parts.push(`₹${c.poAmount}`);
  return parts.join(' · ');
};

const SUB_CONTRACTOR_NAMES = [
  'Apex Engineering & Infra',
  'Shree Ram Construction Co.',
  'Kalyan Earthmovers & Piping',
  'Balaji Pipeline Infrastructure',
  'Omkar Infratech Projects',
  'Sai Krupa Engineering Works',
  'Patel Infrastructure Pvt Ltd',
  'Mahalaxmi Tube & Piping Services'
];

const WORKING_UNITS = ['Hectares', 'Pipe Dia'];

const generateDummyMobilizationData = (currentProject) => {
  const externalPOs = getExternalPurchaseOrders();
  const chosenPO = (externalPOs && externalPOs.length > 0)
    ? externalPOs[Math.floor(Math.random() * externalPOs.length)]
    : {
        poNumber: currentProject?.serialNo ? `PO/${currentProject.serialNo}/01` : 'PO/2026/01',
        name: currentProject?.contractorName || 'Sub Contractor Infra',
        number: (currentProject?.contractorPhone || '9876543210').toString().replace(/\D/g, '').slice(0, 10),
        workingUnit: 'Hectares',
        poAmount: '1500000',
        poDate: toInputDateFormat(new Date()),
        poDocument: '',
        poDocumentName: 'PO_Approved.pdf',
        remarks: 'Sub-contract mobilization and pipeline execution'
      };

  // Valid 1-page sample PDF base64
  const samplePdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxOCAwMDAwMCBuIAowMDAwMDAwMDY5IDAwMDAwIG4gCjAwMDAwMDAxMjUgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA0Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoxOTkKJSVFT0YK';

  return {
    consultants: [
      {
        id: generateId(),
        higherType: 'Sub Contractor',
        poNumber: chosenPO.poNumber,
        name: chosenPO.name,
        number: chosenPO.number,
        workingUnit: chosenPO.workingUnit,
        poAmount: chosenPO.poAmount,
        poDate: chosenPO.poDate,
        poDocument: chosenPO.poDocument || samplePdfBase64,
        poDocumentName: chosenPO.poDocumentName || `${chosenPO.poNumber}_Approved.pdf`,
        remarks: chosenPO.remarks || 'Loaded from external PO Management System',
        isCustomPo: false
      }
    ],
    surveyStatus: 'Yes',
    surveyRemarks: 'Topographic survey and pipeline route verification completed successfully.'
  };
};

const initialFormData = {
  consultants: [],
  surveyStatus: 'No', // 'Yes' | 'No'
  surveyRemarks: ''
};

// Format YYYY-MM-DD -> DD/MM/YYYY for display
const formatDate = (val) => {
  if (!val) return '-';
  const parts = val.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return val;
};

const initialFilters = { searchQuery: '', projectName: '', contractorName: '', projectLocation: '' };

export default function Mobilization() {
  const [projects, setProjects] = useState([]);
  const [records, setRecords] = useState([]);
  const [poRecords, setPoRecords] = useState([]);
  const [surveyRecords, setSurveyRecords] = useState([]);
  const [externalPOs, setExternalPOs] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [formProject, setFormProject] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ ...initialFilters });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const refresh = async () => {
    setProjects(getProjects());
    setRecords(getMobilizations());
    setPoRecords(getSentPOs());
    setSurveyRecords(getSurveys());
    const initialExt = getExternalPurchaseOrders();
    setExternalPOs(initialExt);
    try {
      const liveMaster = await fetchPoMaster();
      if (liveMaster && liveMaster.length > 0) {
        const synced = syncExternalPurchaseOrdersFromMaster(liveMaster);
        setExternalPOs(synced);
      }
    } catch (e) {
      console.warn('Could not fetch live PO master:', e);
    }
  };

  useEffect(() => { refresh(); }, []);

  const recordFor = (projectNo) => records.find(r => r.projectNo === projectNo) || null;
  const poFor = (projectNo) => poRecords.find(p => p.projectNo === projectNo) || null;
  const surveyFor = (projectNo) => surveyRecords.find(s => s.projectNo === projectNo) || null;

  const isContractorComplete = (projectNo) => {
    const mob = recordFor(projectNo);
    const surv = surveyFor(projectNo);
    return isMobilizationComplete(mob) && (surv?.surveyStatus === 'Yes' || isSurveyComplete(surv));
  };

  const pendingProjects = projects.filter(p => !isContractorComplete(p.serialNo)).reverse();
  const historyProjects = projects.filter(p => isContractorComplete(p.serialNo)).reverse();

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

  const openForm = async (project) => {
    let currentExt = getExternalPurchaseOrders();
    setExternalPOs(currentExt);

    try {
      const liveMaster = await fetchPoMaster();
      if (liveMaster && liveMaster.length > 0) {
        currentExt = syncExternalPurchaseOrdersFromMaster(liveMaster);
        setExternalPOs(currentExt);
      }
    } catch (e) {
      console.warn('Could not sync live POs in openForm:', e);
    }

    const rec = recordFor(project.serialNo);
    const po = poFor(project.serialNo);
    const surv = surveyFor(project.serialNo);

    let consultants = rec && Array.isArray(rec.consultants) && rec.consultants.length > 0
      ? rec.consultants
      : (po && Array.isArray(po.consultants) && po.consultants.length > 0 ? po.consultants : [blankConsultant()]);

    consultants = consultants.map((c, idx) => {
      const poC = po?.consultants?.find(p => p.id === c.id) || po?.consultants?.[idx];
      const merged = {
        ...blankConsultant(),
        ...c,
        ...(poC || {})
      };
      return {
        ...merged,
        poDate: toInputDateFormat(merged.poDate) || merged.poDate,
        isCustomPo: Boolean(merged.poNumber && !currentExt.some(p => p.poNumber === merged.poNumber))
      };
    });

    setFormData({
      consultants: consultants.length > 0 ? consultants : [blankConsultant()],
      surveyStatus: surv?.surveyStatus || (surv && isSurveyComplete(surv) ? 'Yes' : 'No'),
      surveyRemarks: surv?.remarks || ''
    });
    setFormProject(project);
  };

  const addConsultantRow = () => {
    setFormData(prev => ({ ...prev, consultants: [...prev.consultants, blankConsultant()] }));
  };

  const removeConsultantRow = (id) => {
    setFormData(prev => ({ ...prev, consultants: prev.consultants.filter(c => c.id !== id) }));
  };

  const updateConsultantRow = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      consultants: prev.consultants.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const handlePoSelect = (consultantId, selectedPoNumber) => {
    if (selectedPoNumber === '__custom__') {
      updateConsultantRow(consultantId, 'isCustomPo', true);
      updateConsultantRow(consultantId, 'poNumber', '');
      return;
    }

    const poData = externalPOs.find(p => p.poNumber === selectedPoNumber);
    if (poData) {
      const formattedDate = toInputDateFormat(poData.poDate) || toInputDateFormat(new Date());
      const cleanPhone = (poData.number || '').toString().replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({
        ...prev,
        consultants: prev.consultants.map(c => {
          if (c.id !== consultantId) return c;
          return {
            ...c,
            poNumber: poData.poNumber,
            name: poData.name || c.name || '',
            number: cleanPhone || c.number || '',
            workingUnit: poData.workingUnit || c.workingUnit || 'Hectares',
            poAmount: poData.poAmount ? String(poData.poAmount) : (c.poAmount || ''),
            poDate: formattedDate,
            poDocument: poData.poDocument || c.poDocument || '',
            poDocumentName: poData.poDocumentName || `${poData.poNumber}_Approved.pdf`,
            remarks: poData.remarks || c.remarks || 'Loaded from PO Management System',
            isCustomPo: false
          };
        })
      }));
      toast.success(`Loaded details for ${selectedPoNumber} from PO System!`);
    } else {
      updateConsultantRow(consultantId, 'poNumber', selectedPoNumber);
    }
  };

  const handlePoDocument = async (id, file) => {
    if (!file) return;
    if (file.size > MAX_PO_UPLOAD) {
      toast.error('File size must be less than 50MB');
      return;
    }
    try {
      if (file.type.startsWith('image/')) {
        const { base64, size } = await compressImageToBase64(file, { maxBytes: MAX_PO_STORED });
        updateConsultantRow(id, 'poDocument', base64);
        updateConsultantRow(id, 'poDocumentName', file.name);
        toast.success(
          size <= MAX_PO_STORED
            ? `Attached (compressed to ${(size / 1024 / 1024).toFixed(2)}MB)`
            : `Attached (${(size / 1024 / 1024).toFixed(2)}MB - could not compress further)`
        );
      } else {
        if (file.size > MAX_PO_STORED) {
          toast.error('PDF files cannot be auto-compressed - please upload a PDF under 2MB, or use an image instead');
          return;
        }
        const base64 = await fileToBase64(file);
        updateConsultantRow(id, 'poDocument', base64);
        updateConsultantRow(id, 'poDocumentName', file.name);
        toast.success('PO document attached');
      }
    } catch (error) {
      toast.error('Error reading file');
    }
  };

  const handleFillDummyData = (e) => {
    e?.preventDefault?.();
    const dummy = generateDummyMobilizationData(formProject);
    setFormData(dummy);
    toast.success('Test entries filled with valid data!');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    for (const c of formData.consultants) {
      if (!c.poNumber?.trim()) { toast.error('PO Number is required — please select or enter a PO'); return; }
      if (!c.name.trim()) { toast.error('Sub Contractor Name is required'); return; }
      if (!c.number.trim()) { toast.error('Sub Contractor Number is required'); return; }
      if (c.number.length !== 10) { toast.error('Sub Contractor Number must be exactly 10 digits'); return; }
    }

    setLoading(true);
    upsertMobilization({ projectNo: formProject.serialNo, consultants: formData.consultants });
    upsertSentPO({ projectNo: formProject.serialNo, consultants: formData.consultants });
    upsertSurvey({
      projectNo: formProject.serialNo,
      surveyStatus: formData.surveyStatus,
      remarks: formData.surveyRemarks
    });
    setLoading(false);
    setFormProject(null);
    refresh();

    if (formData.surveyStatus === 'Yes') {
      toast.success(`${formProject.serialNo} contractor stage complete — moved to Final Approval!`);
    } else {
      toast.success(`${formProject.serialNo} contractor details saved`);
    }
  };

  const tableHeaders = [
    "Action", "Project No", "Project Type", "Project Name", "Agreement Number", "Contractor Name", "Contractor Phone No",
    "Contractor Gmail", "Project Location", "Village", "District", "State", "Start Date", "Planned End Date",
    "Work Order", "Work Order Date", "Irrigation Capacity", "Tender ID", "Tender Amount", "Accepted Amount",
    "Work Period", "Maintenance Period", "Sub Contractor(s)", "PO Number", "Survey Status"
  ];

  const renderRow = (item) => {
    const rec = recordFor(item.serialNo);
    const po = poFor(item.serialNo);
    const surv = surveyFor(item.serialNo);
    const isSurveyDone = surv && (surv.surveyStatus === 'Yes' || surv.surveyStatus === 'yes' || isSurveyComplete(surv));

    return (
      <tr key={item.serialNo} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <button
            onClick={() => openForm(item)}
            className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wide hover:bg-indigo-100 transition-colors"
          >
            <ClipboardCheck size={12} /> {activeTab === 'history' ? 'View' : 'Update'}
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
          {rec?.consultants?.length > 0 ? (
            <InfoPopover
              items={rec.consultants.map(formatConsultantSummary)}
              title={`Sub Contractors — ${item.serialNo}`}
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-2 py-0.5 cursor-help hover:bg-emerald-200/60">
                <Users size={12} /> {rec.consultants.map(c => c.name).filter(Boolean).join(', ') || `${rec.consultants.length} Assigned`}
              </span>
            </InfoPopover>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-gray-100 text-gray-500 border-gray-200">None</span>
          )}
        </td>
        <td className="px-4 py-3 text-center text-[13px] text-gray-700 whitespace-nowrap">
          {rec?.consultants?.some(c => c.poNumber)
            ? rec.consultants.map(c => c.poNumber).filter(Boolean).join(', ')
            : '-'}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          {isSurveyDone ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-emerald-100 text-emerald-700 border-emerald-200">
              <Check size={11} /> Done (Yes)
            </span>
          ) : (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-200">
              Pending (No)
            </span>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const rec = recordFor(item.serialNo);
    const surv = surveyFor(item.serialNo);
    const isSurveyDone = surv && (surv.surveyStatus === 'Yes' || surv.surveyStatus === 'yes' || isSurveyComplete(surv));

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
            <span className="text-gray-500">Gmail:</span>
            <span className="text-gray-700 truncate max-w-[160px]">{item.contractorEmail || '-'}</span>
          </div>
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
          {rec?.consultants?.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Sub Contractor:</span>
              <span className="text-gray-700 truncate max-w-[140px]">{rec.consultants.map(c => c.name).filter(Boolean).join(', ')}</span>
            </div>
          )}
          {rec?.consultants?.some(c => c.poNumber) && (
            <div className="flex justify-between">
              <span className="text-gray-500">PO Number:</span>
              <span className="text-gray-700 truncate max-w-[140px]">{rec.consultants.map(c => c.poNumber).filter(Boolean).join(', ')}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Survey Status:</span>
            {isSurveyDone ? (
              <span className="text-emerald-700 bg-emerald-100 border border-emerald-200 text-[9px] font-semibold px-1.5 py-0.5 rounded">Done (Yes)</span>
            ) : (
              <span className="text-amber-700 bg-amber-100 border border-amber-200 text-[9px] font-semibold px-1.5 py-0.5 rounded">Pending (No)</span>
            )}
          </div>
        </div>

        <button
          onClick={() => openForm(item)}
          className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide flex items-center justify-center gap-1.5"
        >
          <ClipboardCheck size={12} /> {activeTab === 'history' ? 'View' : 'Update'}
        </button>
      </div>
    );
  };

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-3 md:space-y-6 flex flex-col h-full min-h-0">
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
          minWidth="2900px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          totalResults={filteredList.length}
        />
      </div>

      {/* Mobilization Form Modal */}
      <ModalForm
        isOpen={!!formProject}
        onClose={() => setFormProject(null)}
        title={formProject ? `Mobilization — ${formProject.serialNo}` : ''}
        onSubmit={handleSubmit}
        submitText={loading ? 'Saving...' : 'Save'}
        maxWidth="max-w-3xl"
        extraFooterAction={
          <button
            type="button"
            onClick={handleFillDummyData}
            className="flex-1 px-2 md:px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap"
            title="Fill all fields with random valid dummy data"
          >
            <Sparkles size={16} className="text-amber-600" />
            <span>Test Entries</span>
          </button>
        }
      >
        <div className="space-y-3">
          {/* Header Action Row */}
          <div className="flex items-center justify-between pb-1 border-b border-gray-100">
            <span className="text-[10px] md:text-[11px] font-bold text-indigo-500 uppercase tracking-widest">
              Sub Contractor & Survey Details
            </span>
            <button
              type="button"
              onClick={handleFillDummyData}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs"
              title="Fill all fields with random valid dummy data"
            >
              <Sparkles size={13} className="text-amber-600" />
              <span>Test Entries</span>
            </button>
          </div>

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
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Contractor Gmail</p>
                  <p className="text-gray-700 truncate">{formProject.contractorEmail || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Project Location</p>
                  <p className="text-gray-700 truncate">{formProject.projectLocation || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Start Date</p>
                  <p className="text-gray-700 truncate">{formatDate(formProject.startDate)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Planned End Date</p>
                  <p className="text-gray-700 truncate">{formatDate(formProject.plannedEndDate)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Work Order</p>
                  <p className="text-gray-700 truncate">{formProject.workOrder || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Work Order Date</p>
                  <p className="text-gray-700 truncate">{formatDate(formProject.workOrderDate)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Irrigation Capacity</p>
                  <p className="text-gray-700 truncate">{formProject.irrigationCapacity || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Tender ID</p>
                  <p className="text-gray-700 truncate">{formProject.tenderId || '-'}</p>
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
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Work Period</p>
                  <p className="text-gray-700 truncate">{formProject.workPeriod || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase tracking-tighter text-[9px]">Maintenance Period</p>
                  <p className="text-gray-700 truncate">{formProject.maintenancePeriod || '-'}</p>
                </div>
              </div>
              {(amountInWords(formProject.tenderAmount) || amountInWords(formProject.acceptedAmount)) && (
                <div className="text-[10px] text-gray-500 italic space-y-0.5 pt-2 border-t border-gray-200">
                  {amountInWords(formProject.tenderAmount) && <p>Tender: {amountInWords(formProject.tenderAmount)}</p>}
                  {amountInWords(formProject.acceptedAmount) && <p>Accepted: {amountInWords(formProject.acceptedAmount)}</p>}
                </div>
              )}
            </div>
          )}

          {/* Higher Consultant / Sub Contractor entries */}
          <div className="space-y-2">
            {formData.consultants.map((c) => {
              return (
                <div key={c.id} className="bg-slate-50 border border-gray-200 rounded-lg p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] md:text-[15px] font-semibold text-gray-700 uppercase tracking-tight flex items-center gap-1.5">
                      Sub Contractor
                      {c.poNumber && !c.isCustomPo && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-normal normal-case">
                          Auto-filled from PO
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeConsultantRow(c.id)}
                      className="flex-shrink-0 h-[34px] md:h-[38px] w-[30px] md:w-[34px] flex items-center justify-center text-red-500 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. PO Number (FIRST FIELD TO BE FILLED) */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight font-medium">
                          PO Number <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1">
                            <Sparkles size={10} className="text-amber-500" /> PO System
                          </span>
                          {c.isCustomPo ? (
                            <button
                              type="button"
                              onClick={() => updateConsultantRow(c.id, 'isCustomPo', false)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-medium"
                            >
                              Choose from PO List
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateConsultantRow(c.id, 'isCustomPo', true)}
                              className="text-[10px] text-gray-500 hover:text-gray-700 underline font-medium"
                            >
                              Custom PO
                            </button>
                          )}
                        </div>
                      </div>

                      {c.isCustomPo ? (
                        <div className="relative">
                          <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <input
                            type="text"
                            value={c.poNumber}
                            onChange={(e) => updateConsultantRow(c.id, 'poNumber', e.target.value)}
                            placeholder="Enter custom PO number"
                            className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800"
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                          <select
                            value={c.poNumber}
                            onChange={(e) => handlePoSelect(c.id, e.target.value)}
                            className="w-full appearance-none border border-gray-300 rounded pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800 cursor-pointer"
                          >
                            <option value="" disabled>-- Select PO Number (from PO System) --</option>
                            {c.poNumber && !externalPOs.some(p => p.poNumber === c.poNumber) && (
                              <option value={c.poNumber}>{c.poNumber} (Current)</option>
                            )}
                            {externalPOs.map((po) => (
                              <option key={po.poNumber} value={po.poNumber}>
                                {po.poNumber} — {po.name} (₹{Number(po.poAmount || 0).toLocaleString('en-IN')})
                              </option>
                            ))}
                            <option value="__custom__">+ Enter Custom PO Number...</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        </div>
                      )}
                    </div>

                    {/* 2. PO Date */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">PO Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        <input
                          type="date"
                          value={c.poDate}
                          onChange={(e) => updateConsultantRow(c.id, 'poDate', e.target.value)}
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800"
                        />
                      </div>
                    </div>

                    {/* 3. Sub Contractor Name */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Sub Contractor Name *</label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => updateConsultantRow(c.id, 'name', e.target.value)}
                          placeholder="Enter sub contractor name"
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800"
                        />
                      </div>
                    </div>

                    {/* 4. Sub Contractor Number */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Sub Contractor Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={c.number}
                          onChange={(e) => updateConsultantRow(c.id, 'number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="Enter 10-digit number"
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800"
                        />
                      </div>
                    </div>

                    {/* 5. Working Unit */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Working Unit</label>
                      <div className="relative">
                        <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        <select
                          value={c.workingUnit}
                          onChange={(e) => updateConsultantRow(c.id, 'workingUnit', e.target.value)}
                          className="w-full appearance-none border border-gray-300 rounded pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800 cursor-pointer"
                        >
                          <option value="" disabled>Select</option>
                          <option value="Hectares">Hectares</option>
                          <option value="Pipe Dia">Pipe Dia</option>
                          {c.workingUnit && c.workingUnit !== 'Hectares' && c.workingUnit !== 'Pipe Dia' && (
                            <option value={c.workingUnit}>{c.workingUnit}</option>
                          )}
                          <option value="Mtr">Mtr</option>
                          <option value="Nos">Nos</option>
                          <option value="Km">Km</option>
                          <option value="Sq.Mtr">Sq.Mtr</option>
                          <option value="Cum">Cum</option>
                          <option value="Set">Set</option>
                          <option value="Kg">Kg</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                      </div>
                    </div>

                    {/* 6. PO Amount */}
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">PO Amount</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.poAmount}
                          onChange={(e) => updateConsultantRow(c.id, 'poAmount', e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="Enter PO amount"
                          className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 7. Upload PO Document */}
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
                          onChange={(e) => handlePoDocument(c.id, e.target.files?.[0])}
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

                  {/* 8. Remarks */}
                  <div className="space-y-1">
                    <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">Remarks</label>
                    <div className="relative">
                      <FileText className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
                      <textarea
                        value={c.remarks}
                        onChange={(e) => updateConsultantRow(c.id, 'remarks', e.target.value)}
                        placeholder="Add any remarks (optional)"
                        rows={2}
                        className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] resize-none bg-white font-medium text-gray-800"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addConsultantRow}
              className="flex items-center gap-1.5 text-[11px] md:text-[12px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100"
            >
              <Plus size={14} /> Add Sub Contractor
            </button>
          </div>

          {/* Survey Section - Simple Yes/No status */}
          <div className="bg-slate-50 border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] md:text-[14px] font-semibold text-gray-900 flex items-center gap-1.5">
                <Compass size={15} className="text-indigo-600" /> Survey Status
              </span>
              <span className="text-[11px] text-gray-500">
                Select "Yes" to complete survey & proceed to Final Approval
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">
                  Survey Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.surveyStatus}
                  onChange={(e) => setFormData(prev => ({ ...prev, surveyStatus: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[13px] md:text-[15px] h-[34px] md:h-[38px] bg-white font-medium"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[13px] md:text-[15px] text-gray-700 uppercase tracking-tight">
                  Survey Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={formData.surveyRemarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, surveyRemarks: e.target.value }))}
                  placeholder="Enter any survey remarks"
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

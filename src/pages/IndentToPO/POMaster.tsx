import { History, Loader2 } from 'lucide-react';
import Heading from '@/components/element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatDate } from '@/lib/utils';
import DataTable from '@/components/element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { openPoPdfPreview, type PoFilterContext } from '@/lib/poPdfUtils';
import { toast } from 'sonner';

interface PendingIndentsData {
    timestamp: string;
    partyName: string;
    poNumber: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    // preparedBy: string;
    // approvedBy: string;
    pdf: string;
}

// Helper function to parse GST percentage value
const parseGSTPercent = (value: any): number => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    // Convert to string first
    const stringValue = String(value).trim();

    // If it's already a percentage string (like "18%"), remove % and convert
    if (stringValue.includes('%')) {
        const numericPart = stringValue.replace('%', '').trim();
        const parsed = parseFloat(numericPart);
        return isNaN(parsed) ? 0 : parsed;
    }

    // If it's a decimal (like 0.18 for 18%), convert to percentage
    const numericValue = parseFloat(stringValue);
    if (isNaN(numericValue)) {
        return 0;
    }

    // If the value is between 0 and 1, it's likely a decimal representation
    // Convert it to percentage (0.18 -> 18)
    if (numericValue > 0 && numericValue < 1) {
        return numericValue * 100;
    }

    // Otherwise, assume it's already in percentage format
    return numericValue;
};

import { fetchPoMaster } from '@/services/poService';
import { useProject } from '@/context/ProjectContext';
import { getExternalPurchaseOrders, getProjects, getMobilizations, getFinalizeConsultants } from '@/utils/storageManager';

export default () => {
    const { user } = useAuth();
    const { effectivePermittedFirms } = useProject();
    const [tableData, setTableData] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [generatingPoNumber, setGeneratingPoNumber] = useState<string | null>(null);

    const permittedFirms = effectivePermittedFirms;

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const [data, extPOs, projects, mobilizations, finalizeConsultants] = await Promise.all([
                fetchPoMaster(permittedFirms),
                Promise.resolve(getExternalPurchaseOrders()),
                Promise.resolve(getProjects()),
                Promise.resolve(getMobilizations()),
                Promise.resolve(getFinalizeConsultants()),
            ]);

            const mapped = data.map((sheet: any) => {
                const poNum = (sheet.poNumber || sheet.po_number || '').trim();
                const matchedExt = extPOs.find((p: any) => (p.poNumber || '').trim() === poNum);

                // Check for a mobilization consultant that references this PO number
                const mobConsultant = mobilizations
                    .flatMap((m: any) => (m.consultants || []).map((c: any) => ({ ...c, projectNo: m.projectNo, projectName: m.projectName })))
                    .find((c: any) => (c.poNumber || '').trim() === poNum && (c.name || c.number));

                // Check for a finalize consultant that references this PO number
                const finConsultant = (finalizeConsultants || [])
                    .flatMap((f: any) => (f.consultants || []).map((c: any) => ({ ...c, projectNo: f.projectNo })))
                    .find((c: any) => (c.poNumber || '').trim() === poNum && (c.name || c.number));

                const projName = String(sheet.firmNameMatch || sheet.firm_name || mobConsultant?.projectName || '').trim().toLowerCase();
                const matchedProject = projects.find(
                    (p: any) =>
                        (projName && (
                            String(p.projectName || p.name || '').trim().toLowerCase() === projName ||
                            String(p.serialNo || '').trim().toLowerCase() === projName
                        )) ||
                        (mobConsultant?.projectNo && String(p.serialNo || '').trim().toLowerCase() === String(mobConsultant.projectNo).trim().toLowerCase()) ||
                        (finConsultant?.projectNo && String(p.serialNo || '').trim().toLowerCase() === String(finConsultant.projectNo).trim().toLowerCase())
                ) || projects[0];

                const matchedMob = matchedProject
                    ? mobilizations.find((m: any) => m.projectNo === matchedProject.serialNo || String(m.projectName || '').trim().toLowerCase() === String(matchedProject.projectName || '').trim().toLowerCase())
                    : (mobConsultant ? mobilizations.find((m: any) => m.projectNo === mobConsultant.projectNo) : mobilizations[0]);
                const defaultSub = matchedMob?.consultants?.[0];

                const contractorName =
                    sheet.contractorName ||
                    sheet.contractor_name ||
                    matchedExt?.contractorName ||
                    matchedProject?.contractorName ||
                    'Pooja Construction';
                const contractorPhone =
                    sheet.contractorPhone ||
                    sheet.contractor_phone ||
                    matchedExt?.contractorPhone ||
                    matchedProject?.contractorPhone ||
                    '8275149683';
                const contractorEmail =
                    sheet.contractorEmail ||
                    sheet.contractor_email ||
                    matchedExt?.contractorEmail ||
                    matchedProject?.contractorEmail ||
                    'daftarigroup@gmail.com';

                const subContractorName =
                    sheet.subContractorName ||
                    sheet.sub_contractor_name ||
                    matchedExt?.subContractorName ||
                    mobConsultant?.name ||
                    finConsultant?.name ||
                    defaultSub?.name ||
                    matchedProject?.subContractorName ||
                    '';
                const subContractorPhone =
                    sheet.subContractorPhone ||
                    sheet.sub_contractor_phone ||
                    matchedExt?.subContractorPhone ||
                    mobConsultant?.number ||
                    finConsultant?.number ||
                    defaultSub?.number ||
                    matchedProject?.subContractorPhone ||
                    '';
                const subContractorEmail =
                    sheet.subContractorEmail ||
                    sheet.sub_contractor_email ||
                    matchedExt?.subContractorEmail ||
                    mobConsultant?.email ||
                    finConsultant?.email ||
                    defaultSub?.email ||
                    matchedProject?.subContractorEmail ||
                    '';

                return {
                    ...sheet,
                    contractorName,
                    contractorPhone,
                    contractorEmail,
                    subContractorName,
                    subContractorPhone,
                    subContractorEmail,
                    po_created_date: sheet.po_created_date ? formatDate(sheet.po_created_date) : (sheet.timestamp ? formatDate(sheet.timestamp) : ''),
                    rawTimestamp: sheet.timestamp || sheet.po_created_date || '',
                    timestamp: sheet.timestamp ? formatDate(sheet.timestamp) : '',
                    quotationDate: sheet.quotationDate ? formatDate(sheet.quotationDate) : '',
                    enquiryDate: sheet.enquiryDate ? formatDate(sheet.enquiryDate) : '',
                };
            });

            mapped.sort((a: any, b: any) => {
                const cleanA = (a.poNumber || a.po_number || '').trim();
                const cleanB = (b.poNumber || b.po_number || '').trim();
                const matchA = cleanA.match(/^(.*?)(?:[/_-])?(\d+)$/);
                const matchB = cleanB.match(/^(.*?)(?:[/_-])?(\d+)$/);
                if (matchA && matchB) {
                    const prefixA = (matchA[1] || '').trim();
                    const prefixB = (matchB[1] || '').trim();
                    const numA = parseInt(matchA[2], 10);
                    const numB = parseInt(matchB[2], 10);
                    if (prefixA.toLowerCase() === prefixB.toLowerCase()) {
                        if (numB !== numA) return numB - numA;
                    } else {
                        const prefixComp = prefixB.localeCompare(prefixA, undefined, { numeric: true, sensitivity: 'base' });
                        if (prefixComp !== 0) return prefixComp;
                        if (numB !== numA) return numB - numA;
                    }
                }
                const numComp = cleanB.localeCompare(cleanA, undefined, { numeric: true, sensitivity: 'base' });
                if (numComp !== 0) return numComp;
                return new Date(b.rawTimestamp || 0).getTime() - new Date(a.rawTimestamp || 0).getTime();
            });

            setTableData(mapped);
        } catch (error) {
            console.error('Error fetching PO master:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [effectivePermittedFirms]);

    // TODO(migration): PDF is now generated on-demand, no longer stored — remove after verification
    // Previously this pulled the stored po_master.pdf URL and opened it directly.
    // Now it re-fetches fresh po_master/master data and regenerates the PDF on every click.
    const handleViewPdf = async (row: any) => {
        const poNumber = row.poNumber || row.po_number || '';
        try {
            setGeneratingPoNumber(poNumber);
            const freshRows = await fetchPoMaster(permittedFirms);
            // Build a disambiguation context so duplicate PO numbers across firms/dates
            // resolve only the rows that belong to this specific entry.
            const context: PoFilterContext = {
                firmId: row.firm_id != null ? row.firm_id : undefined,
                firmName: row.firmNameMatch || row.firm_name || undefined,
                vendorName: row.partyName || row.party_name || undefined,
                date: row.rawTimestamp || row.po_created_date || row.timestamp || undefined,
            };
            await openPoPdfPreview(poNumber, freshRows, context);
        } catch (error) {
            console.error('Error generating PO PDF:', error);
            toast.error('Failed to generate Purchase Order PDF');
        } finally {
            setGeneratingPoNumber(null);
        }
    };

    // Creating table columns based on PO MASTER sheet structure (Columns A-T)
    const columns: ColumnDef<any>[] = [
        { accessorKey: 'po_created_date', header: 'PO Date' },
        { accessorKey: 'partyName', header: 'Party Name' },
        {
            accessorKey: 'contractorName',
            header: 'Contractor',
            cell: ({ row }) => {
                const name = row.original.contractorName || row.original.contractor_name;
                const phone = row.original.contractorPhone || row.original.contractor_phone;
                if (!name) return <span className="text-gray-400">-</span>;
                return (
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{name}</span>
                        {phone && <span className="text-[11px] text-gray-500">{phone}</span>}
                    </div>
                );
            },
        },
        {
            accessorKey: 'subContractorName',
            header: 'Sub Contractor',
            cell: ({ row }) => {
                const name = row.original.subContractorName || row.original.sub_contractor_name;
                const phone = row.original.subContractorPhone || row.original.sub_contractor_phone;
                if (!name) return <span className="text-gray-400">-</span>;
                return (
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{name}</span>
                        {phone && <span className="text-[11px] text-gray-500">{phone}</span>}
                    </div>
                );
            },
        },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'quotationNumber', header: 'Quotation Number' },
        { accessorKey: 'quotationDate', header: 'Quotation Date' },
        { accessorKey: 'enquiryNumber', header: 'Enquiry Number' },
        { accessorKey: 'enquiryDate', header: 'Enquiry Date' },
        { accessorKey: 'internalCode', header: 'Internal Code' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'description', header: 'Description' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'unit', header: 'Unit' },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate.toLocaleString()}</>;
            },
        },
        {
            accessorKey: 'gstPercent',
            header: 'GST %',
            cell: ({ row }) => {
                return <>{row.original.gstPercent}%</>;
            },
        },
        {
            accessorKey: 'discountPercent',
            header: 'Discount %',
            cell: ({ row }) => {
                return <>{row.original.discountPercent}%</>;
            },
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => {
                return <>&#8377;{row.original.amount.toLocaleString()}</>;
            },
        },
        {
            accessorKey: 'totalPoAmount',
            header: 'Total PO Amount',
            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPoAmount.toLocaleString()}</>;
            },
        },
        { accessorKey: 'preparedBy', header: 'Prepared By' },
        { accessorKey: 'approvedBy', header: 'Approved By' },
        {
            accessorKey: 'pdf',
            header: 'PDF',
            cell: ({ row }) => {
                const poNumber = row.original.poNumber;
                const isGenerating = generatingPoNumber === poNumber;
                return (
                    <button
                        type="button"
                        onClick={() => handleViewPdf(row.original)}
                        disabled={isGenerating}
                        className="text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:no-underline inline-flex items-center gap-1"
                    >
                        {isGenerating && <Loader2 size={14} className="animate-spin" />}
                        {isGenerating ? 'Generating...' : 'View PDF'}
                    </button>
                );
            },
        },
    ];

    return (
        <div>
            <Heading heading="PO History" subtext="View purchase orders and generation history">
                <History size={50} className="text-primary" />
            </Heading>
            <DataTable
                data={tableData}
                columns={columns}
                searchFields={[
                    'partyName',
                    'contractorName',
                    'subContractorName',
                    'poNumber',
                    'product',
                    'description',
                    'quotationNumber',
                    'enquiryNumber',
                    'preparedBy',
                    'approvedBy'
                ]}
                dataLoading={dataLoading}
                className="h-[80dvh]"
            />
        </div>
    );
};

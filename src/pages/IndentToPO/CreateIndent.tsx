import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getProjects, saveProject } from '@/utils/storageManager';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import ModalForm from '@/components/ModalForm';
import SearchableDropdown from '@/components/SearchableDropdown';
import DataTable from '@/components/element/DataTable';
import { fetchIndentRecords, deleteIndentRecord, uploadIndentAttachment, type IndentRecord } from '@/services/indentService';
import { filterByFirmAccess } from '@/lib/firmAccess';
import { canDeleteStoreStage } from '@/lib/roleAccess';
import StageDeleteDialog from '@/components/element/StageDeleteDialog';
import { AttachmentUploadField } from '@/components/element/AttachmentUploadField';
import { useAttachmentUpload } from '@/hooks/useAttachmentUpload';
import { formatDate, formatDateTimeFull } from '@/lib/utils';
import { type ColumnDef } from '@tanstack/react-table';
import { Pill } from '@/components/ui/pill';
import { ClipLoader as Loader } from 'react-spinners';
import { Trash, Search, PlusCircle, Download, Plus, Filter, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { useSheets } from '@/context/SheetsContext';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { storeApi } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { calculateRealInventory } from '@/lib/inventoryUtils';
import { pdf } from '@react-pdf/renderer';
import IndentPdf from '@/components/element/IndentPdf';

// useAttachmentUpload is a hook, so it can't be called inside the products
// .map() loop directly — this child component gives each product row its
// own hook instance instead, keyed by the row's stable field.id so add/remove
// unmounts exactly the right row's upload state via React's own reconciliation.
function ProductAttachmentField({
    control,
    index,
    setValue,
    onUploadingChange,
    justSubmittedRef,
}: {
    control: any;
    index: number;
    setValue: (name: any, value: any, options?: any) => void;
    onUploadingChange: (index: number, isUploading: boolean) => void;
    justSubmittedRef: { current: boolean };
}) {
    const attachment = useAttachmentUpload(uploadIndentAttachment);
    const attachmentRef = useRef(attachment);
    attachmentRef.current = attachment;

    useEffect(() => {
        onUploadingChange(index, attachment.status === 'uploading');
        return () => onUploadingChange(index, false);
    }, [attachment.status, index, onUploadingChange]);

    useEffect(() => {
        return () => {
            if (!justSubmittedRef.current) {
                attachmentRef.current.reset();
            }
        };
    }, [justSubmittedRef]);

    return (
        <FormField
            control={control}
            name={`products.${index}.attachment`}
            render={() => (
                <FormItem>
                    <FormLabel>Attachment</FormLabel>
                    <FormControl>
                        <AttachmentUploadField
                            id={`indent-attachment-${index}`}
                            status={attachment.status}
                            progress={attachment.progress}
                            fileName={attachment.fileName}
                            error={attachment.error}
                            onSelect={async (file: File) => {
                                const url = await attachment.select(file);
                                setValue(`products.${index}.attachment`, url ?? undefined, {
                                    shouldValidate: true,
                                });
                            }}
                            onRemove={() => {
                                attachment.remove();
                                setValue(`products.${index}.attachment`, undefined, {
                                    shouldValidate: true,
                                });
                            }}
                        />
                    </FormControl>
                </FormItem>
            )}
        />
    );
}

export default () => {
    const navigate = useNavigate();
    const {
        masterSheet: options,
        inventorySheet,
        storeInSheet,
        issueSheet,
        indentSheet,
        updateInventorySheet,
        updateMasterSheet,
        updateIndentSheet,
        updateAll,
    } = useSheets();
    const { user } = useAuth();

    // Modal and Filter states
    const [showFormModal, setShowFormModal] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const initialFilters = {
        searchQuery: '',
        projectName: '',
        priority: '',
    };
    const [filters, setFilters] = useState({ ...initialFilters });

    const [searchTermFirmName, setSearchTermFirmName] = useState('');
    const [searchTermGroupHeadByRow, setSearchTermGroupHeadByRow] = useState<Record<number, string>>({});
    const [searchTermProductNameByRow, setSearchTermProductNameByRow] = useState<Record<number, string>>({});
    const [searchTermUOMByRow, setSearchTermUOMByRow] = useState<Record<number, string>>({});
    const [searchTermAreaOfUseByRow, setSearchTermAreaOfUseByRow] = useState<Record<number, string>>({});
    const [searchTermEqGroupHeadByRow, setSearchTermEqGroupHeadByRow] = useState<Record<number, string>>({});
    const [searchTermEqAreaOfUseByRow, setSearchTermEqAreaOfUseByRow] = useState<Record<number, string>>({});

    const [historyData, setHistoryData] = useState<IndentRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [exportingIndentNo, setExportingIndentNo] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<IndentRecord | null>(null);

    const [projectList, setProjectList] = useState<{ id: string | number; name: string }[]>([]);
    const [isAddingProject, setIsAddingProject] = useState(false);
    const [isAddingAreaOfUse, setIsAddingAreaOfUse] = useState(false);

    const loadProjects = useCallback(() => {
        const rawProjects = getProjects() || [];
        const formatted = rawProjects
            .map((p: any) => ({
                id: p.id || p.serialNo,
                name: (p.projectName || p.name || '').trim(),
            }))
            .filter((p: any) => Boolean(p.name));

        const uniqueProjects: { id: string | number; name: string }[] = Array.from(
            new Map<string, { id: string | number; name: string }>(
                formatted.map((item: { id: string | number; name: string }) => [item.name, item])
            ).values()
        );
        setProjectList(uniqueProjects);
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const productSchema = z.object({
        groupHead: z.string().nonempty({ message: 'Select Group Head' }),
        productName: z.string().nonempty({ message: 'Select Product Name' }),
        quantity: z.preprocess(
            (val) => {
                if (val === '' || val === null || val === undefined) return 0;
                const n = Number(val);
                return isNaN(n) ? 0 : n;
            },
            z.number().gt(0, { message: 'Quantity must be greater than 0' })
        ),
        minStockQty: z.preprocess(
            (val) => {
                if (val === '' || val === null || val === undefined) return 0;
                const n = Number(val);
                return isNaN(n) ? 0 : n;
            },
            z.number().optional().nullable()
        ),
        uom: z.string().nonempty({ message: 'Select UOM' }),
        areaOfUse: z.string().nonempty({ message: 'Select Area of Use' }),
        expectedRequirementDate: z.string().nonempty({ message: 'Select Expected Requirement Date' }),
        attachment: z.any().optional(),
        specifications: z.string().optional(),
    });

    const equipmentSchema = z.object({
        groupHead: z.string().nonempty({ message: 'Select Group Head' }),
        areaOfUse: z.string().nonempty({ message: 'Select Area of Use' }),
        equipmentName: z.string().nonempty({ message: 'Enter Equipment Name' }),
        type: z.enum(['Rent', 'Owned'] as const, { error: 'Select Type (Rent or Owned)' }),
        expectedTime: z.string().optional(),
        dayCharge: z.preprocess(
            (val) => {
                if (val === '' || val === null || val === undefined) return undefined;
                const n = Number(val);
                return isNaN(n) ? undefined : n;
            },
            z.number().optional()
        ),
    }).superRefine((data, ctx) => {
        if (data.type === 'Rent') {
            if (!data.expectedTime || !data.expectedTime.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Expected Time is required',
                    path: ['expectedTime'],
                });
            }
            if (data.dayCharge === undefined || data.dayCharge <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Day Charge must be > 0',
                    path: ['dayCharge'],
                });
            }
        }
    });

    const schema = z.object({
        createdDate: z.string().nonempty({ message: 'Select Indent Date' }),
        indenterName: z.string().nonempty({ message: 'Enter Indenter Name' }),
        firmName: z.string().nonempty({ message: 'Select Project Name' }),
        firmId: z.any().optional(),
        indentStatus: z.string().nonempty({ message: 'Select Indent Status' }),
        products: z.array(productSchema).default([]),
        equipments: z.array(equipmentSchema).default([]),
    }).refine((data) => (data.products && data.products.length > 0) || (data.equipments && data.equipments.length > 0), {
        message: 'At least one Product or Equipment item is required',
        path: ['products'],
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            createdDate: new Date().toISOString().split('T')[0],
            indenterName: '',
            firmName: '',
            firmId: undefined,
            indentStatus: undefined,
            products: [
                {
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: '' as any,
                    minStockQty: 0,
                    areaOfUse: '',
                    expectedRequirementDate: '',
                    groupHead: '',
                },
            ],
            equipments: [] as any[],
        },
    });

    const products = form.watch('products') || [];
    const equipments = form.watch('equipments') || [];
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });
    const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({
        control: form.control,
        name: 'equipments',
    });

    const [uploadingRows, setUploadingRows] = useState<Set<number>>(new Set());
    const handleUploadingChange = useCallback((index: number, isUploading: boolean) => {
        setUploadingRows((prev) => {
            const next = new Set(prev);
            if (isUploading) {
                next.add(index);
            } else {
                next.delete(index);
            }
            return next;
        });
    }, []);

    const justSubmittedRef = useRef(false);
    useEffect(() => {
        justSubmittedRef.current = false;
    });

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const rawAccess = user?.firm_access as unknown;
            const isAllAccess = rawAccess === 'All' || rawAccess === 'all' || (Array.isArray(rawAccess) && rawAccess.length === 0);
            const permittedFirms = (user?.administrate || !rawAccess || isAllAccess) ? undefined : user?.firm_access;
            const data = await fetchIndentRecords(permittedFirms);
            const filtered = filterByFirmAccess(data, permittedFirms, {
                id: (i) => i.firm_id,
                name: (i) => i.firm_name
            });
            setHistoryData(filtered);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, [user?.administrate, user?.firm_access]);

    useEffect(() => {
        if (user?.username) {
            fetchHistory();
        }
    }, [user?.username, user?.firm_access, fetchHistory]);

    const handleClearFilters = () => {
        setFilters({ ...initialFilters });
        toast.success('Filters cleared');
    };

    const filteredHistoryData = useMemo(() => {
        return historyData.filter((item) => {
            if (filters.projectName && item.firm_name !== filters.projectName) return false;
            if (filters.priority && item.indent_status !== filters.priority) return false;
            if (filters.searchQuery) {
                const q = filters.searchQuery.toLowerCase();
                return (
                    (item.indent_number || '').toLowerCase().includes(q) ||
                    (item.firm_name || '').toLowerCase().includes(q) ||
                    (item.indenter_name || '').toLowerCase().includes(q) ||
                    (item.product_name || '').toLowerCase().includes(q) ||
                    (item.group_head || '').toLowerCase().includes(q) ||
                    (item.area_of_use || '').toLowerCase().includes(q) ||
                    (item.uom || '').toLowerCase().includes(q) ||
                    (item.specifications || '').toLowerCase().includes(q) ||
                    (item.vendor_type || '').toLowerCase().includes(q) ||
                    (item.indent_status || '').toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [historyData, filters]);

    const historyColumns: ColumnDef<IndentRecord>[] = [
        {
            accessorKey: 'indent_number',
            header: 'Indent No.',
            cell: ({ getValue }) => <span className="font-bold text-indigo-600">{getValue() as string || '-'}</span>
        },
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        { accessorKey: 'firm_name', header: 'Project' },
        { accessorKey: 'indenter_name', header: 'Indenter' },
        { accessorKey: 'group_head', header: 'Group Head' },
        {
            accessorKey: 'product_name',
            header: 'Product / Equipment',
            cell: ({ row, getValue }) => (
                <div className="min-w-[180px] max-w-[320px] break-words whitespace-normal leading-snug flex items-center gap-1.5 flex-wrap">
                    {row.original.indent_type === 'Equipment' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            <Wrench size={10} /> {row.original.equipment_type || 'Equipment'}
                        </span>
                    )}
                    <span>{getValue() as string || '-'}</span>
                </div>
            )
        },
        {
            accessorKey: 'quantity',
            header: 'Qty',
            cell: ({ getValue }) => <span className="font-bold">{getValue() as number || 0}</span>
        },
        {
            accessorKey: 'min_stock_qty',
            header: 'Current Stock',
            cell: ({ getValue }) => <span>{getValue() as number || 0}</span>
        },
        { accessorKey: 'uom', header: 'UOM' },
        { accessorKey: 'area_of_use', header: 'Area of Use' },
        {
            accessorKey: 'expected_req_date',
            header: 'Expected Date',
            cell: ({ row }) => row.original.expected_req_date ? formatDate(new Date(row.original.expected_req_date)) : '-',
        },
        {
            accessorKey: 'specifications',
            header: 'Remarks',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal text-xs text-muted-foreground">
                    {getValue() as string || '-'}
                </div>
            )
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }) => (
                <Pill variant={row.original.indent_status === 'Critical' ? 'reject' : 'secondary'}>
                    {row.original.indent_status}
                </Pill>
            ),
        },
        {
            accessorKey: 'vendor_type',
            header: 'Status',
            cell: ({ row }) => (
                <Pill variant={row.original.vendor_type === 'Reject' ? 'reject' : row.original.vendor_type === 'Pending' ? 'secondary' : 'primary'}>
                    {row.original.vendor_type}
                </Pill>
            ),
        },
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => {
                const indentNo = row.original.indent_number;
                const isLoading = exportingIndentNo === indentNo;
                const canDelete = canDeleteStoreStage(user, 'create_indent');
                return (
                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={isLoading}
                            onClick={() => handleExportIndentPdf(indentNo)}
                            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 h-7 px-2 text-xs"
                        >
                            {isLoading ? <Loader size={11} color="currentColor" /> : <Download size={11} />}
                            View PDF
                        </Button>
                        {canDelete && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteTarget(row.original)}
                                className="flex items-center gap-1 text-red-600 hover:text-red-800 hover:bg-red-50 h-7 px-2 text-xs"
                                title="Delete Indent"
                            >
                                <Trash size={12} />
                                Delete
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    const handleFirmNameSelect = (_val: string) => {
        form.setValue('indenterName', '');
    };

    const handleAddProject = async () => {
        if (!searchTermFirmName.trim()) return;
        setIsAddingProject(true);
        try {
            const data: any = await storeApi.insert('firm', { firm_name: searchTermFirmName.trim() });
            const inserted = Array.isArray(data) ? data[0] : data;

            const currentProjects = getProjects() || [];
            if (!currentProjects.some((p: any) => (p.projectName || p.name || '').toLowerCase() === searchTermFirmName.trim().toLowerCase())) {
                saveProject({
                    id: `PRJ-${Date.now()}`,
                    serialNo: `PRJ-${currentProjects.length + 1}`,
                    projectName: searchTermFirmName.trim(),
                    contractorName: 'Pooja Construction',
                    createdAt: new Date().toISOString(),
                });
            }
            loadProjects();

            toast.success(`Project "${searchTermFirmName}" added successfully!`);
            updateMasterSheet();
            form.setValue('firmName', searchTermFirmName.trim());
            if (inserted?.id) form.setValue('firmId', inserted.id);
            handleFirmNameSelect(searchTermFirmName.trim());
            setSearchTermFirmName('');
        } catch (error) {
            console.error('Error adding project:', error);
            toast.error('Failed to add project. It might already exist.');
        } finally {
            setIsAddingProject(false);
        }
    };

    const handleAddAreaOfUse = async (index: number, areaValue?: string) => {
        const value = areaValue || form.getValues(`products.${index}.areaOfUse`);
        if (!value || !value.trim()) {
            toast.error("Please enter a value to add");
            return;
        }
        setIsAddingAreaOfUse(true);
        try {
            await storeApi.insert('area_of_use', { name: value.trim() });
            toast.success(`Area "${value}" added successfully!`);
            form.setValue(`products.${index}.areaOfUse`, value.trim());
            setSearchTermAreaOfUseByRow(prev => ({ ...prev, [index]: '' }));
            updateMasterSheet();
        } catch (error) {
            console.error('Error adding area of use:', error);
            toast.error('Failed to add area of use.');
        } finally {
            setIsAddingAreaOfUse(false);
        }
    };

    const handleGroupHeadChange = async (index: number, groupHead: string) => {
        form.setValue(`products.${index}.groupHead`, groupHead);
        const productOptions = options?.products[groupHead] || [];
        if (productOptions.length === 1) {
            handleItemChange(index, productOptions[0]);
        } else {
            form.setValue(`products.${index}.productName`, '');
            form.setValue(`products.${index}.uom`, '');
            form.setValue(`products.${index}.minStockQty`, 0);
        }

        if (options?.areaOfUses.length === 1) {
            form.setValue(`products.${index}.areaOfUse`, options.areaOfUses[0]);
        }
    };

    const handleItemChange = (index: number, itemName: string) => {
        form.setValue(`products.${index}.productName`, itemName);
        const groupHeadName = options?.itemGroupHeadMap?.[itemName] || '';
        const uomName = options?.itemUomMap?.[itemName] || '';

        if (groupHeadName) form.setValue(`products.${index}.groupHead`, groupHeadName);
        if (uomName) form.setValue(`products.${index}.uom`, uomName);

        const firmName = form.getValues('firmName');
        if (firmName && groupHeadName) {
            const realInventory = calculateRealInventory(
                inventorySheet || [], indentSheet || [], storeInSheet || [], issueSheet || [], [], firmName
            );
            const thisItem = realInventory.find(i => i.itemName === itemName && i.groupHead === groupHeadName);
            form.setValue(`products.${index}.minStockQty`, thisItem?.current ?? 0);
        } else {
            form.setValue(`products.${index}.minStockQty`, 0);
        }
    };

    const handleProductSelect = async (_index: number, productName: string, groupHead: string, quantityToAdd: number = 1) => {
        try {
            const firmName = form.getValues('firmName');
            const firmId = form.getValues('firmId') || options?.firmObjects?.find((f: { name: string; id: number }) => f.name === firmName)?.id;

            if (!firmId) return;

            const inventoryRecords: any[] = await storeApi.fetch('inventory', {
                item_name: productName,
                group_head: groupHead,
                firm_id: firmId,
            });
            const inventoryData = inventoryRecords?.[0];

            if (inventoryData) {
                const currentIndented = Number(inventoryData.indented) || 0;
                const newIndented = currentIndented + quantityToAdd;
                await storeApi.update('inventory', inventoryData.id, {
                    indented: newIndented,
                    firm_id: firmId || null,
                    firm_name: firmName || ''
                });
            } else {
                await storeApi.insert('inventory', {
                    item_name: productName,
                    group_head: groupHead,
                    indented: quantityToAdd,
                    firm_name: firmName || '',
                    firm_id: firmId || null,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error('Error in handleProductSelect:', error);
        }
    };

    const fetchNextIndentNumber = async (): Promise<string> => {
        let maxNum = 0;
        try {
            const data: any[] = await storeApi.fetch('indent', {
                order: 'id.desc',
                limit: 500,
            });
            if (data) {
                for (const row of data) {
                    const match = String(row.indent_number || '').match(/^SI-(\d+)$/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching DB indent number:', err);
        }

        if (historyData && historyData.length > 0) {
            for (const r of historyData) {
                const match = String(r.indent_number || '').match(/^SI-(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
        }
        if (indentSheet && indentSheet.length > 0) {
            for (const r of indentSheet) {
                const match = String(r.indentNumber || '').match(/^SI-(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
        }

        return `SI-${String(maxNum + 1).padStart(4, '0')}`;
    };

    async function handleExportIndentPdf(indentNo: string) {
        setExportingIndentNo(indentNo);
        try {
            let logoBase64 = '';
            try {
                const r = await fetch('/logo.png');
                if (r.ok) {
                    const blob = await r.blob();
                    logoBase64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                }
            } catch {}

            let rows = historyData.filter(r => r.indent_number === indentNo);
            if (rows.length === 0) {
                const data: any[] = await storeApi.fetch('indent', {
                    indent_number: indentNo,
                });
                if (data && data.length > 0) {
                    rows = data as any;
                }
            }

            if (rows.length === 0) {
                toast.error('Indent data not found');
                return;
            }

            const first = rows[0];

            const blob = await pdf(
                <IndentPdf
                    indentNumber={indentNo}
                    indenterName={first.indenter_name}
                    firmName={first.firm_name}
                    indentStatus={first.indent_status as 'Critical' | 'Non-Critical'}
                    date={first.timestamp ? formatDateTimeFull(new Date(first.timestamp)) : formatDateTimeFull(new Date())}
                    products={rows.map(r => ({
                        productName: r.product_name,
                        groupHead: r.group_head ?? '',
                        quantity: r.quantity,
                        uom: r.uom,
                        expectedRequirementDate: r.expected_req_date || '',
                        specifications: r.specifications || '',
                        areaOfUse: r.area_of_use || '',
                    }))}
                    logo={logoBase64 || '/logo.png'}
                /> as any
            ).toBlob();

            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.success(`${indentNo} PDF opened`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF');
        } finally {
            setExportingIndentNo(null);
        }
    }

    async function onSubmit(data: z.infer<typeof schema>) {
        try {
            const firmId = data.firmId || options?.firmObjects?.find((f: { name: string; id: number }) => f.name === data.firmName)?.id || 1;
            const nextIndentNumber = await fetchNextIndentNumber();
            const productAttachmentUrls = (data.products || []).map(
                (product) => (product.attachment as unknown as string) || ''
            );

            const now = new Date();
            let timestamp: string;
            if (data.createdDate) {
                const [year, month, day] = data.createdDate.split('-').map(Number);
                const d = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
                timestamp = d.toISOString();
            } else {
                timestamp = now.toISOString();
            }

            const productRows = (data.products || []).map((product, i) => ({
                timestamp,
                planned1: timestamp,
                indent_number: nextIndentNumber,
                indenter_name: data.indenterName,
                area_of_use: product.areaOfUse,
                group_head: product.groupHead,
                product_name: product.productName,
                quantity: product.quantity,
                min_stock_qty: product.minStockQty || 0,
                uom: product.uom,
                firm_name: data.firmName,
                firm_id: firmId,
                specifications: product.specifications || '',
                indent_status: data.indentStatus,
                vendor_type: 'Pending',
                expected_req_date: product.expectedRequirementDate,
                attachment: productAttachmentUrls[i] || '',
                indent_url: '',
                status: 'Pending',
                indent_type: 'Material',
            }));

            const equipmentRows = (data.equipments || []).map((eq) => ({
                timestamp,
                planned1: timestamp,
                indent_number: nextIndentNumber,
                indenter_name: data.indenterName,
                area_of_use: eq.areaOfUse,
                group_head: eq.groupHead,
                product_name: eq.equipmentName,
                quantity: 1,
                min_stock_qty: 0,
                uom: eq.type === 'Rent' ? 'Rent' : 'Owned',
                firm_name: data.firmName,
                firm_id: firmId,
                specifications: eq.type === 'Rent'
                    ? `[Equipment - Rent] Expected Time: ${eq.expectedTime}, Day Charge: ₹${eq.dayCharge}`
                    : `[Equipment - Owned]`,
                indent_status: data.indentStatus,
                vendor_type: 'Pending',
                expected_req_date: data.createdDate || now.toISOString().split('T')[0],
                attachment: '',
                indent_url: '',
                status: 'Pending',
                indent_type: 'Equipment',
                equipment_type: eq.type,
                expected_time: eq.expectedTime || '',
                day_charge: eq.dayCharge || 0,
            }));

            const rows = [...productRows, ...equipmentRows];

            await storeApi.insert('indent', rows);

            toast.success(`Indent ${nextIndentNumber} created successfully!`);
            fetchHistory();
            updateIndentSheet(true);
            updateAll(true);

            (data.products || []).forEach(product => {
                const groupHead = product.groupHead || options?.itemGroupHeadMap?.[product.productName] || '';
                if (!groupHead || !firmId) return;
                handleProductSelect(0, product.productName, groupHead, Number(product.quantity) || 1).catch(console.error);
            });

            justSubmittedRef.current = true;
            form.reset({
                createdDate: new Date().toISOString().split('T')[0],
                indenterName: '',
                firmName: '',
                firmId: undefined,
                indentStatus: '' as any,
                products: [{
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: '' as any,
                    minStockQty: 0,
                    areaOfUse: '',
                    expectedRequirementDate: '',
                    groupHead: '',
                }],
                equipments: [],
            });

            setShowFormModal(false);
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Error while creating indent! Please try again');
        }
    }

    const handleFillDummyData = (e?: React.MouseEvent) => {
        e?.preventDefault?.();

        // 1. Project Name (from projectList dropdown)
        const availableProjects = projectList.length > 0 ? projectList : [];
        const chosenProject = availableProjects[0];
        const projectName = chosenProject ? chosenProject.name : (options?.firmsnames?.[0] || 'Default Project');
        const projectId = chosenProject ? chosenProject.id : (options?.firmObjects?.find(f => f.name === projectName)?.id || undefined);

        // 2. Indenter Name
        const indenter = (user?.name && user.name.trim()) ? user.name : 'Admin User';

        // 3. Priority dropdown (Critical / Non-Critical)
        const priority = 'Critical';

        // 4. Products dropdowns
        const defaultGroupHeads = [
            'Pipes & Fittings',
            'Civil Materials',
            'Electrical & Instrumentation',
            'Valves & Actuators',
            'Hardware & Consumables',
            'Pumps & Motors'
        ];
        const groupHeadOptions = (options?.allGroupHeads && options.allGroupHeads.length > 0)
            ? options.allGroupHeads
            : defaultGroupHeads;
        const chosenGroupHead = groupHeadOptions[0] || 'Pipes & Fittings';

        const defaultProducts: Record<string, string[]> = {
            'Pipes & Fittings': ['HDPE Pipe 110mm PN6', 'HDPE Pipe 630mm PN10', 'Electrofusion Coupler 630mm', 'Flange Adapter 110mm', 'Stub End Flange 630mm'],
            'Civil Materials': ['Cement Grade 53 (50kg)', 'River Sand Bedding', 'Ready-Mix Concrete M25', 'Geotextile Fabric 200 GSM'],
            'Electrical & Instrumentation': ['Armoured Cable 4-Core 16sqmm', 'Control Panel 3-Phase', 'Pressure Transmitter'],
            'Valves & Actuators': ['Kinetic Air Release Valve 150mm', 'Resilient Seated Sluice Valve 300mm', 'Butterfly Valve 200mm'],
            'Hardware & Consumables': ['Galvanized High Tensile Bolts & Nuts', 'EPDM Rubber Gasket 630mm', 'Teflon Tape'],
            'Pumps & Motors': ['Centrifugal Pump 15HP', 'Submersible Motor 10HP', 'Monoblock Pump 5HP']
        };

        const availableProducts = (options?.products?.[chosenGroupHead] && options.products[chosenGroupHead].length > 0)
            ? options.products[chosenGroupHead]
            : (defaultProducts[chosenGroupHead] || ['HDPE Pipe 110mm PN6']);
        const chosenProduct = availableProducts[0] || 'HDPE Pipe 110mm PN6';

        const defaultAreaOfUses = [
            'Main Pipeline Section',
            'Water Treatment Plant',
            'Electrical Substation',
            'Distribution Canal Network',
            'Pumping Station',
            'Storage Yard'
        ];
        const areaOfUseOptions = (options?.areaOfUses && options.areaOfUses.length > 0)
            ? options.areaOfUses
            : defaultAreaOfUses;
        const chosenArea = areaOfUseOptions[0] || 'Main Pipeline Section';

        const defaultUoms = ['Mtr', 'Nos', 'Bags', 'Kg', 'Km', 'Sq.Mtr', 'Cum', 'Set', 'Lot', 'Rolls'];
        const uomOptions = (options?.uoms && options.uoms.length > 0)
            ? options.uoms
            : defaultUoms;
        const chosenUom = uomOptions[0] || 'Mtr';

        const todayStr = new Date().toISOString().split('T')[0];
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const expectedDateStr = nextWeek.toISOString().split('T')[0];

        let stockVal = 10;
        if (projectName && chosenProduct && chosenGroupHead) {
            const realInventory = calculateRealInventory(
                inventorySheet || [], indentSheet || [], storeInSheet || [], issueSheet || [], [], projectName
            );
            const thisItem = realInventory.find(i => i.itemName === chosenProduct && i.groupHead === chosenGroupHead);
            if (thisItem?.current !== undefined) {
                stockVal = thisItem.current;
            }
        }

        const currentProducts = form.getValues('products') || [];
        const filledProducts = currentProducts.map(() => ({
            groupHead: chosenGroupHead,
            productName: chosenProduct,
            quantity: 100,
            minStockQty: stockVal,
            uom: chosenUom,
            areaOfUse: chosenArea,
            expectedRequirementDate: expectedDateStr,
            attachment: undefined,
            specifications: 'Standard project site execution requirement',
        }));

        const currentEquipments = form.getValues('equipments') || [];
        const sampleEquipments = [
            { name: 'Hydraulic Excavator CAT 320D', type: 'Rent' as const, time: '30 Days', charge: 8500 },
            { name: 'Hydra Mobile Crane 15T', type: 'Rent' as const, time: '15 Days', charge: 6500 },
            { name: 'Transit Mixer 6 Cu.M', type: 'Owned' as const, time: '', charge: 0 },
            { name: 'Motor Grader 140K', type: 'Rent' as const, time: '20 Days', charge: 9000 },
        ];
        const filledEquipments = currentEquipments.map((_, idx) => {
            const sample = sampleEquipments[idx % sampleEquipments.length];
            return {
                groupHead: chosenGroupHead,
                areaOfUse: chosenArea,
                equipmentName: sample.name,
                type: sample.type,
                expectedTime: sample.time,
                dayCharge: sample.charge,
            };
        });

        form.reset({
            createdDate: todayStr,
            firmName: projectName,
            firmId: projectId,
            indenterName: indenter,
            indentStatus: priority,
            products: filledProducts.length > 0 ? filledProducts : (filledEquipments.length === 0 ? [{
                groupHead: chosenGroupHead,
                productName: chosenProduct,
                quantity: 100,
                minStockQty: stockVal,
                uom: chosenUom,
                areaOfUse: chosenArea,
                expectedRequirementDate: expectedDateStr,
                attachment: undefined,
                specifications: 'Standard project site execution requirement',
            }] : []),
            equipments: filledEquipments,
        });

        toast.success('Test entries filled with valid data!');
    };

    function onError(errors: any) {
        console.error('Form validation errors:', errors);
        const topErrorKey = Object.keys(errors)[0];
        if (topErrorKey === 'products' && Array.isArray(errors.products)) {
            for (const prodErr of errors.products) {
                if (prodErr) {
                    const firstMsg = Object.values(prodErr)[0] as any;
                    if (firstMsg?.message) {
                        toast.error(firstMsg.message);
                        return;
                    }
                }
            }
            toast.error('Please check required product fields');
        } else if (topErrorKey === 'equipments' && Array.isArray(errors.equipments)) {
            for (const eqErr of errors.equipments) {
                if (eqErr) {
                    const firstMsg = Object.values(eqErr)[0] as any;
                    if (firstMsg?.message) {
                        toast.error(firstMsg.message);
                        return;
                    }
                }
            }
            toast.error('Please check required equipment fields');
        } else if (errors[topErrorKey]?.message) {
            toast.error(errors[topErrorKey].message);
        } else {
            toast.error('Please fill all required fields');
        }
    }

    return (
        <div className="p-0 sm:p-2 md:p-6 space-y-3 md:space-y-5 flex flex-col h-full min-h-0">
            {/* Top Toolbar / Header similar to New Project */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full px-2 sm:px-0">
                {/* Mobile Top Bar */}
                <div className="flex items-center gap-2 w-full lg:hidden">
                    <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-[9px] text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search indents..."
                            value={filters.searchQuery}
                            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                            className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-xs h-[32px]"
                        />
                    </div>
                    <button
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className={`flex items-center justify-center rounded-lg shadow-sm h-[32px] w-[32px] flex-shrink-0 transition ${
                            showMobileFilters ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <Filter size={14} />
                    </button>
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded-lg h-[32px] w-[32px] flex-shrink-0 shadow-sm active:scale-95"
                        title="Clear Filters"
                    >
                        <RotateCcw size={14} />
                    </button>
                    <button
                        onClick={() => {
                            loadProjects();
                            setShowFormModal(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center h-[32px] w-[32px] flex-shrink-0 shadow-sm transition"
                        title="Create Indent"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Mobile Collapsible Filters */}
                <div className={`${showMobileFilters ? 'grid' : 'hidden'} lg:hidden grid-cols-2 gap-2 w-full`}>
                    <SearchableDropdown
                        options={Array.from(new Set(historyData.map(p => p.firm_name))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
                        value={filters.projectName}
                        onChange={(val) => setFilters({ ...filters, projectName: val })}
                        placeholder="All Projects"
                        height="h-[32px]"
                    />
                    <SearchableDropdown
                        options={[
                            { value: 'Critical', label: 'Critical' },
                            { value: 'Non-Critical', label: 'Non-Critical' },
                        ]}
                        value={filters.priority}
                        onChange={(val) => setFilters({ ...filters, priority: val })}
                        placeholder="All Priorities"
                        height="h-[32px]"
                    />
                </div>

                {/* Desktop Toolbar Row */}
                <div className="hidden lg:flex lg:flex-1 items-center gap-3">
                    <div className="flex-1 min-w-0 relative">
                        <Search className="absolute left-2.5 top-[11px] text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search indents by number, product, indenter, project, remarks..."
                            value={filters.searchQuery}
                            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                            className="w-full bg-white border border-gray-300 rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-sm h-[38px]"
                        />
                    </div>
                    <div className="w-[220px] min-w-0">
                        <SearchableDropdown
                            options={Array.from(new Set(historyData.map(p => p.firm_name))).filter(Boolean).sort().map(v => ({ value: v, label: v }))}
                            value={filters.projectName}
                            onChange={(val) => setFilters({ ...filters, projectName: val })}
                            placeholder="All Projects"
                            height="h-[38px]"
                        />
                    </div>
                    <div className="w-[180px] min-w-0">
                        <SearchableDropdown
                            options={[
                                { value: 'Critical', label: 'Critical' },
                                { value: 'Non-Critical', label: 'Non-Critical' },
                            ]}
                            value={filters.priority}
                            onChange={(val) => setFilters({ ...filters, priority: val })}
                            placeholder="All Priorities"
                            height="h-[38px]"
                        />
                    </div>
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-200 rounded w-[38px] h-[38px] hover:bg-gray-100 transition-colors shadow-sm flex-shrink-0 cursor-pointer"
                        title="Clear Filters"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>

                <button
                    onClick={() => {
                        loadProjects();
                        setShowFormModal(true);
                    }}
                    className="hidden lg:flex bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg items-center justify-center gap-2 transition shadow-sm h-[38px] px-4 flex-shrink-0 font-semibold text-sm cursor-pointer"
                >
                    <Plus size={18} />
                    <span>Create Indent</span>
                </button>
            </div>

            {/* Permanent Indents DataTable */}
            <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <DataTable
                    data={filteredHistoryData}
                    columns={historyColumns}
                    dataLoading={historyLoading}
                    searchFields={['indent_number', 'product_name', 'indenter_name', 'firm_name', 'group_head', 'area_of_use', 'specifications']}
                    className="h-full"
                />
            </div>

            {/* Modal Form Popup for Creating Indent */}
            <ModalForm
                isOpen={showFormModal}
                onClose={() => {
                    setShowFormModal(false);
                }}
                title="Create New Indent"
                onSubmit={form.handleSubmit(onSubmit, onError)}
                submitText={form.formState.isSubmitting ? 'Creating...' : 'Create Indent'}
                maxWidth="max-w-4xl"
                extraFooterAction={
                    <button
                        type="button"
                        onClick={handleFillDummyData}
                        className="flex-1 px-2 md:px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap cursor-pointer"
                        title="Fill all fields with valid dummy data"
                    >
                        <Sparkles size={16} className="text-amber-600" />
                        <span>Test Entries</span>
                    </button>
                }
            >
                <Form {...form}>
                    <div className="space-y-6">
                        {/* Header Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                            <FormField
                                control={form.control}
                                name="createdDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs font-semibold text-gray-700">
                                            Indent Date <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                className="h-9 bg-white text-xs"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="firmName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-gray-700">
                                            Project Name <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                const firmObj = options?.firmObjects?.find(f => f.name === val);
                                                if (firmObj) form.setValue('firmId', firmObj.id);
                                                handleFirmNameSelect(val);

                                                const currentProducts = form.getValues('products') || [];
                                                currentProducts.forEach((product, idx) => {
                                                    const pName = product.productName;
                                                    const gHead = product.groupHead;
                                                    if (val && pName && gHead) {
                                                        const realInventory = calculateRealInventory(
                                                            inventorySheet || [], indentSheet || [], storeInSheet || [], issueSheet || [], [], val
                                                        );
                                                        const thisItem = realInventory.find(i => i.itemName === pName && i.groupHead === gHead);
                                                        form.setValue(`products.${idx}.minStockQty`, thisItem?.current ?? 0);
                                                    } else {
                                                        form.setValue(`products.${idx}.minStockQty`, 0);
                                                    }
                                                });
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full h-9 bg-white text-xs">
                                                    <SelectValue placeholder="Select Project Name" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <div
                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                    <input
                                                        placeholder="Search Project Name..."
                                                        value={searchTermFirmName}
                                                        onChange={(e) => setSearchTermFirmName(e.target.value)}
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                        className="flex h-8 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                    />
                                                </div>
                                                {projectList.length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-muted-foreground">
                                                        No projects found.
                                                    </div>
                                                ) : (
                                                    projectList
                                                        .filter((f) => 
                                                            f.name.toLowerCase().includes(searchTermFirmName.toLowerCase())
                                                        )
                                                        .map((firm) => (
                                                            <SelectItem key={firm.id} value={firm.name}>
                                                                {firm.name}
                                                            </SelectItem>
                                                        ))
                                                )}

                                                {user?.administrate &&
                                                    searchTermFirmName.trim() !== '' &&
                                                    !projectList.some(f => f.name.toLowerCase() === searchTermFirmName.toLowerCase()) && (
                                                        <div className="p-2 border-t mt-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start text-primary gap-2 h-8 text-xs"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAddProject();
                                                                }}
                                                                disabled={isAddingProject}
                                                            >
                                                                {isAddingProject ? (
                                                                    <Loader size={14} color="currentColor" />
                                                                ) : (
                                                                    <PlusCircle size={14} />
                                                                )}
                                                                Add "{searchTermFirmName}" as new Project
                                                            </Button>
                                                        </div>
                                                    )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="indenterName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-gray-700">
                                            Indenter Name <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter indenter name"
                                                {...field}
                                                className="h-9 bg-white text-xs"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="indentStatus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold text-gray-700">
                                            Priority <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""}>
                                            <FormControl>
                                                <SelectTrigger className="w-full h-9 bg-white text-xs">
                                                    <SelectValue placeholder="Select priority" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Critical">Critical</SelectItem>
                                                <SelectItem value="Non-Critical">Non-Critical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Products List Section */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center pb-1 border-b border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Product Items</h3>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleFillDummyData}
                                        className="h-8 px-2.5 text-xs bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center gap-1 font-semibold cursor-pointer shadow-xs"
                                        title="Fill all fields with valid dummy data"
                                    >
                                        <Sparkles size={13} className="text-amber-600" />
                                        <span>Test Entries</span>
                                    </Button>
                                </div>
                            </div>

                            {fields.map((field, index) => {
                                const currentGroupHead = products[index]?.groupHead;
                                const defaultGroupHeads = [
                                    'Pipes & Fittings',
                                    'Civil Materials',
                                    'Electrical & Instrumentation',
                                    'Valves & Actuators',
                                    'Hardware & Consumables',
                                    'Pumps & Motors'
                                ];
                                const groupHeadOptions = (options?.allGroupHeads && options.allGroupHeads.length > 0)
                                    ? options.allGroupHeads
                                    : defaultGroupHeads;

                                const defaultProducts: Record<string, string[]> = {
                                    'Pipes & Fittings': ['HDPE Pipe 110mm PN6', 'HDPE Pipe 630mm PN10', 'Electrofusion Coupler 630mm', 'Flange Adapter 110mm', 'Stub End Flange 630mm'],
                                    'Civil Materials': ['Cement Grade 53 (50kg)', 'River Sand Bedding', 'Ready-Mix Concrete M25', 'Geotextile Fabric 200 GSM'],
                                    'Electrical & Instrumentation': ['Armoured Cable 4-Core 16sqmm', 'Control Panel 3-Phase', 'Pressure Transmitter'],
                                    'Valves & Actuators': ['Kinetic Air Release Valve 150mm', 'Resilient Seated Sluice Valve 300mm', 'Butterfly Valve 200mm'],
                                    'Hardware & Consumables': ['Galvanized High Tensile Bolts & Nuts', 'EPDM Rubber Gasket 630mm', 'Teflon Tape'],
                                    'Pumps & Motors': ['Centrifugal Pump 15HP', 'Submersible Motor 10HP', 'Monoblock Pump 5HP']
                                };
                                const productOptions = currentGroupHead
                                    ? (options?.products?.[currentGroupHead] && options.products[currentGroupHead].length > 0
                                        ? options.products[currentGroupHead]
                                        : defaultProducts[currentGroupHead] || [])
                                    : Array.from(new Set([...Object.values(options?.products || {}).flat(), ...Object.values(defaultProducts).flat()])).filter(Boolean);

                                const defaultAreaOfUses = [
                                    'Main Pipeline Section',
                                    'Water Treatment Plant',
                                    'Electrical Substation',
                                    'Distribution Canal Network',
                                    'Pumping Station',
                                    'Storage Yard'
                                ];
                                const areaOfUseOptions = (options?.areaOfUses && options.areaOfUses.length > 0)
                                    ? options.areaOfUses
                                    : defaultAreaOfUses;

                                const defaultUoms = ['Mtr', 'Nos', 'Bags', 'Kg', 'Km', 'Sq.Mtr', 'Cum', 'Set', 'Lot', 'Rolls'];
                                const uomOptions = (options?.uoms && options.uoms.length > 0)
                                    ? options.uoms
                                    : defaultUoms;

                                return (
                                    <div
                                        key={field.id}
                                        className="flex flex-col gap-3 border border-gray-200 bg-slate-50/50 p-3.5 rounded-lg shadow-2xs"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                                Item #{index + 1}
                                            </span>
                                            {(fields.length > 1 || equipmentFields.length > 0) && (
                                                <button
                                                    type="button"
                                                    onClick={() => remove(index)}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                                                    title="Remove item"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.groupHead`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Group Head <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={(val) => handleGroupHeadChange(index, val)}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select group head" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div
                                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                                    <input
                                                                        placeholder="Search group head..."
                                                                        value={searchTermGroupHeadByRow[index] || ''}
                                                                        onChange={(e) =>
                                                                            setSearchTermGroupHeadByRow(prev => ({
                                                                                ...prev,
                                                                                [index]: e.target.value
                                                                            }))
                                                                        }
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-7 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                                    />
                                                                </div>
                                                                {groupHeadOptions
                                                                    .filter((gh) =>
                                                                        gh.toLowerCase().includes((searchTermGroupHeadByRow[index] || '').toLowerCase())
                                                                    )
                                                                    .map((gh, i) => (
                                                                        <SelectItem key={i} value={gh}>
                                                                            {gh}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.areaOfUse`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Area Of Use <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select Area of Use" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div
                                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                                    <input
                                                                        placeholder="Search Area of Use..."
                                                                        value={searchTermAreaOfUseByRow[index] || ''}
                                                                        onChange={(e) => setSearchTermAreaOfUseByRow(prev => ({ ...prev, [index]: e.target.value }))}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-7 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                                    />
                                                                </div>
                                                                {areaOfUseOptions
                                                                    .filter((area) =>
                                                                        area.toLowerCase().includes((searchTermAreaOfUseByRow[index] || '').toLowerCase())
                                                                    )
                                                                    .map((area, i) => (
                                                                        <SelectItem key={i} value={area}>
                                                                            {area}
                                                                        </SelectItem>
                                                                    ))}

                                                                {(searchTermAreaOfUseByRow[index] || '').trim() !== '' &&
                                                                    !areaOfUseOptions.some(area => area.toLowerCase() === (searchTermAreaOfUseByRow[index] || '').trim().toLowerCase()) && (
                                                                        <div className="p-2 border-t mt-1">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="w-full justify-start text-primary gap-2 h-7 text-xs"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleAddAreaOfUse(index, (searchTermAreaOfUseByRow[index] || '').trim());
                                                                                }}
                                                                                disabled={isAddingAreaOfUse}
                                                                            >
                                                                                {isAddingAreaOfUse ? (
                                                                                    <Loader size={12} color="currentColor" />
                                                                                ) : (
                                                                                    <PlusCircle size={12} />
                                                                                )}
                                                                                Add "{(searchTermAreaOfUseByRow[index] || '')}" as new Area
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.productName`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Product Name <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={(val) => handleItemChange(index, val)}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select product" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div
                                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                                    <input
                                                                        placeholder="Search product..."
                                                                        value={searchTermProductNameByRow[index] || ''}
                                                                        onChange={(e) =>
                                                                            setSearchTermProductNameByRow(prev => ({
                                                                                ...prev,
                                                                                [index]: e.target.value
                                                                            }))
                                                                        }
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-7 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                                    />
                                                                </div>
                                                                {productOptions
                                                                    .filter((p) =>
                                                                        p.toLowerCase().includes((searchTermProductNameByRow[index] || '').toLowerCase())
                                                                    )
                                                                    .map((p, i) => (
                                                                        <SelectItem key={i} value={p}>
                                                                            {p}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Quantity <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                {...field}
                                                                value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                                                                placeholder="Enter quantity"
                                                                className="h-8.5 bg-white text-xs"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.minStockQty`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Current Stock Qty
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                {...field}
                                                                value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                                                                onChange={(e) => field.onChange(e.target.value)}
                                                                placeholder="Current stock"
                                                                className="h-8.5 bg-white text-xs"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.uom`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            UOM <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select UOM" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div
                                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                                    <input
                                                                        placeholder="Search UOM..."
                                                                        value={searchTermUOMByRow[index] || ''}
                                                                        onChange={(e) =>
                                                                            setSearchTermUOMByRow(prev => ({
                                                                                ...prev,
                                                                                [index]: e.target.value
                                                                            }))
                                                                        }
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-7 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                                    />
                                                                </div>
                                                                {uomOptions
                                                                    .filter((uom) =>
                                                                        uom.toLowerCase().includes((searchTermUOMByRow[index] || '').toLowerCase())
                                                                    )
                                                                    .map((uom, i) => (
                                                                        <SelectItem key={i} value={uom}>
                                                                            {uom}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.expectedRequirementDate`}
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Expected Requirement Date <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="date"
                                                                className="h-8.5 bg-white text-xs"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <ProductAttachmentField
                                                control={form.control}
                                                index={index}
                                                setValue={form.setValue}
                                                onUploadingChange={handleUploadingChange}
                                                justSubmittedRef={justSubmittedRef}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name={`products.${index}.specifications`}
                                            render={({ field }) => (
                                                <FormItem className="w-full">
                                                    <FormLabel className="text-xs font-medium text-gray-700">Specifications / Remarks</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Enter specifications"
                                                            className="resize-y bg-white text-xs min-h-[60px]"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                );
                            })}

                            {/* Equipment Form Blocks */}
                            {equipmentFields.map((field, eqIndex) => {
                                const defaultGroupHeads = [
                                    'Pipes & Fittings',
                                    'Civil Materials',
                                    'Electrical & Instrumentation',
                                    'Valves & Actuators',
                                    'Hardware & Consumables',
                                    'Pumps & Motors'
                                ];
                                const groupHeadOptions = (options?.allGroupHeads && options.allGroupHeads.length > 0)
                                    ? options.allGroupHeads
                                    : defaultGroupHeads;

                                const defaultAreaOfUses = [
                                    'Main Pipeline Section',
                                    'Water Treatment Plant',
                                    'Electrical Substation',
                                    'Distribution Canal Network',
                                    'Pumping Station',
                                    'Storage Yard'
                                ];
                                const areaOfUseOptions = (options?.areaOfUses && options.areaOfUses.length > 0)
                                    ? options.areaOfUses
                                    : defaultAreaOfUses;

                                const currentType = form.watch(`equipments.${eqIndex}.type`);

                                return (
                                    <div
                                        key={field.id}
                                        className="flex flex-col gap-3 border border-amber-200 bg-amber-50/30 p-3.5 rounded-lg shadow-2xs"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                                                <Wrench size={13} className="text-amber-600" />
                                                Equipment #{eqIndex + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeEquipment(eqIndex)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                                                title="Remove equipment"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <FormField
                                                control={form.control}
                                                name={`equipments.${eqIndex}.groupHead`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Group Head <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select group head" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div
                                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                                    <input
                                                                        placeholder="Search group head..."
                                                                        value={searchTermEqGroupHeadByRow[eqIndex] || ''}
                                                                        onChange={(e) =>
                                                                            setSearchTermEqGroupHeadByRow(prev => ({
                                                                                ...prev,
                                                                                [eqIndex]: e.target.value
                                                                            }))
                                                                        }
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-7 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                                    />
                                                                </div>
                                                                {groupHeadOptions
                                                                    .filter((gh) =>
                                                                        gh.toLowerCase().includes((searchTermEqGroupHeadByRow[eqIndex] || '').toLowerCase())
                                                                    )
                                                                    .map((gh, i) => (
                                                                        <SelectItem key={i} value={gh}>
                                                                            {gh}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`equipments.${eqIndex}.areaOfUse`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Area Of Use <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select Area of Use" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div
                                                                    className="flex items-center border-b border-slate-200 px-2.5 py-1.5 sticky top-0 bg-white z-10"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                                    <input
                                                                        placeholder="Search Area of Use..."
                                                                        value={searchTermEqAreaOfUseByRow[eqIndex] || ''}
                                                                        onChange={(e) => setSearchTermEqAreaOfUseByRow(prev => ({ ...prev, [eqIndex]: e.target.value }))}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        className="flex h-7 w-full rounded-md border-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
                                                                    />
                                                                </div>
                                                                {areaOfUseOptions
                                                                    .filter((area) =>
                                                                        area.toLowerCase().includes((searchTermEqAreaOfUseByRow[eqIndex] || '').toLowerCase())
                                                                    )
                                                                    .map((area, i) => (
                                                                        <SelectItem key={i} value={area}>
                                                                            {area}
                                                                        </SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <FormField
                                                control={form.control}
                                                name={`equipments.${eqIndex}.equipmentName`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Equipment Name <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="e.g. Vehicles, Crane, Excavator, Dump Truck"
                                                                className="h-8.5 bg-white text-xs"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`equipments.${eqIndex}.type`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-gray-700">
                                                            Type <span className="text-destructive">*</span>
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-8.5 bg-white text-xs">
                                                                    <SelectValue placeholder="Select Type (Rent or Owned)" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Rent">Rent</SelectItem>
                                                                <SelectItem value="Owned">Owned</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Extra fields if Type is Rent */}
                                        {currentType === 'Rent' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2.5 bg-amber-100/40 rounded-md border border-amber-200">
                                                <FormField
                                                    control={form.control}
                                                    name={`equipments.${eqIndex}.expectedTime`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-medium text-gray-700">
                                                                Expected Time <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="e.g. 15 Days, 1 Month, 8 Hours"
                                                                    className="h-8.5 bg-white text-xs"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name={`equipments.${eqIndex}.dayCharge`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-medium text-gray-700">
                                                                Day Charge (₹) <span className="text-destructive">*</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    step="any"
                                                                    placeholder="Enter Day Charge"
                                                                    className="h-8.5 bg-white text-xs"
                                                                    {...field}
                                                                    value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Add Product and Add Equipment Buttons at the Bottom */}
                            <div className="pt-1 flex items-center justify-start gap-2.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        append({
                                            groupHead: '',
                                            productName: '',
                                            quantity: '' as any,
                                            minStockQty: 0,
                                            uom: '',
                                            areaOfUse: '',
                                            expectedRequirementDate: '',
                                            attachment: undefined,
                                            specifications: '',
                                        })
                                    }
                                    className="h-8.5 px-3.5 text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
                                >
                                    <Plus size={15} />
                                    <span>Add Product</span>
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        appendEquipment({
                                            groupHead: '',
                                            areaOfUse: '',
                                            equipmentName: '',
                                            type: 'Rent',
                                            expectedTime: '',
                                            dayCharge: '' as any,
                                        })
                                    }
                                    className="h-8.5 px-3.5 text-xs bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
                                >
                                    <Plus size={15} />
                                    <span>Add Equipment</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </Form>
            </ModalForm>

            {/* Stage Delete Dialog */}
            <StageDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(v) => !v && setDeleteTarget(null)}
                stageName="Create Indent"
                isPermanentDelete={true}
                indentNumber={deleteTarget?.indent_number}
                productName={deleteTarget?.product_name}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    const targetId = deleteTarget.id;
                    const indentNum = deleteTarget.indent_number;
                    await deleteIndentRecord(targetId);
                    toast.success(`Indent ${indentNum} deleted successfully`);
                    setDeleteTarget(null);
                    setHistoryData(prev => prev.filter(r => r.id !== targetId));
                    await fetchHistory();
                    updateIndentSheet(true);
                }}
            />
        </div>
    );
};

import { storeApi, apiClient } from '@/lib/apiClient';
import { filterByFirmAccess, hasNoFirmAccess, normalizeFirmAccess } from '@/lib/firmAccess';
import { getMockTable } from '@/lib/mockStore';

export interface TechnicalApprovalIndent {
    id: number;
    indentNo: string;
    indenter: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string, string, string, string, string, string, string, string, string][];
    date: string;
    firmNameMatch?: string;
    firm_id?: number;
    plannedDate: string;
    actual3?: string;
    timestamp?: string;
}

export interface TechnicalHistoryIndent {
    id: number;
    indentNo: string;
    indenter: string;
    firmNameMatch: string;
    firm_id?: number;
    product: string;
    vendors: [string, string, string, string, string, string, string, string, string, string, string][];
    date: string;
}

/**
 * Fetch pending technical approvals from backend REST API
 */
export async function fetchPendingTechnicalApprovals(permittedFirms?: string[]): Promise<TechnicalApprovalIndent[]> {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];
        const firms = normalizeFirmAccess(permittedFirms);

        const params: Record<string, any> = {
            order: 'indent_number.desc',
            not_null__planned3: 'true',
            is_null__actual3: 'true',
            limit: 'all',
        };

        if (firms) {
            const ids = firms.filter(f => /^\d+$/.test(f)).map(Number);
            const names = firms.filter(f => !/^\d+$/.test(f));
            if (ids.length > 0) {
                params['in__firm_id'] = ids.join(',');
            } else if (names.length > 0) {
                params['in__firm_name'] = names.join(',');
            }
        }

        const res: any = await apiClient.get('/store/entity/indent', { params });

        const rows = (Array.isArray(res) ? res : (res?.data || [])) as any[];

        const mapped = rows
            .filter((r) => r.planned3 && (!r.actual3 || r.actual3 === '') && r.vendor_type !== 'Reject' && r.status !== 'Rejected' && !r.vendor1_rank && !r.vendor2_rank && !r.vendor3_rank)
            .map((r): TechnicalApprovalIndent => ({
                id: r.id,
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name || '',
                firm_id: r.firm_id,
                indenter: r.indenter_name || '',
                product: r.product_name || '',
                comparisonSheet: r.comparison_sheet || '',
                date: r.timestamp ? r.timestamp : '',
                plannedDate: r.planned3 || 'Not Set',
                vendors: [
                    [
                        r.vendor_name1 || '',
                        r.rate1?.toString() || '0',
                        r.payment_term1 || '',
                        r.select_rate_type1 || 'With Tax',
                        r.with_tax_or_not1 || 'Yes',
                        r.tax_value1?.toString() || '0',
                        r.quotation_no1 || '',
                        r.quotation_date1 || '',
                        r.vendor1_rank || '',
                        r.delivery_time1 || '',
                        r.make1 || ''
                    ],
                    [
                        r.vendor_name2 || '',
                        r.rate2?.toString() || '0',
                        r.payment_term2 || '',
                        r.select_rate_type2 || 'With Tax',
                        r.with_tax_or_not2 || 'Yes',
                        r.tax_value2?.toString() || '0',
                        r.quotation_no2 || '',
                        r.quotation_date2 || '',
                        r.vendor2_rank || '',
                        r.delivery_time2 || '',
                        r.make2 || ''
                    ],
                    [
                        r.vendor_name3 || '',
                        r.rate3?.toString() || '0',
                        r.payment_term3 || '',
                        r.select_rate_type3 || 'With Tax',
                        r.with_tax_or_not3 || 'Yes',
                        r.tax_value3?.toString() || '0',
                        r.quotation_no3 || '',
                        r.quotation_date3 || '',
                        r.vendor3_rank || '',
                        r.delivery_time3 || '',
                        r.make3 || ''
                    ],
                ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
            }));

        return filterByFirmAccess(mapped, permittedFirms, {
            id: (row: any) => row.firm_id,
            name: (row: any) => row.firmNameMatch,
        });
    } catch {
        const rows = getMockTable('indent');
        const mapped = rows
            .filter((r) => r.planned3 && (!r.actual3 || r.actual3 === '') && r.vendor_type !== 'Reject' && r.status !== 'Rejected' && !r.vendor1_rank && !r.vendor2_rank && !r.vendor3_rank)
            .map((r): TechnicalApprovalIndent => ({
                id: r.id,
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name || '',
                firm_id: r.firm_id,
                indenter: r.indenter_name || '',
                product: r.product_name || '',
                comparisonSheet: r.comparison_sheet || '',
                date: r.timestamp ? r.timestamp : '',
                plannedDate: r.planned3 || 'Not Set',
                vendors: [
                    [
                        r.vendor_name1 || '',
                        r.rate1?.toString() || '0',
                        r.payment_term1 || '',
                        r.select_rate_type1 || 'With Tax',
                        r.with_tax_or_not1 || 'Yes',
                        r.tax_value1?.toString() || '0',
                        r.quotation_no1 || '',
                        r.quotation_date1 || '',
                        r.vendor1_rank || '',
                        r.delivery_time1 || '',
                        r.make1 || ''
                    ],
                    [
                        r.vendor_name2 || '',
                        r.rate2?.toString() || '0',
                        r.payment_term2 || '',
                        r.select_rate_type2 || 'With Tax',
                        r.with_tax_or_not2 || 'Yes',
                        r.tax_value2?.toString() || '0',
                        r.quotation_no2 || '',
                        r.quotation_date2 || '',
                        r.vendor2_rank || '',
                        r.delivery_time2 || '',
                        r.make2 || ''
                    ],
                    [
                        r.vendor_name3 || '',
                        r.rate3?.toString() || '0',
                        r.payment_term3 || '',
                        r.select_rate_type3 || 'With Tax',
                        r.with_tax_or_not3 || 'Yes',
                        r.tax_value3?.toString() || '0',
                        r.quotation_no3 || '',
                        r.quotation_date3 || '',
                        r.vendor3_rank || '',
                        r.delivery_time3 || '',
                        r.make3 || ''
                    ],
                ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
            }));

        return filterByFirmAccess(mapped, permittedFirms, {
            id: (row: any) => row.firm_id,
            name: (row: any) => row.firmNameMatch,
        });
    }
}

/**
 * Fetch completed technical approvals (History tab)
 */
export async function fetchCompletedTechnicalApprovals(permittedFirms?: string[]): Promise<TechnicalHistoryIndent[]> {
    try {
        if (hasNoFirmAccess(permittedFirms)) return [];
        const firms = normalizeFirmAccess(permittedFirms);

        const params: Record<string, any> = {
            order: 'indent_number.desc',
            not_null__planned3: 'true',
            limit: 'all',
        };

        if (firms) {
            const ids = firms.filter(f => /^\d+$/.test(f)).map(Number);
            const names = firms.filter(f => !/^\d+$/.test(f));
            if (ids.length > 0) {
                params['in__firm_id'] = ids.join(',');
            } else if (names.length > 0) {
                params['in__firm_name'] = names.join(',');
            }
        }

        const res: any = await apiClient.get('/store/entity/indent', { params });

        const rows = (Array.isArray(res) ? res : (res?.data || [])) as any[];

        const mapped = rows
            .filter((r) => r.vendor_type !== 'Reject' && r.status !== 'Rejected' && (r.vendor1_rank || r.vendor2_rank || r.vendor3_rank))
            .map((r): TechnicalHistoryIndent => ({
                id: r.id,
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name || '',
                firm_id: r.firm_id,
                indenter: r.indenter_name || '',
                product: r.product_name || '',
                date: r.actual3 || r.timestamp || '',
                vendors: [
                    [
                        r.vendor_name1 || '',
                        r.rate1?.toString() || '0',
                        r.payment_term1 || '',
                        r.select_rate_type1 || 'With Tax',
                        r.with_tax_or_not1 || 'Yes',
                        r.tax_value1?.toString() || '0',
                        r.quotation_no1 || '',
                        r.quotation_date1 || '',
                        r.vendor1_rank || '',
                        r.delivery_time1 || '',
                        r.make1 || ''
                    ],
                    [
                        r.vendor_name2 || '',
                        r.rate2?.toString() || '0',
                        r.payment_term2 || '',
                        r.select_rate_type2 || 'With Tax',
                        r.with_tax_or_not2 || 'Yes',
                        r.tax_value2?.toString() || '0',
                        r.quotation_no2 || '',
                        r.quotation_date2 || '',
                        r.vendor2_rank || '',
                        r.delivery_time2 || '',
                        r.make2 || ''
                    ],
                    [
                        r.vendor_name3 || '',
                        r.rate3?.toString() || '0',
                        r.payment_term3 || '',
                        r.select_rate_type3 || 'With Tax',
                        r.with_tax_or_not3 || 'Yes',
                        r.tax_value3?.toString() || '0',
                        r.quotation_no3 || '',
                        r.quotation_date3 || '',
                        r.vendor3_rank || '',
                        r.delivery_time3 || '',
                        r.make3 || ''
                    ],
                ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
            }));

        return filterByFirmAccess(mapped, permittedFirms, {
            id: (row: any) => row.firm_id,
            name: (row: any) => row.firmNameMatch,
        });
    } catch {
        const rows = getMockTable('indent');
        const mapped = rows
            .filter((r) => r.vendor_type !== 'Reject' && r.status !== 'Rejected' && (r.vendor1_rank || r.vendor2_rank || r.vendor3_rank))
            .map((r): TechnicalHistoryIndent => ({
                id: r.id,
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name || '',
                firm_id: r.firm_id,
                indenter: r.indenter_name || '',
                product: r.product_name || '',
                date: r.actual3 || r.timestamp || '',
                vendors: [
                    [
                        r.vendor_name1 || '',
                        r.rate1?.toString() || '0',
                        r.payment_term1 || '',
                        r.select_rate_type1 || 'With Tax',
                        r.with_tax_or_not1 || 'Yes',
                        r.tax_value1?.toString() || '0',
                        r.quotation_no1 || '',
                        r.quotation_date1 || '',
                        r.vendor1_rank || '',
                        r.delivery_time1 || '',
                        r.make1 || ''
                    ],
                    [
                        r.vendor_name2 || '',
                        r.rate2?.toString() || '0',
                        r.payment_term2 || '',
                        r.select_rate_type2 || 'With Tax',
                        r.with_tax_or_not2 || 'Yes',
                        r.tax_value2?.toString() || '0',
                        r.quotation_no2 || '',
                        r.quotation_date2 || '',
                        r.vendor2_rank || '',
                        r.delivery_time2 || '',
                        r.make2 || ''
                    ],
                    [
                        r.vendor_name3 || '',
                        r.rate3?.toString() || '0',
                        r.payment_term3 || '',
                        r.select_rate_type3 || 'With Tax',
                        r.with_tax_or_not3 || 'Yes',
                        r.tax_value3?.toString() || '0',
                        r.quotation_no3 || '',
                        r.quotation_date3 || '',
                        r.vendor3_rank || '',
                        r.delivery_time3 || '',
                        r.make3 || ''
                    ],
                ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
            }));

        return filterByFirmAccess(mapped, permittedFirms, {
            id: (row: any) => row.firm_id,
            name: (row: any) => row.firmNameMatch,
        });
    }
}

/**
 * Submit technical approval: assign vendor ranks, set approved vendor details, and advance stage to Create PO
 */
export async function submitTechnicalApproval(
    id: number,
    ranks: Record<string, string>,
    approvedVendorDetails?: {
        vendorName?: string;
        rate?: string | number;
        paymentTerm?: string;
        taxValue?: string | number;
        withTaxOrNot?: string;
        quotationNo?: string;
        quotationDate?: string;
        make?: string;
        deliveryTime?: string;
    }
) {
    try {
        const now = new Date().toISOString();
        const payload: Record<string, any> = {
            actual3: now,
            planned4: now,
        };

        if (ranks.vendor1_rank) payload.vendor1_rank = ranks.vendor1_rank;
        if (ranks.vendor2_rank) payload.vendor2_rank = ranks.vendor2_rank;
        if (ranks.vendor3_rank) payload.vendor3_rank = ranks.vendor3_rank;

        if (approvedVendorDetails?.vendorName) {
            payload.vendor1_name = approvedVendorDetails.vendorName;
        }

        return await storeApi.update('indent', id, payload);
    } catch (error) {
        console.error('Error submitting technical approval:', error);
        throw error;
    }
}

/**
 * Update technical approval ranks from history tab
 */
export async function updateTechnicalApprovalRanks(id: number, ranks: Record<string, string>) {
    try {
        const payload: Record<string, any> = {};
        if (ranks.vendor1_rank) payload.vendor1_rank = ranks.vendor1_rank;
        if (ranks.vendor2_rank) payload.vendor2_rank = ranks.vendor2_rank;
        if (ranks.vendor3_rank) payload.vendor3_rank = ranks.vendor3_rank;

        return await storeApi.update('indent', id, payload);
    } catch (error) {
        console.error('Error updating technical approval ranks:', error);
        throw error;
    }
}

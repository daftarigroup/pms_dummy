/**
 * In-Memory & LocalStorage Mock Database Store
 * Enables 100% functional standalone dummy frontend operations
 * without any external database or backend server.
 */

const STORAGE_PREFIX = 'pcb_mock_store_';

export interface MockStoreState {
    indent: any[];
    po_master: any[];
    store_in: any[];
    inventory: any[];
    tally_entry: any[];
    fullkitting: any[];
    issue: any[];
    payments: any[];
    payment_history: any[];
    stock_transfer: any[];
    [key: string]: any[];
}

const initialMockIndents: any[] = [];

const initialMockPOs: any[] = [];

export function getMockTable(table: string): any[] {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = localStorage.getItem(`${STORAGE_PREFIX}${table}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (table === 'indent' && Array.isArray(parsed)) {
                    // Filter out legacy hardcoded sample indents
                    const cleaned = parsed.filter((p: any) => !['SI-1001', 'SI-1002', 'SI-1003'].includes(p.indent_number || p.indentNumber));
                    if (cleaned.length !== parsed.length) {
                        localStorage.setItem(`${STORAGE_PREFIX}indent`, JSON.stringify(cleaned));
                    }
                    return cleaned;
                }
                if (table === 'po_master' && Array.isArray(parsed)) {
                    // Strip any legacy dummy PO
                    const cleaned = parsed.filter((p: any) => (p.po_number || p.poNumber) !== 'PO-2026-001');
                    if (cleaned.length !== parsed.length) {
                        localStorage.setItem(`${STORAGE_PREFIX}po_master`, JSON.stringify(cleaned));
                    }
                    return cleaned;
                }
                return parsed;
            }
        }
    } catch (e) {
        console.warn(`Error reading mock store for ${table}:`, e);
    }

    if (table === 'indent') {
        setMockTable('indent', initialMockIndents);
        return initialMockIndents;
    }
    if (table === 'po_master') {
        setMockTable('po_master', initialMockPOs);
        return initialMockPOs;
    }
    return [];
}

export function setMockTable(table: string, data: any[]) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`${STORAGE_PREFIX}${table}`, JSON.stringify(data));
        }
    } catch (e) {
        console.warn(`Error writing mock store for ${table}:`, e);
    }
}

export function mockInsert(table: string, payload: any): any {
    const list = getMockTable(table);
    const rows = Array.isArray(payload) ? payload : [payload];
    
    let maxId = list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
    const newItems = rows.map((row) => {
        maxId += 1;
        return {
            ...row,
            id: row.id || maxId,
            timestamp: row.timestamp || new Date().toISOString(),
            status: row.status || (table === 'indent' ? 'Pending' : 'Active'),
        };
    });

    const updated = [...list, ...newItems];
    setMockTable(table, updated);
    return Array.isArray(payload) ? newItems : newItems[0];
}

export function mockUpdate(table: string, id: string | number, data: any): any {
    const list = getMockTable(table);
    const targetId = Number(id);
    let updatedItem: any = null;

    const updated = list.map((item) => {
        if (Number(item.id) === targetId || String(item.id) === String(id)) {
            updatedItem = { ...item, ...data };
            return updatedItem;
        }
        return item;
    });

    setMockTable(table, updated);
    return updatedItem || data;
}

export function mockUpdateWhere(table: string, where: Record<string, any>, data: any): any[] {
    const list = getMockTable(table);
    const updated = list.map((item) => {
        let match = true;
        for (const [k, v] of Object.entries(where)) {
            if (String(item[k]) !== String(v)) {
                match = false;
                break;
            }
        }
        if (match) {
            return { ...item, ...data };
        }
        return item;
    });

    setMockTable(table, updated);
    return updated;
}

export function mockDelete(table: string, id: string | number): boolean {
    const list = getMockTable(table);
    const targetId = Number(id);
    const updated = list.filter((item) => Number(item.id) !== targetId && String(item.id) !== String(id));
    setMockTable(table, updated);
    return true;
}

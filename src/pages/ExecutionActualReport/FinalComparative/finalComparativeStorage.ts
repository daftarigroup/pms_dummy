import {
  Minor,
  Adjustment,
  SurveyRow,
  FinalComparativeInputs,
  AuditLogEntry,
  DatedSnapshot
} from './finalComparativeTypes';
import {
  SEED_MINORS,
  SEED_ADJUSTMENTS,
  SEED_PDN_EXECUTED_RAW_BY_MINOR,
  SEED_CAD_EXECUTED_BY_MINOR,
  SEED_FINAL_COMPARATIVE_INPUTS,
  generateSeedSurveyRowsForMinor
} from './finalComparativeSeedData';

const FINAL_COMPARATIVE_STORAGE_KEY_PREFIX = 'pms_final_comparative_';
const FINAL_COMPARATIVE_SNAPSHOTS_KEY_PREFIX = 'pms_fc_snapshots_';
const FINAL_COMPARATIVE_AUDIT_KEY_PREFIX = 'pms_fc_audit_';

export interface FinalComparativeStorageState {
  minors: Minor[];
  surveyRowsByMinor: Record<string, SurveyRow[]>;
  adjustments: Adjustment[];
  cadExecutedByMinor: Record<string, Record<number, number>>;
  inputs: FinalComparativeInputs;
  overridePDNByMinor?: Record<string, Record<number, number>>;
  auditLogs: AuditLogEntry[];
}

export function getInitialFinalComparativeSeedState(): FinalComparativeStorageState {
  const surveyRowsByMinor: Record<string, SurveyRow[]> = {};
  SEED_MINORS.forEach(m => {
    const raw = SEED_PDN_EXECUTED_RAW_BY_MINOR[m.id] || {};
    surveyRowsByMinor[m.id] = generateSeedSurveyRowsForMinor(m.id, raw);
  });

  return {
    minors: SEED_MINORS,
    surveyRowsByMinor,
    adjustments: SEED_ADJUSTMENTS,
    cadExecutedByMinor: SEED_CAD_EXECUTED_BY_MINOR,
    inputs: JSON.parse(JSON.stringify(SEED_FINAL_COMPARATIVE_INPUTS)),
    overridePDNByMinor: JSON.parse(JSON.stringify(SEED_PDN_EXECUTED_RAW_BY_MINOR)),
    auditLogs: [
      {
        id: 'init-audit-fc',
        timestamp: '2026-06-18T10:00:00Z',
        action: 'SNAPSHOT_LOADED',
        details: 'Initial dated snapshot loaded (18-Jun-2026)',
        user: 'Chief Billing Engineer'
      }
    ]
  };
}

export function loadFinalComparativeState(projectNo = 'default'): FinalComparativeStorageState {
  try {
    const key = `${FINAL_COMPARATIVE_STORAGE_KEY_PREFIX}${projectNo}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      const initial = getInitialFinalComparativeSeedState();
      saveFinalComparativeState(projectNo, initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      ...getInitialFinalComparativeSeedState(),
      ...parsed
    };
  } catch (err) {
    console.error('Failed to load Final Comparative state:', err);
    return getInitialFinalComparativeSeedState();
  }
}

export function saveFinalComparativeState(
  projectNo = 'default',
  state: FinalComparativeStorageState
): void {
  try {
    const key = `${FINAL_COMPARATIVE_STORAGE_KEY_PREFIX}${projectNo}`;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save Final Comparative state:', err);
  }
}

export function logFinalComparativeAudit(
  projectNo: string,
  action: string,
  details: string,
  user = 'Billing Engineer'
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    action,
    details,
    user
  };
  return entry;
}

// Dated Snapshots
export function loadDatedSnapshots(projectNo = 'default'): DatedSnapshot[] {
  try {
    const key = `${FINAL_COMPARATIVE_SNAPSHOTS_KEY_PREFIX}${projectNo}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      const seedSnapshot: DatedSnapshot = {
        id: 'snapshot-18-jun-2026',
        name: 'Official 18-Jun-2026 Milestone Snapshot',
        date: '18-Jun-2026',
        created_at: '2026-06-18T10:00:00Z',
        inputs: JSON.parse(JSON.stringify(SEED_FINAL_COMPARATIVE_INPUTS)),
        notes: 'Original dated workbook baseline comparing survey PDN with independently measured quantities.'
      };
      saveDatedSnapshots(projectNo, [seedSnapshot]);
      return [seedSnapshot];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load snapshots:', err);
    return [];
  }
}

export function saveDatedSnapshots(projectNo = 'default', snapshots: DatedSnapshot[]): void {
  try {
    const key = `${FINAL_COMPARATIVE_SNAPSHOTS_KEY_PREFIX}${projectNo}`;
    localStorage.setItem(key, JSON.stringify(snapshots));
  } catch (err) {
    console.error('Failed to save snapshots:', err);
  }
}

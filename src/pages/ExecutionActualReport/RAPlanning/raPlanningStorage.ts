import {
  Minor,
  Adjustment,
  SurveyRow,
  CADExecutedRecord,
  WorkType,
  RAPlanningInputs,
  AuditLogEntry
} from './raPlanningTypes';
import {
  SEED_MINORS,
  SEED_ADJUSTMENTS,
  SEED_PDN_EXECUTED_RAW_BY_MINOR,
  SEED_PLANNED_BY_BILL,
  SEED_CAD_EXECUTED,
  generateSeedSurveyRowsForMinor
} from './raPlanningSeedData';

const RA_PLANNING_STORAGE_PREFIX = 'pms_ra_planning_v1_';
const ABSTRACT_STORAGE_PREFIX = 'pms_pipe_abstract_v2_';

export interface RAPlanningStorageState {
  version: number;
  minors: Minor[];
  surveyRowsByMinor: Record<string, SurveyRow[]>;
  adjustments: Adjustment[];
  // [bill_no][work_type][minor_id][dia] -> planned length in metres
  plannedByBill: Record<string, Record<WorkType, Record<string, Record<number, number>>>>;
  // [minor_id][dia] -> CAD record
  cadExecuted: Record<string, Record<number, CADExecutedRecord>>;
  inputs: RAPlanningInputs;
  auditLogs: AuditLogEntry[];
  overridePDNByMinor?: Record<string, Record<number, number>>;
}

/**
 * Initializes clean seed state matching all acceptance test numbers.
 */
export function getInitialRAPlanningSeedState(): RAPlanningStorageState {
  const surveyRowsByMinor: Record<string, SurveyRow[]> = {};

  SEED_MINORS.forEach(m => {
    const rawExecuted = SEED_PDN_EXECUTED_RAW_BY_MINOR[m.id] || {};
    surveyRowsByMinor[m.id] = generateSeedSurveyRowsForMinor(m.id, rawExecuted);
  });

  const initialLogs: AuditLogEntry[] = [
    {
      id: 'log-seed-init',
      timestamp: new Date().toISOString(),
      user: 'System Admin',
      action: 'RESET_SEED',
      details: 'Initialized RA Planning state with verified DPR & CADWM acceptance seed data'
    }
  ];

  return {
    version: 1,
    minors: [...SEED_MINORS],
    surveyRowsByMinor,
    adjustments: JSON.parse(JSON.stringify(SEED_ADJUSTMENTS)),
    plannedByBill: JSON.parse(JSON.stringify(SEED_PLANNED_BY_BILL)),
    cadExecuted: JSON.parse(JSON.stringify(SEED_CAD_EXECUTED)),
    inputs: {
      bill_no: 'RA2',
      tolerance_percent: 10,
      labels_config: {
        pdn: 'PDN (Pipe Distribution Network)',
        cadwm: 'CADWM (Command Area Development & Water Management)'
      },
      cad_source_config: {
        source_name: 'CADWM Central Aggregated Sheet',
        last_synced: new Date().toISOString(),
        is_live_sync: true
      }
    },
    auditLogs: initialLogs,
    overridePDNByMinor: JSON.parse(JSON.stringify(SEED_PDN_EXECUTED_RAW_BY_MINOR))
  };
}

/**
 * Loads RA Planning state from localStorage with seed fallback.
 */
export function loadRAPlanningState(projectKey = 'default'): RAPlanningStorageState {
  try {
    const raw = localStorage.getItem(`${RA_PLANNING_STORAGE_PREFIX}${projectKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && parsed.minors && parsed.plannedByBill && parsed.cadExecuted) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load RA planning state:', e);
  }

  const fresh = getInitialRAPlanningSeedState();
  saveRAPlanningState(projectKey, fresh);
  return fresh;
}

/**
 * Saves RA Planning state and cross-syncs CAD quantities to Abstract page
 */
export function saveRAPlanningState(projectKey = 'default', state: RAPlanningStorageState): void {
  try {
    localStorage.setItem(`${RA_PLANNING_STORAGE_PREFIX}${projectKey}`, JSON.stringify(state));
    syncCADToAbstract(projectKey, state.cadExecuted);
  } catch (e) {
    console.error('Failed to save RA planning state:', e);
  }
}

/**
 * Sync CAD executed quantities from RA Planning into Abstract Page storage
 * so the two views never disagree.
 */
export function syncCADToAbstract(
  projectKey: string,
  cadExecuted: Record<string, Record<number, CADExecutedRecord>>
): void {
  try {
    const absKey = `${ABSTRACT_STORAGE_PREFIX}${projectKey}`;
    const raw = localStorage.getItem(absKey);
    if (raw) {
      const absState = JSON.parse(raw);
      if (absState && absState.inputs) {
        const cadPerMinor: Record<string, Record<number, number>> = {};
        Object.entries(cadExecuted).forEach(([minorId, dias]) => {
          cadPerMinor[minorId] = {};
          Object.entries(dias).forEach(([diaStr, rec]) => {
            cadPerMinor[minorId][Number(diaStr)] = rec.qty;
          });
        });
        absState.inputs.cad_per_minor_per_dia = cadPerMinor;
        absState.inputs.cad_last_refreshed = new Date().toISOString();
        localStorage.setItem(absKey, JSON.stringify(absState));
      }
    }
  } catch (e) {
    console.error('Failed to sync CAD to abstract:', e);
  }
}

/**
 * Appends an entry to audit log.
 */
export function logRAPlanningAuditAction(
  state: RAPlanningStorageState,
  action: AuditLogEntry['action'],
  details: string,
  meta?: {
    bill_no?: string;
    minor_id?: string;
    work_type?: WorkType;
    pipe_dia?: number;
    old_val?: number;
    new_val?: number;
    user?: string;
  }
): RAPlanningStorageState {
  const entry: AuditLogEntry = {
    id: `log_ra_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    user: meta?.user || 'Current User',
    action,
    details,
    bill_no: meta?.bill_no,
    minor_id: meta?.minor_id,
    work_type: meta?.work_type,
    pipe_dia: meta?.pipe_dia,
    old_val: meta?.old_val,
    new_val: meta?.new_val
  };

  const updatedLogs = [entry, ...(state.auditLogs || [])].slice(0, 500);
  return {
    ...state,
    auditLogs: updatedLogs
  };
}

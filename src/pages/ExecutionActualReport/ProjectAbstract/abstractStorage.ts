import {
  Minor,
  Adjustment,
  AbstractInputs,
  SurveyRow,
  AuditLogEntry
} from './abstractTypes';
import {
  SEED_MINORS,
  SEED_PLANNED_QTY,
  SEED_ADJUSTMENTS,
  SEED_ABSTRACT_INPUTS,
  SEED_EXECUTED_FINAL_BY_MINOR,
  generateSeedSurveyRows
} from './abstractSeedData';

const STORAGE_PREFIX = 'pms_pipe_abstract_v2_';

export interface ProjectAbstractState {
  version: number;
  minors: Minor[];
  surveyRowsByMinor: Record<string, SurveyRow[]>;
  plannedQtyByMinor: Record<string, Record<number, number>>;
  adjustments: Adjustment[];
  inputs: AbstractInputs;
  auditLogs: AuditLogEntry[];
  overrideExecutedByMinor?: Record<string, Record<number, number>>;
}

/**
 * Initializes fresh seed state matching all acceptance test numbers.
 */
export function getInitialSeedState(): ProjectAbstractState {
  const surveyRowsByMinor: Record<string, SurveyRow[]> = {};

  SEED_MINORS.forEach(m => {
    const executedFinal = SEED_EXECUTED_FINAL_BY_MINOR[m.id] || {};
    surveyRowsByMinor[m.id] = generateSeedSurveyRows(m.id, executedFinal);
  });

  const initialLogs: AuditLogEntry[] = [
    {
      id: 'log-seed-init',
      timestamp: new Date().toISOString(),
      user: 'System Admin',
      action: 'RESET_SEED',
      details: 'Initialized project with original DPR & CADWM acceptance seed data'
    }
  ];

  return {
    version: 4,
    minors: [...SEED_MINORS],
    surveyRowsByMinor,
    plannedQtyByMinor: JSON.parse(JSON.stringify(SEED_PLANNED_QTY)),
    adjustments: JSON.parse(JSON.stringify(SEED_ADJUSTMENTS)),
    inputs: JSON.parse(JSON.stringify(SEED_ABSTRACT_INPUTS)),
    auditLogs: initialLogs,
    overrideExecutedByMinor: JSON.parse(JSON.stringify(SEED_EXECUTED_FINAL_BY_MINOR))
  };
}

export function loadProjectAbstract(projectKey = 'default'): ProjectAbstractState {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 4 && parsed.minors && parsed.inputs) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load project abstract state:', e);
  }
  const fresh = getInitialSeedState();
  saveProjectAbstract(projectKey, fresh);
  return fresh;
}

export function saveProjectAbstract(projectKey = 'default', state: ProjectAbstractState): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${projectKey}`, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save project abstract state:', e);
  }
}

export function logAuditAction(
  state: ProjectAbstractState,
  action: AuditLogEntry['action'],
  details: string,
  meta?: { minor_id?: string; pipe_dia?: number; old_value?: any; new_value?: any; user?: string }
): ProjectAbstractState {
  const entry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    user: meta?.user || 'Current User',
    action,
    details,
    minor_id: meta?.minor_id,
    pipe_dia: meta?.pipe_dia,
    old_value: meta?.old_value,
    new_value: meta?.new_value
  };

  const updatedLogs = [entry, ...(state.auditLogs || [])].slice(0, 500); // keep last 500
  return {
    ...state,
    auditLogs: updatedLogs
  };
}

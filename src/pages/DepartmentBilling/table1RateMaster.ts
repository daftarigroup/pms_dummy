// Rate Master & Item Mapping based on Table 1 Logic
// Dynamically looks up rates from Project Schedule B / PO, falling back to Table 1 standard rates

import { getScheduleForMinor, getProductsByPONumber, getProjectOrMinor } from '../../utils/storageManager';

export const STANDARD_TABLE1_PIPE_RATES: Record<number, { layingRate: number; supplyRate: number; unit: string }> = {
  110: { layingRate: 329.20, supplyRate: 329.20, unit: 'Rmt' },
  125: { layingRate: 394.90, supplyRate: 394.90, unit: 'Rmt' },
  140: { layingRate: 487.35, supplyRate: 487.35, unit: 'Rmt' },
  160: { layingRate: 616.95, supplyRate: 616.95, unit: 'Rmt' },
  180: { layingRate: 757.95, supplyRate: 757.95, unit: 'Rmt' },
  200: { layingRate: 922.40, supplyRate: 922.40, unit: 'Rmt' },
  225: { layingRate: 1171.00, supplyRate: 1171.00, unit: 'Rmt' },
  250: { layingRate: 1411.80, supplyRate: 1411.80, unit: 'Rmt' },
  280: { layingRate: 1762.25, supplyRate: 1762.25, unit: 'Rmt' },
  315: { layingRate: 2218.75, supplyRate: 2218.75, unit: 'Rmt' },
  355: { layingRate: 2779.40, supplyRate: 2779.40, unit: 'Rmt' },
  400: { layingRate: 3463.05, supplyRate: 3463.05, unit: 'Rmt' },
  450: { layingRate: 4297.20, supplyRate: 4297.20, unit: 'Rmt' },
  500: { layingRate: 5178.60, supplyRate: 5178.60, unit: 'Rmt' },
  560: { layingRate: 6183.15, supplyRate: 6183.15, unit: 'Rmt' },
  630: { layingRate: 7787.95, supplyRate: 7787.95, unit: 'Rmt' },
  710: { layingRate: 9747.20, supplyRate: 9747.20, unit: 'Rmt' },
  800: { layingRate: 12273.50, supplyRate: 12273.50, unit: 'Rmt' },
  900: { layingRate: 14199.65, supplyRate: 14199.65, unit: 'Rmt' } // PCCP
};

export const STANDARD_TABLE1_EARTHWORK_RATES = {
  deepTrenchExcavation: { code: '1A', rate: 158.50, unit: 'CUM', label: 'Excavation for deep trenches' },
  softStrataExcavation: { code: '2', rate: 106.00, unit: 'CUM', label: 'Excavation in soft strata' },
  murumBedding: { code: '3', rate: 242.90, unit: 'CUM', label: 'Murum bedding below pipe' },
  backfilling: { code: '4', rate: 47.30, unit: 'CUM', label: 'Backfilling of trench' },
  sandBedding: { code: '6', rate: 1276.25, unit: 'CUM', label: 'Sand bedding' },
  rubbleSoling: { code: '5', rate: 1973.00, unit: 'CUM', label: 'Rubble soling below' }
};

export const STANDARD_TABLE1_VALVE_RATES: Record<string, { rate: number; unit: string; label: string }> = {
  '50': { rate: 11173.65, unit: 'No', label: 'Air Valve 50 mm' },
  '80': { rate: 13033.05, unit: 'No', label: 'Air Valve 80 mm' },
  '100': { rate: 14297.55, unit: 'No', label: 'Air Valve 100 mm' },
  '150': { rate: 19768.75, unit: 'No', label: 'Air Valve 150 mm' },
  '200': { rate: 30815.10, unit: 'No', label: 'Air Valve 200 mm' },
  'sluice_100': { rate: 11767.50, unit: 'No', label: 'CI Sluice Valve 100 mm' },
  'sluice_150': { rate: 16556.95, unit: 'No', label: 'CI Sluice Valve 150 mm' },
  'sluice_200': { rate: 25959.00, unit: 'No', label: 'CI Sluice Valve 200 mm' },
  'sluice_250': { rate: 44962.10, unit: 'No', label: 'CI Sluice Valve 250 mm' },
  'sluice_300': { rate: 59153.75, unit: 'No', label: 'CI Sluice Valve 300 mm' },
  'default_valve': { rate: 15000.00, unit: 'No', label: 'Line Valve' }
};

/**
 * Dynamically looks up the rate for a pipe diameter from:
 * 1. Project's uploaded Schedule B rows
 * 2. Project's attached PO products
 * 3. Table 1 Standard Schedule Rates (fallback)
 */
export function getPipeRate(pipeDia: number | string, projectNo?: string): number {
  const diaNum = Number(pipeDia);
  if (!diaNum) return 0;

  // 1. Try uploaded Schedule B for this project / minor
  if (projectNo) {
    const sched = getScheduleForMinor(projectNo);
    if (sched && sched.rows && Array.isArray(sched.rows)) {
      const match = sched.rows.find((r: any) => {
        const desc = String(r.description || r.Description || r['Name of Item'] || '').toLowerCase();
        return desc.includes(String(diaNum)) && (desc.includes('pipe') || desc.includes('hdpe') || desc.includes('pccp'));
      });
      if (match) {
        const rateVal = parseFloat(String(match.rate || match.Rate || match['Rate (Figures)'] || '').replace(/[^\d.-]/g, ''));
        if (rateVal > 0) return rateVal;
      }
    }

    // 2. Try Project PO products
    const proj = getProjectOrMinor(projectNo);
    if (proj?.poNumber) {
      const prods = getProductsByPONumber(proj.poNumber);
      const match = prods.find((p: any) => {
        const prodName = String(p.product || p.description || '').toLowerCase();
        return prodName.includes(String(diaNum));
      });
      if (match && Number(match.rate) > 0) {
        return Number(match.rate);
      }
    }
  }

  // 3. Fallback to Table 1 standard rate
  if (STANDARD_TABLE1_PIPE_RATES[diaNum]) {
    return STANDARD_TABLE1_PIPE_RATES[diaNum].layingRate;
  }

  // Interpolate / rough fallback if diameter not directly in table
  return diaNum * 3.5;
}

/**
 * Returns sub-contractor cost rate (typically from Sub-Contractor PO/WO, default ~75% of dept rate)
 */
export function getSubContractorRate(pipeDia: number | string, deptRate: number): number {
  return parseFloat((deptRate * 0.75).toFixed(2));
}

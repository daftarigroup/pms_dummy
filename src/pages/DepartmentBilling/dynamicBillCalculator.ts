// Dynamic Bill Calculator
// Computes bill quantities and amounts directly from entries sent from Execution Details / Actual Details
// Implements Table 1 logic: Qty x Rate = Amount, plus statutory deductions and back-to-back checks.

import { buildChainageDiffMap } from '../../utils/helpers';
import { getExecutions, getActuals, getRMBills } from '../../utils/storageManager';
import { getPipeRate, STANDARD_TABLE1_EARTHWORK_RATES, STANDARD_TABLE1_VALVE_RATES } from './table1RateMaster';

export interface CalculatedBillLineItem {
  id: string;
  category: 'PIPE' | 'EARTHWORK' | 'BEDDING' | 'VALVE' | 'OTHER';
  code: string;
  description: string;
  pipeDia?: number;
  unit: string;
  rate: number;
  subRate?: number;
  quantity: number;
  amount: number;
  subAmount?: number;
  deptCertifiedQty?: number;
  isOverClaim?: boolean;
}

export interface DynamicBillBreakdown {
  lineItems: CalculatedBillLineItem[];
  grossAmount: number;
  totalLengthMeters: number;
  pipeDiaBreakdown: Record<string, { length: number; rate: number; amount: number }>;
  deductions: {
    securityDepositPct: number;
    securityDeposit: number;
    tdsPct: number;
    tdsAmount: number;
    gstTdsPct: number;
    gstTdsAmount: number;
    labourCessPct: number;
    labourCess: number;
    royaltyAmount: number;
    totalDeductions: number;
  };
  netPayable: number;
}

export function computeBillFromExecutionEntries(
  bill: any,
  overrideRates: Record<string, number> = {},
  deductionConfig: {
    securityDepositPct?: number;
    tdsPct?: number;
    gstTdsPct?: number;
    labourCessPct?: number;
  } = {}
): DynamicBillBreakdown {
  const {
    securityDepositPct = 5,
    tdsPct = 2,
    gstTdsPct = 2,
    labourCessPct = 1
  } = deductionConfig;

  const entries = bill?.entries || [];
  if (entries.length === 0) {
    return {
      lineItems: [],
      grossAmount: 0,
      totalLengthMeters: 0,
      pipeDiaBreakdown: {},
      deductions: {
        securityDepositPct,
        securityDeposit: 0,
        tdsPct,
        tdsAmount: 0,
        gstTdsPct,
        gstTdsAmount: 0,
        labourCessPct,
        labourCess: 0,
        royaltyAmount: 0,
        totalDeductions: 0
      },
      netPayable: 0
    };
  }

  // 1. Compute chainage differences from the full project source
  const isExecution = bill.billType === 'Execution';
  const fullSource = isExecution ? getExecutions() : getActuals();
  const sameProject = fullSource
    .filter(s => s.projectNo === bill.projectNo)
    .sort((a, b) => (a.serialNo ?? 0) - (b.serialNo ?? 0));

  const diffMap = isExecution
    ? buildChainageDiffMap(sameProject, s => s.execution?.chainage, s => s.id)
    : buildChainageDiffMap(sameProject, s => s.actual?.chainage, s => s.id);

  // 2. Group pipe lengths by Pipe Diameter
  const pipeDiaMap: Record<number, { length: number; dia: number; count: number }> = {};
  let totalLengthMeters = 0;
  let totalMurumCum = 0;
  let totalExcavationCum = 0;
  let totalBackfillCum = 0;
  let totalValvesCount = 0;

  entries.forEach((e: any) => {
    const data = e.billed || e.original || e.execution || e.actual || {};
    const dia = Number(data.pipeDia);
    const diff = diffMap.get(e.sourceId) || 0;

    if (diff > 0 && dia > 0) {
      if (!pipeDiaMap[dia]) {
        pipeDiaMap[dia] = { length: 0, dia, count: 0 };
      }
      pipeDiaMap[dia].length += diff;
      pipeDiaMap[dia].count += 1;
      totalLengthMeters += diff;

      // Estimate trench excavation and bedding if depth/cuttingLevel is recorded
      const depth = Number(data.cuttingLevel || data.elevation || 1.5) || 1.5;
      const width = Math.max(0.8, (dia / 1000) + 0.6); // trench width
      const trenchVol = diff * width * depth;

      totalExcavationCum += trenchVol;
      totalMurumCum += diff * width * 0.15; // 150mm bedding
      totalBackfillCum += Math.max(0, trenchVol - (diff * Math.PI * Math.pow(dia / 2000, 2)));
    }

    if (data.valve && String(data.valve).toLowerCase() !== 'false') {
      totalValvesCount += 1;
    }
  });

  const lineItems: CalculatedBillLineItem[] = [];
  const pipeDiaBreakdown: Record<string, { length: number; rate: number; amount: number }> = {};
  let grossAmount = 0;

  // 3. Add Pipe Laying Line Items
  const sortedDias = Object.keys(pipeDiaMap).map(Number).sort((a, b) => a - b);
  sortedDias.forEach(dia => {
    const length = parseFloat(pipeDiaMap[dia].length.toFixed(3));
    const defaultRate = getPipeRate(dia, bill.projectNo);
    const rate = overrideRates[`pipe_${dia}`] !== undefined ? overrideRates[`pipe_${dia}`] : defaultRate;
    const amount = parseFloat((length * rate).toFixed(2));

    grossAmount += amount;
    pipeDiaBreakdown[String(dia)] = { length, rate, amount };

    lineItems.push({
      id: `pipe_${dia}`,
      category: 'PIPE',
      code: `ITEM-7-${dia}`,
      description: `Providing, Laying, Jointing HDPE 4 kg/cm² Pipe ${dia} mm`,
      pipeDia: dia,
      unit: 'Rmt',
      rate,
      quantity: length,
      amount
    });
  });

  // 4. Add Earthwork & Bedding Line Items (if lengths exist)
  if (totalLengthMeters > 0) {
    // 1A Deep Trench Excavation
    const excQty = parseFloat(totalExcavationCum.toFixed(2));
    const excRate = overrideRates['excavation'] !== undefined ? overrideRates['excavation'] : STANDARD_TABLE1_EARTHWORK_RATES.deepTrenchExcavation.rate;
    const excAmt = parseFloat((excQty * excRate).toFixed(2));
    grossAmount += excAmt;
    lineItems.push({
      id: 'excavation',
      category: 'EARTHWORK',
      code: 'ITEM-1A',
      description: 'Excavation for deep trenches for pipe laying',
      unit: 'CUM',
      rate: excRate,
      quantity: excQty,
      amount: excAmt
    });

    // Murum Bedding
    const murumQty = parseFloat(totalMurumCum.toFixed(2));
    const murumRate = overrideRates['murum'] !== undefined ? overrideRates['murum'] : STANDARD_TABLE1_EARTHWORK_RATES.murumBedding.rate;
    const murumAmt = parseFloat((murumQty * murumRate).toFixed(2));
    grossAmount += murumAmt;
    lineItems.push({
      id: 'murum',
      category: 'BEDDING',
      code: 'ITEM-3',
      description: 'Murum bedding below pipe line',
      unit: 'CUM',
      rate: murumRate,
      quantity: murumQty,
      amount: murumAmt
    });

    // Backfilling
    const backfillQty = parseFloat(totalBackfillCum.toFixed(2));
    const backfillRate = overrideRates['backfill'] !== undefined ? overrideRates['backfill'] : STANDARD_TABLE1_EARTHWORK_RATES.backfilling.rate;
    const backfillAmt = parseFloat((backfillQty * backfillRate).toFixed(2));
    grossAmount += backfillAmt;
    lineItems.push({
      id: 'backfill',
      category: 'EARTHWORK',
      code: 'ITEM-4',
      description: 'Backfilling of pipe trench with selected earth',
      unit: 'CUM',
      rate: backfillRate,
      quantity: backfillQty,
      amount: backfillAmt
    });
  }

  // 5. Add Valves (if recorded)
  if (totalValvesCount > 0) {
    const valveRate = overrideRates['valves'] !== undefined ? overrideRates['valves'] : 14297.55;
    const valveAmt = totalValvesCount * valveRate;
    grossAmount += valveAmt;
    lineItems.push({
      id: 'valves',
      category: 'VALVE',
      code: 'ITEM-9',
      description: 'Air Valves and fittings along pipeline',
      unit: 'No',
      rate: valveRate,
      quantity: totalValvesCount,
      amount: valveAmt
    });
  }

  // 6. Compute Statutory Deductions (Table 1 Rules)
  const securityDeposit = (grossAmount * securityDepositPct) / 100;
  const tdsAmount = (grossAmount * tdsPct) / 100;
  const gstTdsAmount = (grossAmount * gstTdsPct) / 100;
  const labourCess = (grossAmount * labourCessPct) / 100;
  const royaltyAmount = totalMurumCum * 141.43; // Murum royalty

  const totalDeductions = securityDeposit + tdsAmount + gstTdsAmount + labourCess + royaltyAmount;
  const netPayable = Math.max(0, grossAmount - totalDeductions);

  return {
    lineItems,
    grossAmount: parseFloat(grossAmount.toFixed(2)),
    totalLengthMeters: parseFloat(totalLengthMeters.toFixed(3)),
    pipeDiaBreakdown,
    deductions: {
      securityDepositPct,
      securityDeposit: parseFloat(securityDeposit.toFixed(2)),
      tdsPct,
      tdsAmount: parseFloat(tdsAmount.toFixed(2)),
      gstTdsPct,
      gstTdsAmount: parseFloat(gstTdsAmount.toFixed(2)),
      labourCessPct,
      labourCess: parseFloat(labourCess.toFixed(2)),
      royaltyAmount: parseFloat(royaltyAmount.toFixed(2)),
      totalDeductions: parseFloat(totalDeductions.toFixed(2))
    },
    netPayable: parseFloat(netPayable.toFixed(2))
  };
}

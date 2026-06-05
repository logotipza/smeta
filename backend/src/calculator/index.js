const { getRate } = require('../data/rates');

// Виды работ по умолчанию
const defaultWorkTypes = [
  { id: 'analytics', name: 'Аналитика', type: 'input', cols: { clean: 'F', risk: 'G', total: 'H' } },
  { id: 'design', name: 'Дизайн', type: 'input', cols: { clean: 'I', risk: 'J', total: 'K' } },
  { id: 'backend', name: 'Backend', type: 'input', cols: { clean: 'L', risk: 'M', total: 'N' } },
  { id: 'frontend', name: 'Frontend', type: 'input', cols: { clean: 'O', risk: 'P', total: 'Q' } },
  { id: 'mobile', name: 'Mobile', type: 'input', cols: { clean: 'R', risk: 'S', total: 'T' } },
  { id: 'testing', name: 'Тестирование', type: 'auto', autoSource: 'dev_totals', cols: { clean: 'U', risk: 'V', total: 'W' } },
  { id: 'management', name: 'Управление', type: 'auto', autoSource: 'all_clean', cols: { clean: 'X', risk: 'Y', total: 'Z' } },
];

function roundUp(num) {
  return Math.ceil(num);
}

function getTaskRisk(coeff) {
  return coeff === 0 || coeff === undefined || coeff === null ? 1 : coeff;
}

function calculateTaskRow(task, settings, workTypes = defaultWorkTypes) {
  const result = {
    ...task,
    calculated: {},
  };

  const inputTypes = workTypes.filter((wt) => wt.type === 'input');
  const testingType = workTypes.find((wt) => wt.id === 'testing');
  const mgmtType = workTypes.find((wt) => wt.id === 'management');

  // 1. Расчёт input-видов работ
  inputTypes.forEach((wt) => {
    const est = task.estimates?.[wt.id] || { clean: 0, riskCoeff: 0 };
    const taskRisk = getTaskRisk(est.riskCoeff);
    const globalRisk = settings.applyGlobalRisk ? (settings.riskCoeffs[wt.id] || 1) : 1;
    const total = roundUp(est.clean * taskRisk * globalRisk);
    result.calculated[wt.id] = {
      clean: est.clean || 0,
      total,
    };
  });

  // 2. Расчёт Тестирования = % от суммы итогов input-видов
  if (testingType) {
    const devTotal = inputTypes.reduce(
      (sum, wt) => sum + (result.calculated[wt.id]?.total || 0),
      0
    );
    const cleanTesting = roundUp(devTotal * (settings.devToTestCoeff || 0));
    const est = task.estimates?.testing || { riskCoeff: 0 };
    const taskRisk = getTaskRisk(est.riskCoeff);
    const globalRisk = settings.applyGlobalRisk ? (settings.riskCoeffs.testing || 1) : 1;
    const totalTesting = roundUp(cleanTesting * taskRisk * globalRisk);
    result.calculated.testing = {
      clean: cleanTesting,
      total: totalTesting,
    };
  }

  // 3. Расчёт Управления = % от суммы чистых оценок всех работ (кроме управления)
  if (mgmtType) {
    const allClean = workTypes
      .filter((wt) => wt.id !== 'management')
      .reduce((sum, wt) => sum + (result.calculated[wt.id]?.clean || 0), 0);
    const cleanMgmt = roundUp(allClean * (settings.workToMgmtCoeff || 0));
    const est = task.estimates?.management || { riskCoeff: 0 };
    const taskRisk = getTaskRisk(est.riskCoeff);
    const globalRisk = settings.applyGlobalRisk ? (settings.riskCoeffs.management || 1) : 1;
    const totalMgmt = roundUp(cleanMgmt * taskRisk * globalRisk);
    result.calculated.management = {
      clean: cleanMgmt,
      total: totalMgmt,
    };
  }

  return result;
}

function aggregateRows(rows, workTypes = defaultWorkTypes) {
  // rows — массив уже рассчитанных строк
  const aggregated = {};
  workTypes.forEach((wt) => {
    aggregated[wt.id] = {
      clean: rows.reduce((s, r) => s + (r.calculated?.[wt.id]?.clean || 0), 0),
      total: rows.reduce((s, r) => s + (r.calculated?.[wt.id]?.total || 0), 0),
    };
  });
  return aggregated;
}

function calculateTree(rows, settings, workTypes = defaultWorkTypes) {
  const map = new Map();
  const calculated = [];

  // Сначала рассчитываем листья (task)
  rows.forEach((row) => {
    if (row.type === 'task') {
      const calc = calculateTaskRow(row, settings, workTypes);
      map.set(row.id, calc);
      calculated.push(calc);
    }
  });

  // Затем эпики и проекты — bottom-up
  // Нужно обработать в правильном порядке (сначала дети, потом родители)
  const byParent = new Map();
  rows.forEach((row) => {
    if (row.parentId) {
      if (!byParent.has(row.parentId)) byParent.set(row.parentId, []);
      byParent.set(row.parentId, [...byParent.get(row.parentId), row]);
    }
  });

  function processRow(row) {
    if (map.has(row.id)) return map.get(row.id);

    const children = rows.filter((r) => r.parentId === row.id);
    const childResults = children.map((c) => processRow(c));
    const agg = aggregateRows(childResults, workTypes);

    const result = {
      ...row,
      calculated: agg,
    };
    map.set(row.id, result);
    return result;
  }

  // Обрабатываем все корневые элементы
  const roots = rows.filter((r) => !r.parentId);
  const rootResults = roots.map((r) => processRow(r));

  // Собираем в плоский список в исходном порядке
  const finalRows = [];
  function flatten(row) {
    finalRows.push(map.get(row.id));
    const children = rows.filter((r) => r.parentId === row.id);
    children.forEach((c) => flatten(c));
  }
  roots.forEach((r) => flatten(r));

  return finalRows;
}

function calculateTotals(tasks, settings, workTypes = defaultWorkTypes) {
  // tasks — только строки типа 'task' (листья)
  const leafTasks = tasks.filter((t) => t.type === 'task');

  const totals = {};
  workTypes.forEach((wt) => {
    const cleanSum = leafTasks.reduce((s, t) => s + (t.calculated?.[wt.id]?.clean || 0), 0);
    const totalSum = leafTasks.reduce((s, t) => s + (t.calculated?.[wt.id]?.total || 0), 0);
    const salePrice = settings.salePrices?.[wt.id] || 0;
    const specialist = settings.specialists?.[wt.id] || '';
    const rate = getRate(specialist);

    const costWithoutRisk = roundUp(cleanSum) * salePrice;
    const costTotal = roundUp(totalSum) * salePrice;
    const costPrice = totalSum > 0 ? rate * totalSum : 0;
    const margin = costTotal - costPrice;
    const rgm = costTotal > 0 ? margin / costTotal : 0;
    const coeffOR = cleanSum > 0 ? totalSum / cleanSum : 0;

    totals[wt.id] = {
      clean: cleanSum,
      total: totalSum,
      salePrice,
      costWithoutRisk,
      coeffOR,
      costTotal,
      costPrice,
      margin,
      rgm,
    };
  });

  // Общие итоги
  totals.total = {
    clean: Object.values(totals).reduce((s, v) => s + (v.clean || 0), 0),
    total: Object.values(totals).reduce((s, v) => s + (v.total || 0), 0),
    costWithoutRisk: Object.values(totals).reduce((s, v) => s + (v.costWithoutRisk || 0), 0),
    costTotal: Object.values(totals).reduce((s, v) => s + (v.costTotal || 0), 0),
    costPrice: Object.values(totals).reduce((s, v) => s + (v.costPrice || 0), 0),
    margin: Object.values(totals).reduce((s, v) => s + (v.margin || 0), 0),
    rgm: 0,
  };
  totals.total.rgm = totals.total.costTotal > 0 ? totals.total.margin / totals.total.costTotal : 0;

  return totals;
}

module.exports = {
  defaultWorkTypes,
  calculateTaskRow,
  calculateTree,
  calculateTotals,
};

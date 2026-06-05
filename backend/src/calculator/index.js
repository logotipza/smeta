const { getRate } = require('../data/rates');

const defaultWorkTypes = [
  { id: 'analytics', name: 'Аналитика', type: 'input' },
  { id: 'design', name: 'Дизайн', type: 'input' },
  { id: 'backend', name: 'Backend', type: 'input' },
  { id: 'frontend', name: 'Frontend', type: 'input' },
  { id: 'mobile', name: 'Mobile', type: 'input' },
  { id: 'testing', name: 'Тестирование', type: 'auto', autoSource: 'dev_totals' },
  { id: 'management', name: 'Управление', type: 'auto', autoSource: 'all_clean' },
];

function roundUp(num) {
  return Math.ceil(num);
}

function getTaskRisk(coeff) {
  return coeff === 0 || coeff === undefined || coeff === null ? 1 : coeff;
}

function buildParentMap(rows) {
  // Определяем parentId по indent для каждой строки
  const parents = [];
  const parentMap = new Map();

  rows.forEach((row, idx) => {
    const indent = row.indent || 0;
    if (indent === 0) {
      parentMap.set(row.id, null);
      parents.length = 0;
      parents[0] = row.id;
    } else {
      // Ищем ближайшего родителя с indent = current - 1
      let parentId = null;
      for (let i = idx - 1; i >= 0; i--) {
        if ((rows[i].indent || 0) === indent - 1) {
          parentId = rows[i].id;
          break;
        }
      }
      parentMap.set(row.id, parentId);
      parents[indent] = row.id;
    }
  });

  return parentMap;
}

function calculateTaskRow(task, settings, workTypes = defaultWorkTypes) {
  const result = {
    ...task,
    calculated: {},
  };

  const inputTypes = workTypes.filter((wt) => wt.type === 'input');
  const testingType = workTypes.find((wt) => wt.id === 'testing');
  const mgmtType = workTypes.find((wt) => wt.id === 'management');

  inputTypes.forEach((wt) => {
    const est = task.estimates?.[wt.id] || { clean: 0, riskCoeff: 0 };
    const taskRisk = getTaskRisk(est.riskCoeff);
    const globalRisk = settings.applyGlobalRisk ? (settings.riskCoeffs[wt.id] || 1) : 1;
    const total = roundUp(est.clean * taskRisk * globalRisk);
    result.calculated[wt.id] = { clean: est.clean || 0, total };
  });

  if (testingType) {
    const devTotal = inputTypes.reduce(
      (sum, wt) => sum + (result.calculated[wt.id]?.total || 0), 0
    );
    const cleanTesting = roundUp(devTotal * (settings.devToTestCoeff || 0));
    const est = task.estimates?.testing || { riskCoeff: 0 };
    const taskRisk = getTaskRisk(est.riskCoeff);
    const globalRisk = settings.applyGlobalRisk ? (settings.riskCoeffs.testing || 1) : 1;
    const totalTesting = roundUp(cleanTesting * taskRisk * globalRisk);
    result.calculated.testing = { clean: cleanTesting, total: totalTesting };
  }

  if (mgmtType) {
    const allClean = workTypes
      .filter((wt) => wt.id !== 'management')
      .reduce((sum, wt) => sum + (result.calculated[wt.id]?.clean || 0), 0);
    const cleanMgmt = roundUp(allClean * (settings.workToMgmtCoeff || 0));
    const est = task.estimates?.management || { riskCoeff: 0 };
    const taskRisk = getTaskRisk(est.riskCoeff);
    const globalRisk = settings.applyGlobalRisk ? (settings.riskCoeffs.management || 1) : 1;
    const totalMgmt = roundUp(cleanMgmt * taskRisk * globalRisk);
    result.calculated.management = { clean: cleanMgmt, total: totalMgmt };
  }

  return result;
}

function aggregateRows(rows, workTypes = defaultWorkTypes) {
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
  const parentMap = buildParentMap(rows);
  const map = new Map();

  // Сначала рассчитываем листья (строки без детей)
  const hasChildren = new Set();
  rows.forEach((row) => {
    const parentId = parentMap.get(row.id);
    if (parentId) hasChildren.add(parentId);
  });

  // Обрабатываем в обратном порядке (снизу вверх)
  const calculated = [];
  const calcMap = new Map();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!hasChildren.has(row.id)) {
      // Лист
      const calc = calculateTaskRow(row, settings, workTypes);
      calcMap.set(row.id, calc);
    } else {
      // Узел — суммируем детей
      const children = rows.filter((r) => parentMap.get(r.id) === row.id);
      const childCalcs = children.map((c) => calcMap.get(c.id));
      const agg = aggregateRows(childCalcs, workTypes);
      calcMap.set(row.id, { ...row, calculated: agg });
    }
  }

  // Собираем в исходном порядке
  return rows.map((row) => calcMap.get(row.id));
}

function calculateTotals(tasks, settings, workTypes = defaultWorkTypes) {
  const leafTasks = tasks.filter((t) => {
    // Листья — те у кого нет детей
    return !tasks.some((other) => other.parentId === t.id);
  });

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
  buildParentMap,
};

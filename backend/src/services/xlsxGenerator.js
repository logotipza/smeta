const ExcelJS = require('exceljs');
const { getRate } = require('../data/rates');

const borderThin = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};

function colLetter(idx) {
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String.fromCharCode(64 + Math.floor(idx / 26)) + String.fromCharCode(65 + (idx % 26));
}

async function generate(data = {}, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(options.sheetName || 'Смета');

  const {
    projectName = '',
    author = '',
    customer = '',
    date = new Date().toLocaleDateString('ru-RU'),
    applyGlobalRisk = true,
    riskCoeffs = {},
    devToTestCoeff = 0.2,
    workToMgmtCoeff = 0.2,
    specialists = {},
    salePrices = {},
    workTypes = [],
    rows = [],
  } = data;

  const fixedCols = 5; // A-E
  const colMap = {};
  workTypes.forEach((wt, i) => {
    const base = fixedCols + i * 3;
    colMap[wt.id] = {
      clean: colLetter(base),
      risk: colLetter(base + 1),
      total: colLetter(base + 2),
    };
  });

  const lastDataCol = fixedCols + workTypes.length * 3 - 1;
  const lastColLetter = colLetter(lastDataCol);

  let r = 1;

  // Row 1
  ws.getCell(`A${r}`).value = 'применить к-т риска в целом на работы';
  ws.getCell(`B${r}`).value = applyGlobalRisk ? 'да' : 'нет';
  ws.getCell(`C${r}`).value = { formula: `IF(B${r}="да","укажите к-т риска для работ","")` };
  workTypes.forEach((wt) => {
    ws.getCell(`${colMap[wt.id].risk}${r}`).value = riskCoeffs[wt.id] || 1;
  });
  r++;

  // Row 2
  const testWt = workTypes.find((w) => w.id === 'testing');
  const mgmtWt = workTypes.find((w) => w.id === 'management');
  if (testWt) {
    ws.getCell(`${colMap[testWt.id].clean}${r}`).value = 'К-т на разработку';
    ws.getCell(`${colMap[testWt.id].risk}${r}`).value = devToTestCoeff;
  }
  if (mgmtWt) {
    ws.getCell(`${colMap[mgmtWt.id].clean}${r}`).value = 'К-т на работы';
    ws.getCell(`${colMap[mgmtWt.id].risk}${r}`).value = workToMgmtCoeff;
  }
  r++;

  // Row 3
  ws.getCell(`A${r}`).value = 'Эпик';
  ws.getCell(`B${r}`).value = 'Фича';
  ws.getCell(`C${r}`).value = 'Описание';
  ws.getCell(`D${r}`).value = 'Показатель';
  ws.getCell(`E${r}`).value = 'Вид работ';
  workTypes.forEach((wt) => {
    ws.mergeCells(`${colMap[wt.id].clean}${r}:${colMap[wt.id].total}${r}`);
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = wt.name;
  });
  r++;

  // Row 4
  ws.getCell(`D${r}`).value = 'Состав рисков (обоснование к-та риска)';
  ws.getCell(`E${r}`).value = 'Специалист';
  workTypes.forEach((wt) => {
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = specialists[wt.id] || '';
  });
  r++;

  // Row 5
  ws.getCell(`E${r}`).value = 'Оценка';
  workTypes.forEach((wt) => {
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = 'чистая оценка';
    ws.getCell(`${colMap[wt.id].risk}${r}`).value = 'к-т риска';
    ws.getCell(`${colMap[wt.id].total}${r}`).value = 'итого';
  });
  r++;

  // Row 6
  ws.getCell(`A${r}`).value = 'Название';
  ws.getCell(`D${r}`).value = 'Цена продажи (руб/час)';
  const firstCleanCol = colLetter(fixedCols);
  ws.getCell(`E${r}`).value = { formula: `IFERROR(E${r + 2}/E${r + 1},0)` };
  workTypes.forEach((wt) => {
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = salePrices[wt.id] || 0;
  });
  r++;

  // Rows 7-14: totals
  const totalRows = [
    { label: 'Часы (без ОР и рисков)', formulaClean: (c) => `SUMIFS(${c}15:${c}999,$A15:$A999,"")`, formulaE: `SUM(${firstCleanCol}${r}:${lastColLetter}${r})` },
    { label: 'Стоимость продажи (без ОР и рисков)', formulaClean: (c) => `ROUNDUP(${c}${r - 1},0)*${c}${r - 2}`, formulaE: `SUM(${firstCleanCol}${r}:${lastColLetter}${r})` },
    { label: 'К-т на ОР и риски', formulaClean: (c) => `IFERROR(${c}${r + 1}/${c}${r - 2},0)`, formulaE: `IFERROR(E${r + 1}/E${r - 2},0)` },
    { label: 'Часы (всего)', formulaClean: (c, t) => `SUMIFS(${t}15:${t}999,$A15:$A999,"")`, formulaE: `SUM(${firstCleanCol}${r}:${lastColLetter}${r})` },
    { label: 'Себестоимость (всего)', formulaClean: (c, t) => `IF(${c}${r - 1}>0, IF(VLOOKUP(${c}4,ставки!$A$2:$C$999,3,FALSE)=0,VLOOKUP(${c}4,ставки!$A$2:$C$999,2,FALSE),VLOOKUP(${c}4,ставки!$A$2:$C$999,3,FALSE))*${c}${r - 1},0)`, formulaE: `SUM(${firstCleanCol}${r}:${lastColLetter}${r})` },
    { label: 'Стоимость продажи (всего)', formulaClean: (c) => `ROUNDUP(${c}${r - 2},0)*${c}${r - 6}`, formulaE: `SUM(${firstCleanCol}${r}:${lastColLetter}${r})` },
    { label: 'Маржа (GrossMargin) (всего)', formulaClean: (c, t) => `IF(${c}${r - 3}>0, (${c}${r - 1}-IF(VLOOKUP(${c}4,ставки!$A$2:$C$999,3,FALSE)=0,VLOOKUP(${c}4,ставки!$A$2:$C$999,2,FALSE),VLOOKUP(${c}4,ставки!$A$2:$C$999,3,FALSE))*${c}${r - 3}),0)`, formulaE: `SUM(${firstCleanCol}${r}:${lastColLetter}${r})` },
    { label: 'R_GM', formulaClean: (c) => `IFERROR(${c}${r - 1}/${c}${r - 2},0)`, formulaE: `IFERROR(E${r - 1}/E${r - 2},0)` },
  ];

  totalRows.forEach((tr) => {
    ws.getCell(`D${r}`).value = tr.label;
    ws.getCell(`E${r}`).value = { formula: tr.formulaE.replace(/\$r/g, String(r)) };
    workTypes.forEach((wt) => {
      const cm = colMap[wt.id];
      const f = tr.formulaClean(cm.clean, cm.total).replace(/\$r/g, String(r));
      ws.getCell(`${cm.clean}${r}`).value = { formula: f };
    });
    r++;
  });

  // Styles for header
  for (let sr = 1; sr <= r - 1; sr++) {
    for (let c = 1; c <= fixedCols + workTypes.length * 3; c++) {
      const cell = ws.getCell(sr, c);
      if (cell.value) {
        cell.border = borderThin;
        if ([3, 5].includes(sr)) {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        }
      }
    }
  }

  // ===== DATA ROWS =====
  const rowIndexMap = new Map();

  function buildParentMap(dataRows) {
    const map = new Map();
    dataRows.forEach((row, idx) => {
      const indent = row.indent || 0;
      if (indent === 0) {
        map.set(row.id, null);
      } else {
        let parentId = null;
        for (let i = idx - 1; i >= 0; i--) {
          if ((dataRows[i].indent || 0) === indent - 1) {
            parentId = dataRows[i].id;
            break;
          }
        }
        map.set(row.id, parentId);
      }
    });
    return map;
  }

  const parentMap = buildParentMap(rows);

  // Check if row has children
  const hasChildren = new Set();
  rows.forEach((row) => {
    const parentId = parentMap.get(row.id);
    if (parentId) hasChildren.add(parentId);
  });

  rows.forEach((row) => {
    const indent = row.indent || 0;
    const isLeaf = !hasChildren.has(row.id);

    // A = blank for leaf, name for non-leaf (like original template)
    if (!isLeaf) {
      ws.getCell(`A${r}`).value = row.name;
    } else {
      ws.getCell(`B${r}`).value = row.name;
    }

    ws.getCell(`E${r}`).value = { formula: `SUMIF($${firstCleanCol}$5:$${lastColLetter}$5,$${colLetter(fixedCols + 2)}$5,${firstCleanCol}${r}:${lastColLetter}${r})` };

    workTypes.forEach((wt) => {
      const cm = colMap[wt.id];
      const est = row.estimates?.[wt.id] || { clean: 0, riskCoeff: 0 };
      const calc = row.calculated?.[wt.id] || { clean: 0, total: 0 };

      if (isLeaf) {
        if (wt.type === 'input') {
          ws.getCell(`${cm.clean}${r}`).value = est.clean || 0;
          ws.getCell(`${cm.risk}${r}`).value = est.riskCoeff || 0;
          const globalRiskCell = `${cm.risk}1`;
          ws.getCell(`${cm.total}${r}`).value = {
            formula: `ROUNDUP(IF($B$1="да",(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*${globalRiskCell},(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*1)),0)`,
          };
        } else if (wt.id === 'testing') {
          const inputTotals = workTypes
            .filter((w) => w.type === 'input')
            .map((w) => `${colMap[w.id].total}${r}`)
            .join('+');
          const devCoeffCell = `${cm.risk}2`;
          ws.getCell(`${cm.clean}${r}`).value = { formula: `ROUNDUP((${inputTotals})*${devCoeffCell},0)` };
          ws.getCell(`${cm.risk}${r}`).value = est.riskCoeff || 0;
          const globalRiskCell = `${cm.risk}1`;
          ws.getCell(`${cm.total}${r}`).value = {
            formula: `ROUNDUP(IF($B$1="да",(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*${globalRiskCell},(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*1)),0)`,
          };
        } else if (wt.id === 'management') {
          const allClean = workTypes
            .filter((w) => w.id !== 'management')
            .map((w) => `${colMap[w.id].clean}${r}`)
            .join('+');
          const mgmtCoeffCell = `${cm.risk}2`;
          ws.getCell(`${cm.clean}${r}`).value = { formula: `(${allClean})*${mgmtCoeffCell}` };
          ws.getCell(`${cm.risk}${r}`).value = est.riskCoeff || 0;
          const globalRiskCell = `${cm.risk}1`;
          ws.getCell(`${cm.total}${r}`).value = {
            formula: `ROUNDUP(IF($B$1="да",(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*${globalRiskCell},(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*1)),0)`,
          };
        }
      } else {
        // Parent row — sum children
        const childRows = rows
          .filter((rr) => parentMap.get(rr.id) === row.id)
          .map((rr) => rowIndexMap.get(rr.id))
          .filter(Boolean);

        if (childRows.length > 0) {
          ws.getCell(`${cm.clean}${r}`).value = { formula: `SUM(${childRows.map((cr) => `${cm.clean}${cr}`).join('+')})` };
          ws.getCell(`${cm.total}${r}`).value = { formula: `SUM(${childRows.map((cr) => `${cm.total}${cr}`).join('+')})` };
        } else {
          ws.getCell(`${cm.clean}${r}`).value = 0;
          ws.getCell(`${cm.total}${r}`).value = 0;
        }
      }

      [cm.clean, cm.risk, cm.total].forEach((c) => {
        ws.getCell(`${c}${r}`).border = borderThin;
      });
      ws.getCell(`${cm.clean}${r}`).numFmt = '#,##0';
      ws.getCell(`${cm.total}${r}`).numFmt = '#,##0';
      if (!isLeaf) {
        ws.getCell(`${cm.clean}${r}`).font = { bold: true };
        ws.getCell(`${cm.total}${r}`).font = { bold: true };
      }
    });

    for (let c = 1; c <= 5; c++) {
      ws.getCell(r, c).border = borderThin;
    }
    if (!isLeaf) {
      ws.getCell(r, 1).font = { bold: true };
    }

    rowIndexMap.set(row.id, r);
    r++;
  });

  // Column widths
  ws.columns = [
    { width: 25 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 12 },
    ...workTypes.flatMap(() => [{ width: 12 }, { width: 10 }, { width: 12 }]),
  ];

  // Rates sheet
  const wsRates = workbook.addWorksheet('ставки');
  wsRates.getCell('A1').value = 'роль';
  wsRates.getCell('B1').value = 'партнерские';
  wsRates.getCell('C1').value = 'собственные';
  [1, 2, 3].forEach((c) => {
    wsRates.getCell(1, c).font = { bold: true };
    wsRates.getCell(1, c).border = borderThin;
  });

  const allRates = data.rateDetails || require('../data/rates').rates;
  allRates.forEach((rate, idx) => {
    const rr = idx + 2;
    wsRates.getCell(rr, 1).value = rate.role;
    wsRates.getCell(rr, 2).value = rate.partner || 0;
    wsRates.getCell(rr, 3).value = rate.own || 0;
    [1, 2, 3].forEach((c) => {
      wsRates.getCell(rr, c).border = borderThin;
    });
  });
  wsRates.columns = [{ width: 50 }, { width: 14 }, { width: 14 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generate };

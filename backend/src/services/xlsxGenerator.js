const ExcelJS = require('exceljs');
const { getRate } = require('../data/rates');

const borderThin = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};

function colLetter(idx) {
  // idx 0 -> A, 1 -> B, ...
  return String.fromCharCode(65 + idx);
}

function colLetterExtended(idx) {
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

  // Рассчитаем mapping колонок
  // A=0, B=1, C=2, D=3, E=4 — фиксированные
  // Каждый workType занимает 3 колонки
  const fixedCols = 5; // A-E
  const colMap = {};
  workTypes.forEach((wt, i) => {
    const base = fixedCols + i * 3;
    colMap[wt.id] = {
      clean: colLetterExtended(base),
      risk: colLetterExtended(base + 1),
      total: colLetterExtended(base + 2),
    };
  });

  const lastDataCol = fixedCols + workTypes.length * 3 - 1;
  const lastColLetter = colLetterExtended(lastDataCol);

  let r = 1;

  // ===== СТРОКА 1: Настройки риска =====
  ws.getCell(`A${r}`).value = 'применить к-т риска в целом на работы';
  ws.getCell(`B${r}`).value = applyGlobalRisk ? 'да' : 'нет';
  ws.getCell(`C${r}`).value = { formula: `IF(B${r}="да","укажите к-т риска для работ","")` };

  workTypes.forEach((wt) => {
    const c = colMap[wt.id].risk;
    ws.getCell(`${c}${r}`).value = riskCoeffs[wt.id] || 1;
  });
  r++;

  // ===== СТРОКА 2: К-ты на разработку и работы =====
  const testWt = workTypes.find((w) => w.id === 'testing');
  const mgmtWt = workTypes.find((w) => w.id === 'management');
  if (testWt) {
    const c = colMap[testWt.id].clean;
    ws.getCell(`${c}${r}`).value = 'К-т на разработку';
    ws.getCell(`${colMap[testWt.id].risk}${r}`).value = devToTestCoeff;
  }
  if (mgmtWt) {
    const c = colMap[mgmtWt.id].clean;
    ws.getCell(`${c}${r}`).value = 'К-т на работы';
    ws.getCell(`${colMap[mgmtWt.id].risk}${r}`).value = workToMgmtCoeff;
  }
  r++;

  // ===== СТРОКА 3: Основные заголовки =====
  ws.getCell(`A${r}`).value = 'Эпик';
  ws.getCell(`B${r}`).value = 'Фича';
  ws.getCell(`C${r}`).value = 'Описание';
  ws.getCell(`D${r}`).value = 'Показатель';
  ws.getCell(`E${r}`).value = 'Вид работ';
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.mergeCells(`${c}${r}:${colMap[wt.id].total}${r}`);
    ws.getCell(`${c}${r}`).value = wt.name;
  });
  r++;

  // ===== СТРОКА 4: Специалисты =====
  ws.getCell(`D${r}`).value = 'Состав рисков (обоснование к-та риска)';
  ws.getCell(`E${r}`).value = 'Специалист';
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.getCell(`${c}${r}`).value = specialists[wt.id] || '';
  });
  r++;

  // ===== СТРОКА 5: Подзаголовки =====
  ws.getCell(`E${r}`).value = 'Оценка';
  workTypes.forEach((wt) => {
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = 'чистая оценка';
    ws.getCell(`${colMap[wt.id].risk}${r}`).value = 'к-т риска';
    ws.getCell(`${colMap[wt.id].total}${r}`).value = 'итого';
  });
  r++;

  // ===== СТРОКА 6: Цена продажи =====
  ws.getCell(`A${r}`).value = 'Название';
  ws.getCell(`D${r}`).value = 'Цена продажи (руб/час)';
  // E6 = средняя цена
  const firstCleanCol = colLetterExtended(fixedCols);
  const lastCleanCol = colLetterExtended(fixedCols + workTypes.length * 3 - 3); // последняя "чистая"
  ws.getCell(`E${r}`).value = { formula: `IFERROR(E${r + 2}/E${r + 1},0)` };

  workTypes.forEach((wt) => {
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = salePrices[wt.id] || 0;
  });
  r++;

  // ===== СТРОКА 7: Часы без ОР и рисков =====
  ws.getCell(`D${r}`).value = 'Часы (без ОР и рисков)';
  ws.getCell(`E${r}`).value = { formula: `SUM(${firstCleanCol}${r}:${lastCleanCol}${r})` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.getCell(`${c}${r}`).value = { formula: `SUMIFS(${c}15:${c}999,$A15:$A999,"")` };
  });
  r++;

  // ===== СТРОКА 8: Стоимость продажи без ОР и рисков =====
  ws.getCell(`D${r}`).value = 'Стоимость продажи (без ОР и рисков)';
  ws.getCell(`E${r}`).value = { formula: `SUM(${firstCleanCol}${r}:${lastCleanCol}${r})` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.getCell(`${c}${r}`).value = { formula: `ROUNDUP(${c}${r - 1},0)*${c}${r - 2}` };
  });
  r++;

  // ===== СТРОКА 9: К-т на ОР и риски =====
  ws.getCell(`D${r}`).value = 'К-т на ОР и риски';
  ws.getCell(`E${r}`).value = { formula: `IFERROR(E${r + 1}/E${r - 2},0)` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.getCell(`${c}${r}`).value = { formula: `IFERROR(${c}${r + 1}/${c}${r - 2},0)` };
  });
  r++;

  // ===== СТРОКА 10: Часы всего =====
  ws.getCell(`D${r}`).value = 'Часы (всего)';
  ws.getCell(`E${r}`).value = { formula: `SUM(${firstCleanCol}${r}:${lastCleanCol}${r})` };
  workTypes.forEach((wt) => {
    const cTotal = colMap[wt.id].total;
    ws.getCell(`${colMap[wt.id].clean}${r}`).value = { formula: `SUMIFS(${cTotal}15:${cTotal}999,$A15:$A999,"")` };
  });
  r++;

  // ===== СТРОКА 11: Себестоимость =====
  ws.getCell(`D${r}`).value = 'Себестоимость (всего)';
  ws.getCell(`E${r}`).value = { formula: `SUM(${firstCleanCol}${r}:${lastCleanCol}${r})` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    const cTotal = colMap[wt.id].total;
    const specCell = `${c}4`;
    ws.getCell(`${c}${r}`).value = {
      formula: `IF(${c}${r - 1}>0, IF(VLOOKUP(${specCell},ставки!$A$2:$C$999,3,FALSE)=0,VLOOKUP(${specCell},ставки!$A$2:$C$999,2,FALSE),VLOOKUP(${specCell},ставки!$A$2:$C$999,3,FALSE))*${c}${r - 1},0)`,
    };
  });
  r++;

  // ===== СТРОКА 12: Стоимость продажи всего =====
  ws.getCell(`D${r}`).value = 'Стоимость продажи (всего)';
  ws.getCell(`E${r}`).value = { formula: `SUM(${firstCleanCol}${r}:${lastCleanCol}${r})` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.getCell(`${c}${r}`).value = { formula: `ROUNDUP(${c}${r - 2},0)*${c}${r - 6}` };
  });
  r++;

  // ===== СТРОКА 13: Маржа =====
  ws.getCell(`D${r}`).value = 'Маржа (GrossMargin) (всего)';
  ws.getCell(`E${r}`).value = { formula: `SUM(${firstCleanCol}${r}:${lastCleanCol}${r})` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    const specCell = `${c}4`;
    ws.getCell(`${c}${r}`).value = {
      formula: `IF(${c}${r - 3}>0, (${c}${r - 1}-IF(VLOOKUP(${specCell},ставки!$A$2:$C$999,3,FALSE)=0,VLOOKUP(${specCell},ставки!$A$2:$C$999,2,FALSE),VLOOKUP(${specCell},ставки!$A$2:$C$999,3,FALSE))*${c}${r - 3}),0)`,
    };
  });
  r++;

  // ===== СТРОКА 14: R_GM =====
  ws.getCell(`D${r}`).value = 'R_GM';
  ws.getCell(`E${r}`).value = { formula: `IFERROR(E${r - 1}/E${r - 2},0)` };
  workTypes.forEach((wt) => {
    const c = colMap[wt.id].clean;
    ws.getCell(`${c}${r}`).value = { formula: `IFERROR(${c}${r - 1}/${c}${r - 2},0)` };
  });
  r++;

  // ===== СТИЛИ ШАПКИ =====
  for (let styleRow = 1; styleRow <= r - 1; styleRow++) {
    for (let c = 1; c <= fixedCols + workTypes.length * 3; c++) {
      const cell = ws.getCell(styleRow, c);
      if (!cell.value) continue;
      cell.border = borderThin;
      if (styleRow === 3 || styleRow === 5) {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      }
      if ([6, 7, 8, 9, 10, 11, 12, 13, 14].includes(styleRow)) {
        if (c >= fixedCols + 1) {
          cell.numFmt = '#,##0.00';
        }
      }
    }
  }

  // ===== ДАННЫЕ =====
  const dataStartRow = r;
  const rowIndexMap = new Map(); // id -> excel row

  function writeRows(items, parentId = null) {
    items.forEach((item) => {
      const children = items.filter((i) => i.parentId === item.id);
      const hasChildren = children.length > 0;

      if (item.type === 'project') {
        ws.getCell(`A${r}`).value = item.name;
      } else if (item.type === 'epic') {
        ws.getCell(`A${r}`).value = item.name || 'Эпик';
      } else {
        ws.getCell(`B${r}`).value = item.name || 'Задача';
      }

      ws.getCell(`E${r}`).value = { formula: `SUMIF($${firstCleanCol}$5:$${lastColLetter}$5,$${colLetterExtended(fixedCols + 2)}$5,${firstCleanCol}${r}:${lastColLetter}${r})` };

      workTypes.forEach((wt) => {
        const cm = colMap[wt.id];
        const est = item.estimates?.[wt.id] || { clean: 0, riskCoeff: 0 };
        const calc = item.calculated?.[wt.id] || { clean: 0, total: 0 };

        if (item.type === 'task') {
          if (wt.type === 'input') {
            ws.getCell(`${cm.clean}${r}`).value = est.clean || 0;
            ws.getCell(`${cm.risk}${r}`).value = est.riskCoeff || 0;

            // Итого = ROUNDUP(чистая * (риск==0?1:риск) * (общий_риск?globalRisk:1), 0)
            const globalRiskCell = `${cm.risk}1`;
            ws.getCell(`${cm.total}${r}`).value = {
              formula: `ROUNDUP(IF($B$1="да",(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*${globalRiskCell},(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*1)),0)`,
            };
          } else if (wt.id === 'testing') {
            // Чистая = ROUNDUP(сумма_итогов_input * N$2, 0)
            const inputTotals = workTypes
              .filter((w) => w.type === 'input')
              .map((w) => `${colMap[w.id].total}${r}`)
              .join('+');
            const devCoeffCell = `${colMap[wt.id].risk}2`; // N2
            ws.getCell(`${cm.clean}${r}`).value = { formula: `ROUNDUP((${inputTotals})*${devCoeffCell},0)` };
            ws.getCell(`${cm.risk}${r}`).value = est.riskCoeff || 0;
            const globalRiskCell = `${cm.risk}1`;
            ws.getCell(`${cm.total}${r}`).value = {
              formula: `ROUNDUP(IF($B$1="да",(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*${globalRiskCell},(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*1)),0)`,
            };
          } else if (wt.id === 'management') {
            // Чистая = (сумма_чистых_всех_работ) * Q$2
            const allClean = workTypes
              .filter((w) => w.id !== 'management')
              .map((w) => `${colMap[w.id].clean}${r}`)
              .join('+');
            const mgmtCoeffCell = `${cm.risk}2`; // Q2
            ws.getCell(`${cm.clean}${r}`).value = { formula: `(${allClean})*${mgmtCoeffCell}` };
            ws.getCell(`${cm.risk}${r}`).value = est.riskCoeff || 0;
            const globalRiskCell = `${cm.risk}1`;
            ws.getCell(`${cm.total}${r}`).value = {
              formula: `ROUNDUP(IF($B$1="да",(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*${globalRiskCell},(IF(${cm.risk}${r}<>0,(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))),(${cm.clean}${r}*1*(IF(${cm.risk}${r}=0,1,${cm.risk}${r}))))*1)),0)`,
            };
          }
        } else {
          // Эпик / Проект — суммы дочерних
          const childRows = items
            .filter((i) => i.parentId === item.id)
            .map((i) => rowIndexMap.get(i.id))
            .filter(Boolean);

          if (childRows.length > 0) {
            const sumClean = childRows.map((cr) => `${cm.clean}${cr}`).join('+');
            const sumTotal = childRows.map((cr) => `${cm.total}${cr}`).join('+');
            ws.getCell(`${cm.clean}${r}`).value = { formula: `SUM(${sumClean})` };
            ws.getCell(`${cm.total}${r}`).value = { formula: `SUM(${sumTotal})` };
          } else {
            ws.getCell(`${cm.clean}${r}`).value = 0;
            ws.getCell(`${cm.total}${r}`).value = 0;
          }
        }

        // Стили
        ws.getCell(`${cm.clean}${r}`).border = borderThin;
        ws.getCell(`${cm.risk}${r}`).border = borderThin;
        ws.getCell(`${cm.total}${r}`).border = borderThin;
        ws.getCell(`${cm.clean}${r}`).numFmt = '#,##0';
        ws.getCell(`${cm.total}${r}`).numFmt = '#,##0';
        if (item.type !== 'task') {
          ws.getCell(`${cm.clean}${r}`).font = { bold: true };
          ws.getCell(`${cm.total}${r}`).font = { bold: true };
        }
      });

      // Стили фиксированных колонок
      for (let c = 1; c <= 5; c++) {
        ws.getCell(r, c).border = borderThin;
      }
      if (item.type !== 'task') {
        ws.getCell(r, 1).font = { bold: true };
      }

      rowIndexMap.set(item.id, r);
      r++;

      if (hasChildren) {
        writeRows(items, item.id);
      }
    });
  }

  // Нужно правильно построить дерево
  // Найдём корни
  const roots = rows.filter((row) => !row.parentId);
  function buildTree(parents) {
    parents.forEach((p) => {
      writeRows([p]);
      const children = rows.filter((r) => r.parentId === p.id);
      if (children.length) buildTree(children);
    });
  }
  buildTree(roots);

  // ===== ШИРИНЫ КОЛОНОК =====
  ws.columns = [
    { width: 25 }, // A
    { width: 25 }, // B
    { width: 20 }, // C
    { width: 20 }, // D
    { width: 12 }, // E
    ...workTypes.flatMap(() => [
      { width: 12 }, // чистая
      { width: 10 }, // риск
      { width: 12 }, // итого
    ]),
  ];

  // ===== ЛИСТ "СТАВКИ" =====
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

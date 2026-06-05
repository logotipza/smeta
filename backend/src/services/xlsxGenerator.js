const ExcelJS = require('exceljs');

const borderThin = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};

async function generate(data = {}, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(options.sheetName || 'Смета');

  const {
    title = 'СМЕТА НА РАЗРАБОТКУ ПО',
    projectName = '',
    author = '',
    customer = '',
    date = new Date().toLocaleDateString('ru-RU'),
    rows = [],
  } = data;

  let r = 1;

  // Шапка документа
  ws.mergeCells(`A${r}:G${r}`);
  ws.getCell(`A${r}`).value = title;
  ws.getCell(`A${r}`).font = { bold: true, size: 14 };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center' };
  r += 2;

  ws.getCell(`A${r}`).value = 'Проект:';
  ws.getCell(`B${r}`).value = projectName;
  ws.getCell(`A${r}`).font = { bold: true };
  r++;

  ws.getCell(`A${r}`).value = 'Автор:';
  ws.getCell(`B${r}`).value = author;
  ws.getCell(`A${r}`).font = { bold: true };
  r++;

  ws.getCell(`A${r}`).value = 'Заказчик:';
  ws.getCell(`B${r}`).value = customer;
  ws.getCell(`A${r}`).font = { bold: true };
  r++;

  ws.getCell(`A${r}`).value = 'Дата:';
  ws.getCell(`B${r}`).value = date;
  ws.getCell(`A${r}`).font = { bold: true };
  r += 2;

  // Заголовки таблицы
  const headers = ['Уровень', 'Вид работы', 'Исполнитель', 'Наименование', 'Часы', 'Ставка', 'Сумма'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.border = borderThin;
  });
  const headerRow = r;
  r++;

  // Индекс для формул итогов
  const rowIndexMap = new Map(); // id -> excel row number

  function addRows(items, level = 0) {
    items.forEach((item) => {
      const indent = '  '.repeat(level);
      ws.getCell(r, 1).value = level + 1;
      ws.getCell(r, 2).value = item.workType || '';
      ws.getCell(r, 3).value = item.role || '';
      ws.getCell(r, 4).value = indent + (item.name || '');
      ws.getCell(r, 5).value = item.hours || 0;
      ws.getCell(r, 6).value = item.rate || 0;

      const hasChildren = Array.isArray(item.children) && item.children.length > 0;

      if (hasChildren) {
        // Для родительских строк сумма = сумма детей (формула)
        ws.getCell(r, 7).value = { formula: `SUM(G${r + 1}:G${r + countDescendants(item.children)})` };
        ws.getCell(r, 5).value = { formula: `SUM(E${r + 1}:E${r + countDescendants(item.children)})` };
      } else {
        ws.getCell(r, 7).value = (item.hours || 0) * (item.rate || 0);
      }

      // Стили
      for (let c = 1; c <= 7; c++) {
        ws.getCell(r, c).border = borderThin;
      }
      ws.getCell(r, 5).numFmt = '#,##0.00';
      ws.getCell(r, 6).numFmt = '#,##0.00';
      ws.getCell(r, 7).numFmt = '#,##0.00';

      if (hasChildren) {
        ws.getRow(r).font = { bold: true };
        ws.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      }

      rowIndexMap.set(item.id, r);
      r++;

      if (hasChildren) {
        addRows(item.children, level + 1);
      }
    });
  }

  function countDescendants(items) {
    let count = 0;
    items.forEach((item) => {
      count++;
      if (item.children && item.children.length) {
        count += countDescendants(item.children);
      }
    });
    return count;
  }

  const dataStartRow = r;
  addRows(rows, 0);
  const dataEndRow = r - 1;

  // Общий итог
  if (dataStartRow <= dataEndRow) {
    r++;
    ws.mergeCells(`A${r}:F${r}`);
    ws.getCell(`A${r}`).value = 'ИТОГО ПО СМЕТЕ:';
    ws.getCell(`A${r}`).font = { bold: true, size: 12 };
    ws.getCell(`A${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`A${r}`).border = borderThin;
    ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

    // Итог = сумма всех строк верхнего уровня (тех у кого нет родителя)
    const topLevelIds = rows.map((i) => i.id);
    const topLevelRows = topLevelIds.map((id) => rowIndexMap.get(id)).filter(Boolean);
    if (topLevelRows.length > 0) {
      ws.getCell(`G${r}`).value = { formula: `SUM(${topLevelRows.map((n) => `G${n}`).join('+')})` };
      ws.getCell(`E${r}`).value = { formula: `SUM(${topLevelRows.map((n) => `E${n}`).join('+')})` };
    } else {
      ws.getCell(`G${r}`).value = 0;
      ws.getCell(`E${r}`).value = 0;
    }
    ws.getCell(`G${r}`).font = { bold: true, size: 12 };
    ws.getCell(`G${r}`).numFmt = '#,##0.00';
    ws.getCell(`G${r}`).border = borderThin;
    ws.getCell(`G${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    ws.getCell(`E${r}`).font = { bold: true, size: 12 };
    ws.getCell(`E${r}`).numFmt = '#,##0.00';
    ws.getCell(`E${r}`).border = borderThin;
    ws.getCell(`E${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  }

  // Ширины колонок
  ws.columns = [
    { width: 10 },
    { width: 18 },
    { width: 20 },
    { width: 50 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generate };

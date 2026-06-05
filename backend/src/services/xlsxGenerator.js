const ExcelJS = require('exceljs');

async function generate(data = {}, options = {}) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(options.sheetName || 'Смета');

  const {
    title = 'СМЕТА НА РЕМОНТНО-СТРОИТЕЛЬНЫЕ РАБОТЫ',
    objectName = '',
    customer = '',
    contractor = '',
    date = new Date().toLocaleDateString('ru-RU'),
    sections = [],
  } = data;

  // ===== СТИЛИ =====
  const borderThin = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  };

  let row = 1;

  // Шапка
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`A${row}`).value = title;
  ws.getCell(`A${row}`).font = { bold: true, size: 14 };
  ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
  row += 2;

  ws.getCell(`A${row}`).value = 'Объект:';
  ws.getCell(`B${row}`).value = objectName;
  ws.getCell(`A${row}`).font = { bold: true };
  row++;

  ws.getCell(`A${row}`).value = 'Заказчик:';
  ws.getCell(`B${row}`).value = customer;
  ws.getCell(`A${row}`).font = { bold: true };
  row++;

  ws.getCell(`A${row}`).value = 'Подрядчик:';
  ws.getCell(`B${row}`).value = contractor;
  ws.getCell(`A${row}`).font = { bold: true };
  row++;

  ws.getCell(`A${row}`).value = 'Дата:';
  ws.getCell(`B${row}`).value = date;
  ws.getCell(`A${row}`).font = { bold: true };
  row += 2;

  // Заголовки таблицы
  const headers = ['№ п/п', 'Наименование работ / материалов', 'Ед. изм.', 'Кол-во', 'Цена за ед.', 'Сумма'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.border = borderThin;
  });
  row++;

  let totalFormulaParts = [];
  let lineNum = 1;

  (sections || []).forEach((section) => {
    // Название раздела
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`A${row}`).value = section.name || 'Раздел';
    ws.getCell(`A${row}`).font = { bold: true, size: 11 };
    ws.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    ws.getCell(`A${row}`).border = borderThin;
    const sectionRow = row;
    row++;

    const startRow = row;
    (section.items || []).forEach((item) => {
      const sum = (item.quantity || 0) * (item.price || 0);
      ws.getCell(row, 1).value = lineNum++;
      ws.getCell(row, 2).value = item.name || '';
      ws.getCell(row, 3).value = item.unit || '';
      ws.getCell(row, 4).value = item.quantity || 0;
      ws.getCell(row, 5).value = item.price || 0;
      ws.getCell(row, 6).value = sum;

      for (let c = 1; c <= 6; c++) {
        ws.getCell(row, c).border = borderThin;
        if (c >= 4) {
          ws.getCell(row, c).numFmt = '#,##0.00';
        }
      }
      row++;
    });

    // Итог по разделу
    const endRow = row - 1;
    ws.mergeCells(`A${row}:E${row}`);
    ws.getCell(`A${row}`).value = `Итого по разделу «${section.name}»:`;
    ws.getCell(`A${row}`).font = { bold: true };
    ws.getCell(`A${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(`A${row}`).border = borderThin;

    if (startRow <= endRow) {
      ws.getCell(`F${row}`).value = { formula: `SUM(F${startRow}:F${endRow})` };
    } else {
      ws.getCell(`F${row}`).value = 0;
    }
    ws.getCell(`F${row}`).font = { bold: true };
    ws.getCell(`F${row}`).numFmt = '#,##0.00';
    ws.getCell(`F${row}`).border = borderThin;
    totalFormulaParts.push(`F${row}`);
    row++;
  });

  // Общий итог
  row++;
  ws.mergeCells(`A${row}:E${row}`);
  ws.getCell(`A${row}`).value = 'ИТОГО ПО СМЕТЕ:';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.getCell(`A${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getCell(`A${row}`).border = borderThin;
  ws.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

  if (totalFormulaParts.length > 0) {
    ws.getCell(`F${row}`).value = { formula: totalFormulaParts.join('+') };
  } else {
    ws.getCell(`F${row}`).value = 0;
  }
  ws.getCell(`F${row}`).font = { bold: true, size: 12 };
  ws.getCell(`F${row}`).numFmt = '#,##0.00';
  ws.getCell(`F${row}`).border = borderThin;
  ws.getCell(`F${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

  // Ширины колонок
  ws.columns = [
    { width: 8 },
    { width: 50 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generate };

const ExcelJS = require('exceljs');

async function generate(data = [], options = {}) {
  const workbook = new ExcelJS.Workbook();

  // Создаём лист "Смета"
  const worksheet = workbook.addWorksheet(options.sheetName || 'Смета');

  // Заголовки по умолчанию (будут переопределены под реальный шаблон)
  worksheet.columns = [
    { header: '№ п/п', key: 'num', width: 8 },
    { header: 'Наименование работ', key: 'name', width: 40 },
    { header: 'Ед. изм.', key: 'unit', width: 10 },
    { header: 'Кол-во', key: 'quantity', width: 10 },
    { header: 'Цена за ед.', key: 'price', width: 15 },
    { header: 'Сумма', key: 'total', width: 15 },
  ];

  // Стили заголовков
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Заполняем данные
  (data || []).forEach((item, index) => {
    const row = worksheet.addRow({
      num: index + 1,
      name: item.name || '',
      unit: item.unit || '',
      quantity: item.quantity || 0,
      price: item.price || 0,
      total: (item.quantity || 0) * (item.price || 0),
    });

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Итоговая строка
  const lastRow = worksheet.rowCount + 1;
  worksheet.mergeCells(`A${lastRow}:E${lastRow}`);
  worksheet.getCell(`A${lastRow}`).value = 'ИТОГО:';
  worksheet.getCell(`A${lastRow}`).font = { bold: true };
  worksheet.getCell(`A${lastRow}`).alignment = { horizontal: 'right' };

  // Формула суммы
  const totalFormula = `SUM(F2:F${lastRow - 1})`;
  worksheet.getCell(`F${lastRow}`).value = { formula: totalFormula };
  worksheet.getCell(`F${lastRow}`).font = { bold: true };
  worksheet.getCell(`F${lastRow}`).border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generate };

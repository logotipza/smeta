import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function AutoResizeTextarea({ value, onChange, placeholder, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      rows={1}
    />
  );
}

export default function SmetaPage() {
  const [rates, setRates] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [newWorkTypeName, setNewWorkTypeName] = useState('');
  const [workTypeError, setWorkTypeError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/rates`)
      .then((r) => r.json())
      .then(setRates)
      .catch(console.error);
  }, []);

  const addWorkType = () => {
    const name = newWorkTypeName.trim();
    if (!name) {
      setWorkTypeError(true);
      return;
    }
    setWorkTypeError(false);
    setWorkTypes([...workTypes, { id: genId(), name, specialistId: '', globalRisk: 1 }]);
    setNewWorkTypeName('');
  };

  const updateWorkType = (id, patch) => {
    setWorkTypes(workTypes.map((wt) => (wt.id === id ? { ...wt, ...patch } : wt)));
  };

  const removeWorkType = (id) => {
    setWorkTypes(workTypes.filter((wt) => wt.id !== id));
    setRows(rows.map((row) => {
      const estimates = { ...row.estimates };
      delete estimates[id];
      return { ...row, estimates };
    }));
  };

  const moveWorkType = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= workTypes.length) return;
    const newTypes = [...workTypes];
    [newTypes[index], newTypes[newIndex]] = [newTypes[newIndex], newTypes[index]];
    setWorkTypes(newTypes);
  };

  const addRow = () => {
    setRows([...rows, { id: genId(), name: '', estimates: {} }]);
  };

  const updateRowName = (id, name) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const updateEstimate = (rowId, wtId, field, value) => {
    setRows(rows.map((r) => {
      if (r.id !== rowId) return r;
      const current = r.estimates?.[wtId] || { clean: 0, risk: 1 };
      return {
        ...r,
        estimates: {
          ...r.estimates,
          [wtId]: { ...current, [field]: Number(value) || (field === 'risk' ? 1 : 0) },
        },
      };
    }));
  };

  const removeRow = (id) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const calcTotal = (clean, rowRisk, globalRisk) => {
    const r = (!rowRisk || rowRisk === 0) ? 1 : rowRisk;
    const g = (!globalRisk || globalRisk === 0) ? 1 : globalRisk;
    return Math.ceil((clean || 0) * r * g);
  };

  const getSpecialistName = (id) => rates.find((r) => r.id === id)?.role || '—';

  const colAddr = (idx) => {
    let s = '';
    let n = idx;
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  };

  const exportToXlsx = () => {
    if (workTypes.length === 0) return;

    const COLS_PER_WT = 4; // Чист, Риск, Итого, Стоимость
    const wb = XLSX.utils.book_new();
    const data = [];

    // Row 1: Work type names
    const h1 = ['Задача'];
    workTypes.forEach((wt) => h1.push(wt.name, '', '', ''));
    data.push(h1);

    // Row 2: Specialist
    const h2 = ['Специалист'];
    workTypes.forEach((wt) => h2.push(getSpecialistName(wt.specialistId), '', '', ''));
    data.push(h2);

    // Row 3: Rate
    const h3 = ['Ставка'];
    workTypes.forEach((wt) => {
      const rate = rates.find((r) => r.id === wt.specialistId)?.rate || 0;
      h3.push(rate, '', '', '');
    });
    data.push(h3);

    // Row 4: Global risk
    const h4 = ['Общий риск'];
    workTypes.forEach((wt) => h4.push(wt.globalRisk, '', '', ''));
    data.push(h4);

    // Row 5: Sub-headers + row totals
    const h5 = ['Название'];
    workTypes.forEach(() => h5.push('Чист', 'Риск', 'Итого', 'Стоимость'));
    h5.push('Всего часов', 'Всего стоимость');
    data.push(h5);

    // Data rows with placeholders for formula columns
    rows.forEach((row) => {
      const r = [row.name];
      workTypes.forEach((wt) => {
        const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
        r.push(est.clean ?? 0, est.risk ?? 1, '', '');
      });
      r.push('', ''); // row total placeholders
      data.push(r);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    const firstDataRow = 6; // 1-based
    const rateRow = 3;
    const globalRiskRow = 4;
    const totalsRow = firstDataRow + rows.length;

    // Pre-compute total/cost column addresses
    const totalCols = [];
    const costCols = [];
    workTypes.forEach((_, wtIdx) => {
      const colStart = 1 + wtIdx * COLS_PER_WT;
      totalCols.push(colAddr(colStart + 2));
      costCols.push(colAddr(colStart + 3));
    });
    const totalHoursCol = colAddr(1 + workTypes.length * COLS_PER_WT);
    const totalCostCol = colAddr(2 + workTypes.length * COLS_PER_WT);

    // Add formulas for each data row
    rows.forEach((_, rowIdx) => {
      const excelRow = firstDataRow + rowIdx;

      workTypes.forEach((_, wtIdx) => {
        const colStart = 1 + wtIdx * COLS_PER_WT;
        const cleanCol = colAddr(colStart);
        const riskCol = colAddr(colStart + 1);
        const totalCol = totalCols[wtIdx];
        const costCol = costCols[wtIdx];
        const rateCol = colAddr(colStart);
        const globalRiskCol = colAddr(colStart);

        ws[`${totalCol}${excelRow}`] = {
          t: 'n',
          f: `=ROUNDUP(${cleanCol}${excelRow}*${riskCol}${excelRow}*${globalRiskCol}$${globalRiskRow},0)`,
          v: 0,
        };
        ws[`${costCol}${excelRow}`] = {
          t: 'n',
          f: `=${totalCol}${excelRow}*${rateCol}$${rateRow}`,
          v: 0,
        };
      });

      // Row totals: sum individual total/cost cells
      ws[`${totalHoursCol}${excelRow}`] = {
        t: 'n',
        f: '=' + totalCols.map((c) => `${c}${excelRow}`).join('+'),
        v: 0,
      };
      ws[`${totalCostCol}${excelRow}`] = {
        t: 'n',
        f: '=' + costCols.map((c) => `${c}${excelRow}`).join('+'),
        v: 0,
      };
    });

    // Totals row
    const t = ['ИТОГО'];
    workTypes.forEach((_, wtIdx) => {
      const totalCol = totalCols[wtIdx];
      const costCol = costCols[wtIdx];
      t.push('', '',
        { t: 'n', f: `=SUM(${totalCol}${firstDataRow}:${totalCol}${totalsRow - 1})`, v: 0 },
        { t: 'n', f: `=SUM(${costCol}${firstDataRow}:${costCol}${totalsRow - 1})`, v: 0 }
      );
    });
    t.push(
      { t: 'n', f: `=SUM(${totalHoursCol}${firstDataRow}:${totalHoursCol}${totalsRow - 1})`, v: 0 },
      { t: 'n', f: `=SUM(${totalCostCol}${firstDataRow}:${totalCostCol}${totalsRow - 1})`, v: 0 }
    );
    XLSX.utils.sheet_add_aoa(ws, [t], { origin: { r: totalsRow - 1, c: 0 } });

    // Merges
    const merges = [];
    workTypes.forEach((_, wtIdx) => {
      const colStart = 1 + wtIdx * COLS_PER_WT;
      merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 3 } });
      merges.push({ s: { r: 1, c: colStart }, e: { r: 1, c: colStart + 3 } });
      merges.push({ s: { r: 2, c: colStart }, e: { r: 2, c: colStart + 3 } });
      merges.push({ s: { r: 3, c: colStart }, e: { r: 3, c: colStart + 3 } });
    });
    ws['!merges'] = merges;

    // Column widths
    const cols = [{ wch: 30 }];
    workTypes.forEach(() => {
      cols.push({ wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 });
    });
    cols.push({ wch: 12 }, { wch: 14 });
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, 'Смета');
    XLSX.writeFile(wb, 'smeta.xlsx');
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-start gap-3 bg-white border rounded-lg px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={newWorkTypeName}
            onChange={(e) => { setNewWorkTypeName(e.target.value); setWorkTypeError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && addWorkType()}
            className={`border rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 transition ${workTypeError ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500'}`}
            placeholder="Новый вид работы..."
          />
          {workTypeError && (
            <span className="text-xs text-red-600 font-medium">Введите название вида работы</span>
          )}
        </div>
        <button
          onClick={addWorkType}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 transition mt-0.5"
        >
          + Вид работы
        </button>

        {workTypes.length > 0 && (
          <button
            onClick={exportToXlsx}
            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 transition mt-0.5"
          >
            📥 Выгрузить в Excel
          </button>
        )}

      </div>

      {workTypes.length === 0 && (
        <div className="bg-white border rounded-lg p-12 text-center text-gray-400">
          Добавьте первый вид работы, чтобы начать заполнять смету
        </div>
      )}

      {workTypes.length > 0 && (
        <div className="bg-white border rounded-lg overflow-x-auto overflow-y-auto max-h-[80vh] shadow-sm">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead>
              {/* Row 1: Work type names */}
              <tr className="bg-gray-100 sticky top-0 z-20">
                <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 min-w-[120px] sticky left-0 bg-gray-100 z-30">Задача</th>
                {workTypes.map((wt, idx) => (
                  <th key={wt.id} colSpan={3} className="border border-gray-300 px-1 py-1 text-center min-w-[180px]">
                    <div className="flex items-center justify-center gap-1">
                      {idx > 0 && (
                        <button onClick={() => moveWorkType(idx, -1)} className="text-gray-400 hover:text-gray-600 text-[10px]">←</button>
                      )}
                      <span className="font-bold text-gray-800 text-xs">{wt.name}</span>
                      {idx < workTypes.length - 1 && (
                        <button onClick={() => moveWorkType(idx, 1)} className="text-gray-400 hover:text-gray-600 text-[10px]">→</button>
                      )}
                      <button onClick={() => removeWorkType(wt.id)} className="text-red-400 hover:text-red-600 text-[10px] ml-0.5">✕</button>
                    </div>
                  </th>
                ))}
                <th className="border border-gray-300 w-8" />
              </tr>
              {/* Row 2: Specialist */}
              <tr className="bg-gray-50 sticky top-[28px] z-20">
                <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-500 sticky left-0 bg-gray-50 z-30">Специалист</td>
                {workTypes.map((wt) => (
                  <td key={wt.id} colSpan={3} className="border border-gray-300 px-1 py-1">
                    <select
                      value={wt.specialistId}
                      onChange={(e) => updateWorkType(wt.id, { specialistId: e.target.value })}
                      className="text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white w-full"
                    >
                      <option value="">—</option>
                      {rates.map((r) => (
                        <option key={r.id} value={r.id}>{r.role}</option>
                      ))}
                    </select>
                  </td>
                ))}
                <td className="border border-gray-300" />
              </tr>
              {/* Row 3: Global risk */}
              <tr className="bg-gray-50 sticky top-[48px] z-20">
                <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-500 sticky left-0 bg-gray-50 z-30">Общий риск</td>
                {workTypes.map((wt) => (
                  <td key={wt.id} colSpan={3} className="border border-gray-300 px-1 py-1 text-center">
                    <input
                      type="number"
                      step="0.1"
                      value={wt.globalRisk}
                      onChange={(e) => updateWorkType(wt.id, { globalRisk: Number(e.target.value) || 1 })}
                      className="w-14 text-[10px] border border-gray-300 rounded px-1 py-0.5 text-center"
                    />
                  </td>
                ))}
                <td className="border border-gray-300" />
              </tr>
              {/* Row 4: Sub-headers */}
              <tr className="bg-gray-50 sticky top-[68px] z-20">
                <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-500 font-medium sticky left-0 bg-gray-50 z-30">Название</td>
                {workTypes.map((wt) => (
                  <>
                    <td key={`${wt.id}_c`} className="border border-gray-300 px-1 py-1 text-[10px] text-gray-500 text-center font-medium w-16">Чист</td>
                    <td key={`${wt.id}_r`} className="border border-gray-300 px-1 py-1 text-[10px] text-gray-500 text-center font-medium w-14">Риск</td>
                    <td key={`${wt.id}_t`} className="border border-gray-300 px-1 py-1 text-[10px] text-gray-500 text-center font-medium w-14">Итого</td>
                  </>
                ))}
                <td className="border border-gray-300" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/30">
                  <td className="border border-gray-300 px-2 py-1 sticky left-0 bg-white z-10 align-top">
                    <AutoResizeTextarea
                      value={row.name}
                      onChange={(e) => updateRowName(row.id, e.target.value)}
                      className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none bg-transparent resize-none whitespace-normal break-words leading-tight"
                      placeholder="Название"
                    />
                  </td>
                  {workTypes.map((wt) => {
                    const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
                    const total = calcTotal(est.clean, est.risk, wt.globalRisk);
                    return (
                      <>
                        <td key={`${wt.id}_c`} className="border border-gray-300 px-1 py-1 align-top">
                          <input
                            type="number"
                            value={est.clean || ''}
                            onChange={(e) => updateEstimate(row.id, wt.id, 'clean', e.target.value)}
                            className="w-full px-1 py-0.5 text-xs text-center border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none bg-transparent h-5"
                          />
                        </td>
                        <td key={`${wt.id}_r`} className="border border-gray-300 px-1 py-1 align-top">
                          <input
                            type="number"
                            step="0.1"
                            value={est.risk || ''}
                            onChange={(e) => updateEstimate(row.id, wt.id, 'risk', e.target.value)}
                            className="w-full px-1 py-0.5 text-xs text-center border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none bg-transparent h-5"
                          />
                        </td>
                        <td key={`${wt.id}_t`} className="border border-gray-300 px-1 py-1 text-center font-medium bg-gray-50/50 text-gray-800 text-xs align-top">
                          <div className="h-5 flex items-center justify-center">{total}</div>
                        </td>
                      </>
                    );
                  })}
                  <td className="border border-gray-300 px-1 py-1 text-center align-top">
                    <button onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="border border-gray-300 px-2 py-2 sticky left-0 bg-white z-10">
                  <button
                    onClick={addRow}
                    className="bg-blue-600 text-white w-7 h-7 rounded flex items-center justify-center text-sm font-bold hover:bg-blue-700 transition shadow-sm"
                    title="Добавить строку"
                  >
                    +
                  </button>
                </td>
                {workTypes.map((wt) => (
                  <td key={`${wt.id}_empty`} colSpan={3} className="border border-gray-300" />
                ))}
                <td className="border border-gray-300" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

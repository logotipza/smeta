import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function getSubtreeIds(rows, rootId) {
  const result = [rootId];
  let i = 0;
  while (i < result.length) {
    const currentId = result[i];
    const children = rows.filter((r) => r.parentId === currentId);
    for (const child of children) {
      result.push(child.id);
    }
    i++;
  }
  return result;
}

function getLevel(rows, row) {
  let level = 0;
  let parentId = row.parentId;
  while (parentId) {
    level++;
    const parent = rows.find((r) => r.id === parentId);
    parentId = parent?.parentId || null;
  }
  return level;
}

function getVisibleRows(rows) {
  const result = [];
  for (const row of rows) {
    if (row.parentId) {
      let parentId = row.parentId;
      let visible = true;
      while (parentId) {
        const parent = rows.find((r) => r.id === parentId);
        if (!parent || !parent.isExpanded) {
          visible = false;
          break;
        }
        parentId = parent.parentId;
      }
      if (!visible) continue;
    }
    result.push(row);
  }
  return result;
}

function hasChildren(rows, rowId) {
  return rows.some((r) => r.parentId === rowId);
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
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);


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
    setRows([...rows, { id: genId(), name: '', parentId: null, isExpanded: true, estimates: {} }]);
  };

  const addChildRow = (parentId) => {
    const subtreeIds = getSubtreeIds(rows, parentId);
    const lastDescendantId = subtreeIds[subtreeIds.length - 1];
    const insertIdx = rows.findIndex((r) => r.id === lastDescendantId) + 1;
    const newRow = { id: genId(), name: '', parentId, isExpanded: true, estimates: {} };
    const newRows = [...rows];
    newRows.splice(insertIdx, 0, newRow);
    const parentIdx = newRows.findIndex((r) => r.id === parentId);
    if (parentIdx !== -1) newRows[parentIdx] = { ...newRows[parentIdx], isExpanded: true };
    setRows(newRows);
  };

  const indentRow = (rowId) => {
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx <= 0) return;
    const prevRow = rows[idx - 1];
    if (getSubtreeIds(rows, rowId).includes(prevRow.id)) return;
    const subtreeIds = getSubtreeIds(rows, rowId);
    const subtree = rows.filter((r) => subtreeIds.includes(r.id));
    const remaining = rows.filter((r) => !subtreeIds.includes(r.id));
    const insertIdx = remaining.findIndex((r) => r.id === prevRow.id) + 1;
    const newRows = [...remaining.slice(0, insertIdx), ...subtree, ...remaining.slice(insertIdx)];
    const updatedRows = newRows.map((r) => (r.id === rowId ? { ...r, parentId: prevRow.id } : r));
    setRows(updatedRows);
  };

  const outdentRow = (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row.parentId) return;
    const parent = rows.find((r) => r.id === row.parentId);
    const newParentId = parent?.parentId || null;
    const subtreeIds = getSubtreeIds(rows, rowId);
    const subtree = rows.filter((r) => subtreeIds.includes(r.id));
    const remaining = rows.filter((r) => !subtreeIds.includes(r.id));
    const parentSubtreeIds = getSubtreeIds(remaining, parent.id);
    const insertIdx = remaining.findIndex((r) => r.id === parentSubtreeIds[parentSubtreeIds.length - 1]) + 1;
    const newRows = [...remaining.slice(0, insertIdx), ...subtree, ...remaining.slice(insertIdx)];
    const updatedRows = newRows.map((r) => (r.id === rowId ? { ...r, parentId: newParentId } : r));
    setRows(updatedRows);
  };

  const toggleExpand = (rowId) => {
    setRows(rows.map((r) => (r.id === rowId ? { ...r, isExpanded: !r.isExpanded } : r)));
  };

  const updateRowName = (id, name) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const updateEstimate = (rowId, wtId, field, value) => {
    if (hasChildren(rows, rowId)) return;
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
    const subtreeIds = getSubtreeIds(rows, id);
    setRows(rows.filter((r) => !subtreeIds.includes(r.id)));
  };

  const calcTotal = (clean, rowRisk, globalRisk) => {
    const r = (!rowRisk || rowRisk === 0) ? 1 : rowRisk;
    const g = (!globalRisk || globalRisk === 0) ? 1 : globalRisk;
    return Math.ceil((clean || 0) * r * g);
  };

  const calcCellClean = (row, wt) => {
    if (hasChildren(rows, row.id)) {
      const children = rows.filter((r) => r.parentId === row.id);
      return children.reduce((sum, child) => sum + calcCellClean(child, wt), 0);
    }
    return row.estimates?.[wt.id]?.clean || 0;
  };

  const calcCellTotal = (row, wt) => {
    if (hasChildren(rows, row.id)) {
      const children = rows.filter((r) => r.parentId === row.id);
      return children.reduce((sum, child) => sum + calcCellTotal(child, wt), 0);
    }
    const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
    return calcTotal(est.clean, est.risk, wt.globalRisk);
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

    const COLS_PER_WT = 3; // Чист, Риск, Итого
    const wb = XLSX.utils.book_new();
    const data = [];

    // Row 1: Work type names
    const h1 = ['Задача'];
    workTypes.forEach((wt) => h1.push(wt.name, '', ''));
    data.push(h1);

    // Row 2: Specialist
    const h2 = ['Специалист'];
    workTypes.forEach((wt) => h2.push(getSpecialistName(wt.specialistId), '', ''));
    data.push(h2);

    // Row 3: Rate
    const h3 = ['Ставка'];
    workTypes.forEach((wt) => {
      const rate = rates.find((r) => r.id === wt.specialistId)?.rate || 0;
      h3.push(rate, '', '');
    });
    data.push(h3);

    // Row 4: Global risk
    const h4 = ['Общий риск'];
    workTypes.forEach((wt) => h4.push(wt.globalRisk, '', ''));
    data.push(h4);

    // Row 5: Sub-headers
    const h5 = ['Название'];
    workTypes.forEach(() => h5.push('Чист', 'Риск', 'Итого'));
    h5.push('Всего часов');
    data.push(h5);

    const visibleRows = getVisibleRows(rows);

    // Data rows with placeholders for formula columns
    visibleRows.forEach((row) => {
      const level = getLevel(rows, row);
      const indent = '  '.repeat(level);
      const r = [indent + row.name];
      workTypes.forEach((wt) => {
        const isParent = hasChildren(rows, row.id);
        const clean = calcCellClean(row, wt);
        const risk = isParent ? '' : (row.estimates?.[wt.id]?.risk ?? 1);
        r.push(clean, risk, '');
      });
      r.push(''); // row total placeholder
      data.push(r);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    const firstDataRow = 6; // 1-based
    const rateRow = 3;
    const globalRiskRow = 4;
    const totalsRow = firstDataRow + visibleRows.length;
    const costRow = totalsRow + 1;

    const totalCols = [];
    workTypes.forEach((_, wtIdx) => {
      const colStart = 1 + wtIdx * COLS_PER_WT;
      totalCols.push(colAddr(colStart + 2));
    });
    const rowTotalCol = colAddr(1 + workTypes.length * COLS_PER_WT);

    // Add formulas for data rows
    visibleRows.forEach((row, rowIdx) => {
      const excelRow = firstDataRow + rowIdx;
      const isParent = hasChildren(rows, row.id);

      workTypes.forEach((wt, wtIdx) => {
        const colStart = 1 + wtIdx * COLS_PER_WT;
        const cleanCol = colAddr(colStart);
        const riskCol = colAddr(colStart + 1);
        const totalCol = totalCols[wtIdx];
        const globalRiskCol = colAddr(colStart);

        if (isParent) {
          // Parent row: total is sum of children totals (static value)
          const totalVal = calcCellTotal(row, wt);
          ws[`${totalCol}${excelRow}`] = { t: 'n', v: totalVal };
        } else {
          ws[`${totalCol}${excelRow}`] = {
            t: 'n',
            f: `=ROUNDUP(${cleanCol}${excelRow}*${riskCol}${excelRow}*${globalRiskCol}$${globalRiskRow},0)`,
            v: 0,
          };
        }
      });

      ws[`${rowTotalCol}${excelRow}`] = {
        t: 'n',
        f: '=' + totalCols.map((c) => `${c}${excelRow}`).join('+'),
        v: 0,
      };
    });

    // Build list of visible row indices that are leaf rows (no children)
    const leafVisibleIndices = visibleRows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !hasChildren(rows, r.id))
      .map(({ idx }) => idx);

    // Totals row (hours) — sum only leaf rows to avoid double-counting
    const tHours = ['ИТОГО'];
    workTypes.forEach((_, wtIdx) => {
      const totalCol = totalCols[wtIdx];
      const leafRefs = leafVisibleIndices.map((idx) => `${totalCol}${firstDataRow + idx}`);
      tHours.push('', '',
        { t: 'n', f: '=' + leafRefs.join('+'), v: 0 }
      );
    });
    const rowTotalLeafRefs = leafVisibleIndices.map((idx) => `${rowTotalCol}${firstDataRow + idx}`);
    tHours.push(
      { t: 'n', f: '=' + rowTotalLeafRefs.join('+'), v: 0 }
    );
    XLSX.utils.sheet_add_aoa(ws, [tHours], { origin: { r: totalsRow - 1, c: 0 } });

    // Cost row
    const tCost = ['Стоимость'];
    workTypes.forEach((_, wtIdx) => {
      const colStart = 1 + wtIdx * COLS_PER_WT;
      const totalCol = totalCols[wtIdx];
      const rateCol = colAddr(colStart);
      tCost.push('', '',
        { t: 'n', f: `=${totalCol}${totalsRow}*${rateCol}$${rateRow}`, v: 0 }
      );
    });
    const costCells = totalCols.map((c) => `${c}${costRow}`);
    tCost.push(
      { t: 'n', f: '=' + costCells.join('+'), v: 0 }
    );
    XLSX.utils.sheet_add_aoa(ws, [tCost], { origin: { r: costRow - 1, c: 0 } });

    // Merges
    const merges = [];
    workTypes.forEach((_, wtIdx) => {
      const colStart = 1 + wtIdx * COLS_PER_WT;
      merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 2 } });
      merges.push({ s: { r: 1, c: colStart }, e: { r: 1, c: colStart + 2 } });
      merges.push({ s: { r: 2, c: colStart }, e: { r: 2, c: colStart + 2 } });
      merges.push({ s: { r: 3, c: colStart }, e: { r: 3, c: colStart + 2 } });
    });
    ws['!merges'] = merges;

    // Column widths
    const cols = [{ wch: 30 }];
    workTypes.forEach(() => {
      cols.push({ wch: 10 }, { wch: 8 }, { wch: 10 });
    });
    cols.push({ wch: 12 });
    ws['!cols'] = cols;

    // Styles: borders + wrap text for all cells; bold + gray bg for headers/totals
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

        const isHeader = R < 5;
        const isTotalRow = R === totalsRow - 1;
        const isCostRow = R === costRow - 1;
        const isSpecial = isHeader || isTotalRow || isCostRow;
        const borderStyle = isSpecial ? 'medium' : 'thin';

        ws[cellRef].s = {
          border: {
            top: { style: borderStyle, color: { rgb: '000000' } },
            bottom: { style: borderStyle, color: { rgb: '000000' } },
            left: { style: borderStyle, color: { rgb: '000000' } },
            right: { style: borderStyle, color: { rgb: '000000' } },
          },
          alignment: { vertical: 'center', wrapText: true },
          font: isSpecial ? { bold: true } : {},
          fill: isHeader ? { fgColor: { rgb: 'D1D5DB' }, patternType: 'solid' } : {},
        };
      }
    }

    // Freeze panes: lock first column + first 5 header rows
    ws['!freeze'] = {
      xSplit: 1,
      ySplit: 5,
      topLeftCell: 'B6',
      activePane: 'bottomRight',
    };

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
        <div className="flex items-center gap-6 bg-white border rounded-lg px-4 py-3 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Всего часов</span>
            <span className="text-xl font-bold text-gray-800">
              {rows.filter((r) => !hasChildren(rows, r.id)).reduce((sum, row) => {
                return sum + workTypes.reduce((wtSum, wt) => {
                  const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
                  return wtSum + calcTotal(est.clean, est.risk, wt.globalRisk);
                }, 0);
              }, 0)}
            </span>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Общая стоимость</span>
            <span className="text-xl font-bold text-green-700">
              {rows.filter((r) => !hasChildren(rows, r.id)).reduce((sum, row) => {
                return sum + workTypes.reduce((wtSum, wt) => {
                  const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
                  const hours = calcTotal(est.clean, est.risk, wt.globalRisk);
                  const rate = rates.find((r) => r.id === wt.specialistId)?.rate || 0;
                  return wtSum + hours * rate;
                }, 0);
              }, 0).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>
      )}

      {workTypes.length > 0 && (
        <div className="bg-white border rounded-lg overflow-x-auto overflow-y-auto max-h-[80vh] shadow-sm">
          <table className="w-full text-xs border-separate border-spacing-0 min-w-max">
            <thead>
              {/* Row 1: Work type names */}
              <tr className="bg-gray-100 sticky top-0 z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 min-w-[120px] sticky left-0 bg-gray-100 z-30 drop-shadow-[2px_0_4px_rgba(0,0,0,0.15)] ">Задача</th>
                {workTypes.map((wt, idx) => (
                  <th
                    key={wt.id}
                    colSpan={3}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverIdx(idx);
                    }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                      if (fromIdx === idx) return;
                      const newTypes = [...workTypes];
                      const [moved] = newTypes.splice(fromIdx, 1);
                      newTypes.splice(idx, 0, moved);
                      setWorkTypes(newTypes);
                      setDraggingIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`border border-gray-300 px-1 py-1 text-center min-w-[180px] transition-all duration-200
                      ${draggingIdx === idx ? 'opacity-40 scale-95' : ''}
                      ${dragOverIdx === idx && draggingIdx !== idx ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : ''}
                    `}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingIdx(idx);
                        }}
                        onDragEnd={() => {
                          setDraggingIdx(null);
                          setDragOverIdx(null);
                        }}
                        className="cursor-grab text-gray-400 hover:text-gray-600 select-none px-1 text-xs leading-none"
                        title="Перетащить"
                      >
                        &#x2630;
                      </span>
                      {idx > 0 && (
                        <button onClick={() => moveWorkType(idx, -1)} className="text-gray-400 hover:text-gray-600 text-[10px]">←</button>
                      )}
                      <input
                        type="text"
                        value={wt.name}
                        onChange={(e) => updateWorkType(wt.id, { name: e.target.value })}
                        className="font-bold text-gray-800 text-xs bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 py-0.5 text-center outline-none w-24"
                      />
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
              <tr className="bg-gray-50 sticky top-[28px] z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-500 sticky left-0 bg-gray-50 z-30 drop-shadow-[2px_0_4px_rgba(0,0,0,0.15)] ">Специалист</td>
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
              <tr className="bg-gray-50 sticky top-[48px] z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-500 sticky left-0 bg-gray-50 z-30 drop-shadow-[2px_0_4px_rgba(0,0,0,0.15)] ">Общий риск</td>
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
              <tr className="bg-gray-50 sticky top-[68px] z-20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                <td className="border border-gray-300 px-2 py-1 text-[10px] text-gray-500 font-medium sticky left-0 bg-gray-50 z-30 drop-shadow-[2px_0_4px_rgba(0,0,0,0.15)] ">Название</td>
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
              {getVisibleRows(rows).map((row) => {
                const level = getLevel(rows, row);
                const isParent = hasChildren(rows, row.id);
                return (
                  <tr key={row.id} className="hover:bg-blue-50/30">
                    <td className="border border-gray-300 px-2 py-1 sticky left-0 bg-white z-10 align-top drop-shadow-[2px_0_4px_rgba(0,0,0,0.15)] ">
                      <div className="flex items-start gap-1">
                        <span className="text-gray-300 select-none text-xs leading-none mt-1">&#x2630;</span>
                        {isParent ? (
                          <button
                            onClick={() => toggleExpand(row.id)}
                            className="text-gray-500 hover:text-gray-700 text-xs mt-0.5 w-3 text-left"
                          >
                            {row.isExpanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}
                        <div className="flex-1" style={{ paddingLeft: level * 12 }}>
                          <AutoResizeTextarea
                            value={row.name}
                            onChange={(e) => updateRowName(row.id, e.target.value)}
                            className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none bg-transparent resize-none whitespace-normal break-words leading-tight"
                            placeholder="Название"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 pl-7">
                        <button onClick={() => indentRow(row.id)} className="text-[10px] text-gray-400 hover:text-gray-600" title="Вложить">→</button>
                        <button onClick={() => outdentRow(row.id)} className="text-[10px] text-gray-400 hover:text-gray-600" title="Поднять">←</button>
                        <button onClick={() => addChildRow(row.id)} className="text-[10px] text-blue-400 hover:text-blue-600" title="Добавить подзадачу">+подзадача</button>
                      </div>
                    </td>
                    {workTypes.map((wt) => {
                      const clean = calcCellClean(row, wt);
                      const total = calcCellTotal(row, wt);
                      const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
                      return (
                        <>
                          <td key={`${wt.id}_c`} className="border border-gray-300 px-1 py-1 align-top">
                            {isParent ? (
                              <div className="h-5 flex items-center justify-center text-xs text-gray-600 font-medium">{clean || ''}</div>
                            ) : (
                              <input
                                type="number"
                                value={est.clean || ''}
                                onChange={(e) => updateEstimate(row.id, wt.id, 'clean', e.target.value)}
                                className="w-full px-1 py-0.5 text-xs text-center border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none bg-transparent h-5"
                              />
                            )}
                          </td>
                          <td key={`${wt.id}_r`} className="border border-gray-300 px-1 py-1 align-top">
                            {isParent ? (
                              <div className="h-5 flex items-center justify-center text-xs text-gray-400">—</div>
                            ) : (
                              <input
                                type="number"
                                step="0.1"
                                value={est.risk || ''}
                                onChange={(e) => updateEstimate(row.id, wt.id, 'risk', e.target.value)}
                                className="w-full px-1 py-0.5 text-xs text-center border border-transparent hover:border-gray-300 focus:border-blue-500 rounded outline-none bg-transparent h-5"
                              />
                            )}
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
                );
              })}
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

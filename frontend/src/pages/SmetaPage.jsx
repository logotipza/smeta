import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SmetaPage() {
  const [rates, setRates] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [newWorkTypeName, setNewWorkTypeName] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/rates`)
      .then((r) => r.json())
      .then(setRates)
      .catch(console.error);
  }, []);

  const addWorkType = () => {
    const name = newWorkTypeName.trim();
    if (!name) return;
    setWorkTypes([
      ...workTypes,
      { id: genId(), name, specialistId: '', globalRisk: 1 },
    ]);
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
      return {
        ...r,
        estimates: {
          ...r.estimates,
          [wtId]: { ...r.estimates?.[wtId], [field]: Number(value) || 0 },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Смета</h2>
      </div>

      {/* Добавление вида работы */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Добавить вид работы</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Название вида работы</label>
            <input
              type="text"
              value={newWorkTypeName}
              onChange={(e) => setNewWorkTypeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWorkType()}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="например, Аналитика"
            />
          </div>
          <button
            onClick={addWorkType}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
          >
            Добавить
          </button>
        </div>
      </div>

      {/* Таблица сметы */}
      {workTypes.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                    Задача
                  </th>
                  {workTypes.map((wt, idx) => (
                    <th key={wt.id} className="px-2 py-3 text-center min-w-[280px]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          {idx > 0 && (
                            <button onClick={() => moveWorkType(idx, -1)} className="text-gray-400 hover:text-gray-600">←</button>
                          )}
                          <span className="text-sm font-bold text-gray-900">{wt.name}</span>
                          {idx < workTypes.length - 1 && (
                            <button onClick={() => moveWorkType(idx, 1)} className="text-gray-400 hover:text-gray-600">→</button>
                          )}
                          <button onClick={() => removeWorkType(wt.id)} className="text-red-400 hover:text-red-600 ml-1 text-xs">✕</button>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={wt.specialistId}
                            onChange={(e) => updateWorkType(wt.id, { specialistId: e.target.value })}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">— Специалист —</option>
                            {rates.map((r) => (
                              <option key={r.id} value={r.id}>{r.role} ({r.rate}₽/ч)</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Риск:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={wt.globalRisk}
                              onChange={(e) => updateWorkType(wt.id, { globalRisk: Number(e.target.value) || 1 })}
                              className="w-14 text-xs border border-gray-300 rounded px-1 py-1 text-center"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs text-gray-500 uppercase">
                          <span>Чистая</span>
                          <span>Риск</span>
                          <span>Итого</span>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center w-20"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 sticky left-0 bg-white z-10">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRowName(row.id, e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Название задачи"
                      />
                    </td>
                    {workTypes.map((wt) => {
                      const est = row.estimates?.[wt.id] || { clean: 0, risk: 1 };
                      const total = calcTotal(est.clean, est.risk, wt.globalRisk);
                      return (
                        <td key={wt.id} className="px-2 py-3">
                          <div className="grid grid-cols-3 gap-1">
                            <input
                              type="number"
                              value={est.clean}
                              onChange={(e) => updateEstimate(row.id, wt.id, 'clean', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                            />
                            <input
                              type="number"
                              step="0.1"
                              value={est.risk}
                              onChange={(e) => updateEstimate(row.id, wt.id, 'risk', e.target.value || '1')}
                              className="border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="1"
                            />
                            <div className="flex items-center justify-center bg-gray-100 rounded text-sm font-medium text-gray-900">
                              {total}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={workTypes.length + 2} className="px-6 py-8 text-center text-gray-500 text-sm">
                      Нет строк. Нажмите «Добавить строку» ниже.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t">
            <button
              onClick={addRow}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition"
            >
              + Добавить строку
            </button>
          </div>
        </div>
      )}

      {workTypes.length === 0 && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg">Смета пуста</p>
          <p className="text-gray-400 text-sm mt-1">Добавьте первый вид работы, чтобы начать</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import RatesPage from './RatesPage.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function genId() { return Math.random().toString(36).slice(2, 9); }

const defaultWorkTypes = [
  { id: 'analytics', name: 'Аналитика', type: 'input' },
  { id: 'design', name: 'Дизайн', type: 'input' },
  { id: 'backend', name: 'Backend', type: 'input' },
  { id: 'frontend', name: 'Frontend', type: 'input' },
  { id: 'mobile', name: 'Mobile', type: 'input' },
  { id: 'testing', name: 'Тестирование', type: 'auto', autoSource: 'dev_totals' },
  { id: 'management', name: 'Управление', type: 'auto', autoSource: 'all_clean' },
];

const defaultSettings = {
  projectName: 'Мобильное приложение',
  author: 'Иванов А.П.',
  customer: 'ООО "Клиент"',
  date: new Date().toISOString().split('T')[0],
  applyGlobalRisk: true,
  riskCoeffs: { analytics: 1.5, design: 1.3, backend: 1.3, frontend: 1.3, mobile: 1.3, testing: 1.3, management: 1.0 },
  devToTestCoeff: 0.2,
  workToMgmtCoeff: 0.2,
  specialists: { analytics: 'Аналитик M', design: 'Дизайнер M', backend: 'Backend-разработчик M', frontend: 'Frontend-разработчик M', mobile: 'iOS-разработчик M', testing: 'Инженер по тестированию M', management: 'Менеджер проекта M' },
  salePrices: { analytics: 3500, design: 3500, backend: 3500, frontend: 3500, mobile: 3500, testing: 3500, management: 3500 },
};

const defaultRows = [
  { id: genId(), name: 'Аналитика и проектирование', indent: 0, estimates: { analytics: { clean: 40, riskCoeff: 0 } } },
  { id: genId(), name: 'Сбор требований', indent: 1, estimates: { analytics: { clean: 16, riskCoeff: 0 } } },
  { id: genId(), name: 'Прототипирование', indent: 1, estimates: { analytics: { clean: 24, riskCoeff: 0 } } },
  { id: genId(), name: 'Разработка', indent: 0, estimates: {} },
  { id: genId(), name: 'Backend API', indent: 1, estimates: { backend: { clean: 80, riskCoeff: 1.2 } } },
  { id: genId(), name: 'Frontend интерфейс', indent: 1, estimates: { frontend: { clean: 64, riskCoeff: 0 } } },
  { id: genId(), name: 'Экран авторизации', indent: 2, estimates: { frontend: { clean: 16, riskCoeff: 0 } } },
  { id: genId(), name: 'Экран каталога', indent: 2, estimates: { frontend: { clean: 24, riskCoeff: 0 } } },
];

function App() {
  const [page, setPage] = useState('smeta');
  const [workTypes, setWorkTypes] = useState(defaultWorkTypes);
  const [settings, setSettings] = useState(defaultSettings);
  const [rows, setRows] = useState(defaultRows);
  const [rates, setRates] = useState([]);
  const [calculated, setCalculated] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/rates`)
      .then((r) => r.json())
      .then((d) => setRates(d || []))
      .catch(console.error);
  }, []);

  const recalc = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/smeta/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, settings, workTypes }),
      });
      const data = await res.json();
      setCalculated(data);
    } catch (e) { console.error(e); }
  }, [rows, settings, workTypes]);

  useEffect(() => {
    recalc();
  }, [recalc]);

  const updateSetting = (path, value) => {
    setSettings((prev) => {
      const keys = path.split('.');
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const addWorkType = () => {
    const id = 'wt_' + genId();
    setWorkTypes([...workTypes, { id, name: 'Новый вид', type: 'input' }]);
  };
  const updateWorkType = (id, patch) => setWorkTypes(workTypes.map((wt) => (wt.id === id ? { ...wt, ...patch } : wt)));
  const removeWorkType = (id) => {
    if (['testing', 'management'].includes(id)) return;
    setWorkTypes(workTypes.filter((wt) => wt.id !== id));
  };

  const addRow = (afterIndex) => {
    const indent = afterIndex >= 0 ? (rows[afterIndex]?.indent || 0) : 0;
    const newRow = { id: genId(), name: '', indent, estimates: {} };
    if (afterIndex >= 0) {
      const newRows = [...rows];
      newRows.splice(afterIndex + 1, 0, newRow);
      setRows(newRows);
    } else {
      setRows([...rows, newRow]);
    }
  };

  const removeRow = (index) => {
    const toRemove = new Set();
    const id = rows[index].id;
    toRemove.add(id);

    // Находим всех потомков
    function findDescendants(parentId) {
      rows.forEach((r, i) => {
        if (r.id === parentId) {
          const parentIndent = r.indent || 0;
          // Все строки ниже с большим indent
          for (let j = i + 1; j < rows.length; j++) {
            if ((rows[j].indent || 0) > parentIndent) {
              toRemove.add(rows[j].id);
            } else {
              break;
            }
          }
        }
      });
    }
    findDescendants(id);

    setRows(rows.filter((r) => !toRemove.has(r.id)));
  };

  const indentRow = (index) => {
    if (index <= 0) return;
    const prevIndent = rows[index - 1]?.indent || 0;
    const currentIndent = rows[index].indent || 0;
    if (currentIndent < prevIndent + 1) {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], indent: currentIndent + 1 };
      setRows(newRows);
    }
  };

  const outdentRow = (index) => {
    const currentIndent = rows[index].indent || 0;
    if (currentIndent > 0) {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], indent: currentIndent - 1 };
      setRows(newRows);
    }
  };

  const updateRowName = (index, name) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], name };
    setRows(newRows);
  };

  const updateEstimate = (rowIndex, wtId, patch) => {
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      estimates: {
        ...newRows[rowIndex].estimates,
        [wtId]: { ...newRows[rowIndex].estimates?.[wtId], ...patch },
      },
    };
    setRows(newRows);
  };

  const exportXlsx = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/smeta/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            ...settings,
            date: new Date(settings.date).toLocaleDateString('ru-RU'),
            rows: calculated.rows,
            totals: calculated.totals,
            workTypes,
          },
        }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smeta.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Ошибка экспорта: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculated.totals || {};

  if (page === 'rates') {
    return <RatesPage onBack={() => setPage('smeta')} />;
  }

  return (
    <div style={{ maxWidth: 1400, margin: '16px auto', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Smeta — оценка проекта</h1>
        <button onClick={() => setPage('rates')} style={btn}>📋 Справочник специалистов</button>
      </div>

      {/* НАСТРОЙКИ */}
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Настройки проекта</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <label>Проект: <input value={settings.projectName} onChange={(e) => updateSetting('projectName', e.target.value)} style={input} /></label>
          <label>Автор: <input value={settings.author} onChange={(e) => updateSetting('author', e.target.value)} style={input} /></label>
          <label>Заказчик: <input value={settings.customer} onChange={(e) => updateSetting('customer', e.target.value)} style={input} /></label>
          <label>Дата: <input type="date" value={settings.date} onChange={(e) => updateSetting('date', e.target.value)} style={input} /></label>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 12 }}>
          <label>
            <input type="checkbox" checked={settings.applyGlobalRisk} onChange={(e) => updateSetting('applyGlobalRisk', e.target.checked)} />
            Применить общий к-т риска
          </label>
          <label>К-т на разработку → тест: <input type="number" step="0.1" value={settings.devToTestCoeff} onChange={(e) => updateSetting('devToTestCoeff', Number(e.target.value))} style={{ ...input, width: 60 }} /></label>
          <label>К-т на работы → управл: <input type="number" step="0.1" value={settings.workToMgmtCoeff} onChange={(e) => updateSetting('workToMgmtCoeff', Number(e.target.value))} style={{ ...input, width: 60 }} /></label>
        </div>
      </div>

      {/* ВИДЫ РАБОТ */}
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Виды работ</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f4f8' }}>
              <th style={th}>Название</th>
              <th style={th}>Тип</th>
              <th style={th}>Общий к-т риска</th>
              <th style={th}>Специалист</th>
              <th style={th}>Цена продажи (₽/ч)</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {workTypes.map((wt) => (
              <tr key={wt.id}>
                <td style={td}><input value={wt.name} onChange={(e) => updateWorkType(wt.id, { name: e.target.value })} style={inputSmall} /></td>
                <td style={td}>
                  <select value={wt.type} onChange={(e) => updateWorkType(wt.id, { type: e.target.value })} style={inputSmall}>
                    <option value="input">Ручной ввод</option>
                    <option value="auto">Авторасчёт</option>
                  </select>
                </td>
                <td style={td}><input type="number" step="0.1" value={settings.riskCoeffs[wt.id] || 1} onChange={(e) => updateSetting(`riskCoeffs.${wt.id}`, Number(e.target.value))} style={{ ...inputSmall, width: 60 }} /></td>
                <td style={td}>
                  <select value={settings.specialists[wt.id] || ''} onChange={(e) => updateSetting(`specialists.${wt.id}`, e.target.value)} style={inputSmall}>
                    <option value="">—</option>
                    {rates.map((r) => (<option key={r.role} value={r.role}>{r.role}</option>))}
                  </select>
                </td>
                <td style={td}><input type="number" value={settings.salePrices[wt.id] || 0} onChange={(e) => updateSetting(`salePrices.${wt.id}`, Number(e.target.value))} style={{ ...inputSmall, width: 90 }} /></td>
                <td style={td}>{!['testing', 'management'].includes(wt.id) && <button onClick={() => removeWorkType(wt.id)} style={btnSmall}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addWorkType} style={{ ...btn, marginTop: 8 }}>+ Добавить вид работы</button>
      </div>

      {/* ЗАДАЧИ */}
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Смета</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f0f4f8' }}>
              <th style={th}></th>
              <th style={th}>Задача</th>
              {workTypes.map((wt) => (
                <th key={wt.id} style={th} colSpan={3}>{wt.name}</th>
              ))}
              <th style={th}></th>
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thSmall}></th>
              <th style={thSmall}></th>
              {workTypes.map((wt) => (
                <>
                  <th key={`${wt.id}_c`} style={thSmall}>чист.</th>
                  <th key={`${wt.id}_r`} style={thSmall}>риск</th>
                  <th key={`${wt.id}_t`} style={thSmall}>итого</th>
                </>
              ))}
              <th style={thSmall}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const calc = calculated.rows?.find((c) => c.id === row.id);
              const hasChildren = rows.some((r, i) => i > idx && (r.indent || 0) > (row.indent || 0) && !rows.slice(idx + 1, i).some((rr) => (rr.indent || 0) <= (row.indent || 0)));
              const isLeaf = !hasChildren;
              const indentPx = (row.indent || 0) * 20;

              return (
                <tr key={row.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => outdentRow(idx)} disabled={(row.indent || 0) === 0} style={btnSmall}>←</button>
                    <button onClick={() => indentRow(idx)} style={btnSmall}>→</button>
                  </td>
                  <td style={td}>
                    <input
                      value={row.name}
                      onChange={(e) => updateRowName(idx, e.target.value)}
                      style={{ ...inputSmall, fontWeight: isLeaf ? 'normal' : 'bold', marginLeft: indentPx, width: 220 - indentPx }}
                    />
                  </td>
                  {workTypes.map((wt) => {
                    const est = row.estimates?.[wt.id] || { clean: 0, riskCoeff: 0 };
                    const c = calc?.calculated?.[wt.id] || { clean: 0, total: 0 };
                    if (wt.type === 'input') {
                      return (
                        <>
                          <td key={`${wt.id}_c`} style={td}>
                            {isLeaf ? (
                              <input type="number" value={est.clean || 0} onChange={(e) => updateEstimate(idx, wt.id, { clean: Number(e.target.value) })} style={{ ...inputSmall, width: 55 }} />
                            ) : (
                              <span>{c.clean.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</span>
                            )}
                          </td>
                          <td key={`${wt.id}_r`} style={td}>
                            {isLeaf ? (
                              <input type="number" step="0.1" value={est.riskCoeff || 0} onChange={(e) => updateEstimate(idx, wt.id, { riskCoeff: Number(e.target.value) })} style={{ ...inputSmall, width: 45 }} />
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td key={`${wt.id}_t`} style={{ ...td, fontWeight: 'bold' }}>
                            {c.total.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <td key={`${wt.id}_c`} style={{ ...td, background: '#f8f8f8' }}>
                            {c.clean.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td key={`${wt.id}_r`} style={{ ...td, background: '#f8f8f8' }}>
                            {isLeaf ? (
                              <input type="number" step="0.1" value={est.riskCoeff || 0} onChange={(e) => updateEstimate(idx, wt.id, { riskCoeff: Number(e.target.value) })} style={{ ...inputSmall, width: 45 }} />
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td key={`${wt.id}_t`} style={{ ...td, fontWeight: 'bold', background: '#f8f8f8' }}>
                            {c.total.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                        </>
                      );
                    }
                  })}
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => addRow(idx)} style={btnSmall} title="Добавить строку ниже">+</button>
                    <button onClick={() => removeRow(idx)} style={{ ...btnSmall, color: '#c00' }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={() => addRow(-1)} style={{ ...btn, marginTop: 10 }}>+ Добавить строку</button>
      </div>

      {/* ИТОГИ */}
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Итоги</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f4f8' }}>
              <th style={th}>Показатель</th>
              {workTypes.map((wt) => (<th key={wt.id} style={th}>{wt.name}</th>))}
              <th style={th}>Всего</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Чистые часы', key: 'clean' },
              { label: 'Часы с рисками', key: 'total' },
              { label: 'Себестоимость', key: 'costPrice' },
              { label: 'Стоимость продажи', key: 'costTotal' },
              { label: 'Маржа', key: 'margin' },
            ].map((row) => (
              <tr key={row.key}>
                <td style={td}>{row.label}</td>
                {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.[row.key] || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>))}
                <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.[row.key] || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
            <tr>
              <td style={td}>R_GM</td>
              {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.rgm || 0).toLocaleString('ru-RU', { style: 'percent', minimumFractionDigits: 1 })}</td>))}
              <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.rgm || 0).toLocaleString('ru-RU', { style: 'percent', minimumFractionDigits: 1 })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button onClick={exportXlsx} disabled={loading} style={{ ...btn, background: '#007bff', color: '#fff', fontSize: 16, padding: '10px 24px' }}>
        {loading ? 'Генерация...' : '📥 Выгрузить xlsx'}
      </button>
    </div>
  );
}

const input = { width: '100%', padding: '5px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 };
const inputSmall = { width: '100%', padding: '3px 5px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 };
const th = { border: '1px solid #ccc', padding: '6px', textAlign: 'left', fontSize: 12 };
const thSmall = { border: '1px solid #ccc', padding: '4px', textAlign: 'center', fontSize: 11, background: '#f8fafc' };
const td = { border: '1px solid #ddd', padding: '5px', fontSize: 12 };
const btn = { padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 13 };
const btnSmall = { padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 12, marginRight: 2 };

export default App;

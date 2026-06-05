import { useState, useEffect, useCallback } from 'react';

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
  { id: genId(), type: 'project', name: 'Административная панель', parentId: null, estimates: {} },
  { id: genId(), type: 'epic', name: 'Авторизация', parentId: null, estimates: {} },
  { id: genId(), type: 'task', name: 'Экран входа', parentId: null, estimates: { analytics: { clean: 8, riskCoeff: 0 }, design: { clean: 12, riskCoeff: 0 }, backend: { clean: 16, riskCoeff: 1.2 }, frontend: { clean: 16, riskCoeff: 0 } } },
  { id: genId(), type: 'task', name: 'Восстановление пароля', parentId: null, estimates: { analytics: { clean: 4, riskCoeff: 0 }, design: { clean: 8, riskCoeff: 0 }, backend: { clean: 12, riskCoeff: 0 }, frontend: { clean: 12, riskCoeff: 0 } } },
];

function App() {
  const [workTypes, setWorkTypes] = useState(defaultWorkTypes);
  const [settings, setSettings] = useState(defaultSettings);
  const [rows, setRows] = useState(defaultRows);
  const [rates, setRates] = useState([]);
  const [calculated, setCalculated] = useState({ rows: [], totals: {} });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/smeta/config`)
      .then((r) => r.json())
      .then((d) => setRates(d.rateDetails || []))
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

  const updateWorkType = (id, patch) => {
    setWorkTypes(workTypes.map((wt) => (wt.id === id ? { ...wt, ...patch } : wt)));
  };

  const removeWorkType = (id) => {
    if (['testing', 'management'].includes(id)) return;
    setWorkTypes(workTypes.filter((wt) => wt.id !== id));
  };

  const addRow = (parentId = null, type = 'task') => {
    setRows([...rows, { id: genId(), type, name: '', parentId, estimates: {} }]);
  };

  const updateRow = (id, patch) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id) => {
    const toRemove = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      rows.forEach((r) => {
        if (!toRemove.has(r.id) && toRemove.has(r.parentId)) {
          toRemove.add(r.id);
          changed = true;
        }
      });
    }
    setRows(rows.filter((r) => !toRemove.has(r.id)));
  };

  const updateEstimate = (rowId, wtId, patch) => {
    setRows(rows.map((r) => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        estimates: {
          ...r.estimates,
          [wtId]: { ...r.estimates?.[wtId], ...patch },
        },
      };
    }));
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

  const flatRows = [];
  const renderTree = (parentId = null, depth = 0) => {
    const children = rows.filter((r) => r.parentId === parentId);
    children.forEach((row) => {
      const calc = calculated.rows?.find((c) => c.id === row.id);
      flatRows.push({ ...row, depth, calc });
      renderTree(row.id, depth + 1);
    });
  };
  renderTree();

  const inputTypes = workTypes.filter((wt) => wt.type === 'input');
  const autoTypes = workTypes.filter((wt) => wt.type === 'auto');
  const totals = calculated.totals || {};

  return (
    <div style={{ maxWidth: 1400, margin: '16px auto', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <h1>Smeta — оценка проекта</h1>

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
                <td style={td}>
                  <input type="number" step="0.1" value={settings.riskCoeffs[wt.id] || 1} onChange={(e) => updateSetting(`riskCoeffs.${wt.id}`, Number(e.target.value))} style={{ ...inputSmall, width: 60 }} />
                </td>
                <td style={td}>
                  <select value={settings.specialists[wt.id] || ''} onChange={(e) => updateSetting(`specialists.${wt.id}`, e.target.value)} style={inputSmall}>
                    <option value="">—</option>
                    {rates.map((r) => (<option key={r.role} value={r.role}>{r.role}</option>))}
                  </select>
                </td>
                <td style={td}>
                  <input type="number" value={settings.salePrices[wt.id] || 0} onChange={(e) => updateSetting(`salePrices.${wt.id}`, Number(e.target.value))} style={{ ...inputSmall, width: 90 }} />
                </td>
                <td style={td}>
                  {!['testing', 'management'].includes(wt.id) && (
                    <button onClick={() => removeWorkType(wt.id)} style={btnSmall}>✕</button>
                  )}
                </td>
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
              <th style={th}>Уровень</th>
              <th style={th}>Название</th>
              {workTypes.map((wt) => (
                <th key={wt.id} style={th} colSpan={wt.type === 'input' ? 3 : 2}>
                  {wt.name}
                </th>
              ))}
              <th style={th}></th>
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}></th>
              <th style={th}></th>
              {workTypes.map((wt) => (
                wt.type === 'input' ? (
                  <>
                    <th key={`${wt.id}_c`} style={thSmall}>чист.</th>
                    <th key={`${wt.id}_r`} style={thSmall}>риск</th>
                    <th key={`${wt.id}_t`} style={thSmall}>итого</th>
                  </>
                ) : (
                  <>
                    <th key={`${wt.id}_c`} style={thSmall}>чист.</th>
                    <th key={`${wt.id}_t`} style={thSmall}>итого</th>
                  </>
                )
              ))}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map((row) => {
              const isTask = row.type === 'task';
              return (
                <tr key={row.id} style={{ background: row.type === 'project' ? '#e8f4e8' : row.type === 'epic' ? '#f0f0f0' : '#fff' }}>
                  <td style={td}>{['Проект', 'Эпик', 'Задача'][row.depth] || 'Задача'}</td>
                  <td style={td}>
                    <input value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} style={{ ...inputSmall, fontWeight: row.type !== 'task' ? 'bold' : 'normal', width: 200 }} />
                  </td>
                  {workTypes.map((wt) => {
                    const est = row.estimates?.[wt.id] || { clean: 0, riskCoeff: 0 };
                    const calc = row.calc?.calculated?.[wt.id] || { clean: 0, total: 0 };
                    if (wt.type === 'input') {
                      return (
                        <>
                          <td key={`${wt.id}_c`} style={td}>
                            {isTask ? (
                              <input type="number" value={est.clean || 0} onChange={(e) => updateEstimate(row.id, wt.id, { clean: Number(e.target.value) })} style={{ ...inputSmall, width: 55 }} />
                            ) : (
                              <span>{calc.clean.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</span>
                            )}
                          </td>
                          <td key={`${wt.id}_r`} style={td}>
                            {isTask ? (
                              <input type="number" step="0.1" value={est.riskCoeff || 0} onChange={(e) => updateEstimate(row.id, wt.id, { riskCoeff: Number(e.target.value) })} style={{ ...inputSmall, width: 45 }} />
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td key={`${wt.id}_t`} style={{ ...td, fontWeight: 'bold' }}>
                            {calc.total.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <td key={`${wt.id}_c`} style={{ ...td, background: '#f8f8f8' }}>
                            {calc.clean.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td key={`${wt.id}_t`} style={{ ...td, fontWeight: 'bold', background: '#f8f8f8' }}>
                            {calc.total.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                        </>
                      );
                    }
                  })}
                  <td style={td}>
                    <button onClick={() => addRow(row.id, 'task')} style={btnSmall} title="Добавить подзадачу">+</button>
                    <button onClick={() => removeRow(row.id)} style={{ ...btnSmall, color: '#c00' }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button onClick={() => addRow(null, 'project')} style={btn}>+ Проект</button>
          <button onClick={() => addRow(null, 'epic')} style={btn}>+ Эпик</button>
          <button onClick={() => addRow(null, 'task')} style={btn}>+ Задача</button>
        </div>
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
            <tr>
              <td style={td}>Чистые часы</td>
              {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.clean || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>))}
              <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.clean || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
              <td style={td}>Часы с рисками</td>
              {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.total || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>))}
              <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.total || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
              <td style={td}>Себестоимость</td>
              {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.costPrice || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>))}
              <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.costPrice || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
              <td style={td}>Стоимость продажи</td>
              {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.costTotal || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>))}
              <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.costTotal || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
              <td style={td}>Маржа</td>
              {workTypes.map((wt) => (<td key={wt.id} style={td}>{(totals[wt.id]?.margin || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>))}
              <td style={{ ...td, fontWeight: 'bold' }}>{(totals.total?.margin || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
            </tr>
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
const btnSmall = { padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 12, marginRight: 3 };

export default App;

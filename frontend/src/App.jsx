import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function createRow(parentId = null) {
  return {
    id: generateId(),
    parentId,
    name: '',
    workType: '',
    role: '',
    hours: 0,
    rate: 0,
    children: [],
  };
}

function flattenWithDepth(rows, depth = 0) {
  const result = [];
  rows.forEach((row) => {
    result.push({ ...row, depth });
    if (row.children && row.children.length) {
      result.push(...flattenWithDepth(row.children, depth + 1));
    }
  });
  return result;
}

function updateRowInTree(rows, id, updater) {
  return rows.map((row) => {
    if (row.id === id) {
      return updater({ ...row });
    }
    if (row.children && row.children.length) {
      return { ...row, children: updateRowInTree(row.children, id, updater) };
    }
    return row;
  });
}

function addChildToRow(rows, parentId) {
  return rows.map((row) => {
    if (row.id === parentId) {
      return { ...row, children: [...row.children, createRow(parentId)] };
    }
    if (row.children && row.children.length) {
      return { ...row, children: addChildToRow(row.children, parentId) };
    }
    return row;
  });
}

function removeRowFromTree(rows, id) {
  return rows
    .filter((row) => row.id !== id)
    .map((row) => {
      if (row.children && row.children.length) {
        return { ...row, children: removeRowFromTree(row.children, id) };
      }
      return row;
    });
}

function App() {
  const [meta, setMeta] = useState({
    title: 'СМЕТА НА РАЗРАБОТКУ ПО',
    projectName: 'Мобильное приложение "Доставка"',
    author: 'Иванов А.П.',
    customer: 'ООО "Клиент"',
    date: new Date().toISOString().split('T')[0],
  });

  const [rows, setRows] = useState([
    {
      id: generateId(),
      name: 'Аналитика',
      workType: 'Аналитика',
      role: 'Аналитик',
      hours: 40,
      rate: 1900,
      children: [
        { id: generateId(), name: 'Сбор требований', workType: 'Аналитика', role: 'Аналитик', hours: 16, rate: 1900, children: [] },
        { id: generateId(), name: 'Прототипирование', workType: 'Аналитика', role: 'Аналитик', hours: 24, rate: 1900, children: [] },
      ],
    },
    {
      id: generateId(),
      name: 'Разработка iOS',
      workType: 'iOS разработка',
      role: 'iOS разработчик',
      hours: 120,
      rate: 2500,
      children: [
        { id: generateId(), name: 'Экран авторизации', workType: 'iOS разработка', role: 'iOS разработчик', hours: 24, rate: 2500, children: [] },
        { id: generateId(), name: 'Экран каталога', workType: 'iOS разработка', role: 'iOS разработчик', hours: 40, rate: 2500, children: [] },
        { id: generateId(), name: 'Корзина и оформление', workType: 'iOS разработка', role: 'iOS разработчик', hours: 56, rate: 2500, children: [] },
      ],
    },
    {
      id: generateId(),
      name: 'Тестирование',
      workType: 'Тестирование',
      role: 'Тестировщик',
      hours: 48,
      rate: 1500,
      children: [
        { id: generateId(), name: 'Функциональное тестирование', workType: 'Тестирование', role: 'Тестировщик', hours: 32, rate: 1500, children: [] },
        { id: generateId(), name: 'Регресс', workType: 'Тестирование', role: 'Тестировщик', hours: 16, rate: 1500, children: [] },
      ],
    },
  ]);

  const [dictionaries, setDictionaries] = useState({ workTypes: [], roles: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/smeta/dictionaries`)
      .then((r) => r.json())
      .then(setDictionaries)
      .catch(console.error);
  }, []);

  const updateMeta = (field, value) => setMeta({ ...meta, [field]: value });

  const updateRow = (id, patch) => {
    setRows((prev) =>
      updateRowInTree(prev, id, (row) => {
        const updated = { ...row, ...patch };
        if (patch.role !== undefined) {
          const roleObj = dictionaries.roles.find((r) => r.name === patch.role);
          updated.rate = roleObj ? roleObj.rate : row.rate;
        }
        return updated;
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, createRow()]);
  const addChild = (parentId) => setRows((prev) => addChildToRow(prev, parentId));
  const removeRow = (id) => setRows((prev) => removeRowFromTree(prev, id));

  const exportXlsx = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/smeta/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            ...meta,
            date: new Date(meta.date).toLocaleDateString('ru-RU'),
            rows,
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

  const flatRows = flattenWithDepth(rows);

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Smeta — смета разработки ПО</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <label>Проект: <input value={meta.projectName} onChange={(e) => updateMeta('projectName', e.target.value)} style={input} /></label>
        <label>Автор: <input value={meta.author} onChange={(e) => updateMeta('author', e.target.value)} style={input} /></label>
        <label>Заказчик: <input value={meta.customer} onChange={(e) => updateMeta('customer', e.target.value)} style={input} /></label>
        <label>Дата: <input type="date" value={meta.date} onChange={(e) => updateMeta('date', e.target.value)} style={input} /></label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f0f4f8' }}>
            <th style={th}>Ур.</th>
            <th style={th}>Вид работы</th>
            <th style={th}>Исполнитель</th>
            <th style={th}>Наименование</th>
            <th style={th}>Часы</th>
            <th style={th}>Ставка</th>
            <th style={th}>Сумма</th>
            <th style={th} style={{ width: 90 }}></th>
          </tr>
        </thead>
        <tbody>
          {flatRows.map((row) => {
            const isParent = row.children && row.children.length > 0;
            const sum = (row.hours || 0) * (row.rate || 0);
            return (
              <tr key={row.id} style={{ background: isParent ? '#fafafa' : '#fff' }}>
                <td style={td}>{row.depth + 1}</td>
                <td style={td}>
                  <input
                    list="workTypes"
                    value={row.workType}
                    onChange={(e) => updateRow(row.id, { workType: e.target.value })}
                    style={inputSmall}
                  />
                </td>
                <td style={td}>
                  <select
                    value={row.role}
                    onChange={(e) => updateRow(row.id, { role: e.target.value })}
                    style={inputSmall}
                  >
                    <option value="">—</option>
                    {dictionaries.roles.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} ({r.rate.toLocaleString('ru-RU')} ₽/ч)
                      </option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    style={{ ...inputSmall, fontWeight: isParent ? 'bold' : 'normal' }}
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    value={row.hours}
                    onChange={(e) => updateRow(row.id, { hours: Number(e.target.value) })}
                    style={{ ...inputSmall, width: 70, background: isParent ? '#eee' : '#fff' }}
                    disabled={isParent}
                    title={isParent ? 'Считается автоматически по дочерним строкам' : ''}
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    value={row.rate}
                    onChange={(e) => updateRow(row.id, { rate: Number(e.target.value) })}
                    style={{ ...inputSmall, width: 90 }}
                  />
                </td>
                <td style={{ ...td, fontWeight: isParent ? 'bold' : 'normal' }}>
                  {sum.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                </td>
                <td style={td}>
                  <button onClick={() => addChild(row.id)} style={btnSmall} title="Добавить подстроку">+</button>
                  <button onClick={() => removeRow(row.id)} style={{ ...btnSmall, color: '#c00' }} title="Удалить">✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <datalist id="workTypes">
        {dictionaries.workTypes.map((wt) => (
          <option key={wt} value={wt} />
        ))}
      </datalist>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={addRow} style={btn}>+ Добавить строку верхнего уровня</button>
        <button onClick={exportXlsx} disabled={loading} style={{ ...btn, background: '#007bff', color: '#fff' }}>
          {loading ? 'Генерация...' : '📥 Выгрузить xlsx'}
        </button>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14 };
const inputSmall = { width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 };
const th = { border: '1px solid #ccc', padding: '8px', textAlign: 'left', fontSize: 13 };
const td = { border: '1px solid #ddd', padding: '6px' };
const btn = { padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 14 };
const btnSmall = { padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 13, marginRight: 4 };

export default App;

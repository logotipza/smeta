import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [meta, setMeta] = useState({
    title: 'СМЕТА НА РЕМОНТНО-СТРОИТЕЛЬНЫЕ РАБОТЫ',
    objectName: 'Квартира ул. Ленина, д.10, кв.5',
    customer: 'Иванов И.И.',
    contractor: 'ООО "СтройМастер"',
    date: new Date().toISOString().split('T')[0],
  });

  const [sections, setSections] = useState([
    {
      name: 'Демонтажные работы',
      items: [
        { name: 'Демонтаж стен из ГКЛ', unit: 'м²', quantity: 12, price: 350 },
        { name: 'Демонтаж плитки', unit: 'м²', quantity: 8, price: 400 },
      ],
    },
    {
      name: 'Отделочные работы',
      items: [
        { name: 'Штукатурка стен по маякам', unit: 'м²', quantity: 25, price: 650 },
        { name: 'Шпатлевка под обои', unit: 'м²', quantity: 40, price: 320 },
        { name: 'Укладка плитки', unit: 'м²', quantity: 12, price: 1200 },
      ],
    },
  ]);

  const updateMeta = (field, value) => {
    setMeta({ ...meta, [field]: value });
  };

  const updateSectionName = (si, value) => {
    const updated = [...sections];
    updated[si].name = value;
    setSections(updated);
  };

  const updateItem = (si, ii, field, value) => {
    const updated = [...sections];
    updated[si].items[ii][field] = field === 'name' || field === 'unit' ? value : Number(value);
    setSections(updated);
  };

  const addItem = (si) => {
    const updated = [...sections];
    updated[si].items.push({ name: '', unit: '', quantity: 0, price: 0 });
    setSections(updated);
  };

  const removeItem = (si, ii) => {
    const updated = [...sections];
    updated[si].items = updated[si].items.filter((_, i) => i !== ii);
    setSections(updated);
  };

  const addSection = () => {
    setSections([...sections, { name: 'Новый раздел', items: [] }]);
  };

  const removeSection = (si) => {
    setSections(sections.filter((_, i) => i !== si));
  };

  const exportXlsx = async () => {
    try {
      const res = await fetch(`${API_URL}/api/smeta/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            ...meta,
            date: new Date(meta.date).toLocaleDateString('ru-RU'),
            sections,
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
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '32px auto', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Smeta — редактор сметы</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <label>Объект: <input value={meta.objectName} onChange={(e) => updateMeta('objectName', e.target.value)} style={input} /></label>
        <label>Заказчик: <input value={meta.customer} onChange={(e) => updateMeta('customer', e.target.value)} style={input} /></label>
        <label>Подрядчик: <input value={meta.contractor} onChange={(e) => updateMeta('contractor', e.target.value)} style={input} /></label>
        <label>Дата: <input type="date" value={meta.date} onChange={(e) => updateMeta('date', e.target.value)} style={input} /></label>
      </div>

      {sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 20, border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              value={sec.name}
              onChange={(e) => updateSectionName(si, e.target.value)}
              style={{ ...input, fontWeight: 'bold', fontSize: 16, flex: 1 }}
            />
            <button onClick={() => removeSection(si)} style={btnDanger}>Удалить раздел</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={th}>№</th>
                <th style={th}>Наименование</th>
                <th style={th}>Ед. изм.</th>
                <th style={th}>Кол-во</th>
                <th style={th}>Цена</th>
                <th style={th}>Сумма</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {sec.items.map((item, ii) => (
                <tr key={ii}>
                  <td style={td}>{ii + 1}</td>
                  <td style={td}>
                    <input value={item.name} onChange={(e) => updateItem(si, ii, 'name', e.target.value)} style={inputSmall} />
                  </td>
                  <td style={td}>
                    <input value={item.unit} onChange={(e) => updateItem(si, ii, 'unit', e.target.value)} style={{ ...inputSmall, width: 70 }} />
                  </td>
                  <td style={td}>
                    <input type="number" value={item.quantity} onChange={(e) => updateItem(si, ii, 'quantity', e.target.value)} style={{ ...inputSmall, width: 80 }} />
                  </td>
                  <td style={td}>
                    <input type="number" value={item.price} onChange={(e) => updateItem(si, ii, 'price', e.target.value)} style={{ ...inputSmall, width: 100 }} />
                  </td>
                  <td style={td}>{(item.quantity * item.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}</td>
                  <td style={td}>
                    <button onClick={() => removeItem(si, ii)} style={btnSmall}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={() => addItem(si)} style={{ ...btn, marginTop: 8 }}>+ Добавить строку</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={addSection} style={btn}>+ Добавить раздел</button>
        <button onClick={exportXlsx} style={{ ...btn, background: '#007bff', color: '#fff' }}>
          📥 Выгрузить xlsx
        </button>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 };
const inputSmall = { width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4 };
const th = { border: '1px solid #ccc', padding: '8px', textAlign: 'left', fontSize: 13 };
const td = { border: '1px solid #ddd', padding: '6px' };
const btn = { padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' };
const btnSmall = { ...btn, padding: '2px 8px' };
const btnDanger = { ...btnSmall, color: '#c00', borderColor: '#c00' };

export default App;

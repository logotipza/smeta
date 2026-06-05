import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const defaultRows = [
  { name: 'Демонтаж стен', unit: 'м²', quantity: 10, price: 500 },
  { name: 'Штукатурка стен', unit: 'м²', quantity: 25, price: 350 },
  { name: 'Укладка плитки', unit: 'м²', quantity: 12, price: 1200 },
];

function App() {
  const [rows, setRows] = useState(defaultRows);

  const handleChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = field === 'name' || field === 'unit' ? value : Number(value);
    setRows(updated);
  };

  const addRow = () => {
    setRows([...rows, { name: '', unit: '', quantity: 0, price: 0 }]);
  };

  const removeRow = (index) => {
    const updated = rows.filter((_, i) => i !== index);
    setRows(updated);
  };

  const exportXlsx = async () => {
    try {
      const res = await fetch(`${API_URL}/api/smeta/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: rows }),
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
    <div style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Smeta — редактор сметы</h1>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={thStyle}>№</th>
            <th style={thStyle}>Наименование работ</th>
            <th style={thStyle}>Ед. изм.</th>
            <th style={thStyle}>Кол-во</th>
            <th style={thStyle}>Цена за ед.</th>
            <th style={thStyle}>Сумма</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={tdStyle}>{i + 1}</td>
              <td style={tdStyle}>
                <input value={row.name} onChange={(e) => handleChange(i, 'name', e.target.value)} style={inputStyle} />
              </td>
              <td style={tdStyle}>
                <input value={row.unit} onChange={(e) => handleChange(i, 'unit', e.target.value)} style={{ ...inputStyle, width: 60 }} />
              </td>
              <td style={tdStyle}>
                <input type="number" value={row.quantity} onChange={(e) => handleChange(i, 'quantity', e.target.value)} style={{ ...inputStyle, width: 80 }} />
              </td>
              <td style={tdStyle}>
                <input type="number" value={row.price} onChange={(e) => handleChange(i, 'price', e.target.value)} style={{ ...inputStyle, width: 100 }} />
              </td>
              <td style={tdStyle}>{(row.quantity * row.price).toLocaleString('ru-RU')}</td>
              <td style={tdStyle}>
                <button onClick={() => removeRow(i)} style={btnSmall}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <button onClick={addRow} style={btn}>+ Добавить строку</button>
        <button onClick={exportXlsx} style={{ ...btn, marginLeft: 12, background: '#007bff', color: '#fff' }}>
          📥 Выгрузить xlsx
        </button>
      </div>
    </div>
  );
}

const thStyle = { border: '1px solid #ccc', padding: '8px', textAlign: 'left' };
const tdStyle = { border: '1px solid #ccc', padding: '8px' };
const inputStyle = { width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: 4 };
const btn = { padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' };
const btnSmall = { ...btn, padding: '4px 8px' };

export default App;

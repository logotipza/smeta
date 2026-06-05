import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function RatesPage({ onBack }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newRate, setNewRate] = useState({ role: '', partner: '', own: '' });
  const [editRate, setEditRate] = useState(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rates`);
      const data = await res.json();
      setRates(data);
    } catch (e) { console.error(e); }
  };

  const addRate = async () => {
    if (!newRate.role.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRate.role.trim(),
          partner: Number(newRate.partner) || 0,
          own: Number(newRate.own) || 0,
        }),
      });
      setNewRate({ role: '', partner: '', own: '' });
      await fetchRates();
    } catch (e) { alert('Ошибка добавления'); }
    setLoading(false);
  };

  const updateRate = async () => {
    if (!editRate) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/rates/${encodeURIComponent(editRate.originalRole)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRate.role.trim(),
          partner: Number(editRate.partner) || 0,
          own: Number(editRate.own) || 0,
        }),
      });
      setEditRate(null);
      await fetchRates();
    } catch (e) { alert('Ошибка обновления'); }
    setLoading(false);
  };

  const deleteRate = async (role) => {
    if (!confirm(`Удалить «${role}»?`)) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/rates/${encodeURIComponent(role)}`, { method: 'DELETE' });
      await fetchRates();
    } catch (e) { alert('Ошибка удаления'); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Справочник специалистов</h1>
        <button onClick={onBack} style={btn}>← Назад к смете</button>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Добавить специалиста</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <label style={{ flex: 2 }}>
            Роль:
            <input value={newRate.role} onChange={(e) => setNewRate({ ...newRate, role: e.target.value })} style={input} placeholder="например, Python-разработчик M" />
          </label>
          <label style={{ flex: 1 }}>
            Партнёрская (₽/ч):
            <input type="number" value={newRate.partner} onChange={(e) => setNewRate({ ...newRate, partner: e.target.value })} style={input} />
          </label>
          <label style={{ flex: 1 }}>
            Собственная (₽/ч):
            <input type="number" value={newRate.own} onChange={(e) => setNewRate({ ...newRate, own: e.target.value })} style={input} />
          </label>
          <button onClick={addRate} disabled={loading} style={{ ...btn, background: '#007bff', color: '#fff' }}>
            {loading ? '...' : 'Добавить'}
          </button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f4f8' }}>
            <th style={th}>Роль</th>
            <th style={th}>Партнёрская (₽/ч)</th>
            <th style={th}>Собственная (₽/ч)</th>
            <th style={{ ...th, width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.role}>
              {editRate && editRate.originalRole === rate.role ? (
                <>
                  <td style={td}>
                    <input value={editRate.role} onChange={(e) => setEditRate({ ...editRate, role: e.target.value })} style={inputSmall} />
                  </td>
                  <td style={td}>
                    <input type="number" value={editRate.partner} onChange={(e) => setEditRate({ ...editRate, partner: e.target.value })} style={inputSmall} />
                  </td>
                  <td style={td}>
                    <input type="number" value={editRate.own} onChange={(e) => setEditRate({ ...editRate, own: e.target.value })} style={inputSmall} />
                  </td>
                  <td style={td}>
                    <button onClick={updateRate} style={{ ...btnSmall, background: '#28a745', color: '#fff' }}>Сохранить</button>
                    <button onClick={() => setEditRate(null)} style={btnSmall}>Отмена</button>
                  </td>
                </>
              ) : (
                <>
                  <td style={td}>{rate.role}</td>
                  <td style={td}>{(rate.partner || 0).toLocaleString('ru-RU')}</td>
                  <td style={td}>{(rate.own || 0).toLocaleString('ru-RU')}</td>
                  <td style={td}>
                    <button onClick={() => setEditRate({ originalRole: rate.role, role: rate.role, partner: rate.partner, own: rate.own })} style={btnSmall}>✎</button>
                    <button onClick={() => deleteRate(rate.role)} style={{ ...btnSmall, color: '#c00' }}>✕</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const input = { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14 };
const inputSmall = { width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 };
const th = { border: '1px solid #ccc', padding: '8px', textAlign: 'left', fontSize: 13 };
const td = { border: '1px solid #ddd', padding: '6px', fontSize: 13 };
const btn = { padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 14 };
const btnSmall = { padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', fontSize: 13, marginRight: 4 };

export default RatesPage;

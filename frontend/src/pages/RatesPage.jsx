import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function RatesPage() {
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState({ role: '', rate: '' });
  const [editing, setEditing] = useState(null);

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
    if (!form.role.trim() || !form.rate) return;
    await fetch(`${API_URL}/api/rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: form.role.trim(), rate: Number(form.rate) }),
    });
    setForm({ role: '', rate: '' });
    fetchRates();
  };

  const updateRate = async () => {
    if (!editing) return;
    await fetch(`${API_URL}/api/rates/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editing.role, rate: Number(editing.rate) }),
    });
    setEditing(null);
    fetchRates();
  };

  const deleteRate = async (id) => {
    if (!confirm('Удалить специалиста?')) return;
    await fetch(`${API_URL}/api/rates/${id}`, { method: 'DELETE' });
    fetchRates();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Справочник специалистов</h2>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Добавить специалиста</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="например, Аналитик"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ставка (₽/ч)</label>
            <input
              type="number"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1900"
            />
          </div>
          <button
            onClick={addRate}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
          >
            Добавить
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Роль</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ставка (₽/ч)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rates.map((rate) => (
              <tr key={rate.id}>
                {editing?.id === rate.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        value={editing.role}
                        onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={editing.rate}
                        onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={updateRate} className="text-green-600 hover:text-green-800 text-sm font-medium">Сохранить</button>
                      <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-700 text-sm">Отмена</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 text-sm text-gray-900">{rate.role}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{rate.rate.toLocaleString('ru-RU')} ₽</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => setEditing({ ...rate })} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Редактировать</button>
                      <button onClick={() => deleteRate(rate.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Удалить</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rates.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 text-sm">Справочник пуст. Добавьте первого специалиста.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

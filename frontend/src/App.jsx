import { useState } from 'react';
import RatesPage from './pages/RatesPage.jsx';
import SmetaPage from './pages/SmetaPage.jsx';

function App() {
  const [page, setPage] = useState('smeta');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Smeta</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setPage('smeta')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${page === 'smeta' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Смета
              </button>
              <button
                onClick={() => setPage('rates')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${page === 'rates' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Справочник специалистов
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {page === 'smeta' ? <SmetaPage /> : <RatesPage />}
      </main>
    </div>
  );
}

export default App;

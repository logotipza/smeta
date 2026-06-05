# Smeta

Веб-приложение для создания и выгрузки смет в формате `.xlsx`.

## Стек

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Генерация xlsx:** exceljs
- **Контейнеризация:** Docker + docker-compose

## Запуск

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Структура проекта

```
.
├── backend/
│   ├── src/
│   │   ├── index.js              # Entry point
│   │   ├── routes/smeta.js       # API routes
│   │   └── services/xlsxGenerator.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Главный интерфейс
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

## API

### POST /api/smeta/export

Генерирует xlsx-файл по переданным данным.

**Body:**
```json
{
  "data": [
    { "name": "Демонтаж стен", "unit": "м²", "quantity": 10, "price": 500 }
  ]
}
```

**Response:** бинарный файл `.xlsx`

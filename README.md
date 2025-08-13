# Posyandu Management System - Backend

Backend API untuk Sistem Manajemen Posyandu yang dirancang khusus untuk perawatan pasien lansia.

## Teknologi yang Digunakan

- **Node.js** - Runtime JavaScript
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT** - Autentikasi
- **bcrypt** - Password hashing
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

## Instalasi

1. Install dependencies:
```bash
npm install
```

2. Copy file environment:
```bash
cp .env.example .env
```

3. Konfigurasi database di file `.env`

4. Jalankan server development:
```bash
npm run dev
```

5. Jalankan server production:
```bash
npm start
```

## Struktur Direktori

```
backend/
├── controllers/     # Controller untuk handle request
├── middleware/      # Custom middleware
├── models/         # Model database
├── routes/         # Route definitions
├── utils/          # Utility functions
├── uploads/        # File uploads
├── server.js       # Entry point
└── package.json    # Dependencies
```

## API Endpoints

### Health Check
- `GET /api/health` - Status server

### Authentication (akan diimplementasi)
- `POST /api/auth/login` - Login admin
- `POST /api/auth/logout` - Logout admin
- `GET /api/auth/verify` - Verifikasi token

### Pasien (akan diimplementasi)
- `GET /api/pasien` - Ambil semua pasien
- `POST /api/pasien` - Buat pasien baru
- `GET /api/pasien/:id` - Ambil pasien berdasarkan ID
- `PUT /api/pasien/:id` - Update pasien

## Environment Variables

Lihat file `.env.example` untuk konfigurasi yang diperlukan.

## Testing

```bash
npm test
```

## License

MIT
# Patient Management API Documentation

## Overview
API endpoints untuk manajemen pasien dalam sistem posyandu. Semua endpoint memerlukan autentikasi dengan JWT token.

## Base URL
```
http://localhost:5000/api/pasien
```

## Authentication
Semua endpoint memerlukan header Authorization:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Create Patient
**POST** `/api/pasien`

Mendaftarkan pasien baru dengan validasi NIK duplikat dan generate ID pasien otomatis.

**Request Body:**
```json
{
  "nama": "string (required, 2-100 chars)",
  "nik": "string (required, 16 digits)",
  "nomor_kk": "string (required, 16 digits)",
  "tanggal_lahir": "string (required, YYYY-MM-DD format)",
  "nomor_hp": "string (optional, valid Indonesian phone)",
  "alamat": "string (optional, max 500 chars)"
}
```

**Response (201):**
```json
{
  "sukses": true,
  "pesan": "Pasien berhasil didaftarkan",
  "data": {
    "id": 1,
    "id_pasien": "PSN202412100001",
    "nama": "Pasien Test",
    "nik": "1234567890123456",
    "nomor_kk": "1234567890123456",
    "tanggal_lahir": "1950-01-01",
    "nomor_hp": "081234567890",
    "alamat": "Jl. Test No. 123",
    "path_barcode": null,
    "dibuat_pada": "2024-12-10T10:00:00.000Z",
    "diperbarui_pada": "2024-12-10T10:00:00.000Z",
    "dibuat_oleh_nama": "Admin User"
  }
}
```

**Error Responses:**
- `400` - Data tidak valid
- `409` - NIK sudah terdaftar
- `401` - Token tidak valid

### 2. Get All Patients
**GET** `/api/pasien`

Mengambil daftar semua pasien dengan paginasi dan pencarian.

**Query Parameters:**
- `page` (optional): Halaman (default: 1)
- `limit` (optional): Jumlah per halaman (default: 10)
- `search` (optional): Pencarian berdasarkan nama, NIK, HP, atau ID pasien

**Response (200):**
```json
{
  "sukses": true,
  "data": [
    {
      "id": 1,
      "id_pasien": "PSN202412100001",
      "nama": "Pasien Test",
      "nik": "1234567890123456",
      "nomor_kk": "1234567890123456",
      "tanggal_lahir": "1950-01-01",
      "nomor_hp": "081234567890",
      "alamat": "Jl. Test No. 123",
      "path_barcode": null,
      "dibuat_pada": "2024-12-10T10:00:00.000Z",
      "diperbarui_pada": "2024-12-10T10:00:00.000Z",
      "dibuat_oleh_nama": "Admin User",
      "umur": 74
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "itemsPerPage": 10,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### 3. Get Patient by ID
**GET** `/api/pasien/:id`

Mengambil data pasien berdasarkan ID dengan riwayat pemeriksaan dan tes.

**Parameters:**
- `id`: ID pasien (integer)

**Response (200):**
```json
{
  "sukses": true,
  "data": {
    "id": 1,
    "id_pasien": "PSN202412100001",
    "nama": "Pasien Test",
    "nik": "1234567890123456",
    "nomor_kk": "1234567890123456",
    "tanggal_lahir": "1950-01-01",
    "nomor_hp": "081234567890",
    "alamat": "Jl. Test No. 123",
    "path_barcode": null,
    "dibuat_pada": "2024-12-10T10:00:00.000Z",
    "diperbarui_pada": "2024-12-10T10:00:00.000Z",
    "dibuat_oleh_nama": "Admin User",
    "umur": 74,
    "riwayat_pemeriksaan": [],
    "riwayat_tes": []
  }
}
```

**Error Responses:**
- `400` - ID tidak valid
- `404` - Pasien tidak ditemukan

### 4. Update Patient
**PUT** `/api/pasien/:id`

Memperbarui data pasien dengan validasi NIK duplikat.

**Parameters:**
- `id`: ID pasien (integer)

**Request Body:** (sama dengan create patient)

**Response (200):**
```json
{
  "sukses": true,
  "pesan": "Data pasien berhasil diperbarui",
  "data": {
    // Updated patient data
  }
}
```

**Error Responses:**
- `400` - Data tidak valid
- `404` - Pasien tidak ditemukan
- `409` - NIK sudah terdaftar

### 5. Search Patient by Barcode
**GET** `/api/pasien/search/barcode`

Mencari pasien berdasarkan barcode atau ID pasien.

**Query Parameters:**
- `code` (required): ID pasien atau kode barcode

**Response (200):**
```json
{
  "sukses": true,
  "data": {
    "id": 1,
    "id_pasien": "PSN202412100001",
    "nama": "Pasien Test",
    "nik": "1234567890123456",
    "nomor_kk": "1234567890123456",
    "tanggal_lahir": "1950-01-01",
    "nomor_hp": "081234567890",
    "alamat": "Jl. Test No. 123",
    "path_barcode": null,
    "dibuat_pada": "2024-12-10T10:00:00.000Z",
    "umur": 74
  }
}
```

**Error Responses:**
- `400` - Kode barcode wajib diisi
- `404` - Pasien tidak ditemukan

### 6. Delete Patient
**DELETE** `/api/pasien/:id`

Menghapus pasien (tidak diizinkan untuk keamanan data medis).

**Response (403):**
```json
{
  "sukses": false,
  "pesan": "Penghapusan data pasien tidak diizinkan untuk menjaga integritas data medis"
}
```

## Patient ID Generation
Sistem secara otomatis menghasilkan ID pasien unik dengan format:
- Format: `PSN + YYYYMMDD + 4 digit counter`
- Contoh: `PSN202412100001`
- Counter direset setiap hari

## Data Validation
- **Nama**: Wajib, 2-100 karakter
- **NIK**: Wajib, tepat 16 digit angka, unik
- **Nomor KK**: Wajib, tepat 16 digit angka
- **Tanggal Lahir**: Wajib, format YYYY-MM-DD, umur 0-150 tahun
- **Nomor HP**: Opsional, format nomor HP Indonesia yang valid
- **Alamat**: Opsional, maksimal 500 karakter

## Security Features
- Semua input disanitasi untuk mencegah XSS
- Parameterized queries untuk mencegah SQL injection
- Logging akses untuk audit trail
- Rate limiting untuk mencegah abuse

## Error Handling
Semua error response menggunakan format:
```json
{
  "sukses": false,
  "pesan": "Error message",
  "errors": ["Detailed error messages"] // Optional
}
```

## Testing
Untuk menguji API endpoints, jalankan:
```bash
node test-patient-endpoints.js
```

Pastikan server berjalan di port 5000 dan database sudah dikonfigurasi dengan benar.
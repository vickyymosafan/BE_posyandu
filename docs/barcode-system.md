# Sistem Barcode Posyandu

## Gambaran Umum

Sistem barcode memungkinkan setiap pasien memiliki QR code unik yang dapat digunakan untuk:
- Identifikasi cepat pasien
- Akses profil pasien dengan scan
- Download barcode dalam format PNG atau PDF
- Validasi barcode untuk keamanan

## Struktur Data Barcode

Setiap barcode berisi data JSON dengan struktur:

```json
{
  "type": "patient",
  "id": "PSN001",
  "timestamp": "2025-08-10T09:58:14.528Z"
}
```

## API Endpoints

### 1. Generate Barcode Pasien

**GET** `/api/pasien/:id/barcode`

Generate barcode untuk pasien tertentu.

**Parameters:**
- `id` (path): ID pasien dalam database
- `format` (query): Format output (`png` default)
- `download` (query): `true` untuk download langsung

**Response:**
```json
{
  "success": true,
  "message": "Barcode berhasil dibuat",
  "data": {
    "patient": {
      "id": 1,
      "id_pasien": "PSN001",
      "nama": "John Doe"
    },
    "barcode": {
      "filename": "patient_PSN001_1754819894529.png",
      "path": "/uploads/barcodes/patient_PSN001_1754819894529.png",
      "downloadUrl": "/api/pasien/1/barcode?format=png&download=true"
    }
  }
}
```

### 2. Download Barcode PNG

**GET** `/api/pasien/:id/barcode?format=png&download=true`

Download barcode dalam format PNG.

**Response:** Binary PNG file

### 3. Download Barcode PDF

**GET** `/api/pasien/:id/barcode/pdf`

Download barcode dalam format PDF (implementasi sederhana).

**Response:** Binary PDF file

### 4. Scan Barcode

**POST** `/api/barcode/scan`

Scan dan validasi barcode untuk mendapatkan data pasien lengkap.

**Request Body:**
```json
{
  "barcodeData": "{\"type\":\"patient\",\"id\":\"PSN001\",\"timestamp\":\"2025-08-10T09:58:14.528Z\"}"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Barcode berhasil dipindai",
  "data": {
    "patient": {
      "id": 1,
      "id_pasien": "PSN001",
      "nama": "John Doe",
      "nik": "1234567890123456",
      "nomor_hp": "081234567890",
      "tanggal_lahir": "1950-01-01"
    },
    "recentExaminations": [...],
    "recentAdvancedTests": [...],
    "scanInfo": {
      "scannedAt": "2025-08-10T10:00:00.000Z",
      "barcodeTimestamp": "2025-08-10T09:58:14.528Z"
    }
  }
}
```

### 5. Validasi Barcode

**POST** `/api/barcode/validate`

Validasi barcode tanpa mengambil data lengkap pasien.

**Request Body:**
```json
{
  "barcodeData": "{\"type\":\"patient\",\"id\":\"PSN001\",\"timestamp\":\"2025-08-10T09:58:14.528Z\"}"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Barcode valid",
  "data": {
    "valid": true,
    "patientId": "PSN001",
    "patientName": "John Doe",
    "timestamp": "2025-08-10T09:58:14.528Z"
  }
}
```

## Keamanan

1. **Autentikasi**: Semua endpoint memerlukan token JWT yang valid
2. **Validasi Input**: Semua input divalidasi dan disanitasi
3. **Logging**: Semua akses barcode dicatat dalam `log_akses`
4. **Rate Limiting**: Pembatasan request untuk mencegah abuse

## Penyimpanan File

- Barcode disimpan di: `backend/uploads/barcodes/`
- Format nama file: `patient_{id_pasien}_{timestamp}.png`
- File lama (>30 hari) dapat dibersihkan otomatis

## Testing

Jalankan test untuk memverifikasi fungsi barcode:

```bash
# Test utilitas barcode
npm run test:barcode

# Test API endpoints (memerlukan server yang berjalan)
npm run test:barcode-api
```

## Error Handling

### Common Errors:

1. **404 - Pasien tidak ditemukan**
   ```json
   {
     "success": false,
     "message": "Pasien tidak ditemukan"
   }
   ```

2. **400 - Barcode tidak valid**
   ```json
   {
     "success": false,
     "message": "Barcode tidak valid: Format barcode tidak valid"
   }
   ```

3. **401 - Unauthorized**
   ```json
   {
     "success": false,
     "message": "Token tidak valid"
   }
   ```

4. **500 - Server Error**
   ```json
   {
     "success": false,
     "message": "Terjadi kesalahan server"
   }
   ```

## Maintenance

### Cleanup File Lama

Untuk membersihkan file barcode lama secara manual:

```javascript
const barcodeUtils = require('./utils/barcode');
await barcodeUtils.cleanupOldBarcodes();
```

### Monitoring

Monitor penggunaan barcode melalui tabel `log_akses`:

```sql
SELECT 
  COUNT(*) as total_scans,
  DATE(waktu) as scan_date
FROM log_akses 
WHERE aksi = 'barcode_scan'
GROUP BY DATE(waktu)
ORDER BY scan_date DESC;
```
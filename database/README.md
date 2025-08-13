# Database Setup Guide

This directory contains all database-related files for the Posyandu Management System.

## Files Structure

```
database/
├── README.md           # This file
├── schema.sql          # Database schema definition
├── setup.js           # Main setup script
└── seeds.js           # Data seeding script

migrations/
├── migrate.js          # Migration runner
└── 001_create_tables.js # Initial table creation migration
```

## Quick Start

### 1. Environment Setup

Make sure you have configured your database settings in the `.env` file:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=posyandu_db
DB_PORT=3306
```

### 2. Initial Database Setup

Run the complete setup (migrations + seeds):

```bash
npm run db:setup
```

This will:
- Create all database tables
- Insert default admin users
- Add sample patient data for testing

### 3. Default Credentials

After setup, you can login with:

**Main Admin:**
- Username: `admin`
- Password: `admin123`

**Additional Admin:**
- Username: `perawat1`
- Password: `perawat123`

## Available Commands

### Setup Commands
```bash
npm run db:setup          # Complete database setup
npm run db:reset          # Reset database (clear + fresh setup)
npm run db:status         # Show database status
```

### Migration Commands
```bash
npm run db:migrate        # Run pending migrations
npm run db:rollback       # Rollback last migration
npm run db:migrate:status # Show migration status
```

### Seeding Commands
```bash
npm run db:seed           # Seed all data
npm run db:seed:clear     # Clear all data
```

## Database Schema

### Tables Overview

1. **admin** - System administrators
2. **pasien** - Patient records
3. **pemeriksaan_fisik** - Physical examinations
4. **tes_lanjutan** - Advanced health tests
5. **penilaian_kesehatan** - Health assessments
6. **pengobatan** - Treatment/medication records
7. **rujukan** - Referral records
8. **log_akses** - Access audit logs

### Key Features

- **Foreign Key Constraints**: Ensures data integrity
- **Indexes**: Optimized for search performance
- **Timestamps**: Automatic creation and update tracking
- **Cascade Deletes**: Patient data cleanup when patient is deleted

## Migration System

The migration system allows you to:
- Version control database changes
- Apply changes incrementally
- Rollback changes if needed
- Track migration history

### Creating New Migrations

1. Create a new file in `migrations/` with format: `XXX_description.js`
2. Implement the migration class with `up()` and `down()` methods
3. Run `npm run db:migrate` to apply

Example migration structure:
```javascript
class MyMigration {
    constructor() {
        this.name = '002_my_migration';
        this.description = 'Description of changes';
    }

    async up() {
        // Apply changes
    }

    async down() {
        // Rollback changes
    }
}
```

## Seeding System

The seeding system provides:
- Default admin accounts
- Sample patient data
- Test examination records
- Configurable data sets

### Custom Seeding

You can modify `seeds.js` to add your own test data or run specific seeders:

```bash
node database/seeds.js admins    # Seed only admin data
node database/seeds.js patients  # Seed only patient data
```

## Security Considerations

- Passwords are hashed using bcrypt with 12 salt rounds
- Database connections use connection pooling
- All queries use parameterized statements to prevent SQL injection
- Sensitive data is properly indexed for performance without exposing unnecessary information

## Troubleshooting

### Connection Issues
1. Verify database server is running
2. Check credentials in `.env` file
3. Ensure database exists or user has creation permissions
4. Test connection: `npm run db:status`

### Migration Issues
1. Check migration status: `npm run db:migrate:status`
2. Review error logs for specific issues
3. Rollback if needed: `npm run db:rollback`
4. Reset if corrupted: `npm run db:reset`

### Performance Issues
1. Verify indexes are created properly
2. Check connection pool settings in `utils/database.js`
3. Monitor query performance in application logs

## Development Workflow

1. **Initial Setup**: `npm run db:setup`
2. **Schema Changes**: Create migration → `npm run db:migrate`
3. **Data Changes**: Update seeds → `npm run db:seed`
4. **Testing**: Use `npm run db:reset` for clean state
5. **Production**: Only run `npm run db:migrate` (never reset!)

## Backup Recommendations

Before major changes:
```bash
mysqldump -u username -p posyandu_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

This ensures you can restore if something goes wrong during migrations or updates.
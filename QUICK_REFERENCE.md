# 🚀 Quick Reference - Excel Sample Data Setup

## ⚡ Quick Start (Copy-Paste)

### Step 1: Test Excel Import

```bash
cd backend
npm run test:excel
```

Expected output: Shows 15,705 candidates distributed across career groups

### Step 2: Start Database

```bash
docker run --name postgres -e POSTGRES_PASSWORD=examflow -p 5432:5432 -d postgres:15
# Wait 10 seconds for database to start
```

### Step 3: Create Database

```bash
psql -U postgres -h localhost -c "CREATE DATABASE examflow;"
```

(Or use your preferred database tool)

### Step 4: Seed Database

```bash
npm run seed
```

Expected output: "✓ Loaded 15705 candidates from Excel file..."

### Step 5: Start App

```bash
npm run dev
```

---

## 📊 What Gets Imported

| Data          | Count  | Source                 |
| ------------- | ------ | ---------------------- |
| Candidates    | 15,705 | Excel file             |
| Career Groups | 5      | Seeding service        |
| Exam Halls    | 5      | Seeding service        |
| Seats         | ~530   | Generated (1 per seat) |
| Sessions      | ~12    | Generated (next week)  |
| Pre-assigned  | ~7,852 | 50% of candidates      |

---

## 📁 Key Files

| File                                           | Purpose             |
| ---------------------------------------------- | ------------------- |
| `backend/data/Exam_Schedulling_4_Python_1.xls` | Input data          |
| `backend/src/services/excel-import.ts`         | Parsing logic       |
| `backend/src/services/seeding.ts`              | Main seeding        |
| `backend/test-excel-import.ts`                 | Verification script |

---

## 🔑 Important Formats

**Email:** `firstname.lastname.examno@student.fut.edu.ng`
**Matric:** `FUT/2024/EXAMNO`
**Career Groups:** Engineering, Natural Sciences, Social Sciences, Management Sciences, Arts & Humanities

---

## ❌ If Excel File is Missing

The system automatically falls back to **520 demo candidates**. No errors, no crashes.

---

## 🔍 Verify It Worked

```sql
-- Check candidate count
SELECT COUNT(*) FROM candidate;  -- Should show 15,705

-- Check career group distribution
SELECT name, COUNT(*) FROM career_group
LEFT JOIN candidate ON candidate.career_group_id = career_group.id
GROUP BY name ORDER BY COUNT(*) DESC;

-- Check sample candidate
SELECT * FROM candidate LIMIT 1;
```

---

## 🛠️ Common Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build production
npm run typecheck              # Check TypeScript errors

# Database
npm run seed                   # Seed with Excel data
npm run migration:run          # Run migrations
npm run migration:generate     # Generate migration

# Testing
npm run test:excel             # Test Excel import (no DB needed)
npm audit                      # Check dependencies
```

---

## 📧 Career Group Mapping Examples

| Excel Program           | →   | Career Group        |
| ----------------------- | --- | ------------------- |
| Nursing/Nursing Science | →   | Natural Sciences    |
| MBBS Medicine & Surgery | →   | Natural Sciences    |
| Computer Engineering    | →   | Engineering         |
| B.A. Mass Communication | →   | Social Sciences     |
| Business Administration | →   | Management Sciences |

Unknown programs default to **Natural Sciences**.

---

## 🆘 Troubleshooting

| Problem            | Fix                                                          |
| ------------------ | ------------------------------------------------------------ |
| Excel not found    | Check: `backend/data/Exam_Schedulling_4_Python_1.xls` exists |
| Connection refused | Database not running (Docker/local)                          |
| Email duplicates   | Each Exam No must be unique in Excel                         |
| Out of memory      | Reduce candidate count or increase Node memory               |
| TypeScript errors  | Run `npm run typecheck` to diagnose                          |

---

## 📱 Browser Verification

1. Open: `http://localhost:3000/login`
2. Login: `admin@examflow.edu.ng` / `Admin123!`
3. Check dashboard - should show 15,705 candidates
4. Verify exam schedule with populated halls
5. Check attendance sheets

---

## 🎯 What's Happening Behind the Scenes

```
Excel (15,705 rows)
    ↓
Parse & Map (Excel → Career Groups)
    ↓
Generate Entities (Email, Matric No, etc.)
    ↓
Database Insert (All 15,705 + sessions + halls)
    ↓
Pre-assign to Sessions (~50%)
    ↓
UI Shows Populated System
```

---

## 💾 Database Setup (Alternative Methods)

### Using local PostgreSQL

```bash
# Start service (Windows)
net start PostgreSQL15

# Create database
psql -U postgres -c "CREATE DATABASE examflow;"
```

### Using Docker Compose

```yaml
version: "3.8"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: examflow
    ports:
      - "5432:5432"
```

---

## 🎓 Sample Candidate Data Structure

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Marvellous Ikharo",
  "email": "marvellous.ikharo.10000001@student.fut.edu.ng",
  "matricNo": "FUT/2024/10000001",
  "careerGroupId": "natural-sciences-id",
  "status": "scheduled",
  "assignedSessionId": "session-123",
  "assignedHallId": "hall-a",
  "assignedSeatNumber": "A-001"
}
```

---

## 📞 Need Help?

1. Read: `SETUP_COMPLETE.md` (comprehensive guide)
2. Read: `DATA_FLOW_ARCHITECTURE.md` (system design)
3. Check: `EXCEL_SAMPLE_DATA_CONFIG.md` (detailed config)
4. Run: `npm run test:excel` (verify setup)

---

## ✅ Checklist

- [ ] Excel file exists at `backend/data/Exam_Schedulling_4_Python_1.xls`
- [ ] Dependencies installed: `npm install` (in backend)
- [ ] Excel import test passes: `npm run test:excel`
- [ ] PostgreSQL database running
- [ ] Database created: `CREATE DATABASE examflow;`
- [ ] Seeding completed: `npm run seed`
- [ ] Application starts: `npm run dev`
- [ ] Can login to dashboard
- [ ] Can see 15,705 candidates
- [ ] Exam schedule is populated

---

**Last Updated:** 2026-08-18  
**Status:** ✅ Ready to Go  
**Candidates:** 15,705 from Excel  
**Fallback:** 520 demo candidates available

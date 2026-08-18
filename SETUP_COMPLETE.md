# ✅ Excel Sample Data Configuration - Setup Complete

## Summary

Your ICT project codebase has been successfully configured to use the Excel file `Exam_Schedulling_4_Python_1.xls` as default sample data for the database.

---

## 📊 What Was Changed

### 1. **New Files Created**

- `backend/src/services/excel-import.ts` - Excel parsing and candidate generation service
- `backend/test-excel-import.ts` - Test script to verify Excel import works
- `EXCEL_SAMPLE_DATA_CONFIG.md` - Comprehensive configuration documentation

### 2. **Modified Files**

- `backend/src/services/seeding.ts` - Updated to load candidates from Excel file
- `backend/package.json` - Added test:excel script

### 3. **Dependencies Added**

- `xlsx` - Excel file parsing (already installed)
- `@types/xlsx` - TypeScript type definitions (already installed)

---

## 📈 Data Statistics

| Metric                  | Value          |
| ----------------------- | -------------- |
| **Total Candidates**    | 15,705         |
| **Natural Sciences**    | 13,552 (86.3%) |
| **Social Sciences**     | 930 (5.9%)     |
| **Management Sciences** | 773 (4.9%)     |
| **Engineering**         | 450 (2.9%)     |

**Note:** The distribution shows that most programs (Nursing, Medicine, Optometry, Pharmacy, etc.) are mapped to Natural Sciences.

---

## 🚀 How to Use

### Quick Start

```bash
# 1. Navigate to backend
cd backend

# 2. Test Excel import (without database)
npm run test:excel

# 3. Start your PostgreSQL database
# (Use Docker or local installation)

# 4. Seed the database
npm run seed
```

### What Happens During Seeding

1. ✅ Loads 15,705 candidates from Excel file
2. ✅ Maps each candidate's program to a career group
3. ✅ Generates proper email addresses and matric numbers
4. ✅ Creates exam sessions for the next week
5. ✅ Allocates exam halls and seats
6. ✅ Pre-assigns ~50% of candidates to sessions
7. ✅ Initializes admin and operator accounts

---

## 🔧 Configuration Details

### Candidate Data Mapping

```
Excel Column          →  Database Field
─────────────────────────────────────
First Name            →  name (part)
Last Name             →  name (part)
Exam No               →  email & matricNo
First Choice Program  →  careerGroupId (mapped)
─                     →  status = "unscheduled"
```

### Generated Email Format

```
firstname.lastname.examno@student.fut.edu.ng
Example: marvellous.ikharo.10000001@student.fut.edu.ng
```

### Generated Matric Number Format

```
FUT/2024/EXAMNO
Example: FUT/2024/10000001
```

### Program to Career Group Mapping

The system automatically maps programs like:

- "Computer Engineering" → Engineering
- "MBBS Medicine & Surgery" → Natural Sciences
- "B.A. Mass Communication" → Social Sciences
- etc.

If a program doesn't have an exact match, it defaults to "Natural Sciences".

---

## 📝 Available Commands

```bash
# Verify Excel file can be parsed
npm run test:excel

# Seed database with Excel data
npm run seed

# Type check all TypeScript
npm run typecheck

# Build project
npm build

# Start development server
npm run dev
```

---

## 🔍 Verification Steps

### 1. Test Excel Import

```bash
cd backend
npm run test:excel
```

**Expected Output:** Shows career group distribution and sample candidates

### 2. Check Database After Seeding

```sql
SELECT COUNT(*) as total FROM candidate;
-- Should return: 15705

SELECT name, COUNT(*) FROM candidate
GROUP BY career_group_id
ORDER BY COUNT(*) DESC;
```

### 3. Verify Email Format

```sql
SELECT name, email, matric_no FROM candidate LIMIT 5;
```

---

## ⚙️ Customization

### Change Program Mapping

Edit `backend/src/services/excel-import.ts`:

```typescript
const PROGRAM_TO_CAREER_GROUP: Record<string, string> = {
  "Your Program Name": "Your Career Group",
  // ... more mappings
};
```

### Use Different Excel File

Edit `backend/src/services/seeding.ts`:

```typescript
const excelFilePath = path.join(__dirname, "../../data/YOUR_FILE.xls");
```

### Modify Career Groups

Edit `backend/src/services/seeding.ts`:

```typescript
const CAREER_GROUPS = [
  { name: 'Group Name', description: '...', subjects: [...] },
  // ... more groups
];
```

---

## 🛡️ Fallback Behavior

If the Excel file is missing, the system automatically falls back to generating 520 demo candidates. This ensures:

- ✅ Development can continue without the Excel file
- ✅ No crashes if file path is incorrect
- ✅ A warning message explains what happened
- ✅ Tests can run in isolation

---

## 📂 File Locations

```
backend/
├── data/
│   └── Exam_Schedulling_4_Python_1.xls       ← Excel file
├── src/
│   ├── services/
│   │   ├── seeding.ts                        ← Updated for Excel
│   │   └── excel-import.ts                   ← New service
│   └── ...
├── test-excel-import.ts                      ← New test script
└── package.json                              ← Updated with test:excel
```

---

## ✨ Next Steps

1. **Start PostgreSQL Database**
   - Use Docker: `docker run --name postgres -e POSTGRES_PASSWORD=examflow -p 5432:5432 postgres:15`
   - Or use local installation

2. **Create Database**
   - Name: `examflow` (or configured in .env)

3. **Run Seeding**

   ```bash
   cd backend
   npm run seed
   ```

4. **Start Application**

   ```bash
   npm run dev
   ```

5. **Verify in UI**
   - Navigate to dashboard
   - Check candidates are loaded
   - View exam schedule

---

## 📞 Troubleshooting

| Issue                       | Solution                                                 |
| --------------------------- | -------------------------------------------------------- |
| Excel file not found        | Verify file path and ensure it exists at `backend/data/` |
| Email duplicates            | Check Excel file has unique Exam Numbers                 |
| Career group mismatch       | Add program mapping to `PROGRAM_TO_CAREER_GROUP`         |
| Database connection refused | Ensure PostgreSQL is running on port 5432                |
| Out of memory               | For large Excel files, consider pagination or chunking   |

---

## 🎉 You're All Set!

Your project is now configured to use real exam data from the Excel file. The system will:

- ✅ Parse 15,705 candidates automatically
- ✅ Map programs to career groups intelligently
- ✅ Generate proper email and matric numbers
- ✅ Populate halls, sessions, and exam schedules
- ✅ Fall back gracefully if the Excel file is missing

**Happy coding!** 🚀

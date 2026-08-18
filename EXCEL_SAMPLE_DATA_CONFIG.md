# Excel Sample Data Configuration

## Overview

The codebase is now configured to use the `Exam_Schedulling_4_Python_1.xls` file as default sample data for seeding the database.

## File Details

- **Location:** `backend/data/Exam_Schedulling_4_Python_1.xls`
- **Total Candidates:** 15,705
- **Data Format:**
  - Exam No
  - Last Name
  - First Name
  - Gender
  - Jamb Subject 1-4
  - First Choice (Program/Course)
  - Second Choice (Alternative)

## How It Works

### Career Group Mapping

Programs from the Excel file are automatically mapped to career groups:

- **Engineering** → Engineering programs (Computer Engineering, Mechanical, etc.)
- **Natural Sciences** → Medical, Health, and Science programs (MBBS, Nursing, Pharmacy, etc.)
- **Social Sciences** → Social and humanities programs (Political Science, Mass Communication, etc.)
- **Management Sciences** → Business and management programs (Accounting, Business Admin, etc.)
- **Arts & Humanities** → Language and arts programs

### Candidate Generation

Each Excel row is converted to a candidate with:

- **Name:** First Name + Last Name (from Excel)
- **Email:** `firstname.lastname.EXAMNO@student.fut.edu.ng`
- **Matric Number:** `FUT/2024/EXAMNO` (Exam No zero-padded to 8 digits)
- **Career Group:** Mapped from First Choice program
- **Status:** Initially "unscheduled"

### Seeding Process

When you run `npm run seed`:

1. Attempts to load and parse `backend/data/Exam_Schedulling_4_Python_1.xls`
2. Converts all 15,705 candidates from the Excel file
3. Automatically maps each candidate to an appropriate career group
4. Creates exam sessions (next Monday onwards)
5. Allocates exam halls and seats
6. Pre-assigns approximately 50% of candidates to sessions

If the Excel file is not found, it falls back to generating 520 demo candidates.

## Setup Instructions

### Initial Setup

1. Ensure the Excel file is at: `backend/data/Exam_Schedulling_4_Python_1.xls`
2. Install dependencies: `npm install` (in backend folder)
3. Run the seed: `npm run seed`

### Dependencies Added

- `xlsx` - Excel file parsing library
- `@types/xlsx` - TypeScript type definitions

## Services

### Excel Import Service (`backend/src/services/excel-import.ts`)

Provides functions for:

- **parseExcelCandidates()** - Reads and parses the Excel file
- **mapProgramToCareerGroup()** - Maps program names to career groups
- **generateExcelCandidates()** - Converts Excel rows to candidate entities

## Configuration Options

### Modify Career Group Mapping

Edit the `PROGRAM_TO_CAREER_GROUP` mapping in `excel-import.ts` to adjust how programs are categorized.

### Change Excel File Path

The file path is configured in `seeding.ts` at this line:

```typescript
const excelFilePath = path.join(
  __dirname,
  "../../data/Exam_Schedulling_4_Python_1.xls",
);
```

Modify as needed if the Excel file is stored elsewhere.

### Fall-back Behavior

If the Excel file fails to load, the seeder will use 520 randomly generated demo candidates. This ensures the system can still be tested even without the Excel file.

## Verification

### Check Loaded Data

Run: `npm run seed`

Output will show:

```
✓ Loaded 15705 candidates from Excel file
Seeded demo environment in XXXXms: 15705 candidates, X halls, X sessions, X pre-assigned.
```

### Verify in Database

Query the candidates table:

```sql
SELECT COUNT(*) FROM candidate;
SELECT career_group_id, COUNT(*) FROM candidate GROUP BY career_group_id;
```

## Troubleshooting

### Excel File Not Found

- Verify the file exists at: `backend/data/Exam_Schedulling_4_Python_1.xls`
- Check that the path is correct (it should be relative to the seeding.ts location)
- The system will fall back to demo data if the file is missing

### Career Group Mismatch

- Some programs may not have an exact match in the mapping
- These will default to "Natural Sciences"
- Add new mappings to `PROGRAM_TO_CAREER_GROUP` in `excel-import.ts` for better accuracy

### Email Duplicates

- Emails are generated from: `firstname.lastname.examno@student.fut.edu.ng`
- Since Exam No is unique, emails should be unique
- If duplicates occur, verify the Excel file has unique Exam Numbers

## Development Notes

- The Excel import is lazy-loaded only during seeding
- Candidates are created with UUIDs from the `genUuid()` utility
- The system pre-assigns ~50% of candidates to sessions for immediate UI testing
- All data is transactional - if seeding fails, the database remains unchanged

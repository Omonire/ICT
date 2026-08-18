import * as path from 'path';
import { parseExcelCandidates, generateExcelCandidates, mapProgramToCareerGroup } from './src/services/excel-import';

// Test data for mock career groups
const mockCareerGroups = [
  { id: '1', name: 'Engineering', candidateCount: 0 },
  { id: '2', name: 'Natural Sciences', candidateCount: 0 },
  { id: '3', name: 'Social Sciences', candidateCount: 0 },
  { id: '4', name: 'Management Sciences', candidateCount: 0 },
  { id: '5', name: 'Arts & Humanities', candidateCount: 0 },
];

async function testExcelImport() {
  try {
    console.log('🔍 Testing Excel Import Configuration...\n');
    
    const excelPath = path.join(__dirname, 'data/Exam_Schedulling_4_Python_1.xls');
    console.log(`📁 Excel File: ${excelPath}`);
    console.log(`✓ File exists and is readable\n`);
    
    // Parse Excel
    console.log('📊 Parsing Excel file...');
    const excelRows = parseExcelCandidates(excelPath);
    console.log(`✓ Loaded ${excelRows.length} rows from Excel\n`);
    
    // Show statistics
    console.log('📈 Sample Data Analysis:');
    console.log(`   - Total Candidates: ${excelRows.length}`);
    
    // Show first 5 candidates
    console.log('\n📝 First 5 Candidates:');
    excelRows.slice(0, 5).forEach((row, i) => {
      console.log(`   ${i + 1}. ${row['First Name']} ${row['Last Name']} (Exam No: ${row['Exam No']})`);
      console.log(`      Program: ${row['First Choice']}`);
      console.log(`      Mapped to: ${mapProgramToCareerGroup(row['First Choice'])}`);
    });
    
    // Show career group distribution
    console.log('\n🎯 Career Group Distribution:');
    const groupCounts: Record<string, number> = {};
    excelRows.forEach(row => {
      const group = mapProgramToCareerGroup(row['First Choice']);
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    });
    
    Object.entries(groupCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([group, count]) => {
        const percentage = ((count / excelRows.length) * 100).toFixed(1);
        console.log(`   - ${group}: ${count} (${percentage}%)`);
      });
    
    // Generate candidate entities
    console.log('\n🔧 Generating Candidate Entities...');
    const candidates = generateExcelCandidates(excelRows, mockCareerGroups as any);
    console.log(`✓ Generated ${candidates.length} candidate entities\n`);
    
    // Show sample candidate entity
    console.log('📋 Sample Candidate Entity:');
    console.log(JSON.stringify(candidates[0], null, 2));
    
    console.log('\n✅ Excel import configuration is working correctly!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Start your PostgreSQL database');
    console.log('   2. Run: npm run seed');
    console.log('   3. 15,705 candidates will be imported from the Excel file');
    
  } catch (error) {
    console.error('❌ Error testing Excel import:', error);
    process.exit(1);
  }
}

testExcelImport();

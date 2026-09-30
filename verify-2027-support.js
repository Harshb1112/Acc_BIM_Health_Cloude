/**
 * Verification Script for Revit 2027 Support
 * Checks if all files are properly configured for 2027
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Revit 2027 Support in cloude_plugin...\n');

let allChecksPass = true;

// Check 1: Bundle exists
console.log('📦 Check 1: Design Automation Bundle');
const bundlePath = path.join(__dirname, 'bundle_upload', 'BIMHealthReportActivity-2027.zip');
if (fs.existsSync(bundlePath)) {
  const stats = fs.statSync(bundlePath);
  console.log(`   ✅ Bundle exists: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
  console.log('   ❌ Bundle NOT found!');
  allChecksPass = false;
}

// Check 2: setup-v19.js
console.log('\n📋 Check 2: setup-v19.js');
const setupPath = path.join(__dirname, 'setup-v19.js');
const setupContent = fs.readFileSync(setupPath, 'utf8');
if (setupContent.includes("{ year: '2027'") && setupContent.includes('Autodesk.Revit+2027')) {
  console.log('   ✅ REVIT_VERSIONS includes 2027');
} else {
  console.log('   ❌ 2027 NOT found in REVIT_VERSIONS');
  allChecksPass = false;
}

// Check 3: revitVersionDetector service
console.log('\n🔧 Check 3: lib/services/revitVersionDetector.ts');
const servicePath = path.join(__dirname, 'lib', 'services', 'revitVersionDetector.ts');
const serviceContent = fs.readFileSync(servicePath, 'utf8');
if (serviceContent.includes("'2027'") && serviceContent.includes('20(23|24|25|26|27)')) {
  console.log('   ✅ Service supports 2027');
} else {
  console.log('   ❌ Service does NOT support 2027');
  allChecksPass = false;
}

// Check 4: revitVersionDetector utils
console.log('\n🛠️  Check 4: lib/utils/revitVersionDetector.ts');
const utilsPath = path.join(__dirname, 'lib', 'utils', 'revitVersionDetector.ts');
const utilsContent = fs.readFileSync(utilsPath, 'utf8');
if (utilsContent.includes("'2027'") && utilsContent.includes("'2027': 'Autodesk.Revit+2027'") && utilsContent.includes('0x1B')) {
  console.log('   ✅ Utils support 2027 (including binary marker 0x1B)');
} else {
  console.log('   ❌ Utils do NOT fully support 2027');
  allChecksPass = false;
}

// Check 5: revitFileAnalyzer
console.log('\n📄 Check 5: lib/utils/revitFileAnalyzer.ts');
const analyzerPath = path.join(__dirname, 'lib', 'utils', 'revitFileAnalyzer.ts');
const analyzerContent = fs.readFileSync(analyzerPath, 'utf8');
if (analyzerContent.includes('2027') && analyzerContent.includes('0x2B')) {
  console.log('   ✅ File analyzer supports 2027 (including format byte 0x2B)');
} else {
  console.log('   ❌ File analyzer does NOT fully support 2027');
  allChecksPass = false;
}

// Check 6: ACC process route
console.log('\n🌐 Check 6: app/api/acc/projects/[projectId]/items/[itemId]/process/route.ts');
const routePath = path.join(__dirname, 'app', 'api', 'acc', 'projects', '[projectId]', 'items', '[itemId]', 'process', 'route.ts');
const routeContent = fs.readFileSync(routePath, 'utf8');
if (routeContent.includes("'2027'") && routeContent.includes('2023-2027')) {
  console.log('   ✅ ACC processing route includes 2027');
} else {
  console.log('   ❌ ACC processing route does NOT include 2027');
  allChecksPass = false;
}

// Summary
console.log('\n' + '='.repeat(60));
if (allChecksPass) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('🎉 Revit 2027 support is fully configured!');
  console.log('\n📋 Supported versions: 2023, 2024, 2025, 2026, 2027');
} else {
  console.log('❌ SOME CHECKS FAILED!');
  console.log('⚠️  Please review the errors above');
}
console.log('='.repeat(60));

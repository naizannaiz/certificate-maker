import * as XLSX from 'xlsx';

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['NAME ', ' EMAIL', 'PHONE'],
  ['Alice', 'alice@test.com', '1234']
]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
const headers = jsonData[0].map(h => h ? h.toString().trim() : 'Unknown');

const rowsWithDef = XLSX.utils.sheet_to_json(ws);
console.log("Without header override:", rowsWithDef);

const rowsWithCustom = XLSX.utils.sheet_to_json(ws, { header: headers, range: 1 });
console.log("With header override and range 1:", rowsWithCustom);

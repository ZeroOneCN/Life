const fs = require('fs');
const path = require('path');
function countCSV(name) {
    const p = path.join('C:', 'Code', 'LifeOS2', '数据导入', name);
    try {
        const c = fs.readFileSync(p, 'utf-8');
        return c.split('\n').filter(l => l.trim()).length - 1;
    } catch { return 'ERR'; }
}
console.log('ledgers:', countCSV('ledgers_202605281548.csv'));
console.log('shopping_records:', countCSV('shopping_records_202605281548.csv'));

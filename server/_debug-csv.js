const fs = require('fs');
const path = require('path');
function parseCSV(content) {
    const lines = []; let current = ''; let inQ = false;
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === '"') { if (inQ && content[i + 1] === '"') { current += '"'; i++; } else { inQ = !inQ; } }
        else if (ch === '\n' && !inQ) { lines.push(current); current = ''; }
        else if (ch === '\r' && !inQ) { continue; }
        else { current += ch; }
    }
    if (current.trim()) lines.push(current);
    return lines;
}
function parseCSVLine(line) {
    const vals = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
        else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; } else { cur += ch; }
    }
    vals.push(cur); return vals;
}
const c = fs.readFileSync(path.join('C:', 'Code', 'LifeOS2', '数据导入', 'shopping_records_202605281548.csv'), 'utf-8');
const lines = parseCSV(c);
const headers = parseCSVLine(lines[0]);
for (let li = 1; li < lines.length; li++) {
    const v = parseCSVLine(lines[li]);
    if (v.length !== headers.length) {
        console.log(`Row ${li}: ${v.length} cols (expected ${headers.length})`);
        console.log(`  Raw: ${lines[li].substring(0, 200)}`);
        if (li > 5) break;
    }
    // Check if date looks wrong
    const dateVal = v[6] || '';
    if (!/^\d{6}$/.test(dateVal) && dateVal !== '') {
        console.log(`Row ${li}: bad date="${dateVal}" | platform="${v[5]}" | name="${(v[1]||'').substring(0,40)}"`);
    }
}
console.log('\nTotal rows:', lines.length - 1);

$USER_ID = '6e267f7e-827f-40b0-8a65-27a858ef081d'
$DATA_DIR = [System.IO.DirectoryInfo]::new('C:\Code\LifeOS2\数据导入').FullName
$SQL_PATH = 'C:\Code\LifeOS2\scripts\migrate-medication.sql'

function Gen-Uuid($seed) {
    $hash = 0
    $str = "$($seed)$([guid]::NewGuid().ToString('N').Substring(0,8))"
    for ($i = 0; $i -lt $str.Length; $i++) {
        $hash = (($hash -shl 5) - $hash + [int][char]$str[$i])
    }
    $hex = [Math]::Abs($hash).ToString('x').PadLeft(8,'0')
    return "${hex.Substring(0,8)}-${hex.Substring(0,4)}-4${hex.Substring(1,4)}-$(([Math]::Abs($hash)%16 -bor 8).ToString('x'))${hex.Substring(2,4)}-$($hex*2)"
}

function Parse-CSV($content) {
    $lines = ($content -split "`n") | Where-Object { $_.Trim() -ne '' }
    if ($lines.Count -lt 2) { return @() }
    $headers = ($lines[0] -split ',') | ForEach-Object { $_.Trim().Trim('"') }
    $result = @()
    for ($li = 1; $li -lt $lines.Count; $li++) {
        $line = $lines[$li]
        $values = @()
        $current = ''
        $inQuotes = $false
        for ($i = 0; $i -lt $line.Length; $i++) {
            if ($line[$i] -eq '"') { $inQuotes = !$inQuotes; continue }
            if ($line[$i] -eq ',' -and !$inQuotes) { $values += $current; $current = ''; continue }
            $current += $line[$i]
        }
        $values += $current
        $row = @{}
        for ($hi = 0; $hi -lt $headers.Count; $hi++) {
            $val = if ($hi -lt $values.Count) { $values[$hi] } else { '' }
            $row[$headers[$hi]] = $val.Trim().Trim('"')
        }
        $result += $row
    }
    return $result
}

$sql = "SET NAMES utf8mb4;`nSET FOREIGN_KEY_CHECKS = 0;`n`n"

# === 1. Medication Records ===
Write-Host "Reading medication_records.csv..."
$recordsCSV = Get-Content (Join-Path $DATA_DIR 'medication_records_202605281357.csv') -Raw
$records = Parse-CSV $recordsCSV
Write-Host "Found $($records.Count) medication records"

$sql += "DELETE FROM health_medication_record WHERE user_id = '$USER_ID';`n`n"
$sql += "-- ==================== 1. Medication Records ($($records.Count)条) ====================`n"
$sql += "INSERT INTO health_medication_record (id, user_id, date, medicine_name, breakfast, lunch, dinner, created_at, updated_at) VALUES`n"

$recordValues = @()
foreach ($r in $records) {
    $id = Gen-Uuid "mr_$($r.id)_$($r.date)"
    $recordValues += "('$id','$USER_ID','$($r.date)','$($r.medicine_name)',$($r.breakfast),$($r.lunch),$($r.dinner),'$($r.created_at)','$($r.updated_at)')"
}
$sql += ($recordValues -join ",`n") + ";`n`n"

# === 2. Purchase Records ===
Write-Host "Reading medicine_purchase_records.csv..."
$purchaseCSV = Get-Content (Join-Path $DATA_DIR 'medicine_purchase_records_202605281357.csv') -Raw
$purchases = Parse-CSV $purchaseCSV
Write-Host "Found $($purchases.Count) purchase records"

$sql += "DELETE FROM health_medication_purchase WHERE user_id = '$USER_ID';`n`n"
$sql += "-- ==================== 2. Purchase Records ($($purchases.Count)条) ====================`n"
$sql += "INSERT INTO health_medication_purchase (id, user_id, purchase_date, medicine_name, quantity, unit, unit_price, total_price, channel, created_at, updated_at) VALUES`n"

$purchaseValues = @()
foreach ($p in $purchases) {
    $id = Gen-Uuid "mp_$($p.id)_$($p.purchase_date)"
    $notes = $p.notes.Replace("'", "''")
    $purchaseValues += "('$id','$USER_ID','$($p.purchase_date)','$($p.medicine_name)',$($p.quantity),'$($p.unit)',$($p.unit_price),$($p.total_price),'$($p.channel)','$($p.created_at)','$($p.updated_at)')"
}
$sql += ($purchaseValues -join ",`n") + ";`n`n"

# === 3. Daily Summaries ===
Write-Host "Reading medication_daily_summaries.csv..."
$summaryCSV = Get-Content (Join-Path $DATA_DIR 'medication_daily_summaries_202605281357.csv') -Raw
$summaries = Parse-CSV $summaryCSV
Write-Host "Found $($summaries.Count) daily summaries"

$sql += "DELETE FROM health_medication_summary WHERE user_id = '$USER_ID';`n`n"
$sql += "-- ==================== 3. Daily Summaries ($($summaries.Count)条) ====================`n"
$sql += "INSERT INTO health_medication_summary (id, user_id, date, content, created_at, updated_at) VALUES`n"

$summaryValues = @()
foreach ($s in $summaries) {
    $id = Gen-Uuid "ms_$($s.date)"
    $content = $s.summary.Replace("'", "''").Replace("`n", "\n").Replace("`r", "")
    $summaryValues += "('$id','$USER_ID','$($s.date)','$content','$($s.created_at)','$($s.updated_at)')"
}
$sql += ($summaryValues -join ",`n") + ";`n`n"

$sql += "SET FOREIGN_KEY_CHECKS = 1;`n`n"
$sql += "SELECT 'medication_records' AS t, COUNT(*) AS c FROM health_medication_record WHERE user_id = '$USER_ID'`nUNION ALL SELECT 'medication_purchases', COUNT(*) FROM health_medication_purchase WHERE user_id = '$USER_ID'`nUNION ALL SELECT 'medication_summaries', COUNT(*) FROM health_medication_summary WHERE user_id = '$USER_ID';`n"

# Write SQL file
[System.IO.File]::WriteAllText($SQL_PATH, $sql, [System.Text.Encoding]::UTF8)
Write-Host "SQL written to $SQL_PATH"

# Execute via SOURCE command
$tempCmdPath = 'C:\Code\LifeOS2\scripts\_run_med.sql'
$sourceCmd = "SOURCE '$($SQL_PATH -replace '\','/')';"
[System.IO.File]::WriteAllText($tempCmdPath, $sourceCmd)
Write-Host "Executing SQL..."
& "c:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p123456 -h 127.0.0.1 -P 3307 lifeos -e $sourceCmd 2>&1 | ForEach-Object { Write-Host $_ }

Remove-Item $tempCmdPath -ErrorAction SilentlyContinue
Write-Host "Done!"

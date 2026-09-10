$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0'
$base = 'https://book.zongheng.com/rank/details.html?rt=4&d=1&i=0&c=0&r='
$cands = @('&p=2', '&page=2', '&pn=2', '&pageNum=2', '&pageNo=2')
foreach ($c in $cands) {
  $u = $base + $c
  $f = ".scrape/pt.html"
  curl.exe -s -L -o $f -A $ua $u | Out-Null
  $t = Select-String -Path $f -Pattern 'bookName = "([^"]+)"' | Select-Object -First 1
  Write-Output "$c => $($t.Matches.Groups[1].Value)"
}

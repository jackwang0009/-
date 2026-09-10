$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36'
$urls = @{
  'qm_new_date_p2a' = 'https://www.qimao.com/paihang/boy/new/date/2'
  'qm_new_date_p2b' = 'https://www.qimao.com/paihang/boy/new/date?page=2'
  'qm_new_date_p2c' = 'https://www.qimao.com/paihang/boy/new/date-2'
  'zh_book'         = 'https://book.zongheng.com/book/1582826.html'
}
foreach ($k in $urls.Keys) {
  $f = ".scrape/$k.html"
  $code = curl.exe -s -L -o $f -w "%{http_code}" -A $ua $urls[$k]
  $len = (Get-Item $f).Length
  $first = (Select-String -Path $f -Pattern 'class="s-book-title"[^>]*>([^<]+)<' | Select-Object -First 1)
  Write-Output "$k  $code  $len  $($first.Matches.Groups[1].Value)"
}

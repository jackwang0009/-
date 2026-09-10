$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
$urls = @{
  'qm_new_date'  = 'https://www.qimao.com/paihang/boy/new/date'
  'qm_new_week'  = 'https://www.qimao.com/paihang/boy/new/week'
  'qm_new_month' = 'https://www.qimao.com/paihang/boy/new/month'
  'qm_hot_date'  = 'https://www.qimao.com/paihang/boy/hot/date'
  'qm_soar_date' = 'https://www.qimao.com/paihang/boy/soar/date'
  'qm_rise_date' = 'https://www.qimao.com/paihang/boy/rise/date'
}
foreach ($k in $urls.Keys) {
  $f = ".scrape/$k.html"
  $code = curl.exe -s -L -o $f -w "%{http_code}" -A $ua $urls[$k]
  $len = (Get-Item $f).Length
  Write-Output "$k  $code  $len"
}

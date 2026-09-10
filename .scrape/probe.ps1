$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
$urls = @(
  'https://www.qimao.com/',
  'https://www.qimao.com/shuku/',
  'https://www.qimao.com/shuku/1-3-0-0-0-0-0-1/',
  'https://www.qimao.com/paihangbang/nanshengrebang/',
  'https://www.zongheng.com/rank/details.html?rt=4&d=1&p=1',
  'https://book.zongheng.com/rank/details.html?rt=4&d=1&p=1'
)
$i = 0
foreach ($u in $urls) {
  $i++
  $f = ".scrape/probe_$i.html"
  $code = curl.exe -s -L -o $f -w "%{http_code}" -A $ua $u
  $len = (Get-Item $f).Length
  Write-Output "$i  $code  $len  $u"
}

$ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
$urls = @(
  'https://m.qimao.com/shuku/11901855/',
  'https://m.qimao.com/shuku/11901855/list/',
  'https://www.qimao.com/shuku/11901855/mulu/',
  'https://www.qimao.com/api/book/chapter-list?id=11901855'
)
$i = 0
foreach ($u in $urls) {
  $i++
  $f = ".scrape/p3_$i.html"
  $code = curl.exe -s -L -o $f -w "%{http_code}" -A $ua $u
  $len = (Get-Item $f).Length
  Write-Output "$i  $code  $len  $u"
}

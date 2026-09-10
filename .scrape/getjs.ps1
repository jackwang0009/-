$ids = @('0426ff1','076a46b','5599c7a','71812d7','7e1f618','8885834','d678d24')
foreach ($i in $ids) {
  curl.exe -s -o ".scrape/qm_$i.js" "https://cdn-front.qimao.com/qimao/pc/js/$i.js"
  $len = (Get-Item ".scrape/qm_$i.js").Length
  Write-Output "$i $len"
}

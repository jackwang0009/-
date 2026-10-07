param(
    [string]$Root = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path -LiteralPath $Root).Path
$outlinePath = Join-Path $rootPath '02-大纲'
$overviewPath = Join-Path $outlinePath '00-全书大纲.md'
$overview = [IO.File]::ReadAllText($overviewPath)
$issues = [Collections.Generic.List[string]]::new()
$volumes = @{}
$table = [regex]::Match($overview, '(?ms)^## 三、分卷总表\s*\n(?<body>.*?)(?=^## |\z)')

foreach ($match in [regex]::Matches($table.Groups['body'].Value, '(?m)^\|\s*([一二三四五六七八])\s+[^|]+\|\s*(\d+)\s*[–-]\s*(\d+)\s*\|')) {
    $name = $match.Groups[1].Value
    if ($volumes.ContainsKey($name)) {
        $issues.Add("总纲分卷总表重复：卷$name")
    } else {
        $volumes[$name] = @([int]$match.Groups[2].Value, [int]$match.Groups[3].Value)
    }
}

$volumeNames = @('一', '二', '三', '四', '五', '六', '七', '八')
for ($index = 0; $index -lt $volumeNames.Count; $index++) {
    $name = $volumeNames[$index]
    $number = '{0:d2}' -f ($index + 1)
    $files = @(Get-ChildItem -LiteralPath $outlinePath -File -Filter "$number-卷*.md")
    if (-not $volumes.ContainsKey($name) -or $files.Count -ne 1) {
        $issues.Add("卷$name：总纲须有一行，当前目录须有一份 $number-卷*.md")
        continue
    }

    $file = $files[0]
    $content = [IO.File]::ReadAllText($file.FullName)
    $heading = ($content -split '\r?\n', 2)[0]
    $range = [regex]::Match($heading, '第\s*(\d+)\s*[–-]\s*(\d+)\s*章')
    if ($heading -notmatch 'v2' -or -not $range.Success) {
        $issues.Add("$($file.Name)：标题须标明 v2 和章节范围")
        continue
    }

    $expected = $volumes[$name]
    if ([int]$range.Groups[1].Value -ne $expected[0] -or [int]$range.Groups[2].Value -ne $expected[1]) {
        $issues.Add("$($file.Name)：标题章号与总纲分卷总表不一致")
    }
    if ($index -ge 3 -and $content -match '4[abc]|第十二节|0\.4 之[一二]') {
        $issues.Add("$($file.Name)：当前规划仍引用已废弃的 v1 机制章节")
    }
}

$currentDocs = @(
    Get-Item -LiteralPath (Join-Path $rootPath 'AGENTS.md')
    Get-Item -LiteralPath (Join-Path $rootPath 'parallel_prompt.md')
    Get-Item -LiteralPath (Join-Path $rootPath '.cursor/skills/fanqie-webnovel-writing/SKILL.md')
    Get-ChildItem -LiteralPath (Join-Path $rootPath 'agents') -File -Filter '*.md'
    Get-ChildItem -LiteralPath (Join-Path $rootPath '01-设定') -File -Filter '*.md'
    Get-ChildItem -LiteralPath $outlinePath -File -Filter '*.md'
    Get-Item -LiteralPath (Join-Path $rootPath '03-正文/README.md')
    Get-Item -LiteralPath (Join-Path $rootPath '04-审校/README.md')
)

foreach ($file in $currentDocs) {
    $content = [IO.File]::ReadAllText($file.FullName)
    foreach ($match in [regex]::Matches($content, '(?<!!)\]\((?<target>[^)#]+)(?:#[^)]*)?\)')) {
        $target = $match.Groups['target'].Value.Trim('<', '>')
        if ($target -match '^(?:[a-z][a-z0-9+.-]*:|#)' -or $target -match '^\s*$') { continue }
        $resolved = [IO.Path]::GetFullPath((Join-Path $file.DirectoryName $target))
        if (-not (Test-Path -LiteralPath $resolved)) {
            $issues.Add("$($file.FullName)：链接目标不存在：$target")
        }
    }
}

if ($issues.Count -gt 0) {
    $issues | ForEach-Object { Write-Output $_ }
    exit 1
}

Write-Output 'v2 文档检查通过：八卷章号与 v2 标记、后五卷机制引用、当前规范文档链接。'

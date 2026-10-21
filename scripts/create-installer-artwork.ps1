Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $projectRoot "src-tauri\icons"
$topoPath = Join-Path $iconsDir "topo-bg.jpg"
$iconPath = Join-Path $iconsDir "icon.png"

if (-not (Test-Path $topoPath) -or -not (Test-Path $iconPath)) {
    Write-Error "Required source images not found in $iconsDir"
    exit 1
}

$topoImg = [System.Drawing.Image]::FromFile($topoPath)
$logoImg = [System.Drawing.Image]::FromFile($iconPath)

# -------------------------------------------------------------
# 1. NSIS SIDEBAR (164 x 314)
# Clean, deep tactical dark #0e0d0c with subtle topo overlay,
# centered GTFO emblem, and a crisp subtle right border.
# No weird yellow blobs or cutoffs!
# -------------------------------------------------------------
function Create-NsisSidebar {
    param([string]$outputPath)
    $w = 164
    $h = 314
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Dark tactical base
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(14, 13, 12))
    $g.FillRectangle($bgBrush, 0, 0, $w, $h)

    # Draw topo background with soft dark overlay
    $g.DrawImage($topoImg, 0, 0, $w, $h)
    $overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(195, 14, 13, 12))
    $g.FillRectangle($overlayBrush, 0, 0, $w, $h)

    # Centered GTFO Emblem in upper-middle
    $logoSize = 104
    $logoX = [int](($w - $logoSize) / 2)
    $logoY = 48
    $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

    # Subtle refined amber divider below logo
    $penAmber = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 245, 158, 11), 1)
    $lineY = $logoY + $logoSize + 16
    $g.DrawLine($penAmber, 32, $lineY, $w - 32, $lineY)

    # Right edge separator (border between sidebar and white installer panel)
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(214, 211, 209), 1)
    $g.DrawLine($borderPen, $w - 1, 0, $w - 1, $h)

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created NSIS Sidebar: $outputPath ($w x $h)"
}

# -------------------------------------------------------------
# 2. NSIS HEADER (150 x 57)
# Top-right header image on internal wizard pages.
# White background so it matches the NSIS header banner,
# with the GTFO emblem cleanly placed on the right.
# -------------------------------------------------------------
function Create-NsisHeader {
    param([string]$outputPath)
    $w = 150
    $h = 57
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # White background matching standard NSIS header
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($whiteBrush, 0, 0, $w, $h)

    # Logo on right
    $logoSize = 44
    $logoX = $w - $logoSize - 8
    $logoY = [int](($h - $logoSize) / 2)
    $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created NSIS Header: $outputPath ($w x $h)"
}

# -------------------------------------------------------------
# 3. WIX / MSI DIALOG (493 x 312)
# Standard WiX UI puts text across the entire right 329 pixels in BLACK.
# Left 164px = Branded Dark Topo Sidebar with Logo.
# Right 329px = Pure White (#FFFFFF) so WiX black text is 100% legible!
# -------------------------------------------------------------
function Create-WixDialog {
    param([string]$outputPath)
    $w = 493
    $h = 312
    $sidebarW = 164
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # 1. Fill entire canvas with White (for the right content area)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($whiteBrush, 0, 0, $w, $h)

    # 2. Draw Left Sidebar (0 to 164px)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(14, 13, 12))
    $g.FillRectangle($bgBrush, 0, 0, $sidebarW, $h)

    # Draw Topo texture on sidebar
    $g.DrawImage($topoImg, 0, 0, $sidebarW, $h)
    $overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(195, 14, 13, 12))
    $g.FillRectangle($overlayBrush, 0, 0, $sidebarW, $h)

    # Logo in sidebar
    $logoSize = 104
    $logoX = [int](($sidebarW - $logoSize) / 2)
    $logoY = 48
    $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

    # Subtle amber divider below logo
    $penAmber = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 245, 158, 11), 1)
    $lineY = $logoY + $logoSize + 16
    $g.DrawLine($penAmber, 32, $lineY, $sidebarW - 32, $lineY)

    # Divider line between sidebar and white content area
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(214, 211, 209), 1)
    $g.DrawLine($borderPen, $sidebarW - 1, 0, $sidebarW - 1, $h)

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created WiX Dialog: $outputPath ($w x $h)"
}

# -------------------------------------------------------------
# 4. WIX / MSI BANNER (493 x 58)
# Top header across intermediate WiX dialogs.
# White background so black WiX title/subtitle text is crisp,
# with GTFO emblem on the far right.
# -------------------------------------------------------------
function Create-WixBanner {
    param([string]$outputPath)
    $w = 493
    $h = 58
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # White background for readable black text
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($whiteBrush, 0, 0, $w, $h)

    # Logo on far right
    $logoSize = 46
    $logoX = $w - $logoSize - 14
    $logoY = [int](($h - $logoSize) / 2)
    $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

    # Subtle bottom border line
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(214, 211, 209), 1)
    $g.DrawLine($borderPen, 0, $h - 1, $w, $h - 1)

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created WiX Banner: $outputPath ($w x $h)"
}

Create-NsisSidebar (Join-Path $iconsDir "nsis-sidebar.bmp")
Create-NsisHeader  (Join-Path $iconsDir "nsis-header.bmp")
Create-WixDialog   (Join-Path $iconsDir "wix-dialog.bmp")
Create-WixBanner   (Join-Path $iconsDir "wix-banner.bmp")

$topoImg.Dispose()
$logoImg.Dispose()
Write-Host "All installer artwork regenerated cleanly!"

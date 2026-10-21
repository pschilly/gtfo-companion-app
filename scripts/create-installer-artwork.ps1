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

function Create-Artwork {
    param(
        [int]$width,
        [int]$height,
        [string]$outputPath,
        [string]$type # 'nsis-sidebar', 'nsis-header', 'wix-dialog', 'wix-banner'
    )

    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Base background: Deep tactical stone / dark #0c0a09
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 10, 9))
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Draw Topo Background scaled & cropped with low opacity
    # We'll draw the topo texture
    $topoRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $g.DrawImage($topoImg, $topoRect)

    # Semi-transparent dark overlay to keep the topo pattern subtle and tactical
    $overlayColor = [System.Drawing.Color]::FromArgb(180, 12, 10, 9)
    $overlayBrush = New-Object System.Drawing.SolidBrush($overlayColor)
    $g.FillRectangle($overlayBrush, 0, 0, $width, $height)

    if ($type -eq 'nsis-sidebar') {
        # Amber tactical gradient at top-left
        $glowColor = [System.Drawing.Color]::FromArgb(40, 245, 158, 11)
        $glowBrush = New-Object System.Drawing.SolidBrush($glowColor)
        $g.FillEllipse($glowBrush, -40, -40, 180, 180)

        # Draw GTFO Emblem centered horizontally in the upper region
        $logoSize = 100
        $logoX = [int](($width - $logoSize) / 2)
        $logoY = 35
        $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

        # Draw subtle amber accent line below logo
        $penAmber = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 245, 158, 11), 1.5)
        $lineY = $logoY + $logoSize + 18
        $g.DrawLine($penAmber, 30, $lineY, $width - 30, $lineY)

        # Tactical right border line
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 68, 64, 60), 1)
        $g.DrawLine($borderPen, $width - 1, 0, $width - 1, $height)
    }
    elseif ($type -eq 'nsis-header') {
        # Logo on right side
        $logoSize = 44
        $logoX = $width - $logoSize - 12
        $logoY = [int](($height - $logoSize) / 2)
        $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

        # Subtle bottom border line
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 68, 64, 60), 1)
        $g.DrawLine($borderPen, 0, $height - 1, $width, $height - 1)
    }
    elseif ($type -eq 'wix-dialog') {
        # In WiX dialogs, the left ~164px is the prominent sidebar area, the right is the dialog body.
        # Draw emblem in the left 164px zone
        $sidebarWidth = 164
        $logoSize = 104
        $logoX = [int](($sidebarWidth - $logoSize) / 2)
        $logoY = 40
        $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

        # Subtle amber line below logo in sidebar area
        $penAmber = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 245, 158, 11), 1.5)
        $lineY = $logoY + $logoSize + 18
        $g.DrawLine($penAmber, 25, $lineY, $sidebarWidth - 25, $lineY)

        # Subtle divider line at x = 164
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 68, 64, 60), 1)
        $g.DrawLine($borderPen, $sidebarWidth, 0, $sidebarWidth, $height)
    }
    elseif ($type -eq 'wix-banner') {
        # Top banner for intermediate WiX steps
        $logoSize = 44
        $logoX = $width - $logoSize - 16
        $logoY = [int](($height - $logoSize) / 2)
        $g.DrawImage($logoImg, $logoX, $logoY, $logoSize, $logoSize)

        # Subtle bottom divider
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 68, 64, 60), 1)
        $g.DrawLine($borderPen, 0, $height - 1, $width, $height - 1)
    }

    $g.Dispose()

    # Save as 24-bit BMP
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    Write-Host "Created $outputPath ($width x $height)"
}

# Generate NSIS bitmaps
Create-Artwork -width 164 -height 314 -outputPath (Join-Path $iconsDir "nsis-sidebar.bmp") -type 'nsis-sidebar'
Create-Artwork -width 150 -height 57  -outputPath (Join-Path $iconsDir "nsis-header.bmp")  -type 'nsis-header'

# Generate WiX bitmaps
Create-Artwork -width 493 -height 312 -outputPath (Join-Path $iconsDir "wix-dialog.bmp")   -type 'wix-dialog'
Create-Artwork -width 493 -height 58  -outputPath (Join-Path $iconsDir "wix-banner.bmp")   -type 'wix-banner'

$topoImg.Dispose()
$logoImg.Dispose()
Write-Host "All installer branding bitmaps generated successfully!"

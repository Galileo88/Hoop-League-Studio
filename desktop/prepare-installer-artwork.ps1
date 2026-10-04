$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$artworkDir = Join-Path $projectRoot 'dist/installer-artwork'
$backgroundPath = Join-Path $artworkDir 'background.png'
New-Item -ItemType Directory -Path $artworkDir -Force | Out-Null
Add-Type -AssemblyName System.Drawing
if (-not (Test-Path -LiteralPath $backgroundPath)) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'windows/background.png') -Destination $backgroundPath
}

# Inno's default wizard has a 497:360 aspect ratio. Center-crop the source
# to that ratio so its basketballs and lettering retain their proportions.
$source = [System.Drawing.Image]::FromFile($backgroundPath)
try {
    $unit = [Math]::Max(1, [Math]::Floor([Math]::Min($source.Width / 497.0, $source.Height / 360.0)))
    $width = [int](497 * $unit)
    $height = [int](360 * $unit)
    $scale = [Math]::Max($width / [double]$source.Width, $height / [double]$source.Height)
    $cropWidth = $width / $scale
    $cropHeight = $height / $scale
    $crop = [System.Drawing.RectangleF]::new(($source.Width - $cropWidth) / 2, ($source.Height - $cropHeight) / 2, $cropWidth, $cropHeight)
    $fitted = [System.Drawing.Bitmap]::new($width, $height)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($fitted)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($source, [System.Drawing.RectangleF]::new(0, 0, $width, $height), $crop, [System.Drawing.GraphicsUnit]::Pixel)
        } finally { $graphics.Dispose() }
        $fitted.Save((Join-Path $artworkDir 'background-fit.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $fitted.Dispose() }
} finally { $source.Dispose() }

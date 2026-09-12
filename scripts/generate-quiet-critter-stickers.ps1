param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
$drawingAssembly = [System.Drawing.Bitmap].Assembly.Location
$drawingPrimitivesAssembly = [System.Drawing.Color].Assembly.Location
$drawingRoot = Split-Path $drawingAssembly
$windowsAssemblies = Get-ChildItem -LiteralPath $drawingRoot -Filter 'System.Private.Windows*.dll' | Select-Object -ExpandProperty FullName
Add-Type -ReferencedAssemblies (@($drawingAssembly, $drawingPrimitivesAssembly) + $windowsAssemblies) -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class QuietCritterStickerRenderer
{
    private static byte Clamp(double value)
    {
        return (byte)Math.Max(0, Math.Min(255, Math.Round(value)));
    }

    public static void Render(string sourcePath, string outputPath, string hexColor, int borderRadius)
    {
        using (var original = new Bitmap(sourcePath))
        using (var source = new Bitmap(original.Width, original.Height, PixelFormat.Format32bppArgb))
        using (var sourceGraphics = Graphics.FromImage(source))
        {
            sourceGraphics.DrawImageUnscaled(original, 0, 0);

            var rect = new Rectangle(0, 0, source.Width, source.Height);
            var data = source.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            var bytes = new byte[Math.Abs(data.Stride) * data.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);

            var target = ColorTranslator.FromHtml(hexColor);
            var targetLuminance = .2126 * target.R + .7152 * target.G + .0722 * target.B;
            const double mix = .92;

            for (var y = 0; y < source.Height; y++)
            {
                var row = y * data.Stride;
                for (var x = 0; x < source.Width; x++)
                {
                    var offset = row + x * 4;
                    var alpha = bytes[offset + 3];
                    if (alpha == 0) continue;

                    var blue = bytes[offset];
                    var green = bytes[offset + 1];
                    var red = bytes[offset + 2];
                    var luminance = .2126 * red + .7152 * green + .0722 * blue;
                    if (luminance >= 232 || luminance <= 48) continue;

                    var scale = targetLuminance <= 0 ? 1 : luminance / targetLuminance;
                    bytes[offset] = Clamp(blue * (1 - mix) + target.B * scale * mix);
                    bytes[offset + 1] = Clamp(green * (1 - mix) + target.G * scale * mix);
                    bytes[offset + 2] = Clamp(red * (1 - mix) + target.R * scale * mix);
                }
            }

            Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
            source.UnlockBits(data);

            using (var silhouette = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
            {
                var silhouetteData = silhouette.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                var silhouetteBytes = new byte[Math.Abs(silhouetteData.Stride) * silhouetteData.Height];
                for (var y = 0; y < source.Height; y++)
                {
                    var sourceRow = y * data.Stride;
                    var silhouetteRow = y * silhouetteData.Stride;
                    for (var x = 0; x < source.Width; x++)
                    {
                        var sourceOffset = sourceRow + x * 4;
                        var silhouetteOffset = silhouetteRow + x * 4;
                        silhouetteBytes[silhouetteOffset] = 255;
                        silhouetteBytes[silhouetteOffset + 1] = 255;
                        silhouetteBytes[silhouetteOffset + 2] = 255;
                        silhouetteBytes[silhouetteOffset + 3] = bytes[sourceOffset + 3];
                    }
                }
                Marshal.Copy(silhouetteBytes, 0, silhouetteData.Scan0, silhouetteBytes.Length);
                silhouette.UnlockBits(silhouetteData);

                using (var output = new Bitmap(source.Width + borderRadius * 2, source.Height + borderRadius * 2, PixelFormat.Format32bppArgb))
                using (var graphics = Graphics.FromImage(output))
                {
                    graphics.Clear(Color.Transparent);
                    graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceOver;
                    graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
                    graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;

                    var radii = new[] { borderRadius, Math.Max(1, borderRadius / 2) };
                    foreach (var radius in radii)
                    {
                        var steps = radius == borderRadius ? 72 : 36;
                        for (var step = 0; step < steps; step++)
                        {
                            var angle = Math.PI * 2 * step / steps;
                            var offsetX = borderRadius + (int)Math.Round(Math.Cos(angle) * radius);
                            var offsetY = borderRadius + (int)Math.Round(Math.Sin(angle) * radius);
                            graphics.DrawImageUnscaled(silhouette, offsetX, offsetY);
                        }
                    }

                    graphics.DrawImageUnscaled(source, borderRadius, borderRadius);
                    output.Save(outputPath, ImageFormat.Png);
                }
            }
        }
    }
}
'@

$outputRoot = Join-Path $PSScriptRoot '..\assets\stickers\quiet-critters'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$stickers = @(
    @{ Source = 'jump1.png';    Output = 'jump-lavender.png'; Color = '#9f87ea' },
    @{ Source = 'jump2.png';    Output = 'jump-blue.png';     Color = '#6baee8' },
    @{ Source = 'sleep2.png';   Output = 'sleep-mint.png';    Color = '#74c7a4' },
    @{ Source = 'armsway1.png'; Output = 'sway-rose.png';     Color = '#df8fb4' },
    @{ Source = 'blink1.png';   Output = 'blink-amber.png';   Color = '#dfa95e' },
    @{ Source = 'dance1.png';   Output = 'dance-moss.png';    Color = '#8fb66d' },
    @{ Source = 'dance2.png';   Output = 'dance-sky.png';     Color = '#79c8d9' },
    @{ Source = 'armsway2.png'; Output = 'sway-lavender.png'; Color = '#9f87ea' }
)

foreach ($sticker in $stickers) {
    $sourcePath = Join-Path $SourceRoot $sticker.Source
    $outputPath = Join-Path $outputRoot $sticker.Output
    [QuietCritterStickerRenderer]::Render($sourcePath, $outputPath, $sticker.Color, 22)
    Write-Output $outputPath
}

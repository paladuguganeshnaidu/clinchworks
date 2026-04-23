$files = Get-ChildItem -Path "c:\Users\ganes\OneDrive\Desktop\Clinch" -Filter "*.html" -Recurse
foreach ($file in $files) {
    if ($file.FullName -match "_archive") { continue }
    
    $content = Get-Content $file.FullName -Raw
    
    # 1. Replace tailwind CDN
    $content = $content -replace '<script src="https://cdn\.tailwindcss\.com"></script>', '<link rel="stylesheet" href="/assets/css/tailwind-compiled.css" />'
    
    # 2. Remove tailwind-config
    $content = $content -replace '<script src="/assets/js/tailwind-config\.js"></script>', ''
    
    # 3. Add defer to gsap
    $content = $content -replace '<script src="https://cdnjs\.cloudflare\.com/ajax/libs/gsap/3\.12\.2/gsap\.min\.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" defer></script>'
    $content = $content -replace '<script src="https://cdnjs\.cloudflare\.com/ajax/libs/gsap/3\.12\.2/ScrollTrigger\.min\.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" defer></script>'
    
    # 4. Add defer to script.js and footer-loader.js
    $content = $content -replace '<script src="/assets/js/script\.js(\?v=[0-9]+)?"></script>', '<script src="/assets/js/script.js$1" defer></script>'
    $content = $content -replace '<script src="/assets/js/footer-loader\.js(\?v=[0-9]+)?"></script>', '<script src="/assets/js/footer-loader.js$1" defer></script>'
    $content = $content -replace '<script src="/assets/js/notification\.js(\?v=[a-z0-9]+)?"></script>', '<script src="/assets/js/notification.js$1" defer></script>'

    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
Write-Output "Optimization Complete"

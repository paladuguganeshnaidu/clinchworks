const fs = require('fs');
const path = require('path');

['src/components', 'src/pages'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync('src/components/layout.html')) {
    const html = fs.readFileSync('index.html', 'utf8');
    const heroStartIdx = html.indexOf('  <!-- ========================================\r\n       HERO');
    const footerStartIdx = html.indexOf('  <!-- ========================================\r\n       FOOTER');

    // Fallbacks for LF vs CRLF
    const actualHeroIdx = heroStartIdx !== -1 ? heroStartIdx : html.indexOf('  <!-- ========================================\n       HERO');
    const actualFooterIdx = footerStartIdx !== -1 ? footerStartIdx : html.indexOf('  <!-- ========================================\n       FOOTER');

    if (actualHeroIdx === -1 || actualFooterIdx === -1) {
        console.error("Index not found! hero: " + actualHeroIdx + " footer: " + actualFooterIdx);
        process.exit(1);
    }

    const preHero = html.slice(0, actualHeroIdx);
    const mainBody = html.slice(actualHeroIdx, actualFooterIdx);
    const footerAndScripts = html.slice(actualFooterIdx);



    let layout = preHero + '\n  <!-- CONTENT_PLACEHOLDER -->\n' + footerAndScripts;
    layout = layout.replace(/<title>.*?<\/title>/, '<title>{{TITLE}}</title>');

    fs.writeFileSync('src/components/layout.html', layout);
    fs.writeFileSync('src/pages/index.html', mainBody);
}

const layoutTpl = fs.readFileSync('src/components/layout.html', 'utf8');

function compilePage(filename, title) {
    const content = fs.readFileSync(path.join('src/pages', filename), 'utf8');
    
    let finalHtml = layoutTpl.replace('{{TITLE}}', title + ' — Clinch Works');
    
    if (filename === 'index.html') {
        finalHtml = layoutTpl
            .replace('<title>{{TITLE}}</title>', '<title>Clinch Works — Engineering That Delivers</title>')
            .replace('<!-- CONTENT_PLACEHOLDER -->', content);
    } else {
        finalHtml = finalHtml.replace('<!-- CONTENT_PLACEHOLDER -->', '\n<div class="pt-24 min-h-screen">\n' + content + '\n</div>\n');
    }
    
    fs.writeFileSync(filename, finalHtml, 'utf8');
    console.log('Built: ' + filename);
}

compilePage('index.html', 'Home');
compilePage('services.html', 'Services');
compilePage('training.html', 'Training');
compilePage('projects.html', 'Projects');

if (fs.existsSync('generate_pages.js')) {
    fs.unlinkSync('generate_pages.js');
}

console.log('Build completed successfully.');

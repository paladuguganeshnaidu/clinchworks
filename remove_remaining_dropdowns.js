const fs = require('fs');
const path = require('path');

const dirs = [
  __dirname,
  path.join(__dirname, 'pages')
];

let filesProcessed = 0;

dirs.forEach(dir => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (!file.endsWith('.html')) return;
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;

    // 1. Remove classes from Home link
    content = content.replace(/<li class="nav-item-wrapper nav-has-dropdown"\s+data-target="dropdown-home">/g, '<li class="nav-item-wrapper">');
    content = content.replace(/ nav-has-dropdown"\s+data-target="dropdown-home"/g, '"');
    content = content.replace(/nav-has-dropdown"\s+data-target="dropdown-home"/g, '"');

    // 2. Remove classes from Training link
    content = content.replace(/<li class="nav-item-wrapper nav-has-dropdown"\s+data-target="dropdown-training">/g, '<li class="nav-item-wrapper">');
    content = content.replace(/ nav-has-dropdown"\s+data-target="dropdown-training"/g, '"');
    content = content.replace(/nav-has-dropdown"\s+data-target="dropdown-training"/g, '"');

    // 3. Remove the SECONDARY NAVIGATION MENU block entirely
    // We will find "<!-- SECONDARY NAVIGATION MENU" and remove everything up to the final </div></div> right before </header>
    // Wait, let's just match the block:
    const startMarker = '<!-- SECONDARY NAVIGATION MENU';
    const startIndex = content.indexOf(startMarker);
    if (startIndex !== -1) {
      // Find the end of this block. It's usually followed by "</div>\n  </header>"
      // Or we can just count divs. Let's just use a regex for safety:
      // It starts with startMarker, ends with the second </div> after the last </ul>
      const regex = /\s*<!-- SECONDARY NAVIGATION MENU[\s\S]*?id="secondary-nav"[\s\S]*?<\/ul>\s*<\/div>\s*<\/div>/g;
      
      // But wait! dropdown-services is gone, so what's the last ul? It could be dropdown-training or dropdown-home.
      content = content.replace(/\s*<!-- SECONDARY NAVIGATION MENU[\s\S]*?id="secondary-nav"[\s\S]*?<\/div>\s*<\/div>/g, '');
      
      // Fallback if the regex missed it because of extra divs:
      if (content.includes('id="secondary-nav"')) {
         // Manual string extraction
         const start = content.indexOf(startMarker);
         let end = content.indexOf('</header>', start);
         if (end !== -1) {
            // Find the </div></div> before </header>
            const headerPart = content.substring(start, end);
            content = content.replace(headerPart, '');
         }
      }
    }

    if (content !== original) {
      fs.writeFileSync(fullPath, content);
      console.log('Updated', fullPath);
      filesProcessed++;
    }
  });
});

console.log(`Done. Updated ${filesProcessed} files.`);

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
    
    let modified = false;

    // Remove the data-target and nav-has-dropdown classes from the li
    if (content.includes('data-target="dropdown-services"')) {
      content = content.replace(/<li class="nav-item-wrapper nav-has-dropdown"\s+data-target="dropdown-services">/g, '<li class="nav-item-wrapper">');
      
      // Also handle inline cases
      content = content.replace(/ nav-has-dropdown"\s+data-target="dropdown-services"/g, '"');
      content = content.replace(/nav-has-dropdown"\s+data-target="dropdown-services"/g, '"');
      modified = true;
    }

    // Remove the <ul> block completely
    if (content.includes('id="dropdown-services"')) {
      content = content.replace(/\s*<!--\s*Services Options\s*-->\s*<ul id="dropdown-services"[\s\S]*?<\/ul>/g, '');
      content = content.replace(/\s*<ul id="dropdown-services"[\s\S]*?<\/ul>/g, '');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log('Updated', fullPath);
      filesProcessed++;
    }
  });
});

console.log(`Done. Updated ${filesProcessed} files.`);

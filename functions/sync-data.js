const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'data');

fs.mkdirSync(outDir, { recursive: true });

const files = [
  { src: path.join(root, 'courses-content.json'), dst: path.join(outDir, 'courses-content.json') },
  { src: path.join(root, 'examquestions.json'), dst: path.join(outDir, 'examquestions.json') }
];

for (const { src, dst } of files) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source file: ${src}`);
  }
  fs.copyFileSync(src, dst);
}

console.log('Synced static JSON into functions/data');

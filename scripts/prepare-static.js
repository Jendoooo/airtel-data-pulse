// Optional static build helper.
// Copies public/ and synthetic demo data only; never copy a private usage snapshot.

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA = path.join(__dirname, '..', 'data');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
}

// Copy public -> dist
console.log('Copying public/ -> dist/');
copyDir(PUBLIC, DIST);

// Copy only synthetic demo data -> dist/data
const DEMO_DATA = path.join(DATA, 'usage.example.json');
if (fs.existsSync(DEMO_DATA)) {
  const distData = path.join(DIST, 'data');
  if (!fs.existsSync(distData)) fs.mkdirSync(distData, { recursive: true });
  console.log('Copying synthetic demo data -> dist/data/');
  fs.copyFileSync(DEMO_DATA, path.join(distData, 'usage.example.json'));
}

console.log('Build complete!');

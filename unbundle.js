// unbundle.js — reverses bundle.js: reads project-bundle.txt and recreates
// every file at its original relative path, making directories as needed.
//
// Usage (on the NEW laptop):
//   1. Put project-bundle.txt next to this script (or pass a path as argv[2])
//   2. node unbundle.js
//   3. npm install   (regenerates node_modules — wasn't in the bundle)

const fs = require("fs");
const path = require("path");

const bundlePath = process.argv[2] || path.join(process.cwd(), "project-bundle.txt");
const OUT_ROOT = process.cwd();

if (!fs.existsSync(bundlePath)) {
  console.error(`Can't find ${bundlePath}`);
  process.exit(1);
}

const text = fs.readFileSync(bundlePath, "utf8");
const fileRegex = /===== FILE START: (.+?) =====\n([\s\S]*?)\n===== FILE END: \1 =====/g;

let match;
let count = 0;

while ((match = fileRegex.exec(text)) !== null) {
  const relPath = match[1].trim();
  const content = match[2];
  const fullPath = path.join(OUT_ROOT, relPath);

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  count++;
  console.log("wrote", relPath);
}

console.log(`\nRestored ${count} files into ${OUT_ROOT}`);
console.log("Next: npm install, then npm run dev");

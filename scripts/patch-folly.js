const fs = require('fs');
const path = require('path');

const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'third-party-podspecs',
  'RCT-Folly.podspec'
);

if (!fs.existsSync(podspecPath)) {
  console.warn('[patch-folly] RCT-Folly.podspec not found, skipping.');
  process.exit(0);
}

let contents = fs.readFileSync(podspecPath, 'utf8');

if (contents.includes('folly/coro/*.h')) {
  console.log('[patch-folly] RCT-Folly.podspec already patched.');
  process.exit(0);
}

let replaced = 0;
contents = contents.replace(/(^\s*'folly\/system\/\*\.h',\s*\n)/gm, (match) => {
  if (replaced >= 2) return match;
  replaced += 1;
  const indent = match.match(/^\s*/)?.[0] ?? '';
  return `${match}${indent}'folly/coro/*.h',\n`;
});

if (replaced === 0) {
  console.warn('[patch-folly] Target insertion point not found, skipping.');
  process.exit(0);
}

fs.writeFileSync(podspecPath, contents);
console.log('[patch-folly] Added folly/coro headers to RCT-Folly.podspec.');

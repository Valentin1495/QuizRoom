const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'node_modules', 'expo', 'src', 'launch', 'withDevTools.tsx'),
  path.join(__dirname, '..', 'node_modules', 'expo', 'src', 'launch', 'withDevTools.ios.tsx'),
];

const sourceSnippet = [
  "const { useKeepAwake, ExpoKeepAwakeTag } = require('expo-keep-awake');",
  "      return () => useKeepAwake(ExpoKeepAwakeTag, { suppressDeactivateWarnings: true });",
].join('\n');

const patchedSnippet = [
  'const {',
  '        activateKeepAwakeAsync,',
  '        deactivateKeepAwake,',
  '        ExpoKeepAwakeTag,',
  "      } = require('expo-keep-awake');",
  '      return () => {',
  '        React.useEffect(() => {',
  '          activateKeepAwakeAsync(ExpoKeepAwakeTag).catch(() => {});',
  '          return () => {',
  '            deactivateKeepAwake(ExpoKeepAwakeTag).catch(() => {});',
  '          };',
  '        }, []);',
  '      };',
].join('\n');

let patchedCount = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-expo-keep-awake] File not found: ${filePath}`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes("activateKeepAwakeAsync(ExpoKeepAwakeTag).catch(() => {});")) {
    console.log(`[patch-expo-keep-awake] Already patched: ${path.basename(filePath)}`);
    patchedCount += 1;
    continue;
  }

  if (!original.includes(sourceSnippet)) {
    console.warn(
      `[patch-expo-keep-awake] Target snippet not found in ${path.basename(filePath)}, skipping.`
    );
    continue;
  }

  const next = original.replace(sourceSnippet, patchedSnippet);
  fs.writeFileSync(filePath, next);
  console.log(`[patch-expo-keep-awake] Patched ${path.basename(filePath)}`);
  patchedCount += 1;
}

if (patchedCount === 0) {
  console.warn('[patch-expo-keep-awake] No files patched.');
}

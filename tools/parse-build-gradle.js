const fs = require('fs');
const s = fs.readFileSync('apps/mobile/android/app/build.gradle', 'utf8');
const vc = s.match(/versionCode\s+(\d+)/);
const vn = s.match(/versionName\s+"([^"]+)"/);
console.log('versionCode:', vc ? vc[1] : 'NOT FOUND');
console.log('versionName:', vn ? vn[1] : 'NOT FOUND');

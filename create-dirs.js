const fs = require('fs');
const path = require('path');

const dirs = [
    'src/lib',
    'src/config',
    'src/components/advisor',
    'src/app/api/advisor/analyze',
    'src/app/api/advisor/face-analyze',
    'src/app/api/advisor/questions',
    'src/app/(advisor)/questions',
    'src/app/(advisor)/face-scan',
    'src/app/(advisor)/analyzing',
    'src/app/(advisor)/result'
];

dirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created: ${dir}`);
});

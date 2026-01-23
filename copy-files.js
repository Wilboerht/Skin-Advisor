const fs = require('fs');
const path = require('path');

const sourceBase = 'C:\\Users\\hongk\\Desktop\\nihplod.cn - master';
const destBase = 'C:\\Users\\hongk\\Desktop\\nihplod.cn - master\\skin-advisor-standalone';

const filesToCopy = [
    {
        src: 'src/components/website/advisor/FaceCapture.tsx',
        dest: 'src/components/advisor/FaceCapture.tsx'
    },
    {
        src: 'src/components/website/advisor/FaceAnalysisResult.tsx',
        dest: 'src/components/advisor/FaceAnalysisResult.tsx'
    },
    {
        src: 'src/components/website/advisor/ProgressBar.tsx',
        dest: 'src/components/advisor/ProgressBar.tsx'
    },
    {
        src: 'src/components/website/advisor/QuestionStep.tsx',
        dest: 'src/components/advisor/QuestionStep.tsx'
    }
];

// Copy files
filesToCopy.forEach(item => {
    const srcPath = path.join(sourceBase, item.src);
    const destPath = path.join(destBase, item.dest);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied: ${item.src} -> ${item.dest}`);
    } else {
        console.error(`Source file not found: ${srcPath}`);
    }
});

// Copy models directory
const modelsSrc = path.join(sourceBase, 'public/models');
const modelsDest = path.join(destBase, 'public/models');

if (fs.existsSync(modelsSrc)) {
    if (!fs.existsSync(modelsDest)) {
        fs.mkdirSync(modelsDest, { recursive: true });
    }

    const files = fs.readdirSync(modelsSrc);
    files.forEach(file => {
        const srcFile = path.join(modelsSrc, file);
        const destFile = path.join(modelsDest, file);
        fs.copyFileSync(srcFile, destFile);
    });
    console.log(`Copied models directory (${files.length} files)`);
} else {
    console.error(`Models directory not found: ${modelsSrc}`);
}

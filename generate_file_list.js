const fs = require('fs');
const path = require('path');

const directories = {
    'chao': 'Chao Voices',
    'sonic': 'Sonic',
    'shadow': 'Shadow',
    'pokemon': 'Pokemon'
};

const outputFile = path.join(__dirname, 'files.json');
const result = {};

try {
    for (const [key, dirName] of Object.entries(directories)) {
        const dirPath = path.join(__dirname, dirName);
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            result[key] = files.filter(f => f.toLowerCase().endsWith('.wav') || f.toLowerCase().endsWith('.mp3'));
            console.log(`Scanned ${dirName}: found ${result[key].length} files.`);
        } else {
            console.warn(`Directory not found: ${dirName}`);
            result[key] = [];
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`Successfully generated files.json with categorized sounds.`);
} catch (err) {
    console.error('Error scanning directories:', err);
}

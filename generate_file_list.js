const fs = require('fs');
const path = require('path');

const voicesDir = path.join(__dirname, 'Chao Voices');
const outputFile = path.join(__dirname, 'files.json');

try {
    const files = fs.readdirSync(voicesDir);
    const audioFiles = files.filter(f => f.toLowerCase().endsWith('.wav') || f.toLowerCase().endsWith('.mp3'));
    
    fs.writeFileSync(outputFile, JSON.stringify(audioFiles, null, 2));
    console.log(`Successfully generated files.json with ${audioFiles.length} files.`);
} catch (err) {
    console.error('Error scanning directory:', err);
}

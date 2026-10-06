const fs = require('fs');
const readline = require('readline');
async function run() {
    const fileStream = fs.createReadStream('C:/Users/revan/.gemini/antigravity/brain/dfdc1978-54de-492b-bc45-e422ff6d5223/.system_generated/logs/transcript_full.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let fullText = '';
    for await (const line of rl) {
        const obj = JSON.parse(line);
        if (obj.source === 'USER_EXPLICIT' && obj.content.includes('/* ===== LIGHT THEME ===== */')) {
            fullText = obj.content;
        }
    }
    
    if (fullText) {
        // extract the css part starting with LIGHT THEME
        const idx = fullText.indexOf('/* ===== LIGHT THEME ===== */');
        if (idx !== -1) {
            fs.writeFileSync('d:/STAR/SCSMAv2/user_light_css.css', fullText.substring(idx));
            console.log('Saved');
        }
    }
}
run();

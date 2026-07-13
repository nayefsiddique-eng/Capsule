const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.resolve(__dirname, '../assets/fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

function fetchCSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function downloadFonts() {
  try {
    console.log('Fetching Space Grotesk CSS...');
    const spaceCSS = await fetchCSS('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
    
    console.log('Fetching JetBrains Mono CSS...');
    const monoCSS = await fetchCSS('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
    
    // Extract WOFF2 URLs (latin charset)
    const extractUrl = (css, weight) => {
      const parts = css.split(`font-weight: ${weight}`);
      if (parts.length > 1) {
        const match = parts[1].match(/url\((https:\/\/[^)]+\.woff2)\)/);
        return match ? match[1] : null;
      }
      return null;
    };
    
    const spaceUrl = extractUrl(spaceCSS, '400') || spaceCSS.match(/url\((https:\/\/[^)]+\.woff2)\)/)[1];
    const monoUrl = extractUrl(monoCSS, '400') || monoCSS.match(/url\((https:\/\/[^)]+\.woff2)\)/)[1];
    
    console.log('Space Grotesk URL:', spaceUrl);
    console.log('JetBrains Mono URL:', monoUrl);
    
    await downloadFile(spaceUrl, path.join(fontsDir, 'space-grotesk.woff2'));
    await downloadFile(monoUrl, path.join(fontsDir, 'jetbrains-mono.woff2'));
    
    console.log('Fonts downloaded successfully!');
  } catch(e) {
    console.error('Error downloading fonts:', e);
  }
}

downloadFonts();

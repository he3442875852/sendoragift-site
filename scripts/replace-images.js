const fs = require('fs');
const https = require('https');
const path = require('path');

const assets = [
  ['premium-conference.jpg', 'https://tmpfiles.org/dl/wsw4cuDFqakD/premium-conference.jpg'],
  ['premium-corporate.jpg', 'https://tmpfiles.org/dl/w7wXcUDdqkqG/premium-corporate.jpg'],
  ['premium-event.jpg', 'https://tmpfiles.org/dl/wJwZcwDtqQpT/premium-event.jpg'],
  ['premium-executive.jpg', 'https://tmpfiles.org/dl/wewRcWDsNOeN/premium-executive.jpg'],
  ['premium-hero.jpg', 'https://tmpfiles.org/dl/wjwqcTDHNQ6f/premium-hero.jpg'],
  ['premium-holiday.jpg', 'https://tmpfiles.org/dl/wtwCcbDNNAHa/premium-holiday.jpg'],
  ['premium-promo.jpg', 'https://tmpfiles.org/dl/wuwsctDVNe5O/premium-promo.jpg'],
  ['premium-sports.jpg', 'https://tmpfiles.org/dl/wUw7c8DINybo/premium-sports.jpg'],
  ['premium-welcome.jpg', 'https://tmpfiles.org/dl/wPwfcjDyNH9E/premium-welcome.jpg']
];

const replacements = new Map([
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/hero.png', 'assets/premium-hero.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/corporate.png', 'assets/premium-corporate.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/welcome.png', 'assets/premium-welcome.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/promo.png', 'assets/premium-promo.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/event%20gift.png', 'assets/premium-event.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/event gift.png', 'assets/premium-event.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/executive%20gift.png', 'assets/premium-executive.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/executive gift.png', 'assets/premium-executive.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/conference%20gift.png', 'assets/premium-conference.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/conference gift.png', 'assets/premium-conference.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/sports.png', 'assets/premium-sports.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/holiday%20gift.png', 'assets/premium-holiday.jpg'],
  ['https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/holiday gift.png', 'assets/premium-holiday.jpg']
]);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.rmSync(dest, { force: true });
        return download(response.headers.location, dest).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(dest, { force: true });
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', error => {
      file.close();
      fs.rmSync(dest, { force: true });
      reject(error);
    });
  });
}

async function main() {
  fs.mkdirSync('assets', { recursive: true });
  for (const [name, url] of assets) {
    await download(url, path.join('assets', name));
  }

  const htmlFiles = fs.readdirSync('.').filter(file => file.endsWith('.html'));
  for (const file of htmlFiles) {
    let html = fs.readFileSync(file, 'utf8');
    for (const [from, to] of replacements) {
      html = html.split(from).join(to);
    }
    fs.writeFileSync(file, html, 'utf8');
  }

  fs.rmSync('scripts/replace-images.js', { force: true });
  fs.rmSync('.github/workflows/replace-images.yml', { force: true });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

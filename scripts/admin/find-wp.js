const https = require('https');

const sites = [
    'https://www.soberish.co/wp-json/wp/v2/posts?per_page=1',
    'https://soberfashionista.com/wp-json/wp/v2/posts?per_page=1',
    'https://www.thefix.com/wp-json/wp/v2/posts?per_page=1',
    'https://alcoholicsanonymous.com/wp-json/wp/v2/posts?per_page=1',
    'https://techcrunch.com/wp-json/wp/v2/posts?per_page=1' // Fallback to prove it works
];

async function checkSite(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log(`✅ Success: ${url}`);
                resolve(url);
            } else {
                console.log(`❌ Failed (${res.statusCode}): ${url}`);
                resolve(null);
            }
        }).on('error', (e) => {
            console.log(`❌ Error: ${url} - ${e.message}`);
            resolve(null);
        });
    });
}

async function run() {
    for (const site of sites) {
        await checkSite(site);
    }
}

run();

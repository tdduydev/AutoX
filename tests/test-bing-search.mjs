// Test Bing search parsing
const res = await fetch('https://www.bing.com/search?q=weather+hanoi+today&count=5', {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
});

const html = await res.text();
const blocks = html.split('class="b_algo"');
console.log('Total result blocks:', blocks.length - 1);

const results = [];
for (let i = 1; i < blocks.length && results.length < 5; i++) {
    const block = blocks[i];

    // Extract real URL from u=a1... base64 pattern
    const urlMatch = block.match(/u=a1([^&"]+)/);
    let url = '';
    if (urlMatch) {
        try {
            url = Buffer.from(urlMatch[1], 'base64').toString();
        } catch { /* fallback */ }
    }

    // Fallback: try to get URL from href with http but not bing.com
    if (!url) {
        const hrefMatch = block.match(/href="(https?:\/\/(?!www\.bing\.com)[^"]+)"/);
        if (hrefMatch) url = hrefMatch[1];
    }

    // Get title from <a> target="_blank" with h= attribute  
    const titleLinkMatch = block.match(/<a[^>]*target="_blank"[^>]*h="ID=SERP[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    let title = '';
    if (titleLinkMatch) {
        title = titleLinkMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    // Fallback title: aria-label on tilk link
    if (!title) {
        const ariaMatch = block.match(/aria-label="([^"]+)"/);
        if (ariaMatch) title = ariaMatch[1];
    }

    // Get snippet from <p> inside b_caption or b_paractl
    const snippetMatch = block.match(/<p[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    let snippet = '';
    if (snippetMatch) {
        snippet = snippetMatch[1].replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim().slice(0, 300);
    }

    if (title || url) {
        results.push({ title: title || url, url, snippet });
    }
}

console.log('\nParsed results:');
results.forEach((r, i) => {
    console.log(`\n[${i + 1}] ${r.title}`);
    console.log(`    URL: ${r.url}`);
    console.log(`    Snippet: ${r.snippet.substring(0, 100)}...`);
});

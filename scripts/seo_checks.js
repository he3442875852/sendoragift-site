const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const siteOrigin = 'https://www.sendoragift.com';

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (name.endsWith('.html')) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function routeForFile(file) {
  const relative = rel(file);
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}

function fileForRoute(route) {
  const clean = route.split('?')[0].split('#')[0];
  if (clean === '/') return path.join(root, 'index.html');
  if (clean.endsWith('/')) return path.join(root, clean.slice(1), 'index.html');
  return path.join(root, clean.slice(1));
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeVisibleText(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  return stripTags(value)
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/\s+/g, ' ').trim();
}

function schemaNodes(value, nodes = []) {
  if (Array.isArray(value)) value.forEach(item => schemaNodes(item, nodes));
  else if (value && typeof value === 'object') {
    nodes.push(value);
    Object.values(value).forEach(item => schemaNodes(item, nodes));
  }
  return nodes;
}

function getContent(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].trim() : '';
}

function titleOf(html) {
  return stripTags(getContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
}

function descriptionOf(html) {
  return (
    getContent(html, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    getContent(html, /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)
  );
}

function canonicalOf(html, file) {
  return (
    getContent(html, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i) ||
    getContent(html, /<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i) ||
    `${siteOrigin}${routeForFile(file)}`
  );
}

function hasNoindex(html) {
  return /<meta\s+[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function hasHeadMeta(html, kind, name) {
  const attr = kind === 'property' ? 'property' : 'name';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<meta\\s+[^>]*${attr}=["']${escaped}["']`, 'i').test(html);
}

function attrOf(tag, attr) {
  const match = tag.match(new RegExp(`\\b${attr}=["']([^"']*)["']`, 'i'));
  return match ? match[1].trim() : '';
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url, siteOrigin);
    if (parsed.origin !== siteOrigin) return null;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

function localPathForSrc(src, file) {
  if (!src || /^(https?:)?\/\//i.test(src) || /^data:/i.test(src)) return null;
  if (src.startsWith('/')) return path.join(root, src.replace(/^\/+/, ''));
  return path.resolve(path.dirname(file), src);
}

function parseWebpSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16),
        height: 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16),
      };
    }
    if (type === 'VP8L' && data + 5 <= buffer.length) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8 ' && data + 10 <= buffer.length) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    offset += 8 + length + (length % 2);
  }
  return null;
}

function loadRedirectSources() {
  const configPath = path.join(root, 'vercel.json');
  if (!fs.existsSync(configPath)) return new Set();
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return new Set((config.redirects || []).filter(item => item.permanent).map(item => item.source));
}

function pushGroupedDuplicates(errors, label, map) {
  for (const [value, pages] of map.entries()) {
    if (pages.length > 1) errors.push(`${label} duplicated for ${pages.join(', ')}: "${value}"`);
  }
}

const redirectSources = loadRedirectSources();
const htmlFiles = walk(root);
const errors = [];
const warnings = [];
const pageData = [];
const imageSizeCache = new Map();

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const route = routeForFile(file);
  const canonical = canonicalOf(html, file);
  const canonicalPath = normalizeUrl(canonical)?.replace(siteOrigin, '') || route;
  const utilityFile = /^google[a-z0-9]+\.html$/i.test(rel(file)) || rel(file).startsWith('assets/');
  const indexable = !utilityFile && !hasNoindex(html) && !redirectSources.has(route);

  pageData.push({ file, route, html, canonical, canonicalPath, indexable });

  if (/\uFFFD|鈥\?|(?:â|Â)(?:€|™|œ|“|”|‘|’)/u.test(html)) {
    errors.push(`${rel(file)} contains mojibake or malformed UTF-8 text.`);
  }

  if (indexable) {
    const expectedCanonical = `${siteOrigin}${route}`;
    const hasCanonical = /<link\s+[^>]*rel=["']canonical["']/i.test(html);
    if (!hasCanonical || canonical !== expectedCanonical) {
      errors.push(`${rel(file)} must declare its canonical route ${expectedCanonical}.`);
    }
    const ogUrl = getContent(html, /<meta\s+[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
      getContent(html, /<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:url["'][^>]*>/i);
    if (ogUrl !== canonical) errors.push(`${rel(file)} og:url differs from its canonical URL.`);
    const visibleText = normalizeVisibleText(html);
    const nodes = [];
    for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { schemaNodes(JSON.parse(block[1]), nodes); }
      catch (error) { errors.push(`${rel(file)} has invalid JSON-LD: ${error.message}`); }
    }
    const articles = nodes.filter(node => [].concat(node['@type'] || []).some(type => ['Article', 'BlogPosting', 'NewsArticle'].includes(type)));
    for (const article of articles) {
      if (!article.image) errors.push(`${rel(file)} article schema is missing its representative image.`);
      const mainEntityUrl = typeof article.mainEntityOfPage === 'string' ? article.mainEntityOfPage : article.mainEntityOfPage?.['@id'];
      if (mainEntityUrl && normalizeUrl(mainEntityUrl) !== canonical) {
        errors.push(`${rel(file)} article mainEntityOfPage differs from its canonical URL.`);
      }
      for (const field of ['datePublished', 'dateModified']) {
        if (article[field] && !Number.isFinite(Date.parse(article[field]))) {
          errors.push(`${rel(file)} article has an invalid ${field}.`);
        }
      }
      if (article.datePublished && article.dateModified && Date.parse(article.dateModified) < Date.parse(article.datePublished)) {
        errors.push(`${rel(file)} article dateModified precedes datePublished.`);
      }
    }
    if (route === '/blog/') {
      const list = nodes.find(node => node['@type'] === 'ItemList' && node['@id'] === `${canonical}#articles`);
      if (!list) errors.push('blog/index.html must describe its visible article directory as an ItemList.');
      else {
        const items = list.itemListElement || [];
        const linkedUrls = new Set([...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(match => normalizeUrl(new URL(match[1], canonical).href)));
        const listedUrls = new Set();
        if (list.numberOfItems !== items.length) errors.push('blog/index.html article count differs from its ItemList.');
        items.forEach((item, index) => {
          if (item.position !== index + 1 || !item.name || !linkedUrls.has(item.url) || listedUrls.has(item.url)) {
            errors.push(`blog/index.html has an invalid or invisible article listing: ${item.url || '(missing URL)'}`);
          }
          listedUrls.add(item.url);
        });
      }
    }
    const faqs = nodes.filter(node => [].concat(node['@type'] || []).includes('FAQPage'));
    if (faqs.length > 1) errors.push(`${rel(file)} declares ${faqs.length} FAQPage nodes; consolidate its visible questions.`);
    for (const faq of faqs) {
      const names = new Set();
      for (const question of faq.mainEntity || []) {
        const name = normalizeVisibleText(question.name);
        const answer = normalizeVisibleText(question.acceptedAnswer?.text);
        if (!name || !answer || !visibleText.includes(name) || !visibleText.includes(answer)) {
          errors.push(`${rel(file)} FAQ schema does not match visible text: ${name || '(missing question)'}`);
        }
        if (names.has(name)) errors.push(`${rel(file)} repeats an FAQ schema question: ${name}`);
        names.add(name);
      }
    }
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
    const ids = new Set([...markup.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]));
    for (const label of markup.matchAll(/\baria-labelledby=["']([^"']+)["']/gi)) {
      for (const id of label[1].split(/\s+/)) {
        if (!ids.has(id)) errors.push(`${rel(file)} references missing aria-labelledby ID ${id}.`);
      }
    }
    const h1s = html.match(/<h1\b[\s\S]*?<\/h1>/gi) || [];
    if (h1s.length === 0) errors.push(`${rel(file)} (${route}) is missing an H1.`);
    if (h1s.length > 1) warnings.push(`${rel(file)} (${route}) has ${h1s.length} H1 tags.`);

    for (const [kind, name] of [
      ['property', 'og:type'],
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['property', 'og:url'],
      ['property', 'og:image'],
      ['name', 'twitter:card'],
      ['name', 'twitter:title'],
      ['name', 'twitter:description'],
      ['name', 'twitter:image'],
    ]) {
      if (!hasHeadMeta(html, kind, name)) errors.push(`${rel(file)} (${route}) is missing ${name} metadata.`);
    }
  }

  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    const alt = getContent(img, /\balt=["']([^"']*)["']/i);
    if (!/\balt\s*=/i.test(img) || alt.trim() === '') errors.push(`${rel(file)} has an image with missing or empty alt text: ${img.slice(0, 120)}`);

    const src = getContent(img, /\bsrc=["']([^"']+)["']/i);
    const local = localPathForSrc(src, file);
    if (!local || !fs.existsSync(local) || path.extname(local).toLowerCase() !== '.webp') continue;
    if (!imageSizeCache.has(local)) imageSizeCache.set(local, parseWebpSize(local));
    const size = imageSizeCache.get(local);
    if (!size) continue;
    const width = Number(getContent(img, /\bwidth=["'](\d+)["']/i));
    const height = Number(getContent(img, /\bheight=["'](\d+)["']/i));
    if (!width || !height) errors.push(`${rel(file)} image ${src} is missing width or height.`);
    else if (width !== size.width || height !== size.height) {
      errors.push(`${rel(file)} image ${src} has width/height ${width}x${height}, expected ${size.width}x${size.height}.`);
    }
  }

  for (const form of html.match(/<form\b[\s\S]*?<\/form>/gi) || []) {
    for (const control of form.match(/<(input|select|textarea)\b[\s\S]*?(?:>|<\/select>|<\/textarea>)/gi) || []) {
      const type = (attrOf(control, 'type') || '').toLowerCase();
      const name = attrOf(control, 'name');
      if (name === '_gotcha') continue;
      if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(type)) continue;
      if (/\baria-label\s*=|\baria-labelledby\s*=/i.test(control)) continue;
      const id = attrOf(control, 'id');
      if (id && new RegExp(`<label\\b[^>]*for=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(form)) continue;
      errors.push(`${rel(file)} has a form control without an accessible name: ${control.slice(0, 120)}`);
    }
  }
}

const homepage = pageData.find(item => item.route === '/');
if (homepage) {
  const serviceCardKeys = new Map();
  for (const card of homepage.html.match(/<article\b[^>]*class=["'][^"']*service-card[^"']*["'][^>]*>[\s\S]*?<\/article>/gi) || []) {
    const href = getContent(card, /<a\b[^>]*href=["']([^"']+)["']/i);
    const heading = stripTags(getContent(card, /<h3\b[^>]*>([\s\S]*?)<\/h3>/i));
    if (!href || !heading) continue;
    const key = `${href}::${heading}`;
    serviceCardKeys.set(key, (serviceCardKeys.get(key) || 0) + 1);
  }
  for (const [key, count] of serviceCardKeys.entries()) {
    if (count > 1) errors.push(`index.html repeats the same buyer-path card ${count} times: ${key}`);
  }

  const visibleHomepageText = stripTags(homepage.html);
  if (/\b(?:AEO|GEO)\b/.test(visibleHomepageText)) {
    errors.push('index.html exposes internal AEO/GEO optimization terminology to buyers.');
  }
}

const titles = new Map();
const descriptions = new Map();
for (const page of pageData.filter(item => item.indexable)) {
  const title = titleOf(page.html);
  const description = descriptionOf(page.html);
  if (!title) errors.push(`${rel(page.file)} (${page.route}) is missing a title.`);
  if (!description) errors.push(`${rel(page.file)} (${page.route}) is missing a meta description.`);
  if (title) titles.set(title, [...(titles.get(title) || []), page.route]);
  if (description) descriptions.set(description, [...(descriptions.get(description) || []), page.route]);
}
pushGroupedDuplicates(errors, 'Title', titles);
pushGroupedDuplicates(errors, 'Meta description', descriptions);

const sitemapPath = path.join(root, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim());
const sitemapUrls = new Set(sitemapLocations);
if (sitemapUrls.size !== sitemapLocations.length) errors.push('sitemap.xml contains duplicate URLs.');
const indexableCanonicals = new Set(pageData.filter(item => item.indexable).map(item => item.canonical));
for (const page of pageData.filter(item => item.indexable)) {
  if (!sitemapUrls.has(page.canonical)) errors.push(`${rel(page.file)} canonical URL is missing from sitemap.xml: ${page.canonical}`);
}
for (const loc of sitemapUrls) {
  const parsed = normalizeUrl(loc);
  if (!parsed) { errors.push(`sitemap.xml includes a URL outside the canonical site origin: ${loc}`); continue; }
  if (!indexableCanonicals.has(loc)) errors.push(`sitemap.xml includes a non-indexable or non-canonical URL: ${loc}`);
  const route = new URL(loc).pathname;
  if (redirectSources.has(route)) errors.push(`sitemap.xml includes redirected URL ${loc}.`);
  const target = fileForRoute(route);
  if (!fs.existsSync(target)) errors.push(`sitemap.xml URL does not resolve to a local HTML file: ${loc}`);
}
const geoSitemapPath = path.join(root, 'sitemap-geo.xml');
if (fs.existsSync(geoSitemapPath)) {
  const geoUrls = [...fs.readFileSync(geoSitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim());
  if (new Set(geoUrls).size !== geoUrls.length) errors.push('sitemap-geo.xml contains duplicate URLs.');
  for (const loc of geoUrls) {
    if (!sitemapUrls.has(loc)) errors.push(`sitemap-geo.xml includes a URL absent from sitemap.xml: ${loc}`);
  }
}

for (const page of pageData) {
  for (const link of page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = link[1].trim();
    if (!href || href === '#' || /^(mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(href)) continue;
    let parsed;
    try {
      parsed = new URL(href, `${siteOrigin}${page.route}`);
    } catch {
      errors.push(`${rel(page.file)} has an invalid href: ${href}`);
      continue;
    }
    if (parsed.origin !== siteOrigin) continue;
    const targetRoute = parsed.pathname;
    if (redirectSources.has(targetRoute)) {
      if (page.indexable) errors.push(`${rel(page.file)} links through a redirect instead of its canonical destination: ${href}`);
      continue;
    }
    const targetFile = fileForRoute(targetRoute);
    if (!fs.existsSync(targetFile)) errors.push(`${rel(page.file)} links to missing route ${href}`);
    if (parsed.hash && fs.existsSync(targetFile)) {
      const targetHtml = fs.readFileSync(targetFile, 'utf8');
      const id = parsed.hash.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`\\b(?:id|name)=["']${id}["']`, 'i').test(targetHtml)) {
        errors.push(`${rel(page.file)} links to missing fragment ${href}`);
      }
    }
  }
}

// A page's own fragment links must not hide a disconnected cluster.
const indexableByRoute = new Map(pageData.filter(page => page.indexable).map(page => [page.route, page]));
const reachableRoutes = new Set();
const crawlQueue = indexableByRoute.has('/') ? ['/'] : [];
while (crawlQueue.length) {
  const route = crawlQueue.shift();
  if (reachableRoutes.has(route)) continue;
  reachableRoutes.add(route);
  const page = indexableByRoute.get(route);
  for (const link of page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    let target;
    try { target = new URL(link[1], page.canonical); }
    catch { continue; } // The link-validation pass reports malformed URLs.
    if (target.origin === siteOrigin && indexableByRoute.has(target.pathname) && !reachableRoutes.has(target.pathname)) {
      crawlQueue.push(target.pathname);
    }
  }
}
for (const [route, page] of indexableByRoute) {
  if (!reachableRoutes.has(route)) errors.push(`${rel(page.file)} cannot be reached through indexable internal links from the homepage.`);
}

if (warnings.length) {
  console.log('SEO check warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length) {
  console.error('SEO checks failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO checks passed for ${indexableByRoute.size} indexable pages; all are reachable from the homepage.`);

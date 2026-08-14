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
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim()));
for (const page of pageData.filter(item => item.indexable)) {
  if (!sitemapUrls.has(page.canonical)) errors.push(`${rel(page.file)} canonical URL is missing from sitemap.xml: ${page.canonical}`);
}
for (const loc of sitemapUrls) {
  const parsed = normalizeUrl(loc);
  if (!parsed) continue;
  const route = new URL(loc).pathname;
  if (redirectSources.has(route)) errors.push(`sitemap.xml includes redirected URL ${loc}.`);
  const target = fileForRoute(route);
  if (!fs.existsSync(target)) errors.push(`sitemap.xml URL does not resolve to a local HTML file: ${loc}`);
}

for (const page of pageData) {
  for (const link of page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = link[1].trim();
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(href)) continue;
    let parsed;
    try {
      parsed = new URL(href, `${siteOrigin}${page.route}`);
    } catch {
      errors.push(`${rel(page.file)} has an invalid href: ${href}`);
      continue;
    }
    if (parsed.origin !== siteOrigin) continue;
    const targetRoute = parsed.pathname;
    if (redirectSources.has(targetRoute)) continue;
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

if (warnings.length) {
  console.log('SEO check warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length) {
  console.error('SEO checks failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO checks passed for ${pageData.filter(item => item.indexable).length} indexable pages.`);

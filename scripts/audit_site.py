from pathlib import Path
import re, sys
ROOT=Path('.').resolve(); errors=[]; warnings=[]
COMPANY='Shenzhen Gelinhong Technology Co., Ltd.'; EMAIL='mcpatch@188.com'; ALIBABA='https://gelinhong.en.alibaba.com/'
def fail(p,m): errors.append(f'{p}: {m}')
def warn(p,m): warnings.append(f'{p}: {m}')
htmls=[p for p in ROOT.rglob('*.html') if '.git' not in p.parts and not p.name.startswith('google')]
for p in htmls:
    raw=p.read_bytes()
    try:
        t=raw.decode('utf-8')
    except UnicodeDecodeError as exc:
        fail(p.relative_to(ROOT).as_posix(),f'invalid UTF-8: {exc}')
        t=raw.decode('utf-8', errors='replace')
    name=p.relative_to(ROOT).as_posix()
    if any(x in t for x in ['codex-2026-06-27','data-content-expansion','data-final-expansion','data-seo-schema']): fail(name,'internal Codex marker remains')
    if '\ufffd' in t or 'Page Intent' in t or 'Temporary visuals' in t or 'during migration' in t: fail(name,'buyer-visible internal or malformed text remains')
    if t.count('<h1') != 1: warn(name,f'H1 count is {t.count("<h1")}')
    if '<title>' not in t: warn(name,'missing title')
    if '<img' in t and 'site-v6.css' not in t and 'image ratio guard' not in t: warn(name,'no shared image ratio CSS')
    if '<footer' in t and COMPANY not in t: warn(name,'footer lacks legal company')
    for m in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', t):
        if m.lower()!=EMAIL: fail(name,f'unexpected email {m}')
    for forbidden in ['ISO 9001 certified','certified factory','verified factory','5-star reviews','trusted by Fortune']:
        if forbidden.lower() in t.lower(): fail(name,f'unsupported claim: {forbidden}')
c=ROOT/'contact/index.html'
if c.exists():
    t=c.read_text(encoding='utf-8')
    for needed in ['/api/submit-quote','_next','type="file"','privacy_consent','wa.me/8613400883682']:
        if needed not in t: fail('contact/index.html',f'missing preserved contact feature {needed}')
faq=ROOT/'corporate-gift-faq.html'
if faq.exists():
    t=faq.read_text(encoding='utf-8')
    if 'noindex' not in t.lower() and t.count('@type":"Question"')<8 and t.count('"@type": "Question"')<8: fail('corporate-gift-faq.html','FAQ schema appears incomplete')
cases=ROOT/'cases'
if cases.exists():
    for p in cases.glob('*.html'):
        t=p.read_text(encoding='utf-8')
        if 'Sample Project / Reference Solution' not in t or 'case-disclaimer' not in t: fail(p.relative_to(ROOT).as_posix(),'case not clearly labeled as sample/reference')
facts=ROOT/'SITE_FACTS.md'
if not facts.exists() or COMPANY not in facts.read_text(encoding='utf-8'): fail('SITE_FACTS.md','missing confirmed company facts')
if not (ROOT/'llms.txt').exists(): fail('llms.txt','missing')
css=''.join([p.read_text(encoding='utf-8') for p in [ROOT/'assets/site-v6.css',ROOT/'assets/styles.css'] if p.exists()])
if 'height:auto' not in css: fail('assets css','missing image height:auto guard')
print('SITE AUDIT')
print(f'errors={len(errors)} warnings={len(warnings)}')
for e in errors: print('ERROR '+e)
for w in warnings[:40]: print('WARN '+w)
sys.exit(1 if errors else 0)

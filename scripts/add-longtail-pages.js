const fs = require('fs');

const today = '2026-06-10';
const site = 'https://www.sendoragift.com';
const contactEmail = 'rita@mcpatch.com';

const pages = [
  {
    file: 'custom-logo-gifts.html',
    title: 'Custom Logo Gifts | Branded Corporate Gifts Supplier | Sendora Gift',
    description: 'Custom logo gifts for corporate clients, events, employees and promotional campaigns. Sendora Gift provides branded business gifts with logo printing, packaging and worldwide shipping.',
    h1: 'Custom Logo Gifts for Business Branding',
    intro: 'Sendora Gift helps companies create custom logo gifts for employees, clients, events, exhibitions and marketing campaigns. Choose practical products, add your brand logo and build a gift solution that matches your audience, budget and delivery schedule.',
    image: 'promo.png',
    imageAlt: 'custom logo gifts and branded promotional products',
    sections: [
      ['Popular Custom Logo Gift Ideas', 'Common options include tumblers, mugs, notebooks, pens, tote bags, caps, umbrellas, lanyards, keychains, mouse pads and gift boxes. These products are useful for daily work, events and brand promotion.'],
      ['Logo Customization Methods', 'We support screen printing, UV printing, laser engraving, embroidery, heat transfer, embossing and custom packaging. The best method depends on the product material, order quantity and desired brand effect.'],
      ['Best Uses', 'Custom logo gifts are suitable for employee rewards, customer appreciation, trade shows, conferences, product launches, onboarding kits and seasonal campaigns.']
    ],
    faqs: [
      ['What products can be customized with a logo?', 'Drinkware, notebooks, pens, bags, apparel, umbrellas, lanyards, keychains, office accessories and gift boxes can usually be customized with a logo.'],
      ['Can you recommend logo methods?', 'Yes. We recommend printing, engraving, embroidery or packaging options based on the product material and your design.'],
      ['What is the MOQ for custom logo gifts?', 'MOQ depends on product type and customization method. Many custom gift projects start from around 100 units.']
    ]
  },
  {
    file: 'bulk-corporate-gifts.html',
    title: 'Bulk Corporate Gifts | Custom Business Gifts in Large Quantity | Sendora Gift',
    description: 'Order bulk corporate gifts with logo customization and packaging support. Sendora Gift supplies business gifts for events, employees, clients and promotional campaigns worldwide.',
    h1: 'Bulk Corporate Gifts with Custom Branding',
    intro: 'Bulk corporate gifts are ideal for companies planning employee programs, large events, client campaigns or annual appreciation projects. Sendora Gift supports product selection, branding, packaging, quality checking and shipment for large-quantity business gift orders.',
    image: 'corporate.png',
    imageAlt: 'bulk corporate gifts with custom branding',
    sections: [
      ['Bulk Gift Planning', 'A successful bulk gift order starts with the target audience, quantity, budget, logo requirements and deadline. We help buyers compare suitable products and packaging options before production.'],
      ['Cost-Effective Product Choices', 'Popular bulk gift items include pens, notebooks, mugs, bottles, tote bags, caps, lanyards, umbrellas and office accessories. Product combinations can be adjusted for different budget levels.'],
      ['Production and Delivery', 'We support sample confirmation, bulk production, inspection and shipping by express, air, sea or door-to-door logistics depending on order size and destination.']
    ],
    faqs: [
      ['Can you handle large corporate gift orders?', 'Yes. Sendora Gift supports bulk corporate gift projects for global B2B clients, distributors and event organizers.'],
      ['Can products be packed individually?', 'Yes. We can support individual packaging, custom gift boxes, paper bags, sleeves, labels and insert cards.'],
      ['How long does a bulk order take?', 'Production usually takes 3-5 weeks depending on quantity, product complexity and customization requirements.']
    ]
  },
  {
    file: 'corporate-gifts-for-clients.html',
    title: 'Corporate Gifts for Clients | Custom Client Appreciation Gifts | Sendora Gift',
    description: 'Custom corporate gifts for clients, partners and customer appreciation programs. Build branded gift boxes with premium products, logo customization and worldwide shipping.',
    h1: 'Corporate Gifts for Clients and Partners',
    intro: 'Client gifts should feel professional, useful and aligned with your brand. Sendora Gift helps companies create custom corporate gifts for customers, distributors, VIP partners and appreciation campaigns.',
    image: 'executive gift.png',
    imageAlt: 'corporate gifts for clients and partners',
    sections: [
      ['Client Gift Ideas', 'Recommended items include premium tumblers, ceramic mugs, leather notebooks, metal pens, card holders, desk accessories, umbrellas, tote bags and rigid gift boxes.'],
      ['Premium Presentation', 'Packaging is important for client gifting. Custom gift boxes, greeting cards, paper sleeves, inserts and branded bags help create a stronger unboxing experience.'],
      ['When to Send Client Gifts', 'Client gifts are useful for contract renewals, holiday programs, customer appreciation, company anniversaries, product launches and partnership milestones.']
    ],
    faqs: [
      ['Can we make premium client gift boxes?', 'Yes. We can combine premium products with custom packaging, cards and logo branding.'],
      ['Can different clients receive different gift combinations?', 'Yes. Gift combinations can be adjusted by budget level, recipient type or campaign purpose.'],
      ['Do you support worldwide delivery?', 'Yes. We support express, air, sea and door-to-door shipping for corporate gift projects.']
    ]
  },
  {
    file: 'branded-employee-onboarding-kits.html',
    title: 'Branded Employee Onboarding Kits | New Hire Welcome Gifts | Sendora Gift',
    description: 'Create branded employee onboarding kits for new hires with drinkware, notebooks, bags, apparel, desk accessories, welcome cards and custom packaging.',
    h1: 'Branded Employee Onboarding Kits for New Hires',
    intro: 'A well-designed employee onboarding kit helps new hires feel welcomed and connected to the company from day one. Sendora Gift supplies branded new hire kits with practical products, logo customization and packaging support.',
    image: 'welcome.png',
    imageAlt: 'branded employee onboarding kits for new hires',
    sections: [
      ['What to Include', 'Popular onboarding kit items include tumblers, mugs, notebooks, pens, tote bags, backpacks, T-shirts, caps, mouse pads, desk mats and welcome cards.'],
      ['Brand Experience', 'Consistent colors, logo placement, packaging design and a welcome message help the kit reflect your company culture and HR brand.'],
      ['Flexible Programs', 'We support small team onboarding, fast-growing startup kits, multinational employee programs and recurring new hire gift projects.']
    ],
    faqs: [
      ['Can we customize every item in the onboarding kit?', 'Yes. Logo printing, embroidery, engraving and custom packaging are available depending on product material.'],
      ['Can you include welcome cards?', 'Yes. We can support custom greeting cards, insert cards and branded packaging.'],
      ['Can onboarding kits be reordered?', 'Yes. We can help create repeatable kit combinations for recurring employee onboarding needs.']
    ]
  },
  {
    file: 'trade-show-giveaways.html',
    title: 'Trade Show Giveaways | Custom Exhibition Promotional Gifts | Sendora Gift',
    description: 'Custom trade show giveaways and exhibition promotional gifts with logo branding. Choose practical branded items for booths, events and marketing campaigns.',
    h1: 'Trade Show Giveaways for Exhibitions and Events',
    intro: 'Trade show giveaways should attract visitors, carry your logo clearly and be easy to distribute. Sendora Gift helps companies prepare cost-effective branded gifts for exhibitions, booth promotions and marketing events.',
    image: 'conference gift.png',
    imageAlt: 'trade show giveaways and exhibition promotional gifts',
    sections: [
      ['Popular Giveaway Items', 'Pens, notebooks, tote bags, lanyards, keychains, bottles, caps, badges, phone stands and small office accessories are common trade show choices.'],
      ['Booth-Friendly Planning', 'Lightweight products, clear logo placement and compact packaging make giveaways easier to store, carry and hand out during exhibitions.'],
      ['Campaign Support', 'We can match giveaway items to your campaign theme, target audience, quantity, branding area and unit cost.']
    ],
    faqs: [
      ['What gifts are best for trade shows?', 'Lightweight, useful and easy-to-brand items such as pens, notebooks, bags, lanyards, bottles and keychains are popular.'],
      ['Can you help with urgent event deadlines?', 'We can recommend products and customization methods based on your event date and available production time.'],
      ['Do you provide bulk pricing?', 'Pricing depends on product type, quantity, customization and packaging. Bulk orders are quoted project by project.']
    ]
  },
  {
    file: 'custom-gift-box-packaging.html',
    title: 'Custom Gift Box Packaging | Branded Corporate Gift Boxes | Sendora Gift',
    description: 'Custom gift box packaging for corporate gifts, welcome kits, client gifts and event merchandise. Create branded boxes, sleeves, inserts and greeting cards.',
    h1: 'Custom Gift Box Packaging for Corporate Gifts',
    intro: 'Packaging turns individual products into a complete branded gift experience. Sendora Gift supports custom gift boxes, sleeves, inserts, paper bags, labels and greeting cards for corporate gifting projects.',
    image: 'holiday gift.png',
    imageAlt: 'custom gift box packaging for corporate gifts',
    sections: [
      ['Packaging Options', 'Options include rigid gift boxes, kraft boxes, paper sleeves, mailer boxes, paper bags, labels, product inserts, greeting cards and custom inner trays.'],
      ['Brand Presentation', 'Colors, logo placement, insert copy and product layout can be designed to match your campaign, event or company identity.'],
      ['Best Applications', 'Custom packaging is ideal for executive gift boxes, employee welcome kits, holiday gifts, client appreciation gifts and premium promotional sets.']
    ],
    faqs: [
      ['Can you design custom gift boxes?', 'Yes. We can support gift box design, paper sleeves, inserts, cards and branded packaging details.'],
      ['Can different products be packed together?', 'Yes. We can combine selected items into one gift set with suitable box size and layout.'],
      ['Is custom packaging available for samples?', 'Sample options depend on box type and design complexity. We can advise before bulk production.']
    ]
  },
  {
    file: 'branded-drinkware-gifts.html',
    title: 'Branded Drinkware Gifts | Custom Tumblers, Bottles and Mugs | Sendora Gift',
    description: 'Branded drinkware gifts including custom tumblers, bottles, travel mugs and ceramic mugs for corporate gifts, employee kits and promotional campaigns.',
    h1: 'Branded Drinkware Gifts for Corporate Programs',
    intro: 'Drinkware is one of the most practical corporate gift categories because it is useful at work, home, travel and events. Sendora Gift supplies custom tumblers, bottles, travel mugs and ceramic mugs with logo branding.',
    image: 'corporate.png',
    imageAlt: 'branded drinkware gifts with logo customization',
    sections: [
      ['Drinkware Options', 'Choose stainless steel tumblers, insulated bottles, sports bottles, travel mugs, ceramic mugs and gift set combinations with notebooks, pens or bags.'],
      ['Branding Methods', 'Logo options include screen printing, UV printing, laser engraving and packaging customization depending on material and design.'],
      ['Common Uses', 'Branded drinkware is suitable for employee gifts, client appreciation, conferences, trade shows, sports events and holiday gift sets.']
    ],
    faqs: [
      ['Can drinkware be laser engraved?', 'Yes. Many stainless steel tumblers and bottles can be laser engraved for a durable logo effect.'],
      ['Can mugs and bottles be packed in gift boxes?', 'Yes. Drinkware can be packed individually or combined with other items in custom gift boxes.'],
      ['What drinkware is best for corporate gifts?', 'Insulated tumblers, travel mugs and stainless steel bottles are popular because they are practical and have strong perceived value.']
    ]
  },
  {
    file: 'corporate-holiday-gifts.html',
    title: 'Corporate Holiday Gifts | Custom Christmas and New Year Gift Sets | Sendora Gift',
    description: 'Custom corporate holiday gifts for Christmas, New Year and seasonal appreciation campaigns. Build branded gift sets with packaging and worldwide shipping.',
    h1: 'Corporate Holiday Gifts for Clients and Employees',
    intro: 'Holiday gifts help companies thank employees, clients and partners at the end of the year. Sendora Gift creates custom corporate holiday gift sets with practical products, seasonal packaging and branded presentation.',
    image: 'holiday gift.png',
    imageAlt: 'corporate holiday gifts and seasonal gift sets',
    sections: [
      ['Holiday Gift Ideas', 'Popular items include mugs, tumblers, notebooks, blankets, candles, bags, premium pens, greeting cards, snack packaging and custom gift boxes.'],
      ['Seasonal Packaging', 'Custom boxes, paper sleeves, greeting cards and color-matched inserts help create a holiday feeling while keeping your company brand visible.'],
      ['Planning Timeline', 'Holiday orders should be planned early to allow time for samples, packaging confirmation, bulk production and international shipping before peak season.']
    ],
    faqs: [
      ['When should we start planning holiday gifts?', 'For customized holiday gift sets, planning several weeks or months ahead is recommended, especially for custom packaging and international shipping.'],
      ['Can holiday gifts include our logo?', 'Yes. Products and packaging can be customized with your logo, brand colors and greeting message.'],
      ['Can you ship holiday gift orders worldwide?', 'Yes. We support worldwide shipping by express, air, sea or door-to-door logistics.']
    ]
  },
  {
    file: 'company-swag-kits.html',
    title: 'Company Swag Kits | Branded Employee and Event Merchandise | Sendora Gift',
    description: 'Create company swag kits with branded apparel, drinkware, bags, notebooks and accessories for employees, events, onboarding and marketing campaigns.',
    h1: 'Company Swag Kits with Custom Branding',
    intro: 'Company swag kits combine practical branded items into one package for employees, events, onboarding and marketing campaigns. Sendora Gift helps build flexible swag kits with logo customization and packaging support.',
    image: 'event gift.png',
    imageAlt: 'company swag kits with branded merchandise',
    sections: [
      ['Swag Kit Items', 'Common items include T-shirts, caps, tote bags, backpacks, tumblers, mugs, notebooks, pens, stickers, lanyards and desk accessories.'],
      ['Use Cases', 'Company swag kits are useful for new hire onboarding, remote teams, conferences, brand events, team building and customer campaigns.'],
      ['Custom Packaging', 'Swag items can be packed in custom boxes, paper bags or mailer packaging with insert cards and brand messages.']
    ],
    faqs: [
      ['Can we choose our own swag kit items?', 'Yes. You can choose products based on budget, audience, quantity and campaign purpose.'],
      ['Can apparel be customized?', 'Yes. T-shirts, caps, bags and other textile items can often be customized with embroidery, screen printing or heat transfer.'],
      ['Do you support remote team swag kits?', 'We can help prepare branded kits and advise on packing and shipping options for distributed teams.']
    ]
  }
];

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pageHtml(page) {
  const url = `${site}/${page.file}`;
  const related = [
    ['Corporate Gift Sets', 'corporate-gift.html'],
    ['Employee Welcome Kits', 'employee-welcome.html'],
    ['Promotional Giveaways', 'promotional-giveaways.html'],
    ['Executive Gift Boxes', 'executive-gift.html']
  ];
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.h1,
      url,
      description: page.description,
      isPartOf: { '@type': 'WebSite', name: 'Sendora Gift', url: `${site}/` },
      provider: { '@type': 'Organization', name: 'Sendora Gift', url: `${site}/`, email: contactEmail }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: page.h1, item: url }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a }
      }))
    }
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<link rel="icon" href="favicon.ico">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;}
body{line-height:1.6;color:#333;background:#f8f8f8;}
a{text-decoration:none;color:#ff6b00;}a:hover{color:#ff4c00;}
header{position:sticky;top:0;background:#fff;z-index:1000;box-shadow:0 2px 15px rgba(0,0,0,.08);}
.header-inner{display:flex;justify-content:space-between;align-items:center;max-width:1400px;margin:auto;padding:0 20px;height:80px;}
.logo{font-size:28px;font-weight:bold;color:#222;}nav a{margin-left:25px;font-weight:bold;color:#555;}
.hero{min-height:520px;background:linear-gradient(rgba(0,0,0,.52),rgba(0,0,0,.52)),url('https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/${page.image.replace(/ /g, '%20')}');background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;}
.hero-content{max-width:920px;padding:20px;}.hero h1{font-size:44px;margin-bottom:20px;}.hero p{font-size:19px;margin-bottom:28px;}
.btn{display:inline-block;padding:12px 26px;background:#ff6b00;color:#fff!important;border-radius:5px;font-weight:bold;}
section{padding:75px 0;background:#fff;}section.alt{background:#f0f0f0;}section h2{text-align:center;margin-bottom:36px;font-size:32px;color:#222;}.container{width:90%;max-width:1200px;margin:0 auto;}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;}.two-col img{width:100%;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.12);}.two-col h2{text-align:left;margin-bottom:18px;}.two-col p{margin-bottom:16px;color:#555;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:25px;}.card{background:#fff;padding:25px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);}.card h3{margin-bottom:12px;color:#222;}.card p{color:#555;font-size:15px;}
.faq-item{margin-bottom:18px;background:#fff;border-radius:8px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.1);}.faq-item h3{font-size:18px;margin-bottom:10px;color:#222;}.faq-item p{color:#555;}
form{max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:15px;}input,textarea{padding:12px;border-radius:5px;border:1px solid #ccc;width:100%;font-size:15px;}button{padding:12px;background:#ff6b00;color:#fff;border:none;border-radius:5px;font-weight:bold;cursor:pointer;}
footer{background:#222;color:#fff;text-align:center;padding:40px 0;}footer p{margin-bottom:10px;}footer a{color:#ff6b00;}
#whatsapp-btn{position:fixed;bottom:30px;right:30px;background:#25D366;color:#fff!important;border-radius:50%;width:60px;height:60px;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 2px 6px rgba(0,0,0,.3);z-index:1000;}
@media(max-width:768px){.header-inner{height:auto;flex-direction:column;padding:15px;}nav{margin-top:10px;text-align:center;}nav a{display:inline-block;margin:8px;}.hero h1{font-size:34px;}.two-col{grid-template-columns:1fr;}section{padding:60px 0;}}
</style>
<script type="application/ld+json" data-seo="codex">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>
<header><div class="header-inner"><div class="logo">Sendora Gift</div><nav><a href="index.html">Home</a><a href="index.html#products">Products</a><a href="#faq">FAQ</a><a href="#contact">Contact</a></nav></div></header>
<section class="hero"><div class="hero-content"><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.intro)}</p><a href="#contact" class="btn">Request Custom Quote</a></div></section>
<section><div class="container two-col"><img src="https://raw.githubusercontent.com/he3442875852/sendoragift-site/main/${page.image.replace(/ /g, '%20')}" alt="${escapeHtml(page.imageAlt)}"><div><h2>${escapeHtml(page.sections[0][0])}</h2><p>${escapeHtml(page.sections[0][1])}</p><p>Sendora Gift supports OEM and ODM corporate gift projects with flexible product selection, custom logo branding, packaging options, sample support and worldwide shipping.</p></div></div></section>
<section class="alt"><div class="container"><h2>Why Buyers Choose This Solution</h2><div class="grid">${page.sections.slice(1).map(([heading, text]) => `<div class="card"><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(text)}</p></div>`).join('')}<div class="card"><h3>One-Stop Service</h3><p>From product sourcing to logo customization, packaging, quality checking and delivery, our team helps simplify the corporate gifting process.</p></div></div></div></section>
<section><div class="container"><h2>Related Gift Solutions</h2><div class="grid">${related.map(([label, href]) => `<div class="card"><h3>${label}</h3><p>Explore more custom B2B gift options from Sendora Gift.</p><a href="${href}">View Details →</a></div>`).join('')}</div></div></section>
<section class="alt" id="faq"><div class="container"><h2>Frequently Asked Questions</h2>${page.faqs.map(([q, a]) => `<div class="faq-item"><h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p></div>`).join('')}</div></section>
<section id="contact"><h2>Get A Custom Quote</h2><div class="container"><form action="https://formspree.io/f/mojzqnke" method="POST"><input type="text" name="name" placeholder="Your Name" required><input type="email" name="email" placeholder="Your Email" required><input type="text" name="company" placeholder="Company Name"><textarea name="message" rows="5" placeholder="Tell us your gift requirements, quantity and target delivery date" required></textarea><button type="submit">Send Inquiry</button></form></div></section>
<footer><p>&copy; 2026 Sendora Gift. All rights reserved.</p><p>Email: <a href="mailto:${contactEmail}">${contactEmail}</a> | WhatsApp: <a href="https://wa.me/8618390800841" target="_blank">Chat Now</a></p></footer>
<a id="whatsapp-btn" href="https://wa.me/8618390800841?text=Hello%20Sendora%20Gift%2C%20I%20am%20interested%20in%20custom%20corporate%20gift%20solutions." target="_blank">💬</a>
</body>
</html>
`;
}

for (const page of pages) {
  fs.writeFileSync(page.file, pageHtml(page), 'utf8');
}

let index = fs.readFileSync('index.html', 'utf8');
if (!index.includes('id="solutions"')) {
  const cards = pages.map(page => `<div class="seo-card"><h3>${page.h1}</h3><p>${page.description}</p><a href="${page.file}">Learn More →</a></div>`).join('\n');
  const section = `\n<section id="solutions" class="seo-block">\n<div class="container">\n<h2>Popular Custom Gift Solutions</h2>\n<div class="seo-grid">\n${cards}\n</div>\n</div>\n</section>\n`;
  index = index.replace('<section id="faq">', `${section}\n<section id="faq">`);
  fs.writeFileSync('index.html', index, 'utf8');
}

let sitemap = fs.readFileSync('sitemap.xml', 'utf8');
for (const page of pages) {
  const loc = `${site}/${page.file}`;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) {
    sitemap = sitemap.replace('</urlset>', `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n\n</urlset>`);
  }
}
fs.writeFileSync('sitemap.xml', sitemap, 'utf8');

fs.rmSync('scripts/add-longtail-pages.js', { force: true });
fs.rmSync('.github/workflows/add-longtail-pages.yml', { force: true });

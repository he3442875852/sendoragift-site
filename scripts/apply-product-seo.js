const fs = require('fs');

const pages = [
  {
    file: 'corporate-gift.html',
    url: 'https://www.sendoragift.com/corporate-gift.html',
    name: 'Custom Corporate Gift Sets',
    description: 'Custom corporate gift sets for client appreciation, employee rewards, events and business gifting programs.',
    guideTitle: 'How to Choose Custom Corporate Gift Sets',
    guide: [
      'The best corporate gift set depends on who will receive it, how the gift will be used and what brand message you want to deliver. For employees, practical daily-use items such as tumblers, notebooks, tote bags and desk accessories are usually effective.',
      'For VIP clients and partners, premium packaging, higher-value drinkware, leather notebooks and executive accessories can create a stronger impression. Sendora Gift can recommend product combinations based on your audience, quantity, budget and delivery date.'
    ]
  },
  {
    file: 'employee-welcome.html',
    url: 'https://www.sendoragift.com/employee-welcome.html',
    name: 'Employee Welcome Kits',
    description: 'Branded employee welcome kits and onboarding gift sets with logo customization and custom packaging.',
    guideTitle: 'How to Build Employee Welcome Kits',
    guide: [
      'A strong employee welcome kit should feel useful from the first workday. Popular items include branded drinkware, notebooks, pens, tote bags, desk accessories, apparel and welcome cards.',
      'For onboarding projects, buyers often choose durable daily-use products, consistent brand colors and packaging that presents the company culture clearly. Sendora Gift can help balance budget, MOQ, customization method and delivery schedule.'
    ]
  },
  {
    file: 'promotional-giveaways.html',
    url: 'https://www.sendoragift.com/promotional-giveaways.html',
    name: 'Promotional Giveaways',
    description: 'Custom promotional giveaways and branded marketing gifts for exhibitions, campaigns and events.',
    guideTitle: 'How to Select Promotional Giveaways',
    guide: [
      'Effective promotional giveaways should be easy to distribute, practical for the target audience and clear enough to carry your logo or campaign message. Lightweight items are useful for exhibitions, retail campaigns and trade shows.',
      'Common choices include pens, notebooks, tote bags, bottles, keychains, lanyards, caps and small office accessories. We can recommend items based on your event type, quantity, branding area and target unit cost.'
    ]
  },
  {
    file: 'event-gift.html',
    url: 'https://www.sendoragift.com/event-gift.html',
    name: 'Event Gift Kits',
    description: 'Custom event gift kits and branded merchandise for meetings, corporate events and brand activities.',
    guideTitle: 'How to Plan Event Gift Kits',
    guide: [
      'Event gift kits should match the event purpose, audience and distribution method. For meetings and conferences, practical items such as notebooks, pens, lanyards, bottles and tote bags work well.',
      'For brand activities and company events, custom packaging, insert cards and matching product colors can make the kit feel more complete. Sendora Gift supports product sourcing, logo branding, packing and worldwide delivery.'
    ]
  },
  {
    file: 'executive-gift.html',
    url: 'https://www.sendoragift.com/executive-gift.html',
    name: 'Executive Gift Boxes',
    description: 'Premium executive gift boxes for VIP clients, partners, leadership teams and business appreciation programs.',
    guideTitle: 'How to Create Executive Gift Boxes',
    guide: [
      'Executive gift boxes should focus on perceived value, presentation and long-term usefulness. Premium drinkware, leather notebooks, metal pens, business accessories and rigid gift boxes are common choices.',
      'For VIP clients and senior partners, packaging details matter. Custom inserts, greeting cards, logo engraving and consistent color matching can help the gift feel professional and intentional.'
    ]
  },
  {
    file: 'conference-gift.html',
    url: 'https://www.sendoragift.com/conference-gift.html',
    name: 'Conference Gifts',
    description: 'Custom conference gifts and attendee gift sets with notebooks, pens, bags, lanyards and branded packaging.',
    guideTitle: 'How to Choose Conference Gifts',
    guide: [
      'Conference gifts should be practical, easy to carry and useful during or after the event. Notebooks, pens, lanyards, tote bags, bottles and badges are popular for attendee gift sets.',
      'For large conferences, buyers usually care about stable supply, clear logo printing, packing efficiency and delivery timing. Sendora Gift can support bulk production and event-ready packing.'
    ]
  },
  {
    file: 'sports-event.html',
    url: 'https://www.sendoragift.com/sports-event.html',
    name: 'Sports Event Kits',
    description: 'Sports event gift kits and custom merchandise for marathons, tournaments, team building and race events.',
    guideTitle: 'How to Build Sports Event Kits',
    guide: [
      'Sports event kits should be lightweight, durable and relevant to outdoor or team activities. Bottles, towels, caps, drawstring bags, wristbands, medals and T-shirts are common choices.',
      'For marathons, tournaments and team-building events, logo visibility and packing efficiency are important. We can help match products to the event theme, participant profile and delivery timeline.'
    ]
  },
  {
    file: 'holiday-gift.html',
    url: 'https://www.sendoragift.com/holiday-gift.html',
    name: 'Holiday Gift Sets',
    description: 'Corporate holiday gift sets for Christmas, New Year, seasonal campaigns and customer appreciation.',
    guideTitle: 'How to Plan Corporate Holiday Gift Sets',
    guide: [
      'Holiday gift sets should feel warm, useful and easy to present. Popular choices include mugs, tumblers, notebooks, blankets, candles, snack packaging, greeting cards and seasonal gift boxes.',
      'For Christmas, New Year and annual appreciation programs, early planning helps confirm samples, packaging, production and shipping before peak season. Sendora Gift can help create flexible gift sets for clients and employees.'
    ]
  }
];

const org = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Sendora Gift',
  url: 'https://www.sendoragift.com/',
  email: 'info@sendoragift.com',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    email: 'info@sendoragift.com',
    availableLanguage: ['English']
  }
};

function schemaFor(page) {
  return [
    org,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.name,
      url: page.url,
      description: page.description,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Sendora Gift',
        url: 'https://www.sendoragift.com/'
      },
      provider: {
        '@type': 'Organization',
        name: 'Sendora Gift',
        url: 'https://www.sendoragift.com/'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.sendoragift.com/' },
        { '@type': 'ListItem', position: 2, name: page.name, item: page.url }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: page.name,
      serviceType: 'Custom corporate gifts and branded business gift solutions',
      description: page.description,
      provider: {
        '@type': 'Organization',
        name: 'Sendora Gift',
        url: 'https://www.sendoragift.com/'
      },
      areaServed: 'Worldwide',
      offers: {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'PriceSpecification',
          priceCurrency: 'USD',
          description: 'Quote-based pricing depending on product selection, quantity, branding and packaging requirements.'
        }
      }
    }
  ];
}

function guideSection(page) {
  return `<section data-seo="codex-product-guide">
<div class="container">
<h2>${page.guideTitle}</h2>
${page.guide.map(text => `<p>${text}</p>`).join('\n')}
</div>
</section>\n\n`;
}

for (const page of pages) {
  let html = fs.readFileSync(page.file, 'utf8');
  html = html.replace(/<link rel="canonical" href="[^"]+">\s*/g, '');
  html = html.replace(/<script type="application\/ld\+json" data-seo="codex">[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/(<meta name="robots" content="index, follow">\s*)/, `$1<link rel="canonical" href="${page.url}">\n`);

  const json = JSON.stringify(schemaFor(page), null, 2).replace(/<\/script>/g, '<\\/script>');
  html = html.replace('</head>', `<script type="application/ld+json" data-seo="codex">\n${json}\n</script>\n</head>`);

  if (!html.includes('data-seo="codex-product-guide"')) {
    const guide = guideSection(page);
    if (html.includes('<section class="alt" id="faq">')) {
      html = html.replace('<section class="alt" id="faq">', `${guide}<section class="alt" id="faq">`);
    } else if (html.includes('<section id="faq">')) {
      html = html.replace('<section id="faq">', `${guide}<section id="faq">`);
    } else {
      html = html.replace('<section class="alt" id="contact">', `${guide}<section class="alt" id="contact">`);
    }
  }

  fs.writeFileSync(page.file, html, 'utf8');
}

fs.rmSync('scripts/apply-product-seo.js', { force: true });
fs.rmSync('.github/workflows/product-seo.yml', { force: true });

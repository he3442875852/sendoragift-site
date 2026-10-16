(function(){
      const params=new URLSearchParams(window.location.search);
      const raw=params.get('product')||params.get('case')||params.get('source');
      if(!raw) return;
      const productNames={"corporate-office-gift-set":"Custom Corporate Office Gift Set","employee-welcome-kit":"Custom Employee Welcome Kit","client-appreciation-gift-box":"Custom Client Appreciation Gift Box","conference-meeting-gift-set":"Custom Conference and Meeting Gift Set","trade-show-giveaway-kit":"Custom Trade Show Giveaway Kit","sports-event-giveaway-kit":"Custom Sports Event Giveaway Kit","golf-tournament-gift-set":"Custom Golf Tournament Gift Set","pickleball-team-gift-set":"Custom Pickleball Team Gift Set","custom-pu-document-folders":"Custom PU Document Folders with Logo","custom-metal-pens":"Custom Metal Pens with Logo for Business Gifts","custom-passport-holders":"Custom Passport Holders with Logo for Corporate Travel Gifts","custom-luggage-tags":"Custom Luggage Tags with Logo for Business Travel Gifts","custom-id-card-holders":"Custom ID Card Holders and Badge Holders","custom-business-card-holders":"Custom Business Card Holders with Logo","custom-logo-lanyards":"Custom Logo Lanyards for Events and Employee Programs","custom-pu-desk-mats":"Custom PU Desk Mats with Logo for Office Gifts","pu-document-folders":"Custom PU Document Folders with Logo"};
      const label=productNames[raw]||raw.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const source=document.getElementById('source_context');
      const message=(document.getElementById('message')||document.getElementById('quote-details'));
      const product=(document.getElementById('product_type')||document.getElementById('quote-product'));
      if(product && Array.from(product.options).some(option => option.value === label)) product.value=label;
      else if(product && productNames[raw]) product.value='Custom logo gifts';
      if(productNames[raw]) document.body.setAttribute('data-inquiry-product',label);
      if(source) source.value=label;
      if(message&&!message.value) message.value='I am interested in '+label+'. Please help me review the product and customization options.';
    })();

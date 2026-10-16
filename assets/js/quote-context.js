(function(){
      const params=new URLSearchParams(window.location.search);
      const raw=params.get('product')||params.get('case')||params.get('source');
      if(!raw) return;
      const sampleProducts={"sample-ace-office-travel":"Office & Travel Gift Set Sample","sample-ace-desk":"Desk Essentials Gift Set Sample","sample-ace-outdoor":"Outdoor Essentials Gift Set Sample","sample-ace-sports":"Sports & Wellness Gift Set Sample","sample-navy-stationery":"Notebook & Pen Presentation Set Sample","sample-metal-pen":"Metal Pen in Presentation Case Sample","sample-golf-packaging":"Golf Ball Packaging Options Sample","sample-orange-golf":"Custom Logo Golf Balls Sample","sample-metal-keychains":"Metal & PU Strap Keychains Sample","sample-pumpkin-mug":"Printed Ceramic Mug Sample","sample-metal-bookmark":"Metal Bookmark with Tassel Sample","sample-pu-folder":"PU Document File Pouch Sample"};
      const sampleSets=["sample-ace-office-travel","sample-ace-desk","sample-ace-outdoor","sample-ace-sports","sample-navy-stationery"];
      const productNames={"corporate-office-gift-set":"Custom Corporate Office Gift Set","employee-welcome-kit":"Custom Employee Welcome Kit","client-appreciation-gift-box":"Custom Client Appreciation Gift Box","conference-meeting-gift-set":"Custom Conference and Meeting Gift Set","trade-show-giveaway-kit":"Custom Trade Show Giveaway Kit","sports-event-giveaway-kit":"Custom Sports Event Giveaway Kit","golf-tournament-gift-set":"Custom Golf Tournament Gift Set","pickleball-team-gift-set":"Custom Pickleball Team Gift Set","custom-pu-document-folders":"Custom PU Document Folders with Logo","custom-metal-pens":"Custom Metal Pens with Logo for Business Gifts","custom-passport-holders":"Custom Passport Holders with Logo for Corporate Travel Gifts","custom-luggage-tags":"Custom Luggage Tags with Logo for Business Travel Gifts","custom-id-card-holders":"Custom ID Card Holders and Badge Holders","custom-business-card-holders":"Custom Business Card Holders with Logo","custom-logo-lanyards":"Custom Logo Lanyards for Events and Employee Programs","custom-pu-desk-mats":"Custom PU Desk Mats with Logo for Office Gifts","pu-document-folders":"Custom PU Document Folders with Logo"};
      Object.assign(productNames,sampleProducts);
      const label=productNames[raw]||raw.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const source=document.getElementById('source_context');
      const message=(document.getElementById('message')||document.getElementById('quote-details'));
      const product=(document.getElementById('product_type')||document.getElementById('quote-product'));
      if(product && Array.from(product.options).some(option => option.value === label)) product.value=label;
      else if(product && productNames[raw]) product.value=sampleSets.includes(raw)?'Corporate gift sets':'Custom logo gifts';
      if(productNames[raw]) document.body.setAttribute('data-inquiry-product',label);
      if(source) source.value=label;
      const selection=document.getElementById('inquiry-selection');
      const selectionName=document.getElementById('inquiry-selection-name');
      if(selection && selectionName){selectionName.textContent=label;selection.hidden=false;}
      if(message&&!message.value) message.value='I am interested in '+label+'. Please help me review the product and customization options.';
    })();

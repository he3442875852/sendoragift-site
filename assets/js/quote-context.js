(function(){
      const params=new URLSearchParams(window.location.search);
      const raw=params.get('product')||params.get('sample')||params.get('case')||params.get('source');
      if(!raw) return;
      const sampleProducts={"sample-ace-office-travel":"Office & Travel Gift Set Sample","sample-ace-desk":"Desk Essentials Gift Set Sample","sample-ace-outdoor":"Outdoor Essentials Gift Set Sample","sample-ace-sports":"Sports & Wellness Gift Set Sample","sample-navy-stationery":"Notebook & Pen Presentation Set Sample","sample-metal-pen":"Metal Pen in Presentation Case Sample","sample-golf-packaging":"Golf Ball Packaging Options Sample","sample-orange-golf":"Custom Logo Golf Balls Sample","sample-metal-keychains":"Metal & PU Strap Keychains Sample","sample-pumpkin-mug":"Printed Ceramic Mug Sample","sample-metal-bookmark":"Metal Bookmark with Tassel Sample","sample-pu-folder":"PU Document File Pouch Sample","sample-bucket-hat":"Bucket Hat with Logo Sample","sample-baseball-cap":"Baseball Cap with Logo Sample","sample-backpack":"Backpack with Logo Sample","sample-mouse-pad":"Mouse Pad with Logo Sample"};
      const detailSamples={"black-gold-executive-set":"Black & Gold Executive Gift Set Sample","red-organizer-set":"Red Organizer & Tumbler Gift Set Sample","two-tone-mug":"Two-Tone Ceramic Mug Logo Sample","golf-accessory-set":"Navy & Orange Golf Accessory Gift Set Sample"};
      Object.assign(sampleProducts,detailSamples);
      const sampleSets=["car-dealership-handover-gift-set","real-estate-closing-gift-set","black-gold-executive-set","red-organizer-set","golf-accessory-set","sample-ace-office-travel","sample-ace-desk","sample-ace-outdoor","sample-ace-sports","sample-navy-stationery"];
      const productNames={"car-dealership-handover-gift-set":"Custom Car Dealership Handover Gift Set","real-estate-closing-gift-set":"Custom Real Estate Closing Gift Set","corporate-office-gift-set":"Custom Corporate Office Gift Set","employee-welcome-kit":"Custom Employee Welcome Kit","client-appreciation-gift-box":"Custom Client Appreciation Gift Box","conference-meeting-gift-set":"Custom Conference and Meeting Gift Set","trade-show-giveaway-kit":"Custom Trade Show Giveaway Kit","sports-event-giveaway-kit":"Custom Sports Event Giveaway Kit","golf-tournament-gift-set":"Custom Golf Tournament Gift Set","pickleball-team-gift-set":"Custom Pickleball Team Gift Set","custom-pu-document-folders":"Custom PU Document Folders with Logo","custom-metal-pens":"Custom Metal Pens with Logo for Business Gifts","custom-passport-holders":"Custom Passport Holders with Logo for Corporate Travel Gifts","custom-luggage-tags":"Custom Luggage Tags with Logo for Business Travel Gifts","custom-id-card-holders":"Custom ID Card Holders and Badge Holders","custom-business-card-holders":"Custom Business Card Holders with Logo","custom-logo-lanyards":"Custom Logo Lanyards for Events and Employee Programs","custom-pu-desk-mats":"Custom PU Desk Mats with Logo for Office Gifts","pu-document-folders":"Custom PU Document Folders with Logo"};
      Object.assign(productNames,sampleProducts);
      const knownProduct=Object.prototype.hasOwnProperty.call(productNames,raw);
      const label=knownProduct?productNames[raw]:raw.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).slice(0,160);
      const source=document.getElementById('source_context');
      const message=(document.getElementById('message')||document.getElementById('quote-details'));
      const product=(document.getElementById('product_type')||document.getElementById('quote-product'));
      if(product && Array.from(product.options).some(option => option.value === label)) product.value=label;
      else if(product && knownProduct) product.value=sampleSets.includes(raw)?'Corporate gift sets':'Custom logo gifts';
      if(knownProduct) document.body.setAttribute('data-inquiry-product',label);
      if(window.SendoraGiftDirections&&Object.prototype.hasOwnProperty.call(window.SendoraGiftDirections.products,raw))document.body.setAttribute('data-buyer-product',raw);
      if(source) source.value=label;
      const selection=document.getElementById('inquiry-selection');
      const selectionName=document.getElementById('inquiry-selection-name');
      if(selection && selectionName){selectionName.textContent=label;selection.hidden=false;}
      const directions=window.SendoraGiftDirections;
      const configuration=directions&&directions.resolve(raw,params.get('configuration'));
      const packing=configuration?directions.packingLabel(params.get('packing')):'';
      const quantity=configuration?directions.quantity(params.get('quantity')):'';
      const details=[];
      if(configuration){
        details.push('Direction: '+configuration.label,'Starting items: '+configuration.items);
        document.body.setAttribute('data-inquiry-configuration',configuration.label);
        document.body.setAttribute('data-buyer-product',raw);
        document.body.setAttribute('data-buyer-configuration',configuration.id);
        if(packing){details.push('Packing preference: '+packing);document.body.setAttribute('data-inquiry-packing',packing);document.body.setAttribute('data-buyer-packing',params.get('packing'));}
        if(quantity){
          const quantityField=document.getElementById('quantity')||document.getElementById('quote-quantity');
          if(quantityField&&!quantityField.value)quantityField.value=quantity;
          details.push('Estimated quantity: '+quantity);
        }
        details.push('Final models, logo method, MOQ and packaging to be confirmed.');
      }
      const selectionDetails=document.getElementById('inquiry-selection-details');
      if(selectionDetails&&configuration){selectionDetails.textContent=details.join('\n');selectionDetails.hidden=false;}
      let generatedMessage='';
      if(message&&!message.value){
        generatedMessage='I am interested in '+label+'. Please help me review the product and customization options.'+(details.length?'\n\n'+details.join('\n'):'');
        message.value=generatedMessage;
      }
      if(product&&typeof product.addEventListener==='function')product.addEventListener('change',function(){
        document.body.setAttribute('data-inquiry-configuration','');
        document.body.setAttribute('data-inquiry-packing','');
        document.body.setAttribute('data-buyer-configuration','');
        document.body.setAttribute('data-buyer-packing','');
        document.body.setAttribute('data-buyer-product','');
        if(selectionDetails)selectionDetails.hidden=true;
        if(selectionName)selectionName.textContent=product.value;
        if(source)source.value=product.value;
        if(message&&generatedMessage&&message.value===generatedMessage){
          generatedMessage='I am interested in '+product.value+'. Please help me review the product and customization options.';
          message.value=generatedMessage;
        }
      });
    })();

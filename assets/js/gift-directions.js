(function (root) {
  "use strict";
  var products = {
  "corporate-office-gift-set": {
    "legend": "Office gift configuration",
    "options": [
      {
        "id": "compact-desk",
        "label": "Compact desk pair",
        "items": "Notebook + metal pen",
        "review": "Prioritize writing essentials and review individual packing."
      },
      {
        "id": "desk-drinkware",
        "label": "Desk & drinkware",
        "items": "Notebook + metal pen + tumbler or mug",
        "review": "Confirm the drinkware model before deciding the insert."
      },
      {
        "id": "boxed-office",
        "label": "Boxed office presentation",
        "items": "Notebook + metal pen + drinkware + presentation box",
        "review": "Review the loaded box, logo direction and protection together."
      }
    ]
  },
  "employee-welcome-kit": {
    "legend": "Welcome kit configuration",
    "options": [
      {
        "id": "office-arrival",
        "label": "Office arrival kit",
        "items": "Notebook + pen + welcome card",
        "review": "Plan one repeatable base kit for your next hiring batch."
      },
      {
        "id": "daily-essentials",
        "label": "Daily essentials kit",
        "items": "Notebook + pen + drinkware + carry item",
        "review": "Choose the bag or ID accessory around the recipient."
      },
      {
        "id": "remote-welcome",
        "label": "Remote welcome direction",
        "items": "Selected welcome items + card + protective packing",
        "review": "Review each destination and courier protection separately."
      }
    ]
  },
  "client-appreciation-gift-box": {
    "legend": "Client gift configuration",
    "options": [
      {
        "id": "meeting-thanks",
        "label": "Meeting thank-you",
        "items": "Notebook + metal pen + thank-you card",
        "review": "Keep the presentation easy to hand over at a meeting."
      },
      {
        "id": "coffee-thanks",
        "label": "Coffee break thank-you",
        "items": "Ceramic mug + coaster + thank-you card",
        "review": "Approve the mug shape, decoration and packing protection."
      },
      {
        "id": "boxed-client",
        "label": "Boxed client gift",
        "items": "Notebook + pen + drinkware + card + presentation box",
        "review": "Confirm recipient level, item finish and complete box layout."
      }
    ]
  },
  "conference-meeting-gift-set": {
    "legend": "Conference gift configuration",
    "options": [
      {
        "id": "delegate-notes",
        "label": "Delegate note pack",
        "items": "Notebook + pen + lanyard",
        "review": "Match the quantities to registration and sponsor requirements."
      },
      {
        "id": "document-meeting",
        "label": "Document meeting pack",
        "items": "PU document folder + notebook + pen",
        "review": "Check the actual agenda or document format and loaded closure."
      },
      {
        "id": "speaker-gift",
        "label": "Speaker presentation",
        "items": "Notebook + metal pen + card + gift box",
        "review": "Review speaker and sponsor artwork versions separately."
      }
    ]
  },
  "trade-show-giveaway-kit": {
    "legend": "Trade show configuration",
    "options": [
      {
        "id": "booth-handout",
        "label": "Compact booth handout",
        "items": "Pen + lanyard",
        "review": "Prioritize distribution quantity and clear logo visibility."
      },
      {
        "id": "visitor-carry",
        "label": "Visitor carry kit",
        "items": "Tote bag + notebook + pen",
        "review": "Check bag artwork, carrying needs and booth storage."
      },
      {
        "id": "qualified-visitor",
        "label": "Meeting visitor kit",
        "items": "Notebook + pen + card + coordinated packing",
        "review": "Allocate this direction to planned meetings or selected visitors."
      }
    ]
  },
  "sports-event-giveaway-kit": {
    "legend": "Sports event configuration",
    "options": [
      {
        "id": "race-finish",
        "label": "Finish-line direction",
        "items": "Medal + sports towel",
        "review": "Confirm the medal artwork and distribution point."
      },
      {
        "id": "participant-pack",
        "label": "Participant essentials",
        "items": "Water bottle + towel + drawstring bag",
        "review": "Approve bottle type, fabric details and packed weight."
      },
      {
        "id": "sponsor-pack",
        "label": "Sponsor merchandise",
        "items": "Cap + bottle + selected sports accessory",
        "review": "Review sponsor artwork and participant quantities separately."
      }
    ]
  },
  "golf-tournament-gift-set": {
    "legend": "Golf event configuration",
    "options": [
      {
        "id": "registration-pack",
        "label": "Compact registration pack",
        "items": "Ball marker + golf towel + selected packing",
        "review": "Keep small accessories secure and easy to count at check-in."
      },
      {
        "id": "player-welcome",
        "label": "Player welcome set",
        "items": "Golf balls + tees + towel + accessory options",
        "review": "Confirm the ball specification and exact accessory list."
      },
      {
        "id": "sponsor-presentation",
        "label": "Sponsor presentation",
        "items": "Selected golf accessories + card + presentation box",
        "review": "Approve the sponsor artwork on each item and the loaded box."
      }
    ]
  },
  "pickleball-team-gift-set": {
    "legend": "Pickleball configuration",
    "options": [
      {
        "id": "team-accessories",
        "label": "Team accessory direction",
        "items": "Paddle sleeve + wristband + carry item",
        "review": "Request the exact accessory models and sizes for review."
      },
      {
        "id": "paddle-play",
        "label": "Paddle & ball direction",
        "items": "Selected paddles + balls + carry bag",
        "review": "Confirm paddle construction and indoor or outdoor ball use."
      },
      {
        "id": "club-presentation",
        "label": "Club presentation kit",
        "items": "Selected paddle and accessory mix + branded packing",
        "review": "Approve the actual component list before sizing the packaging."
      }
    ]
  },
  "car-dealership-handover-gift-set": {
    "legend": "Dealership handover configuration",
    "options": [
      {
        "id": "owner-documents",
        "label": "Compact owner pack",
        "items": "PU document wallet + metal keychain + thank-you card",
        "review": "Check document stack thickness and clearance around the key fob."
      },
      {
        "id": "signing-delivery",
        "label": "Signing & delivery set",
        "items": "PU document wallet + metal pen + metal keychain + card + gift box",
        "review": "Approve pen orientation, document fit and the complete packed layout."
      },
      {
        "id": "dealer-branches",
        "label": "Dealer group program",
        "items": "One base kit + branch-specific cards or sleeves",
        "review": "Separate branch quantities and artwork revisions before sampling."
      }
    ]
  },
  "real-estate-closing-gift-set": {
    "legend": "Property handover configuration",
    "options": [
      {
        "id": "closing-documents",
        "label": "Closing document kit",
        "items": "PU document folder + metal pen + welcome card",
        "review": "Measure the closing pack and identify the agent-card position."
      },
      {
        "id": "property-keys",
        "label": "Property key handover",
        "items": "Document wallet + metal keychain + card + presentation box",
        "review": "Check key and fob dimensions and the required handover batches."
      },
      {
        "id": "home-thanks",
        "label": "New-home thank-you",
        "items": "Ceramic mug + PU coaster + card",
        "review": "Confirm handle clearance and protection for the chosen delivery route."
      }
    ]
  },
  "custom-metal-pens": {
    "legend": "Pen presentation direction",
    "options": [
      {
        "id": "pen-only",
        "label": "Individual metal pen",
        "items": "Selected stock-model pen + logo",
        "review": "Confirm the exact model, mechanism, refill and marking area."
      },
      {
        "id": "pen-case",
        "label": "Pen in presentation case",
        "items": "Selected metal pen + individual case",
        "review": "Check that the case leaves the logo visible in its final position."
      },
      {
        "id": "pen-notebook",
        "label": "Notebook & pen direction",
        "items": "Metal pen + notebook + selected packing",
        "review": "Review the notebook and pen as one proposed combination."
      }
    ]
  },
  "custom-pu-document-folders": {
    "legend": "Document accessory direction",
    "options": [
      {
        "id": "envelope-pouch",
        "label": "Envelope-style file pouch",
        "items": "Selected PU envelope pouch + logo",
        "review": "Check opening clearance, document capacity and the closure."
      },
      {
        "id": "opening-folder",
        "label": "Opening document folder",
        "items": "Selected PU opening folder + logo",
        "review": "Confirm paper retention, pockets and usable internal dimensions."
      },
      {
        "id": "folder-pen",
        "label": "Folder & pen direction",
        "items": "Selected PU document accessory + metal pen",
        "review": "Test the loaded closure and pen position before sizing the packing."
      }
    ]
  }
};
  var packing = {"individual":"Individual packing", "presentation":"Presentation box", "carry-bag":"Carry bag", "bulk":"Bulk packing to one location"};
  function resolve(product, id) {
    var entry = Object.prototype.hasOwnProperty.call(products, product) ? products[product] : null;
    return entry ? entry.options.find(function (option) { return option.id === id; }) || null : null;
  }
  function packingLabel(id) { return Object.prototype.hasOwnProperty.call(packing, id) ? packing[id] : ""; }
  function quantity(value) { return /^[1-9][0-9]{0,5}$/.test(String(value || "")) ? String(value) : ""; }
  var api = { products: products, resolve: resolve, packingLabel: packingLabel, quantity: quantity };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SendoraGiftDirections = api;
})(typeof window !== "undefined" ? window : this);

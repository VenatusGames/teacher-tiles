(() => {
  const catalog=Object.freeze([
  {
    "id": "ruby",
    "name": "Ruby",
    "tier": "basic",
    "color": "#cc5264",
    "description": "A clean ruby-red outline.",
    "price": 10,
    "productId": "profile-frame-ruby"
  },
  {
    "id": "coral",
    "name": "Coral",
    "tier": "basic",
    "color": "#ed8b72",
    "description": "A warm coral outline.",
    "price": 10,
    "productId": "profile-frame-coral"
  },
  {
    "id": "amber",
    "name": "Amber",
    "tier": "basic",
    "color": "#c99a3c",
    "description": "A sunny amber outline.",
    "price": 10,
    "productId": "profile-frame-amber"
  },
  {
    "id": "sage",
    "name": "Sage",
    "tier": "basic",
    "color": "#8aaf86",
    "description": "A soft sage-green outline.",
    "price": 10,
    "productId": "profile-frame-sage"
  },
  {
    "id": "emerald",
    "name": "Emerald",
    "tier": "basic",
    "color": "#369b79",
    "description": "A rich emerald outline.",
    "price": 10,
    "productId": "profile-frame-emerald"
  },
  {
    "id": "teal",
    "name": "Teal",
    "tier": "basic",
    "color": "#459eac",
    "description": "A cool teal outline.",
    "price": 10,
    "productId": "profile-frame-teal"
  },
  {
    "id": "sky",
    "name": "Sky",
    "tier": "basic",
    "color": "#76a9df",
    "description": "A soft sky-blue outline.",
    "price": 10,
    "productId": "profile-frame-sky"
  },
  {
    "id": "indigo",
    "name": "Indigo",
    "tier": "basic",
    "color": "#7879c7",
    "description": "A deep periwinkle outline.",
    "price": 10,
    "productId": "profile-frame-indigo"
  },
  {
    "id": "lavender",
    "name": "Lavender",
    "tier": "basic",
    "color": "#b092d2",
    "description": "A pastel lavender outline.",
    "price": 10,
    "productId": "profile-frame-lavender"
  },
  {
    "id": "rose",
    "name": "Rose",
    "tier": "basic",
    "color": "#d990b4",
    "description": "A soft rose-pink outline.",
    "price": 10,
    "productId": "profile-frame-rose"
  },
  {
    "id": "rainbow",
    "name": "Rainbow Ribbon",
    "tier": "decorative",
    "color": "#d990b4",
    "description": "A ribbon of soft rainbow colors.",
    "price": 25,
    "productId": "profile-frame-rainbow"
  },
  {
    "id": "candy",
    "name": "Candy Stripe",
    "tier": "decorative",
    "color": "#ed829d",
    "description": "Pink and cream candy stripes.",
    "price": 25,
    "productId": "profile-frame-candy"
  },
  {
    "id": "confetti",
    "name": "Confetti",
    "tier": "decorative",
    "color": "#719dc9",
    "description": "Tiny colorful confetti around every edge.",
    "price": 25,
    "productId": "profile-frame-confetti"
  },
  {
    "id": "garden",
    "name": "Garden Party",
    "tier": "decorative",
    "color": "#82ad88",
    "description": "Little blush blossoms and leafy greens.",
    "price": 25,
    "productId": "profile-frame-garden"
  },
  {
    "id": "starlight",
    "name": "Starlight",
    "tier": "decorative",
    "color": "#8584b5",
    "description": "Golden stars on a midnight-blue trim.",
    "price": 25,
    "productId": "profile-frame-starlight"
  },
  {
    "id": "gilded",
    "name": "Gilded",
    "tier": "decorative",
    "color": "#c8a454",
    "description": "Layered brushed-gold edges.",
    "price": 25,
    "productId": "profile-frame-gilded"
  },
  {
    "id": "stitched",
    "name": "Stitched Denim",
    "tier": "decorative",
    "color": "#6186aa",
    "description": "Blue fabric trim with a neat stitched edge.",
    "price": 25,
    "productId": "profile-frame-stitched"
  },
  {
    "id": "checker",
    "name": "Checkerboard",
    "tier": "decorative",
    "color": "#a39bc8",
    "description": "A playful lavender checkerboard.",
    "price": 25,
    "productId": "profile-frame-checker"
  },
  {
    "id": "notebook",
    "name": "Notebook",
    "tier": "decorative",
    "color": "#81acc9",
    "description": "Ruled paper trim with a red margin.",
    "price": 25,
    "productId": "profile-frame-notebook"
  },
  {
    "id": "terrazzo",
    "name": "Terrazzo",
    "tier": "decorative",
    "color": "#bc8f78",
    "description": "Warm stone flecks on a cream border.",
    "price": 25,
    "productId": "profile-frame-terrazzo"
  },
  {
    "id": "aurora",
    "name": "Aurora",
    "tier": "animated",
    "color": "#8ec4ac",
    "description": "Soft ribbons of northern lights drift around your profile.",
    "price": 40,
    "productId": "profile-frame-aurora"
  },
  {
    "id": "neon",
    "name": "Neon Pulse",
    "tier": "animated",
    "color": "#b28ddd",
    "description": "A violet glow that gently breathes.",
    "price": 40,
    "productId": "profile-frame-neon"
  },
  {
    "id": "orbit",
    "name": "Orbit",
    "tier": "animated",
    "color": "#80c4de",
    "description": "A luminous blue band travels around the edge.",
    "price": 40,
    "productId": "profile-frame-orbit"
  },
  {
    "id": "golden-hour",
    "name": "Golden Hour",
    "tier": "animated",
    "color": "#dfb35c",
    "description": "A glint of light sweeps across a golden frame.",
    "price": 40,
    "productId": "profile-frame-golden-hour"
  },
  {
    "id": "marquee",
    "name": "Marquee",
    "tier": "animated",
    "color": "#dba85c",
    "description": "A row of carnival lights twinkles around the border.",
    "price": 40,
    "productId": "profile-frame-marquee"
  }
].map(frame=>Object.freeze(frame)));
  const find=id=>catalog.find(frame=>frame.id===id);
  function decorate(host,id){
    host.querySelector(':scope > .profile-frame-outline')?.remove();
    const frame=find(id);if(!frame)return;
    const edge=document.createElement('span');edge.className='profile-frame-outline';edge.dataset.profileFrame=id;edge.style.setProperty('--frame-color',frame.color);edge.setAttribute('aria-hidden','true');host.append(edge);
    if(id==='marquee'){
      // Draw bulbs along a rounded path instead of clipping a tiled pattern at the edges.
      edge.innerHTML='<svg class="profile-frame-marquee-lights" width="100%" height="100%" focusable="false"><rect x="4" y="4"/><rect x="4" y="4"/></svg>';
    }
  }
  function preview(id){
    const card=document.createElement('span');card.className='profile-frame-preview';card.setAttribute('aria-hidden','true');
    card.innerHTML='<span class="profile-frame-preview-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><span class="profile-frame-preview-copy"><b>TeacherTiles</b><i></i><i></i></span>';
    decorate(card,id);return card;
  }
  window.TeacherTilesProfileFrames={catalog,find,decorate,preview};
})();

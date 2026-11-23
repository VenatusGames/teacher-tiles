// Manual awards stay separate from automatic and coming-soon achievements.
export const manualPatchIds = [
  'beloved', 'tiktok', 'beta', 'first-100', 'alpha-tester', 'connected',
  'contributor', 'stickerer', 'tile-layer', 'template-creator', 'template-artist'
];

export function getPatchName(catalog, id, fallback = 'Patch name unavailable') {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog) || !Object.hasOwn(catalog, id)) {
    return fallback;
  }

  const name = catalog[id];
  if (typeof name !== 'string' || !name.trim()) {
    return fallback;
  }

  return name.trim();
}

export function getManualPatchOptions(catalog) {
  return manualPatchIds.flatMap(id => {
    const name = getPatchName(catalog, id, null);
    return name ? [[id, name]] : [];
  });
}

export const newPatches=[
 {id:'beloved',requirement:'Get more than 50 likes on a template you uploaded!',comingSoon:true,icon:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42S5 30 5 17a10 10 0 0 1 19-4 10 10 0 0 1 19 4c0 13-19 25-19 25Z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><g transform="translate(12 11)"><rect x="4.25" y="5" width="15.5" height="12.5" rx="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8M8 12h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g></svg>'},
 {id:"tiktok",requirement:"Redeemed the secret TikTok code!",comingSoon:false,icon:'<img src="assets/patches/tiktok.png" width="48" height="54" alt="" decoding="async">'},
 {id:'first-100',requirement:'One of the first 100 TeacherTiles users!',comingSoon:false,icon:'<svg viewBox="0 0 48 48"><path d="m24 3 6.3 13.1L45 18.2 34.3 28.6l2.5 14.7L24 36.4l-12.8 6.9 2.5-14.7L3 18.2l14.7-2.1Z" fill="currentColor" fill-opacity=".14" stroke-width="1.8" stroke-linejoin="round"/><g transform="translate(13.68 13.965) scale(.43)"><path d="m7 20 4-3v15M7 32h8M22 17h2a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3ZM36 17h2a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>'},
 {id:'alpha-tester',requirement:'Tested the original version of TeacherTiles!',comingSoon:false,icon:'<svg viewBox="0 0 48 48"><text x="24" y="32" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="38" fill="currentColor" stroke="none">α</text><path d="M14 39h20M17 43h14" stroke-width="1.6"/></svg>'},
 {id:'connected',requirement:'Ran your first ClassConnect session!',comingSoon:true,icon:'<svg viewBox="0 0 48 48"><rect x="12" y="6" width="24" height="17" rx="3"/><path d="M24 23v5M18 28h12M9 30v-3l6-4M39 30v-3l-6-4M5 42v-2a4 4 0 0 1 8 0v2M20 44v-2a4 4 0 0 1 8 0v2M35 42v-2a4 4 0 0 1 8 0v2" stroke-width="2"/><circle cx="9" cy="33" r="2.5"/><circle cx="24" cy="35" r="2.5"/><circle cx="39" cy="33" r="2.5"/><path d="m20 14 3 3 6-6" stroke-width="2"/></svg>'}
];

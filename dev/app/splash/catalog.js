export const splashScreens=Object.freeze([
 {id:'default',name:'Default'}, {id:'halloween',name:'Halloween'},
 {id:'fall',name:'Fall'}, {id:'christmas',name:'Christmas'},
 {id:'winter',name:'Winter / Icy'}, {id:'summer',name:'Summer'},
 {id:'valentine',name:"Valentine’s"}, {id:'rainbow',name:'Rainbow'}
]);
export const normalizeSplash=id=>splashScreens.some(s=>s.id===id)?id:'default';

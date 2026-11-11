import { GAME_SLUGS } from "@/games/slugs";

// Where a newcomer lands: straight into the flagship game, not the hub. Runs
// in <head> before the page paints, so the hub never flashes.
//
// Only the first page load of a browser session counts as arriving: after
// that (the logo, a reload, a link) the hub opens normally. Anyone who has
// signed in on this device ("www:account:signed-in", the hint account/state.ts
// keeps in lib/storage) or has played any game here (a save under
// "www:<slug>:…", see each game's store.ts) is no newcomer: they get the hub,
// where today's progress is.

const ENTERED_KEY = "www:entered";
const SIGNED_IN_KEY = "www:account:signed-in";
const GUEST_HOME = "/who-when-where";
const SAVE_PREFIXES = JSON.stringify(GAME_SLUGS.map((slug) => `www:${slug}:`));

export const ENTRY_SCRIPT = `(function(){try{if(sessionStorage.getItem("${ENTERED_KEY}"))return;sessionStorage.setItem("${ENTERED_KEY}","1");if(location.pathname!=="/"||location.search)return;if(JSON.parse(localStorage.getItem("${SIGNED_IN_KEY}")||"false"))return;var p=${SAVE_PREFIXES};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||"";for(var j=0;j<p.length;j++)if(k.indexOf(p[j])===0)return}location.replace("${GUEST_HOME}")}catch(e){}})()`;

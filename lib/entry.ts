// Where a visitor without an account lands: straight into the flagship game,
// not the hub. Runs in <head> before the page paints, so the hub never flashes.
//
// Only the first page load of a browser session counts as arriving: after
// that (the logo, a reload, a link) the hub opens normally. "www:account:signed-in"
// is the hint account/state.ts keeps in lib/storage; anyone who has signed in
// on this device skips the redirect.

const ENTERED_KEY = "www:entered";
const SIGNED_IN_KEY = "www:account:signed-in";
const GUEST_HOME = "/who-when-where";

export const ENTRY_SCRIPT = `(function(){try{if(sessionStorage.getItem("${ENTERED_KEY}"))return;sessionStorage.setItem("${ENTERED_KEY}","1");if(location.pathname!=="/"||location.search)return;if(JSON.parse(localStorage.getItem("${SIGNED_IN_KEY}")||"false"))return;location.replace("${GUEST_HOME}")}catch(e){}})()`;

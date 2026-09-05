// ==UserScript==
// @name         ESPN redraft picks (deprecated)
// @namespace    maurerFPG
// @version      0.4.0
// @description  Deprecated. Use the Chrome MV3 extension in /extension and the HTTPS /api/picks board. Does not post to localhost.
// @match        https://fantasy.espn.com/football/draft*
// @match        https://fantasy.espn.com/*draft*
// @updateURL    https://maurerfpg.github.io/dynasty-league/espn-picks.user.js
// @downloadURL  https://maurerfpg.github.io/dynasty-league/espn-picks.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/* Localhost Tampermonkey never reliably posted; GitHub Pages cannot accept POSTs;
   mDraftDetail playerId -1 was written as Unknown. Load extension/ unpacked. */
(() => {
  console.info("[espn-picks] deprecated — use the Chrome extension in /extension");
})();

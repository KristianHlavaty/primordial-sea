/* Single import point for React. React/ReactDOM/htm are loaded as plain
   scripts by index.html (vendor/ folder), so the app needs no build step:
   `html` is htm bound to React.createElement and is used like JSX:

     html`<div className="hud">${children}</div>`
     html`<${MyComponent} someProp=${value}/>`
*/
const React = window.React;
const ReactDOM = window.ReactDOM;
const htm = window.htm && window.htm.default ? window.htm.default : window.htm;

export const html = htm.bind(React.createElement);
export { React, ReactDOM };
export const { useState, useRef, useMemo, useLayoutEffect, useEffect, Fragment } = React;

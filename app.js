'use strict';

(() => {
  const baseUrl = new URL('app.parts/', document.currentScript.src);
  const parts = ["part-01.jsfrag","part-02.jsfrag","part-03.jsfrag","part-04.jsfrag"];
  const source = parts.map((name) => {
    const request = new XMLHttpRequest();
    request.open('GET', new URL(name, baseUrl).href, false);
    request.send(null);
    if (request.status !== 0 && (request.status < 200 || request.status >= 300)) throw new Error('Could not load ' + name);
    return request.responseText;
  }).join('');
  Function(source + '\n//# sourceURL=x-client-renderer.bundle.js')();
})();

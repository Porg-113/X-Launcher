# X-Client-Shop

Der Eintrag ?Shop? in der Navigation f?hrt direkt zu **https://x-client.printify.me/**
im selben Browser-Tab. Es gibt keine eigene Shop-Oberfl?che auf der X-Client-Webseite.
Produkte, Varianten, Warenkorb und Bezahlung werden im Printify-Shop verwaltet.
F?r den direkten Link werden kein API-Schl?ssel und kein Shopify-Shop ben?tigt.

Die bisherigen Adressen `/shop/` und `/shop.html` bleiben als Weiterleitungen erhalten,
einschlie?lich Weiterleitung ohne JavaScript. Die alten Shop-Skripte und Styles sind
entfernt. Bei einer Umbenennung des Printify-Shops die Links in `docs/index.html`,
`docs/features.html`, `docs/downloads.html`, `docs/shop.html` und `docs/download.js`
sowie die Zieladresse in `test/website-urls.test.js` aktualisieren.

## Pr?fen und ver?ffentlichen

Die aktive Website-Quelle ist `docs/`. `X Client Website/` ist eine ?ltere Kopie.

```powershell
node --test test/website-urls.test.js
npm run build:website
```

`site/` enth?lt die ver?ffentlichbare Website. Der bestehende GitHub-Pages-Workflow
ver?ffentlicht sie nach einem Push nach `main`.

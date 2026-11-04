# X-Client-Shop einrichten

Die aktive Website-Quelle ist `docs/`. `X Client Website/` ist eine ältere Kopie.
`npm run build:website` erzeugt die Website in `site/`, einschließlich `/shop/`.
Die bestehenden GitHub-Pages-Workflows übernehmen die Veröffentlichung nach einem Push.

## Aktuell: Printify Pop-Up Store

Der Shop ist unter **https://x-client.printify.me/** eingerichtet. Es sind noch
keine Produkte veröffentlicht. Die X-Client-Shopseite zeigt deshalb „Die Kollektion
kommt bald“ und verlinkt den echten Printify-Shop. Sie ist auf Deutsch und Englisch verfügbar.

Die aktive Konfiguration in `docs/shop-config.js` lautet:

```js
provider: 'printify',
shopUrl: 'https://x-client.printify.me/',
comingSoon: true,
```

Für diese Einbindung werden **kein Shopify-Shop und kein API-Schlüssel** benötigt.
Produktauswahl, Varianten, Warenkorb und Bezahlung laufen direkt im Printify-Shop.
Es gibt auf der X-Client-Seite deshalb keinen zusätzlichen Shopify-Warenkorb.
Der Shop-Link funktioniert auch ohne JavaScript.

Sobald Produkte in Printify veröffentlicht sind, `comingSoon` auf `false` setzen.
Dadurch wird der Hinweis auf die noch fehlenden Produkte durch einen Verweis auf
die verfügbare Kollektion ersetzt. Produktkarten werden nicht automatisch auf die
X-Client-Seite übertragen. Für eigene Produktvorschauen werden die veröffentlichten
Produktlinks und Bilder benötigt. Bei einer Umbenennung des Printify-Shops muss auch
die hier hinterlegte Adresse angepasst werden.

Printify beschreibt Pop-Up Stores und ihre Bestellabwicklung hier:
https://help.printify.com/hc/en-us/articles/12051129478417-What-is-Printify-Pop-Up-Store

Die öffentliche Shopseite konnte bei der Einrichtung nicht automatisch ausgelesen
werden (HTTP 403). Der Link wurde wie vom Benutzer angegeben übernommen. Die
Prüfungen der X-Client-Seite ersetzen keinen Test des Printify-Checkouts.

## Optional: später auf Shopify wechseln

Dieser Abschnitt ist für den aktuellen Pop-Up Store **nicht erforderlich**. Die
vorbereitete Shopify-Anbindung bleibt als Alternative erhalten. Um sie zu verwenden,
`provider` auf `'shopify'` setzen und einen echten Shopify-Shop konfigurieren.

1. Zuerst einen Shopify-Shop erstellen. Shopify hat eigene Tarif- und Zahlungsbedingungen.
2. In Printify unter „Add new store“ die Shopify-Verbindung auswählen und den Shop verbinden.
3. Die gewünschten Printify-Produkte nach Shopify veröffentlichen. Preise, Varianten, Versand und Zahlungsarten im Shopify-Shop einrichten.
4. Die Shopify-Domain angeben, z. B. `dein-shop.myshopify.com`. Für diese Variante wird kein Printify-API-Schlüssel benötigt.

Printify: https://help.printify.com/hc/en-us/articles/4483644320145-Do-I-need-to-link-a-store

## Optionale Shopify-Verbindung

In `docs/shop-config.js` die echte `shopDomain` eintragen. Sie muss die genaue
`*.myshopify.com`-Domain sein; keine Admin-URL und kein Passwort.

Die Storefront API unterstützt tokenlosen Zugriff auf Produkte und Warenkörbe.
`publicAccessToken` kann zunächst leer bleiben. Wenn ein eigener Headless-Vertriebskanal
verwendet wird, dessen **öffentlichen Storefront-Zugriffstoken** eintragen und die
gewünschten Produkte für diesen Kanal veröffentlichen. Ein leerer Produktkatalog
kann auch bedeuten, dass die Produkte für den verwendeten Kanal noch nicht freigegeben sind.

**Niemals einen Admin-API-Token, privaten Storefront-Token, Printify-Token oder ein
Passwort in diese Dateien eintragen.** Diese Website ist statisch; ihre Konfiguration
ist für Besucher sichtbar. Die `publicAccessToken`-Option ist ausschließlich für den
öffentlichen Browser-Token der Shopify Storefront API vorgesehen.

Optional:

- `collectionHandle`: Nur diese Shopify-Kollektion zeigen; leer zeigt alle veröffentlichten Produkte. Den Handle aus der Kollektions-URL übernehmen.
- `countryCode`: Shopify Market festlegen, z. B. `CH` oder `DE`. Leer verwendet den Shop-Standard. Preise und Warenkorb werden mit demselben Kontext angefragt.
- `apiVersion`: Aktuell `2026-10`. Regelmäßig auf eine unterstützte Shopify-Version aktualisieren.

Produktdaten, Bilder, Verfügbarkeit, Preise, Warenkorb und vorhandene Rechtstexte
kommen aus Shopify. Es sind keine Beispielprodukte oder erfundenen Preise enthalten.
Der Warenkorb wird bei Shopify gespeichert; der Browser merkt sich lediglich seine ID
pro Shop und Markt. Beim Checkout werden Preise und Mengen erneut geprüft. Bezahlt
wird über die von Shopify zurückgegebene `checkoutUrl`. Auf der Website werden keine
Zahlungsdaten verarbeitet. Finalen Versand, Steuern und Rabatte berechnet Shopify.

Produkte werden seitenweise geladen. Pro Produkt werden zunächst 20 Varianten
abgerufen, um das Komplexitätslimit für tokenlose Anfragen einzuhalten. Über
„Weitere Varianten laden“ lassen sich zusätzliche Varianten direkt auf der Seite auswählen.

## Prüfen und veröffentlichen

```powershell
node --test test/website-urls.test.js test/website-shop.test.js
npm run build:website
python -m http.server 4173 --directory site --bind 127.0.0.1
```

Danach `http://127.0.0.1:4173/shop/` öffnen. Die aktuelle Printify-Konfiguration
zeigt den Vorbereitungszustand und einen direkten Shop-Link. Vor dem Verkaufsstart
die veröffentlichten Produkte und den Kaufablauf im Printify-Shop prüfen.
Bei einem späteren Wechsel auf Shopify zusätzlich Varianten, ausverkaufte Artikel,
Mengenänderungen, Versand, Steuern, Shopify Markets und einen Shopify-Testcheckout
prüfen. Automatisierte API-Tests verwenden simulierte Antworten und ersetzen diese
Shop-Prüfung nicht.

Shopify:

- https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api
- https://shopify.dev/docs/api/storefront/2026-10/mutations/cartCreate

Die Website-Änderungen sind lokal vorbereitet. Sie müssen über den bestehenden
GitHub-Pages-Workflow veröffentlicht werden, damit sie auf der Live-Website erscheinen.

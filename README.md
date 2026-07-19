# Hopfenstand

Eine installierbare, offline-fähige Web-App zum privaten Zählen von Bier.

## Starten

Da die App einen Service Worker verwendet, sollte sie über einen kleinen lokalen Webserver geöffnet werden:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` im Browser öffnen. Alternativ funktioniert beispielsweise auch die VS-Code-Erweiterung „Live Server“.

## Datenschutz

Alle Einträge liegen ausschließlich im `localStorage` des verwendeten Browsers. Es werden keine Daten an einen Server übertragen.

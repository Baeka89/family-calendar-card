# Development / Entwicklung

## Build and tests / Build und Tests

Use a current Node.js LTS version with npm. The corrected package was tested with Node.js 24.19.0. / Eine aktuelle Node.js-LTS-Version mit npm verwenden. Das korrigierte Paket wurde mit Node.js 24.19.0 geprüft.

Run from the repository root / Im Repository-Hauptverzeichnis ausführen:

```bash
npm ci --no-audit --fund=false
npm test
npm run build
```

Browser tests / Browser-Tests:

```bash
npx playwright install chromium
npm run test:visual
```

Edit authored code in `src/`; build the root `family-calendar-card.js` with Rollup and include it with source changes. Do not edit the generated bundle manually. / Quellcode unter `src/` bearbeiten; die Datei `family-calendar-card.js` im Hauptverzeichnis mit Rollup erstellen und zusammen mit Quellcodeänderungen aufnehmen. Das generierte Bundle nicht manuell bearbeiten.

The full Node case count can be obtained with / Die vollständige Anzahl der Node-Testfälle lässt sich so ermitteln:

```bash
node --test --test-isolation=none family-calendar-card.test.js ha-state-helpers.test.mjs color-config-normalizers.test.mjs
```

## Changelog maintenance / Changelog pflegen

1. Add user-visible changes under `[Unreleased]`. / Sichtbare Änderungen unter `[Unreleased]` ergänzen.
2. Write English first, then the equivalent German text, matching the maintainer's existing changelog structure. / Zuerst Englisch, dann den entsprechenden deutschen Text ergänzen, wie im vorhandenen Changelog des Maintainers.
3. Use `Added`, `Changed`, `Fixed` and, when needed, `Removed`; in German use `Hinzugefügt`, `Geändert`, `Behoben` and `Entfernt`. Omit empty categories. / Passende Kategorien verwenden und leere Kategorien weglassen.
4. Describe the concrete behavior and relevant limitations. / Konkretes Verhalten und wesentliche Einschränkungen beschreiben.
5. When preparing an actual release, move its entries to a section such as `## [1.0.0]` using the real version, newest first. Keep `[Unreleased]` for subsequent work and use the same notes for GitHub Releases. / Bei einer tatsächlichen Veröffentlichung Einträge unter die echte Version verschieben, neueste zuerst. `[Unreleased]` für weitere Arbeit beibehalten und dieselben Hinweise für GitHub Releases verwenden.

Version numbers, tags and release workflows are changed only as part of release preparation. This documentation update does not prepare a release. / Versionsnummern, Tags und Release-Workflows erst bei der Release-Vorbereitung ändern. Diese Dokumentationsänderung bereitet keinen Release vor.

## Current validation / Aktueller Prüfstand

The corrected development snapshot passed 531 Node tests. Browser testing could not complete in the available environment; real Home Assistant integration testing remains pending. See [bugfix notes](docs/bugfix-notes.md). / Der korrigierte Entwicklungsstand bestand 531 Node-Tests. Die Browserprüfung konnte in der verfügbaren Umgebung nicht abgeschlossen werden; Tests mit realem Home Assistant stehen noch aus. Siehe [Korrekturhinweise](docs/bugfix-notes.md).

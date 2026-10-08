# Changelog

All notable changes to this project are documented in this file.
Alle wesentlichen Änderungen an diesem Projekt werden hier dokumentiert.

## [Unreleased]

### Fixed / Behoben
- Keep the popup header and close button visible during scrolling. / Popup-Kopfzeile und Schließen-Schaltfläche bleiben beim Scrollen sichtbar.
- Make additional calendar selections readable in light and dark mode with matching popup styling. / Zusätzliche Kalenderauswahl ist in heller und dunkler Ansicht lesbar und passend gestaltet.
- Clicking the popup backdrop closes it without saving draft inputs or reopening a parent dialog. Dragging from inside does not dismiss it. / Ein Klick außerhalb schließt ohne Speichern oder Rückkehr zum übergeordneten Dialog; Ziehen von innen nach außen schließt nicht.


### Fixed / Behoben
- Display assignments remain limited to one occurrence even when a calendar integration omits recurrence metadata. / Anzeigezuordnungen bleiben auf ein Vorkommen begrenzt, auch ohne Wiederholungsmetadaten.
- Time and font settings follow visible assigned calendars when the source calendar is hidden. / Uhrzeit und Schriftfarbe berücksichtigen sichtbare zugeordnete Kalender bei ausgeblendetem Ursprung.
- Release asset uploads use the release tag and reject a mismatching bundle version. / Release-Dateien werden aus dem zugehörigen Tag geladen; abweichende Kartenversionen brechen den Upload ab.


### English 🇺🇸

#### Added

- Assign additional display calendars to an existing event from its details, including read-only invitations. Calendar names and colors are displayed without editing or copying the original event. Assignments persist in this browser; recurring events apply to the selected occurrence only.

### Deutsch 🇩🇪

#### Hinzugefügt

- Zusätzliche Anzeigekalender im Terminfenster auswählen, auch bei schreibgeschützten Einladungen. Kalendernamen und Farben erscheinen ohne Änderung oder Kopie des Originaltermins. Die Zuordnung bleibt in diesem Browser gespeichert; bei Serien gilt sie für das ausgewählte Vorkommen.


### English 🇺🇸

#### Changed

- Project descriptions and editor diagnostics consistently use Family Calendar Card; translated resource instructions now point to the correct installation file.
- README identifies Baeka89 as developer and maintainer and links to published versions.

### Deutsch 🇩🇪

#### Geändert

- Projektbeschreibung und Editor-Diagnose verwenden einheitlich Family Calendar Card; übersetzte Ressourcenhinweise verweisen auf die richtige Installationsdatei.
- README nennt Baeka89 als Entwickler und Maintainer und verlinkt veröffentlichte Versionen.


### English 🇺🇸

#### Added

- **Extra header buttons:** calendar gradients with individually selected real or virtual calendars. Colors follow the selection order and update with the configured calendar colors. Existing button color options remain available.

### Deutsch 🇩🇪

#### Hinzugefügt

- **Zusätzliche Header-Buttons:** Kalender-Farbverläufe mit einzeln auswählbaren echten oder virtuellen Kalendern. Farben folgen der Auswahlreihenfolge und den konfigurierten Kalenderfarben. Bisherige Farboptionen bleiben verfügbar.


This section describes the current `dev` snapshot, not a published release. No earlier release history was included in the supplied package.
Dieser Abschnitt beschreibt den aktuellen `dev`-Stand, keine veröffentlichte Version. Das bereitgestellte Paket enthielt keine frühere Release-Historie.

### English 🇺🇸

#### Added

- Regression coverage for the corrected behavior: 13 additional Node test cases and browser regression scenarios for event attributes, calendar picker labels and the editor.
- This changelog and a development guide covering build commands, validation and bilingual release notes.

#### Changed

- README follows the maintainer's existing repository structure: German and English descriptions, HACS/manual installation, configuration example, documentation links, technical components and PayPal support.
- HACS instructions describe a custom dashboard repository instead of claiming inclusion in the default catalog.
- Event management documentation explains partial saves and retry behavior.

#### Fixed

- **Rules:** conditions that require a false day flag now evaluate correctly.
- **Event editing:** explicitly clearing a location or description now sends the empty value instead of silently keeping the previous text.
- **Recurrence dates:** UTC `UNTIL` values are converted to the local date; all-day recurrence end dates remain date-only values.
- **Form validation:** invalid times and impossible all-day dates are rejected instead of being normalized to a different day.
- **Weather:** results and subscription callbacks from an earlier configuration no longer overwrite the active weather data.
- **Recurring series:** removing recurrence explicitly uses the replacement path rather than sending an invalid empty recurrence rule.
- **Partial updates:** concurrent updates to the same event are guarded. If a replacement was created but deleting the original failed, retrying unchanged values retries deletion without creating another replacement. Completed targets are skipped when retrying an unchanged multi-calendar edit. This tracking lasts until the card is reloaded.
- **HTML attributes:** calendar picker labels and editor background URLs are escaped before insertion into markup.
- **Event details:** serialized event attributes are escaped, so quotes and HTML entity text preserve their original values when opening an event.
- **Combined calendars:** duplicate-event merging preserves virtual calendar display sources while keeping real source entities for write operations.
- **Duplicate detection:** structured event keys avoid collisions caused by pipe characters in event titles or locations.

#### Validation

- 531 Node tests passed; JavaScript syntax checks passed and the three packaged bundles were synchronized after the build.
- Browser regression scenarios were added, but the browser suite could not complete in the available environment. End-to-end checks against a real Home Assistant instance remain open.

### Deutsch 🇩🇪

#### Hinzugefügt

- Regressionstests für die Korrekturen: 13 zusätzliche Node-Testfälle und Browser-Szenarien für Terminattribute, Kalenderbeschriftungen und den Editor.
- Dieser Changelog und eine Entwicklungsanleitung für Build, Prüfung und zweisprachige Versionshinweise.

#### Geändert

- README an die vorhandene Repository-Struktur des Maintainers angepasst: deutsche und englische Beschreibung, HACS/manuelle Installation, Konfigurationsbeispiel, Dokumentationslinks, technische Komponenten und PayPal-Unterstützung.
- HACS-Anleitung beschreibt ein benutzerdefiniertes Dashboard-Repository statt eine Aufnahme in den Standardkatalog zu behaupten.
- Dokumentation der Terminverwaltung erklärt Teilerfolge beim Speichern und das Verhalten bei Wiederholungsversuchen.

#### Behoben

- **Regeln:** Bedingungen, die einen falschen Tagesstatus verlangen, werden korrekt ausgewertet.
- **Terminbearbeitung:** Leeren von Ort oder Beschreibung übermittelt jetzt den leeren Wert, statt den bisherigen Text beizubehalten.
- **Wiederholungsdaten:** UTC-`UNTIL`-Werte werden ins lokale Datum umgerechnet; Enddaten ganztägiger Wiederholungen bleiben reine Datumswerte.
- **Formularprüfung:** Ungültige Zeiten und nicht existierende ganztägige Datumsangaben werden zurückgewiesen, statt auf einen anderen Tag verschoben zu werden.
- **Wetter:** Ergebnisse und Subscription-Callbacks einer früheren Konfiguration überschreiben keine aktuellen Wetterdaten mehr.
- **Terminserien:** Entfernen einer Wiederholung verwendet ausdrücklich den Ersetzungspfad, statt eine ungültige leere Wiederholungsregel zu senden.
- **Teilweise gespeicherte Änderungen:** Gleichzeitige Änderungen desselben Termins werden abgesichert. Wurde ein Ersatztermin erstellt, aber das Original nicht gelöscht, wiederholt ein erneuter Versuch mit gleichen Werten nur die Löschung. Bereits erledigte Kalender werden bei unverändertem erneutem Speichern übersprungen. Diese Zuordnung gilt bis zum Neuladen der Karte.
- **HTML-Attribute:** Beschriftungen der Kalenderauswahl und Hintergrund-URLs im Editor werden vor dem Einsetzen ins Markup maskiert.
- **Termindetails:** Serialisierte Terminattribute werden maskiert; Anführungszeichen und HTML-Entity-Text behalten beim Öffnen ihre ursprünglichen Werte.
- **Zusammengeführte Kalender:** Beim Zusammenführen gleicher Termine bleiben virtuelle Anzeigequellen erhalten; Schreiboperationen verwenden weiterhin die tatsächlichen Quellkalender.
- **Duplikaterkennung:** Strukturierte Terminschlüssel verhindern Kollisionen durch senkrechte Striche in Titel oder Ort.

#### Prüfung

- 531 Node-Tests bestanden; JavaScript-Syntaxprüfungen bestanden und die drei Paket-Bundles nach dem Build abgeglichen.
- Browser-Regressionsszenarien ergänzt, die Browser-Suite konnte in der verfügbaren Umgebung jedoch nicht abgeschlossen werden. Ende-zu-Ende-Prüfungen mit einer realen Home-Assistant-Instanz stehen noch aus.

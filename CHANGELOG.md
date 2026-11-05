# Changelog

Veröffentlichte Änderungen werden hier dokumentiert. Noch nicht veröffentlichte Änderungen stehen getrennt davor. / Published changes are documented here, preceded by a separate section for unreleased changes.

## Noch nicht veröffentlicht / Unreleased

### Deutsch 🇩🇪

#### Hinzugefügt

- Browser-Regressionstest für den konkret gemeldeten Angriff sowie Prüfungen für fehlerhaftes HTML, Linkgrenzen, fremde Namensräume und erneutes Einlesen der Ausgabe.

#### Geändert

Keine.

#### Behoben

- Sicherheitslücke in Terminbeschreibungen geschlossen: Links werden nicht mehr durch nachfolgende HTML-Textersetzungen verändert. Ein inertes HTML-Fragment wird eingelesen und ausschließlich mit erlaubten Elementen und geprüften Linkzielen neu aufgebaut.
- Linkziele mit Leerzeichen, Steuerzeichen, Anführungszeichen, spitzen Klammern oder Rückwärtsschrägstrichen werden verworfen.

#### Entfernt

- Den nicht verwendeten Workflow „Sync Main Back Into Dev“ entfernt. Er setzte einen nicht vorhandenen `dev`-Branch voraus und verursachte nach Veröffentlichungen fehlgeschlagene Läufe.

#### Updatehinweise

- Sicherheitsupdate der Karte installieren und das Dashboard neu laden. Die optionale Integration bleibt auf v0.1.2; kein Home-Assistant-Neustart für das Kartenupdate erforderlich.

#### Bekannte Einschränkungen

- Historische fehlgeschlagene Workflow-Läufe bleiben im GitHub-Verlauf sichtbar.

#### Prüfungen

- Build, Syntaxprüfung von 53 Quelldateien und 579 Node-Tests erfolgreich. Alle 140 Browser- und Bildvergleichstests einschließlich acht gezielter Sicherheitstests erfolgreich; vorhandene Referenzbilder unverändert. Keine Liveprüfung in einer echten Home-Assistant-Installation.

### English 🇺🇸

#### Added

- Browser regression coverage for the reported exploit, malformed HTML, URL boundaries, foreign namespaces and reparsing the output.

#### Changed

None.

#### Fixed

- Closed an event-description security issue: subsequent HTML text replacements no longer modify generated links. An inert HTML fragment is parsed and rebuilt using only allowed elements and validated link targets.
- Discarded URL targets containing whitespace, control characters, quotes, angle brackets or backslashes.

#### Removed

- Removed the unused “Sync Main Back Into Dev” workflow. It required a nonexistent `dev` branch and caused failed runs after releases.

#### Update notes

- Install the card security update and reload the dashboard. The optional integration remains at v0.1.2; the card update requires no Home Assistant restart.

#### Known limitations

- Historical failed workflow runs remain visible in GitHub history.

#### Checks

- Build, syntax checks across 53 source files and 579 Node tests passed. All 140 browser and screenshot tests passed, including eight targeted security tests; existing reference images are unchanged. No live test in a real Home Assistant installation.

---

<a id="release-0-1-7"></a>

## [0.1.7] – 2026-11-04

### Deutsch 🇩🇪

#### Hinzugefügt

- Regressionstests für HTML-Attribute, Kalendernamen, Editorfelder, Beschreibungslinks und interne Formatierungstokens.

#### Geändert

- Browser- und Baseline-Workflows auf Ubuntu 24.04 festgelegt, passend zur vorhandenen Playwright-Version.
- README mit zwölf gleich aufgebauten Abschnitten je Sprache; Deutsch vor Englisch. Vorhandene Bilder und Link zur vollständigen Galerie bleiben enthalten.

#### Behoben

- Anführungszeichen und Sonderzeichen in Texten, Symbol-, Bild-, Farb- und Formularattributen absichern. Kalendernamen im Editor werden als Text ausgegeben.
- Markdown-Formatierung verändert keine erzeugten Linkziele; HTML-Links behalten Abfrageparameter. Code-Inhalte kollidieren nicht mit internen Tokens.

#### Entfernt

Keine.

#### Updatehinweise

- Nach dem Kartenupdate das Dashboard neu laden. Die Begleitintegration bleibt optional. Download: `family-calendar-card.js` für HACS oder `/config/www/`; das optionale ZIP enthält Integration v0.1.2 unter `custom_components/family_calendar_card/` für `/config/`.

#### Bekannte Einschränkungen

- Keine neue Liveprüfung in einer echten Home-Assistant-Installation. Die Karte benötigt die optionale Integration nur für gemeinsame zusätzliche Anzeigezuordnungen.

#### Prüfungen

- Lokaler Build, Syntax- und Node-Prüfungen erfolgreich. GitHub-Prüfungen des Korrekturstands einschließlich Browser-/Bildvergleichstests erfolgreich. Veröffentlichung nur nach erfolgreicher erneuter Prüfung des exakten Release-Commits.
### English 🇺🇸

#### Added

- Regression tests for HTML attributes, calendar names, editor fields, description links and internal formatting tokens.

#### Changed

- Pin browser and baseline workflows to Ubuntu 24.04 to match the existing Playwright version.
- README with twelve matching sections per language, German before English. Existing images and the full gallery link are retained.

#### Fixed

- Escape quotes and special characters in text, icon, image, color and form attributes. Calendar names in the editor are displayed as text.
- Markdown formatting no longer modifies generated link targets; HTML links retain query parameters. Code contents do not collide with internal tokens.

#### Removed

None.

#### Update notes

- Reload the dashboard after updating the card. The companion remains optional. Download: `family-calendar-card.js` for HACS or `/config/www/`; the optional ZIP contains integration v0.1.2 under `custom_components/family_calendar_card/` for `/config/`.

#### Known limitations

- No new live test in a real Home Assistant installation. Only shared additional display assignments require the optional integration.

#### Checks

- Local build, syntax and Node checks passed. GitHub checks for the correction commit, including browser/screenshot tests, passed. Publication requires successful repeated checks on the exact release commit.

---

## [v0.1.6]

- EN: Apply hidden calendar badges to all views and event details, while preserving events, colors and calendar selection.
- DE: Ausgeblendete Kalender-Badges gelten in allen Ansichten und Termindetails; Termine, Farben und Kalenderauswahl bleiben erhalten.

- Let Agenda use its content height when compact height is disabled, removing stretched empty space. Fixed-height compact layouts keep their existing behavior. / Die Agenda verwendet bei deaktivierter kompakter Höhe ihre Inhaltshöhe und reserviert keinen gestreckten Leerraum. Kompakte Layouts mit vorgegebener Höhe behalten ihr Verhalten.

## [v0.1.5]

- Include all 48 example screenshots, their configurations and the interactive gallery in the repository. / Alle 48 Beispielbilder einschließlich Konfigurationen und interaktiver Galerie ins Repository aufnehmen.

- Replace the README gallery with nine selected example screenshots and English/German feature descriptions. / README-Galerie durch neun ausgewählte Beispielbilder mit englischen und deutschen Funktionsbeschreibungen ersetzen.

- Complete optional integration notices and setup translations in all nine supported languages; validate translation keys and placeholders. / Hinweise und Einrichtungstexte der optionalen Integration in allen neun unterstützten Sprachen vervollständigen; Textschlüssel und Platzhalter prüfen.

- Optional companion setup through the Home Assistant UI; legacy YAML import preserves shared assignments. / Optionale Einrichtung der Begleitintegration über die Home-Assistant-Oberfläche; YAML-Übernahme erhält gemeinsame Zuordnungen.
- Standalone card displays installation information instead of unavailable assignment controls. / Die eigenständig nutzbare Karte zeigt einen Einrichtungshinweis statt nicht verfügbarer Zuordnungsschaltflächen.

- Preserve shared assignments outside the editing card’s calendars and validate merged assignments before saving. / Gemeinsame Zuordnungen außerhalb der bearbeitenden Karte erhalten und zusammengeführte Zuordnungen vor dem Speichern prüfen.


- Reject nonexistent local times during spring clock changes instead of shifting appointments by an hour. / Nicht existierende lokale Uhrzeiten bei der Zeitumstellung ablehnen, statt Termine um eine Stunde zu verschieben.


- Reject impossible timed-event dates and overflowing clock values instead of silently moving appointments. / Unmögliche Datums- und Uhrzeitwerte bei Terminen ablehnen, statt sie stillschweigend zu verschieben.


- Reject invalid selected recurrence limits instead of silently saving an unlimited series. / Ungültige ausgewählte Wiederholungsgrenzen ablehnen, statt unbegrenzte Serien zu speichern.


- Preserve recurring occurrence scope on updates and moves when providers return a recurrence ID without an rrule. / Vorkommensbegrenzung beim Bearbeiten und Verschieben auch ohne gelieferte Wiederholungsregel erhalten.


- Keep additional display-calendar badges and event visibility when the original calendar belongs to a virtual group. / Zusätzliche Anzeigekalender und Termine bleiben auch bei einer ausgeblendeten virtuellen Originalgruppe sichtbar.


- Preserve the Agenda scroll position when shared calendar assignments update, including deferred refreshes after closing the event dialog. / Agenda-Scrollposition bei gemeinsamen Kalenderzuordnungen erhalten, auch nach dem Schließen eines Dialogs.


- Prevent stale shared-calendar save replies from replacing newer updates; notify other devices even if the writer disconnects after saving. / Veraltete Speicherantworten überschreiben keine neueren Zuordnungen; andere Geräte werden auch nach einer Trennung des speichernden Clients benachrichtigt.
- Compare future recurring color rules chronologically across explicit time-zone offsets. / Farbregeln für zukünftige Serienvorkommen anhand der tatsächlichen zeitlichen Reihenfolge einschließlich Zeitzonen vergleichen.


### Added / Hinzugefügt
- Share display-only calendar assignments across devices and users with the Home Assistant companion integration. / Anzeigezuordnungen mit der Home-Assistant-Begleitintegration auf allen Geräten und für alle Benutzer teilen.
- Add Agenda text alignment in the visual editor and YAML (`auto`, `left`, `center`, `right`). / Textausrichtung der Agenda im Editor und YAML wählen.

### Changed / Geändert
- Saving display assignments requires the companion; failed saves show an error instead of silently remaining local. Existing local assignments must be selected and saved again. / Das Speichern benötigt die Begleitintegration; bei Fehlern erscheint eine Meldung. Bisherige lokale Zuordnungen einmal neu auswählen und speichern.


### Fixed / Behoben
- Reset the form-error timeout when a new error appears, so an older timer cannot hide the new message early. / Bei einer neuen Formularfehlermeldung den Timer zurücksetzen, damit ein älterer Timer sie nicht vorzeitig ausblendet.
- Register calendar and discrete family-rule change handlers only once in the editor. / Änderungen an Kalenderauswahl und Familienregel-Auswahlfeldern werden im Editor nur einmal verarbeitet.
- Reject invalid explicit event end times instead of silently replacing them; validate chunk sizes to prevent non-progressing date-range loops. / Ungültige eingegebene Endzeiten nicht stillschweigend ersetzen; ungültige Abschnittsgrößen gegen Endlosschleifen absichern.
- Ignore malformed or outdated shared-storage replies and isolate disconnected subscribers. / Fehlerhafte und verspätete Speicherantworten ignorieren; getrennte Abonnenten beeinträchtigen andere Geräte nicht mehr.

- Give combined-calendar initials their own wrapping row below Agenda content, avoiding overlap with event times. / Kalenderkürzel erhalten in der Agenda eine eigene umbrechende Zeile unter dem Termininhalt und überlagern die Uhrzeit nicht mehr.
- Keep the popup header and close button visible during scrolling. / Popup-Kopfzeile und Schließen-Schaltfläche bleiben beim Scrollen sichtbar.
- Make additional calendar selections readable in light and dark mode with matching popup styling. / Zusätzliche Kalenderauswahl ist in heller und dunkler Ansicht lesbar und passend gestaltet.
- Clicking the popup backdrop closes it without saving draft inputs or reopening a parent dialog. Dragging from inside does not dismiss it. / Ein Klick außerhalb schließt ohne Speichern oder Rückkehr zum übergeordneten Dialog; Ziehen von innen nach außen schließt nicht.


- Display assignments remain limited to one occurrence even when a calendar integration omits recurrence metadata. / Anzeigezuordnungen bleiben auf ein Vorkommen begrenzt, auch ohne Wiederholungsmetadaten.
- Time and font settings follow visible assigned calendars when the source calendar is hidden. / Uhrzeit und Schriftfarbe berücksichtigen sichtbare zugeordnete Kalender bei ausgeblendetem Ursprung.
- Release asset uploads use the release tag and reject a mismatching bundle version. / Release-Dateien werden aus dem zugehörigen Tag geladen; abweichende Kartenversionen brechen den Upload ab.


### Maintenance / Wartung
- Remove unused editor imports and the duplicate form-error method without changing layout. / Unbenutzte Editor-Imports und doppelte Formularfehler-Methode entfernen, ohne das Layout zu ändern.
- Check all authored JavaScript files and duplicate class methods in CI. / Alle JavaScript-Quelldateien und doppelte Klassenmethoden in CI prüfen.

### English 🇺🇸

#### Added

- Assign additional display calendars to an existing event from its details, including read-only invitations. Calendar names and colors are displayed without editing or copying the original event. Assignments use the shared Home Assistant companion store; recurring events apply to the selected occurrence only.

### Deutsch 🇩🇪

#### Hinzugefügt

- Zusätzliche Anzeigekalender im Terminfenster auswählen, auch bei schreibgeschützten Einladungen. Kalendernamen und Farben erscheinen ohne Änderung oder Kopie des Originaltermins. Die Zuordnung wird mit der Home-Assistant-Begleitintegration zentral gespeichert; bei Serien gilt sie für das ausgewählte Vorkommen.


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

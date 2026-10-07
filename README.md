# Family Calendar Card for Home Assistant

[![HACS](https://img.shields.io/badge/HACS-Compatible-blue.svg)](https://github.com/hacs/integration)
[![Maintainer](https://img.shields.io/badge/Maintainer-Baeka89-blue.svg)](https://github.com/Baeka89)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/misomazo)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Deutsch](#deutsch) | [English](#english) · [Changelog](CHANGELOG.md)

---

<a id="deutsch"></a>

## Deutsch 🇩🇪

### Über dieses Projekt

**Family Calendar Card** bringt mehrere Home-Assistant-Kalender in einer gemeinsamen Dashboard-Karte zusammen. Termine, Familienmitglieder und Wetter lassen sich übersichtlich darstellen und individuell gestalten.

Das Projekt wird von **Baeka89** entwickelt und gepflegt. Die Karte lässt sich über den visuellen Editor oder YAML konfigurieren.

**Versionen:** Veröffentlichte Versionen findest du unter [Releases](https://github.com/Baeka89/family-calendar-card/releases). Änderungen sind im [Changelog](CHANGELOG.md) dokumentiert.

### Features

- **Vier Ansichten:** Monat, Woche, Schedule und Agenda.
- **Mehrere Kalender:** gemeinsame Darstellung, Kalenderfarben und zusammengeführte Termine.
- **Zusätzliche Zuordnung:** In den Termindetails unter „Betrifft auch diese Kalender“ weitere konfigurierte Kalender auswählen. Auch bei schreibgeschützten Einladungen werden deren Namen und Farben angezeigt. Die Zuordnung bleibt lokal in diesem Browser gespeichert und ändert den Originaltermin nicht; bei Serien gilt sie nur für das ausgewählte Vorkommen.
- **Terminverwaltung:** Termine erstellen und bearbeiten, einschließlich Wiederholungen; verfügbare Aktionen hängen von der Kalenderintegration und ihren Schreibrechten ab.
- **Wetter:** Vorhersagen aus einer Home-Assistant-Wetterentität.
- **Individuelle Darstellung:** Termin- und Tagesstile, Tages-Badges und virtuelle Kalender.
- **Familienmitglieder:** Einbindung von `person`-Entitäten.
- **Beschreibungen:** Markdown- und HTML-Darstellung für Termindetails.
- **Bedienung:** visueller Konfigurationseditor und responsive Ansichten für Tablets und andere Bildschirmgrößen.

### Voraussetzungen

- Home Assistant mit mindestens einer `calendar`-Entität.
- Optional eine `weather`-Entität für Vorhersagen und `person`-Entitäten für Familienmitglieder.
- Eine schreibfähige Kalenderintegration, wenn Termine über die Karte verwaltet werden sollen.

### Unterstützung

Fehler und Vorschläge kannst du über die [GitHub Issues](https://github.com/Baeka89/family-calendar-card/issues) melden. Bitte ergänze Kartenversion, Home-Assistant-Version, verwendete Kalenderintegration und Schritte zum Nachstellen; entferne persönliche Termindaten aus Beispielen.

Wenn du die Weiterentwicklung unterstützen möchtest: **[Spende via PayPal](https://paypal.me/misomazo)**.

---

<a id="english"></a>

## English 🇺🇸

### About this Project

**Family Calendar Card** brings multiple Home Assistant calendars together in one dashboard card. Customize how events, family members and weather forecasts appear.

The project is developed and maintained by **Baeka89**. Configure the card using the visual editor or YAML.

**Versions:** Published versions are available under [Releases](https://github.com/Baeka89/family-calendar-card/releases). Changes are documented in the [changelog](CHANGELOG.md).

### Features

- **Four views:** Month, Week, Schedule and Agenda.
- **Multiple calendars:** shared views, calendar colors and combined events.
- **Additional assignments:** Open event details and select additional configured calendars under “Also concerns these calendars”. Their names and colors appear even for read-only invitations. Assignments are stored locally in this browser without changing the original event; recurring assignments apply only to the selected occurrence.
- **Event management:** create and edit events, including recurring events; available actions depend on the calendar integration and its write permissions.
- **Weather:** forecasts from a Home Assistant weather entity.
- **Customization:** event styles, day styles, day badges and virtual calendars.
- **Family members:** support for `person` entities.
- **Descriptions:** Markdown and HTML rendering in event details.
- **Controls:** visual configuration editor and responsive views for tablets and other screen sizes.

### Requirements

- Home Assistant with at least one `calendar` entity.
- Optional `weather` and `person` entities for forecasts and family members.
- A calendar integration with write support to manage events through the card.

### Support

Report bugs and suggestions through [GitHub Issues](https://github.com/Baeka89/family-calendar-card/issues). Include the card version, Home Assistant version, calendar integration and reproduction steps. Remove personal event data from examples.

To support development: **[Donate via PayPal](https://paypal.me/misomazo)**.

---

## Gallery / Galerie

### Week / Woche

![Week view / Wochenansicht](https://github.com/user-attachments/assets/8a772a66-3ce7-4f78-aeab-d0abb50ac27b)

### Schedule

![Schedule view / Schedule-Ansicht](https://github.com/user-attachments/assets/eb3852b6-0f7f-477c-9e6d-3c5741f6cb77)

### Agenda

<img src="https://github.com/user-attachments/assets/6610248e-716a-420c-972b-e427d4a65582" width="300" alt="Agenda view / Agenda-Ansicht">

---

## How to Install / Installation

### HACS

**Deutsch:**

1. HACS öffnen und nach **Family Calendar Card** suchen.
2. Falls die Karte nicht gefunden wird: im Menü **benutzerdefinierte Repositories** die Adresse `https://github.com/Baeka89/family-calendar-card` hinzufügen; als Typ **Dashboard** wählen (in älteren HACS-Versionen „Frontend“).
3. **Family Calendar Card** herunterladen.
4. Unter den Dashboard-Ressourcen prüfen, ob `/hacsfiles/family-calendar-card/family-calendar-card.js` als **JavaScript-Modul** eingetragen ist; bei Bedarf ergänzen.
5. Browser neu laden und die Karte zum Dashboard hinzufügen.

**English:**

1. Open HACS and search for **Family Calendar Card**.
2. If the card is not listed, add `https://github.com/Baeka89/family-calendar-card` under **Custom repositories**, with type **Dashboard** (called “Frontend” in older HACS versions).
3. Download **Family Calendar Card**.
4. Check dashboard resources for `/hacsfiles/family-calendar-card/family-calendar-card.js`, configured as a **JavaScript module**; add it if needed.
5. Reload your browser and add the card to your dashboard.

### Manual / Manuell

| Schritt / Step | Deutsch | English |
| --- | --- | --- |
| 1 | Die fertige [family-calendar-card.js](family-calendar-card.js) aus diesem Paket oder Repository verwenden. | Use the built [family-calendar-card.js](family-calendar-card.js) from this package or repository. |
| 2 | Nach `<config>/www/family-calendar-card.js` kopieren. | Copy it to `<config>/www/family-calendar-card.js`. |
| 3 | `/local/family-calendar-card.js?v=1` als Dashboard-Ressource vom Typ **JavaScript-Modul** hinzufügen. | Add `/local/family-calendar-card.js?v=1` as a dashboard resource of type **JavaScript module**. |
| 4 | Browser neu laden. Nach Updates den Wert von `?v=` erhöhen, falls der Browser die alte Datei lädt. | Reload the browser. After updates, increase `?v=` if the browser loads the old file. |

---

## Quick Start / Schnellstart

Eine manuelle Dashboard-Karte hinzufügen und die Beispiel-Entitäten durch eigene ersetzen. / Add a manual dashboard card and replace the sample entities with your own.

```yaml
type: custom:family-calendar-card
title: Family Calendar
entities:
  - calendar.family
  - calendar.work
  - calendar.holidays
```

Weitere Einstellungen sind im visuellen Editor verfügbar. / More settings are available in the visual editor.

---

## Documentation / Dokumentation

Die ausführliche Dokumentation liegt im Repository unter [`docs/`](docs). Die Seiten sind als englische MDX-Quelldateien verfügbar; eine separate Dokumentationswebsite ist nicht eingerichtet. / Detailed documentation is available as English MDX source files in [`docs/`](docs); there is no separately hosted documentation site.

- [Basic configuration / Grundkonfiguration](docs/configuration/basic.mdx)
- [Display options / Anzeigeoptionen](docs/configuration/display.mdx)
- [Appearance / Gestaltung](docs/configuration/appearance.mdx)
- [Weather / Wetter](docs/configuration/weather.mdx)
- [Event management / Terminverwaltung](docs/configuration/event-management.mdx)
- [Event styles / Terminstile](docs/advanced/event-styles.mdx)
- [Day styles / Tagesstile](docs/advanced/day-styles.mdx)
- [Day badges / Tages-Badges](docs/advanced/day-badges.mdx)
- [Virtual calendars / Virtuelle Kalender](docs/advanced/virtual-calendars.mdx)
- [Troubleshooting / Fehlerbehebung](docs/troubleshooting.mdx)

---

## Technical Components / Technische Komponenten

| Datei / File | Aufgabe / Purpose |
| --- | --- |
| `src/family-calendar-card.js` | Hauptkomponente und Build-Einstieg / Main component and build entry point. |
| `src/events/` | Termindaten, Formulare und Kalender-Aufrufe / Event data, forms and calendar requests. |
| `src/renderers/`, `src/views/` | Darstellung und Ansichtsmodelle / Rendering and view models. |
| `src/editor/` | Visueller Konfigurationseditor / Visual configuration editor. |
| `src/weather/` | Wetterdaten und Aktualisierung / Weather data and refresh logic. |
| `src/translations.js` | Übersetzungen der Karte / Card translations. |
| `family-calendar-card.js` | Generierte Datei für HACS und manuelle Installation / Built file for HACS and manual installation. |
| `hacs.json` | HACS-Metadaten / HACS metadata. |

Entwicklung und Prüfung: [DEVELOPMENT.md](DEVELOPMENT.md). Änderungen: [CHANGELOG.md](CHANGELOG.md). / Development and validation: [DEVELOPMENT.md](DEVELOPMENT.md). Release notes: [CHANGELOG.md](CHANGELOG.md).

### Thanks / Danke

Danke an die Home-Assistant-Community für Feedback, Ideen und Tests. / Thanks to the Home Assistant community for feedback, ideas and testing.

Family Calendar Card wird von **[Baeka89](https://github.com/Baeka89)** gepflegt. Lizenz: [MIT](LICENSE). / Family Calendar Card is maintained by **[Baeka89](https://github.com/Baeka89)**. License: [MIT](LICENSE).

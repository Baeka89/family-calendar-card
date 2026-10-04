# Correctness fixes in the packaged development build

This build fixes negative day predicates, delimiter collisions in duplicate detection,
entity-safe event attributes, prefix color participation when combining duplicates,
UNTIL date round trips, editable empty location/description fields, invalid all-day
form dates, late weather responses, and label escaping.

When an entire series or its future part has recurrence explicitly disabled, the
card replaces it with a nonrecurring event instead of sending an invalid empty
RRULE. Editing one occurrence keeps the series scope intact. Calendar integrations
still determine which recurrence operations they support.

If a replacement is saved but the old event cannot be deleted, the error identifies
that partial completion. Retry with exactly the same values, scope and destination:
the active card retries deletion without creating another replacement. Already
completed targets in a combined edit are skipped on retry. Changed values are
rejected until the partial operation finishes. A retry record is held only by the
active card instance, not persisted across page reloads or new card instances.
After reloading, inspect the calendar and resolve any remaining duplicate before
editing again. No automatic rollback is attempted without the new event's UID.

The event backend was checked against Home Assistant's calendar schema: empty
location/description strings are permitted; null or empty RRULE is not supported.
References:
- https://github.com/home-assistant/core/blob/dev/homeassistant/components/calendar/__init__.py
- https://github.com/home-assistant/core/blob/dev/homeassistant/components/calendar/helper.py

The initial ZIP had no screenshot baselines. Browser verification status is recorded
in the delivery notes; this file does not claim snapshot comparison coverage.

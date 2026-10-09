"""Shared display-only calendar assignments for Family Calendar Card."""

import asyncio
import logging
import re
from uuid import uuid4

try:
    import probatio as vol
except ImportError:  # Home Assistant releases using voluptuous.
    import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store

_LOGGER = logging.getLogger(__name__)
DOMAIN = "family_calendar_card"
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)
CALENDAR_ID = re.compile(r"calendar\.[a-zA-Z0-9_]+\Z")


def validate_keys(value):
    """Limit untrusted identifiers and reject malformed event keys."""
    if not isinstance(value, list) or not 1 <= len(value) <= 100:
        raise vol.Invalid("Expected 1–100 event keys")
    for key in value:
        if not isinstance(key, str) or not 1 <= len(key) <= 4096:
            raise vol.Invalid("Invalid event key")
    return list(dict.fromkeys(value))


def validate_calendars(value):
    """Allow only calendar entity IDs; an empty list removes an assignment."""
    if not isinstance(value, list) or len(value) > 100:
        raise vol.Invalid("Expected at most 100 calendars")
    if any(not isinstance(item, str) or not CALENDAR_ID.fullmatch(item) for item in value):
        raise vol.Invalid("Invalid calendar ID")
    return list(dict.fromkeys(value))


def normalize_assignments(value):
    """Retain valid saved assignments if storage contains malformed entries."""
    if not isinstance(value, dict):
        return {}
    assignments = {}
    for key, calendars in value.items():
        try:
            validate_keys([key])
            ids = validate_calendars(calendars)
        except vol.Invalid:
            continue
        if ids:
            assignments[key] = ids
    return assignments


async def async_setup(hass, config):
    """Load the central store and register authenticated WebSocket commands."""
    store = Store(hass, 1, DOMAIN + ".display_calendars")
    assignments = normalize_assignments(await store.async_load())
    hass.data[DOMAIN] = {
        "epoch": uuid4().hex,
        "revision": 0,
        "store": store,
        "assignments": assignments,
        "lock": asyncio.Lock(),
        "listeners": set(),
    }
    websocket_api.async_register_command(hass, websocket_subscribe)
    websocket_api.async_register_command(hass, websocket_set)
    return True


@websocket_api.websocket_command({vol.Required("type"): DOMAIN + "/subscribe"})
@callback
def websocket_subscribe(hass, connection, msg):
    """Send the current state and subsequent changes to all connected clients."""
    data = hass.data[DOMAIN]

    @callback
    def send_update():
        connection.send_event(msg["id"], {"assignments": data["assignments"], "epoch": data["epoch"], "revision": data["revision"]})

    data["listeners"].add(send_update)
    connection.subscriptions[msg["id"]] = lambda: data["listeners"].discard(send_update)
    connection.send_result(msg["id"])
    send_update()


@websocket_api.websocket_command(
    {
        vol.Required("type"): DOMAIN + "/set",
        vol.Required("keys"): validate_keys,
        vol.Required("calendars"): validate_calendars,
        vol.Optional("managed_calendars"): validate_calendars,
    }
)
@websocket_api.async_response
async def websocket_set(hass, connection, msg):
    """Patch only the selected event's keys, preserving concurrent other edits."""
    data = hass.data[DOMAIN]
    async with data["lock"]:
        assignments = dict(data["assignments"])
        managed = set(msg["managed_calendars"]) if "managed_calendars" in msg else None
        for key in msg["keys"]:
            retained = [entity_id for entity_id in assignments.get(key, []) if managed is not None and entity_id not in managed]
            selected = msg["calendars"] if managed is None else [entity_id for entity_id in msg["calendars"] if entity_id in managed]
            calendars = validate_calendars(list(dict.fromkeys([*retained, *selected])))
            if calendars:
                assignments[key] = calendars
            else:
                assignments.pop(key, None)
        # Publish only after the atomic HA storage save succeeds.
        await data["store"].async_save(assignments)
        data["assignments"] = assignments
        data["revision"] += 1
        for listener in tuple(data["listeners"]):
            try:
                listener()
            except (ConnectionError, RuntimeError):
                data["listeners"].discard(listener)
                _LOGGER.debug("Removed disconnected calendar display subscriber", exc_info=True)

        # Notify observers even when the writer disconnected after the disk save.
        connection.send_result(msg["id"], {"assignments": assignments, "epoch": data["epoch"], "revision": data["revision"]})

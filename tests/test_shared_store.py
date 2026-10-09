"""Backend contract tests with HA storage/WebSocket adapters mocked."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest


class FakeStore:
    disk = {}
    fail = False

    def __init__(self, hass, version, key):
        self.key = key

    async def async_load(self):
        return dict(self.disk.get(self.key, {}))

    async def async_save(self, value):
        await asyncio.sleep(0)
        if self.fail:
            raise OSError("disk unavailable")
        self.disk[self.key] = dict(value)


ws = types.SimpleNamespace(websocket_command=lambda schema: lambda f: f,
                           async_response=lambda f: f,
                           async_register_command=lambda hass, handler: None)
modules = {
    "probatio": types.SimpleNamespace(Required=lambda key: key, Optional=lambda key: key, Invalid=ValueError),
    "homeassistant": types.ModuleType("homeassistant"),
    "homeassistant.components": types.SimpleNamespace(websocket_api=ws),
    "homeassistant.core": types.SimpleNamespace(callback=lambda f: f),
    "homeassistant.helpers": types.SimpleNamespace(config_validation=types.SimpleNamespace(empty_config_schema=lambda domain: {})),
    "homeassistant.helpers.storage": types.SimpleNamespace(Store=FakeStore),
}
sys.modules.update(modules)
spec = importlib.util.spec_from_file_location("shared_store", Path(__file__).resolve().parents[1] / "custom_components/family_calendar_card/__init__.py")
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


class Connection:
    def __init__(self):
        self.subscriptions = {}
        self.events = []
        self.results = []

    def send_result(self, msg_id, result=None):
        self.results.append(result)

    def send_event(self, msg_id, event):
        self.events.append(event)


class SharedStoreTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        FakeStore.disk = {}
        FakeStore.fail = False
        self.hass = types.SimpleNamespace(data={})
        await backend.async_setup_entry(self.hass, None)

    async def test_unconfigured_integration_does_not_start_storage(self):
        hass = types.SimpleNamespace(data={})
        self.assertTrue(await backend.async_setup(hass, {}))
        self.assertNotIn(backend.DOMAIN, hass.data)

    async def test_yaml_setup_imports_and_preserves_storage(self):
        calls = []
        tasks = []
        async def async_init(domain, **kwargs):
            calls.append((domain, kwargs))
        key = backend.DOMAIN + ".display_calendars"
        FakeStore.disk[key] = {"existing": ["calendar.family"]}
        hass = types.SimpleNamespace(data={}, config_entries=types.SimpleNamespace(flow=types.SimpleNamespace(async_init=async_init)), async_create_task=lambda coro: tasks.append(asyncio.create_task(coro)))
        self.assertTrue(await backend.async_setup(hass, {backend.DOMAIN: {}}))
        await asyncio.gather(*tasks)
        self.assertEqual(hass.data[backend.DOMAIN]["assignments"], {"existing": ["calendar.family"]})
        self.assertEqual(calls, [(backend.DOMAIN, {"context": {"source": "import"}, "data": {}})])

    async def test_entry_setup_is_idempotent(self):
        data = self.hass.data[backend.DOMAIN]
        self.assertTrue(await backend.async_setup_entry(self.hass, None))
        self.assertIs(self.hass.data[backend.DOMAIN], data)

    async def test_two_clients_concurrent_updates_delete_and_restart(self):
        first, second = Connection(), Connection()
        backend.websocket_subscribe(self.hass, first, {"id": 1})
        backend.websocket_subscribe(self.hass, second, {"id": 2})
        await asyncio.gather(
            backend.websocket_set(self.hass, first, {"id": 3, "keys": ["event-a"], "calendars": ["calendar.work"]}),
            backend.websocket_set(self.hass, second, {"id": 4, "keys": ["event-b"], "calendars": ["calendar.school"]}),
        )
        expected = {"event-a": ["calendar.work"], "event-b": ["calendar.school"]}
        self.assertEqual(first.events[-1]["assignments"], expected)
        self.assertEqual(second.events[-1]["assignments"], expected)
        await backend.websocket_set(self.hass, first, {"id": 5, "keys": ["event-a"], "calendars": []})
        restarted = types.SimpleNamespace(data={})
        await backend.async_setup_entry(restarted, None)
        self.assertEqual(restarted.data[backend.DOMAIN]["assignments"], {"event-b": ["calendar.school"]})
        second.subscriptions[2]()
        count = len(second.events)
        await backend.websocket_set(self.hass, first, {"id": 6, "keys": ["event-c"], "calendars": ["calendar.work"]})
        self.assertEqual(len(second.events), count)

    async def test_failed_disk_save_keeps_previous_state_and_sends_no_success(self):
        client = Connection()
        backend.websocket_subscribe(self.hass, client, {"id": 1})
        count = len(client.events)
        FakeStore.fail = True
        with self.assertRaises(OSError):
            await backend.websocket_set(self.hass, client, {"id": 2, "keys": ["event"], "calendars": ["calendar.work"]})
        self.assertEqual(self.hass.data[backend.DOMAIN]["assignments"], {})
        self.assertEqual(len(client.events), count)
        self.assertEqual(client.results, [None])

    async def test_malformed_storage_retains_valid_entries(self):
        key = backend.DOMAIN + ".display_calendars"
        FakeStore.disk[key] = {"valid": ["calendar.work"], "bad": ["sensor.bad"], "empty": []}
        restarted = types.SimpleNamespace(data={})
        await backend.async_setup_entry(restarted, None)
        self.assertEqual(restarted.data[backend.DOMAIN]["assignments"], {"valid": ["calendar.work"]})
        self.assertEqual(backend.normalize_assignments(["bad"]), {})

    async def test_disconnected_subscriber_does_not_block_other_clients(self):
        client = Connection()
        backend.websocket_subscribe(self.hass, client, {"id": 1})
        def failed_listener():
            raise RuntimeError("connection closed")
        self.hass.data[backend.DOMAIN]["listeners"].add(failed_listener)
        await backend.websocket_set(self.hass, client, {"id": 2, "keys": ["event"], "calendars": ["calendar.work"]})
        self.assertEqual(client.events[-1]["assignments"], {"event": ["calendar.work"]})
        self.assertNotIn(failed_listener, self.hass.data[backend.DOMAIN]["listeners"])

    async def test_disconnected_writer_still_notifies_other_clients(self):
        watcher, writer = Connection(), Connection()
        backend.websocket_subscribe(self.hass, watcher, {"id": 1})
        def closed_result(*args):
            raise ConnectionError("writer disconnected")
        writer.send_result = closed_result
        with self.assertRaises(ConnectionError):
            await backend.websocket_set(self.hass, writer, {"id": 2, "keys": ["event"], "calendars": ["calendar.work"]})
        self.assertEqual(watcher.events[-1]["assignments"], {"event": ["calendar.work"]})

    async def test_limited_card_edit_preserves_assignments_outside_its_scope(self):
        client = Connection()
        await backend.websocket_set(self.hass, client, {"id": 1, "keys": ["event"], "calendars": ["calendar.work", "calendar.school"]})
        await backend.websocket_set(self.hass, client, {"id": 2, "keys": ["event"], "calendars": [], "managed_calendars": ["calendar.family", "calendar.work"]})
        self.assertEqual(self.hass.data[backend.DOMAIN]["assignments"], {"event": ["calendar.school"]})
        await backend.websocket_set(self.hass, client, {"id": 3, "keys": ["event"], "calendars": ["calendar.work"], "managed_calendars": ["calendar.family", "calendar.work"]})
        self.assertEqual(set(self.hass.data[backend.DOMAIN]["assignments"]["event"]), {"calendar.school", "calendar.work"})

    async def test_concurrent_cards_patch_same_event_without_losing_other_scopes(self):
        client = Connection()
        calendars = [f"calendar.member_{index}" for index in range(40)]
        await asyncio.gather(*(backend.websocket_set(self.hass, client, {"id": index + 1, "keys": ["same-event"], "calendars": [entity_id], "managed_calendars": [entity_id]}) for index, entity_id in enumerate(calendars)))
        self.assertEqual(set(self.hass.data[backend.DOMAIN]["assignments"]["same-event"]), set(calendars))
        restarted = types.SimpleNamespace(data={})
        await backend.async_setup_entry(restarted, None)
        self.assertEqual(set(restarted.data[backend.DOMAIN]["assignments"]["same-event"]), set(calendars))
        self.assertEqual(self.hass.data[backend.DOMAIN]["revision"], len(calendars))

    async def test_combined_assignment_limit_cannot_write_data_lost_on_restart(self):
        client = Connection()
        calendars = [f"calendar.member_{index}" for index in range(100)]
        await backend.websocket_set(self.hass, client, {"id": 1, "keys": ["event"], "calendars": calendars})
        before_revision = self.hass.data[backend.DOMAIN]["revision"]
        with self.assertRaises(ValueError):
            await backend.websocket_set(self.hass, client, {"id": 2, "keys": ["new-event", "event"], "calendars": ["calendar.extra"], "managed_calendars": ["calendar.extra"]})
        self.assertEqual(self.hass.data[backend.DOMAIN]["assignments"]["event"], calendars)
        self.assertEqual(self.hass.data[backend.DOMAIN]["revision"], before_revision)
        self.assertNotIn("new-event", self.hass.data[backend.DOMAIN]["assignments"])
        restarted = types.SimpleNamespace(data={})
        await backend.async_setup_entry(restarted, None)
        self.assertEqual(restarted.data[backend.DOMAIN]["assignments"]["event"], calendars)

    async def test_validation_rejects_bad_ids_and_bounds_payloads(self):
        for invalid in [None, "calendar.work", ["sensor.bad"], ["calendar.invalid-id"], ["calendar.work"] * 101]:
            with self.assertRaises(ValueError):
                backend.validate_calendars(invalid)
        for invalid in [None, [], [""], ["a" * 4097], ["key"] * 101]:
            with self.assertRaises(ValueError):
                backend.validate_keys(invalid)
        self.assertEqual(backend.validate_calendars(["calendar.work", "calendar.work"]), ["calendar.work"])
        self.assertEqual(backend.validate_calendars([]), [])


if __name__ == "__main__":
    unittest.main()

"""Config-flow contract checks; Home Assistant flow adapter is mocked."""
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest


class ConfigFlow:
    configured = False

    def __init_subclass__(cls, **kwargs):
        pass

    async def async_set_unique_id(self, value):
        self.unique_id = value

    def _abort_if_unique_id_configured(self):
        if self.configured:
            raise ValueError("already_configured")

    def async_show_form(self, **kwargs):
        return {"type": "form", **kwargs}

    def async_create_entry(self, **kwargs):
        return {"type": "create_entry", **kwargs}


sys.modules['homeassistant'] = types.SimpleNamespace(config_entries=types.SimpleNamespace(ConfigFlow=ConfigFlow))
spec = importlib.util.spec_from_file_location('companion_config_flow', Path(__file__).resolve().parents[1] / 'custom_components/family_calendar_card/config_flow.py')
flow_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flow_module)


class ConfigFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_supported_languages_have_complete_setup_translations(self):
        folder = Path(__file__).resolve().parents[1] / 'custom_components/family_calendar_card'
        def flatten(value, prefix=''):
            result = {}
            for key, item in value.items():
                path = prefix + key
                if isinstance(item, dict):
                    result.update(flatten(item, path + '.'))
                else:
                    result[path] = item
            return result
        reference = flatten(json.loads((folder / 'strings.json').read_text()))
        locales = {'en', 'fr', 'de', 'nl', 'es', 'et', 'ca', 'da', 'sv'}
        self.assertEqual({p.stem for p in (folder / 'translations').glob('*.json')}, locales)
        for locale in locales:
            values = flatten(json.loads((folder / 'translations' / (locale + '.json')).read_text()))
            self.assertEqual(set(values), set(reference), locale)
            self.assertTrue(all(isinstance(value, str) and value.strip() for value in values.values()), locale)
            if locale != 'en':
                for key in ['config.step.user.description', 'config.abort.already_configured']:
                    self.assertNotEqual(values[key], reference[key], locale + '.' + key)

    async def test_user_setup_requires_confirmation(self):
        flow = flow_module.FamilyCalendarCardConfigFlow()
        self.assertEqual((await flow.async_step_user())['type'], 'form')
        result = await flow.async_step_user({})
        self.assertEqual(result['type'], 'create_entry')
        self.assertEqual(result['data'], {})
        self.assertEqual(flow.unique_id, 'family_calendar_card')

    async def test_yaml_import_creates_same_entry(self):
        flow = flow_module.FamilyCalendarCardConfigFlow()
        self.assertEqual((await flow.async_step_import({}))['type'], 'create_entry')

    async def test_duplicate_is_rejected(self):
        flow = flow_module.FamilyCalendarCardConfigFlow()
        flow.configured = True
        with self.assertRaisesRegex(ValueError, 'already_configured'):
            await flow.async_step_user({})


if __name__ == '__main__':
    unittest.main()

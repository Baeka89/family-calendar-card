"""UI setup for the optional Family Calendar Card companion."""
from homeassistant import config_entries

DOMAIN = "family_calendar_card"


class FamilyCalendarCardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure a single shared store for this Home Assistant instance."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Ask for confirmation; no credentials or helpers are needed."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Family Calendar Card Companion", data={})
        return self.async_show_form(step_id="user")

    async def async_step_import(self, user_input):
        """Migrate the existing YAML setup without changing stored assignments."""
        return await self.async_step_user({})

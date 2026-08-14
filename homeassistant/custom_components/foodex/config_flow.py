"""Config flow for the FoodEx integration."""

from __future__ import annotations

import logging

import aiohttp
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import (
    CONF_PROJECT_ID,
    CONF_SCAN_INTERVAL,
    CONF_TOKEN,
    DEFAULT_PROJECT_ID,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    FIRESTORE_URL_TEMPLATE,
)

_LOGGER = logging.getLogger(__name__)


class FoodExConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for FoodEx."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        """Handle the initial step — user enters their FoodEx token."""
        errors: dict[str, str] = {}

        if user_input is not None:
            token = user_input[CONF_TOKEN].strip()
            project_id = (
                user_input.get(CONF_PROJECT_ID, "").strip() or DEFAULT_PROJECT_ID
            )
            scan_interval = user_input.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)

            # Prevent duplicate entries for the same token
            await self.async_set_unique_id(token)
            self._abort_if_unique_id_configured()

            # Validate the token by fetching the Firestore document
            url = FIRESTORE_URL_TEMPLATE.format(
                project_id=project_id, token=token
            )
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url, timeout=aiohttp.ClientTimeout(total=15)
                    ) as resp:
                        if resp.status == 404:
                            errors["base"] = "invalid_token"
                        elif resp.status != 200:
                            errors["base"] = "cannot_connect"
            except (aiohttp.ClientError, TimeoutError):
                errors["base"] = "cannot_connect"
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Unexpected error during FoodEx config flow")
                errors["base"] = "unknown"

            if not errors:
                return self.async_create_entry(
                    title="FoodEx",
                    data={
                        CONF_TOKEN: token,
                        CONF_PROJECT_ID: project_id,
                        CONF_SCAN_INTERVAL: scan_interval,
                    },
                )

        # Show the form
        data_schema = vol.Schema(
            {
                vol.Required(CONF_TOKEN): str,
                vol.Optional(CONF_PROJECT_ID, default=DEFAULT_PROJECT_ID): str,
                vol.Optional(
                    CONF_SCAN_INTERVAL, default=DEFAULT_SCAN_INTERVAL
                ): vol.All(int, vol.Range(min=60, max=3600)),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )

"""The FoodEx integration."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_PROJECT_ID,
    CONF_SCAN_INTERVAL,
    CONF_TOKEN,
    DEFAULT_PROJECT_ID,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    PLATFORMS,
)
from .coordinator import FoodExCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up FoodEx from a config entry."""
    token = entry.data[CONF_TOKEN]
    project_id = entry.data.get(CONF_PROJECT_ID, DEFAULT_PROJECT_ID)
    scan_interval = entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)

    coordinator = FoodExCoordinator(hass, token, project_id, scan_interval)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Register the bundled Lovelace card as a static resource
    hass.http.register_static_path(
        "/foodex/foodex-card.js",
        hass.config.path("custom_components/foodex/www/foodex-card.js"),
        cache_headers=False,
    )

    # Add the card to Lovelace resources so users can find it in the card picker
    await hass.async_add_executor_job(
        _register_frontend_resource, hass
    )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a FoodEx config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        coordinator = hass.data[DOMAIN].pop(entry.entry_id)
        if hasattr(coordinator, "_session") and coordinator._session:
            await coordinator._session.close()
    return unload_ok


def _register_frontend_resource(hass: HomeAssistant) -> None:
    """Register the Lovelace card JS file as a frontend resource."""
    # This is a best-effort registration. Users may also manually add
    # the resource via the UI: /foodex/foodex-card.js as a JavaScript Module.
    _LOGGER.info(
        "FoodEx Lovelace card available at /foodex/foodex-card.js — "
        "add it as a Dashboard Resource (JavaScript Module) if not auto-detected."
    )

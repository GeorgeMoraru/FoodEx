"""Binary sensor platform for the FoodEx integration."""

from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import FoodExCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up FoodEx binary sensors from a config entry."""
    coordinator: FoodExCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([FoodExExpirationAlert(coordinator, entry)])


class FoodExExpirationAlert(
    CoordinatorEntity[FoodExCoordinator], BinarySensorEntity
):
    """Binary sensor that is ON when items are expired or expiring soon."""

    _attr_has_entity_name = True
    _attr_name = "Expiration Alert"
    _attr_icon = "mdi:alert-circle"
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(
        self, coordinator: FoodExCoordinator, entry: ConfigEntry
    ) -> None:
        """Initialize the binary sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_expiration_alert"

    @property
    def is_on(self) -> bool:
        """Return True if there are expired or expiring items."""
        if self.coordinator.data is None:
            return False
        return (
            self.coordinator.data.get("expired_count", 0) > 0
            or self.coordinator.data.get("expiring_soon_count", 0) > 0
        )

    @property
    def extra_state_attributes(self) -> dict:
        """Return counts as attributes."""
        if self.coordinator.data is None:
            return {}
        return {
            "expired_count": self.coordinator.data.get("expired_count", 0),
            "expiring_soon_count": self.coordinator.data.get(
                "expiring_soon_count", 0
            ),
        }

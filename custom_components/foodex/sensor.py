"""Sensor platform for the FoodEx integration."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
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
    """Set up FoodEx sensors from a config entry."""
    coordinator: FoodExCoordinator = hass.data[DOMAIN][entry.entry_id]

    async_add_entities(
        [
            FoodExActiveSensor(coordinator, entry),
            FoodExExpiringSoonSensor(coordinator, entry),
            FoodExExpiredSensor(coordinator, entry),
        ]
    )


class FoodExBaseSensor(CoordinatorEntity[FoodExCoordinator], SensorEntity):
    """Base class for FoodEx sensors."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: FoodExCoordinator,
        entry: ConfigEntry,
        key: str,
        name: str,
        icon: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_icon = icon
        self._attr_unique_id = f"{entry.entry_id}_{key}"

    @property
    def native_value(self) -> int:
        """Return the sensor state (count)."""
        if self.coordinator.data is None:
            return 0
        return self.coordinator.data.get(f"{self._key}_count", 0)


def _serialize_products(products: list[dict]) -> list[dict]:
    """Create a serializable summary list from product dicts."""
    result = []
    for p in products:
        if not isinstance(p, dict):
            continue
        result.append(
            {
                "name": p.get("name", "Unknown"),
                "location": p.get("location", ""),
                "category": p.get("category", ""),
                "expiration_date": p.get("expirationDate") or p.get("expiration_date", ""),
                "days_left": p.get("days_left"),
                "status": p.get("status", ""),
            }
        )
    return result


class FoodExActiveSensor(FoodExBaseSensor):
    """Sensor showing total active items."""

    def __init__(self, coordinator: FoodExCoordinator, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(coordinator, entry, "active", "Active Items", "mdi:food-apple")

    @property
    def extra_state_attributes(self) -> dict:
        """Return the full list of active products as attributes."""
        if self.coordinator.data is None:
            return {"items": []}
        return {
            "items": _serialize_products(self.coordinator.data.get("active", [])),
            "total": self.coordinator.data.get("active_count", 0),
        }


class FoodExExpiringSoonSensor(FoodExBaseSensor):
    """Sensor showing items expiring within threshold."""

    def __init__(self, coordinator: FoodExCoordinator, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(
            coordinator, entry, "expiring_soon", "Expiring Soon", "mdi:clock-alert-outline"
        )

    @property
    def extra_state_attributes(self) -> dict:
        """Return the list of expiring products."""
        if self.coordinator.data is None:
            return {"items": []}
        return {
            "items": _serialize_products(
                self.coordinator.data.get("expiring_soon", [])
            ),
            "notification_days": self.coordinator.data.get("notification_days", 3),
        }


class FoodExExpiredSensor(FoodExBaseSensor):
    """Sensor showing already-expired items."""

    def __init__(self, coordinator: FoodExCoordinator, entry: ConfigEntry) -> None:
        """Initialize."""
        super().__init__(coordinator, entry, "expired", "Expired Items", "mdi:food-off")

    @property
    def extra_state_attributes(self) -> dict:
        """Return the list of expired products."""
        if self.coordinator.data is None:
            return {"items": []}
        return {
            "items": _serialize_products(
                self.coordinator.data.get("expired", [])
            ),
        }

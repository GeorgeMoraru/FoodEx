"""Data update coordinator for the FoodEx integration."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, FIRESTORE_URL_TEMPLATE

_LOGGER = logging.getLogger(__name__)


def _parse_firestore_value(value: dict):
    """Recursively convert a Firestore typed-value dict into a plain Python value."""
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "booleanValue" in value:
        return value["booleanValue"]
    if "nullValue" in value:
        return None
    if "mapValue" in value:
        return {
            k: _parse_firestore_value(v)
            for k, v in value["mapValue"].get("fields", {}).items()
        }
    if "arrayValue" in value:
        return [
            _parse_firestore_value(v)
            for v in value["arrayValue"].get("values", [])
        ]
    return None


def _compute_days_left(expiration_date: str | None) -> int | None:
    """Calculate days remaining until expiration from a date string (YYYY-MM-DD or ISO)."""
    if not expiration_date:
        return None
    try:
        exp = datetime.fromisoformat(expiration_date.replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = (exp.date() - now.date()).days
        return delta
    except (ValueError, AttributeError):
        return None


class FoodExCoordinator(DataUpdateCoordinator):
    """Coordinator to poll FoodEx data from the Firestore REST API."""

    def __init__(
        self,
        hass: HomeAssistant,
        token: str,
        project_id: str,
        scan_interval: int,
    ) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=scan_interval),
        )
        self._url = FIRESTORE_URL_TEMPLATE.format(
            project_id=project_id, token=token
        )
        self._session: aiohttp.ClientSession | None = None

    async def _async_update_data(self) -> dict:
        """Fetch data from FoodEx Firestore endpoint."""
        try:
            if self._session is None or self._session.closed:
                self._session = aiohttp.ClientSession()

            async with self._session.get(self._url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 404:
                    # Document doesn't exist (yet) — return empty
                    return self._empty_result()
                if resp.status != 200:
                    raise UpdateFailed(
                        f"Error fetching FoodEx data: HTTP {resp.status}"
                    )
                raw = await resp.json()

        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Connection error: {err}") from err
        except TimeoutError as err:
            raise UpdateFailed("Request timed out") from err

        return self._normalize(raw)

    def _normalize(self, raw: dict) -> dict:
        """Convert raw Firestore document into clean structured data."""
        fields = raw.get("fields", {})

        # Parse products array
        products_raw = fields.get("products", {})
        products = _parse_firestore_value(products_raw) if products_raw else []
        if not isinstance(products, list):
            products = []

        # Parse settings
        settings_raw = fields.get("settings", {})
        settings = _parse_firestore_value(settings_raw) if settings_raw else {}
        if not isinstance(settings, dict):
            settings = {}

        notification_days = settings.get("notificationDaysBefore", 3)
        if not isinstance(notification_days, (int, float)):
            notification_days = 3

        # Enrich products with days_left
        for product in products:
            if isinstance(product, dict):
                exp_date = product.get("expirationDate") or product.get("expiration_date")
                product["days_left"] = _compute_days_left(exp_date)

        # Categorize
        active = [
            p for p in products
            if isinstance(p, dict) and p.get("status") == "ACTIVE"
        ]
        expiring_soon = [
            p for p in active
            if p.get("days_left") is not None and 0 <= p["days_left"] <= notification_days
        ]
        expired = [
            p for p in active
            if p.get("days_left") is not None and p["days_left"] < 0
        ]

        return {
            "products": products,
            "active": active,
            "expiring_soon": expiring_soon,
            "expired": expired,
            "active_count": len(active),
            "expiring_soon_count": len(expiring_soon),
            "expired_count": len(expired),
            "notification_days": notification_days,
        }

    @staticmethod
    def _empty_result() -> dict:
        """Return an empty result set."""
        return {
            "products": [],
            "active": [],
            "expiring_soon": [],
            "expired": [],
            "active_count": 0,
            "expiring_soon_count": 0,
            "expired_count": 0,
            "notification_days": 3,
        }

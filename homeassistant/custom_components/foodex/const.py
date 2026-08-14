"""Constants for the FoodEx integration."""

DOMAIN = "foodex"

CONF_TOKEN = "token"
CONF_PROJECT_ID = "project_id"
CONF_SCAN_INTERVAL = "scan_interval"

DEFAULT_PROJECT_ID = "foodex-a9dee"
DEFAULT_SCAN_INTERVAL = 300  # seconds

FIRESTORE_URL_TEMPLATE = (
    "https://firestore.googleapis.com/v1/projects/{project_id}"
    "/databases/(default)/documents/ha_tokens/{token}"
)

PLATFORMS = ["sensor", "binary_sensor"]

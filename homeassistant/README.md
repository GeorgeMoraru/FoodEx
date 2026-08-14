# FoodEx — Home Assistant Custom Integration

A local-only Home Assistant custom integration for [FoodEx](https://github.com/GeorgeMoraru/FoodEx). Track your food inventory, get expiration alerts, and display a custom dashboard card — all set up through the UI with zero YAML.

## Installation

### 1. Copy the files
Copy the entire `custom_components/foodex/` folder into your Home Assistant `config/custom_components/` directory:

```
config/
└── custom_components/
    └── foodex/
        ├── __init__.py
        ├── manifest.json
        ├── const.py
        ├── config_flow.py
        ├── coordinator.py
        ├── sensor.py
        ├── binary_sensor.py
        ├── strings.json
        ├── translations/
        │   └── en.json
        └── www/
            └── foodex-card.js
```

**How to copy** (pick one):
- **Samba Share**: Navigate to `\\homeassistant\config\custom_components\` and paste.
- **SSH/Terminal**: `scp -r custom_components/foodex/ root@homeassistant.local:/config/custom_components/`
- **File Editor Add-on**: Upload files via the HA File Editor.

### 2. Restart Home Assistant
Go to **Settings → System → Restart** (or run `ha core restart` via SSH).

### 3. Add the Integration
1. Go to **Settings → Devices & Services → Add Integration**.
2. Search for **FoodEx**.
3. Enter your **FoodEx Token** (found in the FoodEx web app under *Settings → Home Assistant Integration*).
4. Optionally adjust the Firebase Project ID and scan interval.
5. Click **Submit**.

### 4. Add the Dashboard Card
1. Go to **Settings → Dashboards → Resources** and add:
   - **URL**: `/foodex/foodex-card.js`
   - **Type**: JavaScript Module
2. Edit your dashboard → **Add Card** → search for **FoodEx Inventory**.
3. Set the entity to `sensor.foodex_active_items`.

## Entities Created

| Entity | Type | Description |
|---|---|---|
| `sensor.foodex_active_items` | Sensor | Total count of active items (with full list in attributes) |
| `sensor.foodex_expiring_soon` | Sensor | Count of items expiring within your configured threshold |
| `sensor.foodex_expired` | Sensor | Count of already-expired items |
| `binary_sensor.foodex_expiration_alert` | Binary Sensor | ON when any items are expired or expiring soon |

## Example Automation

Get a daily phone notification at 9 AM if you have expiring items:

```yaml
automation:
  - alias: "FoodEx: Morning Expiration Alert"
    trigger:
      - platform: time
        at: "09:00:00"
    condition:
      - condition: state
        entity_id: binary_sensor.foodex_expiration_alert
        state: "on"
    action:
      - service: notify.notify
        data:
          title: "🍏 FoodEx Alert"
          message: >
            You have {{ states('sensor.foodex_expiring_soon') }} item(s) expiring soon
            and {{ states('sensor.foodex_expired') }} expired item(s).
```

## Privacy

- **100% local**: The integration runs entirely on your Home Assistant instance.
- **Not published to HACS or any public store** — only you have access.
- **Data flow**: Your HA instance polls the Firestore REST API using your private token. No data is sent from HA to any third party.

## Uninstall

1. Remove the integration from **Settings → Devices & Services**.
2. Delete the `custom_components/foodex/` folder.
3. Restart Home Assistant.

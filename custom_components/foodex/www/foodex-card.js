/**
 * FoodEx Lovelace Card for Home Assistant
 * Renders a styled inventory view grouped by status (Expired / Expiring / Fresh).
 */

class FoodExCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("foodex-card-editor");
  }

  static getStubConfig() {
    return { entity: "sensor.foodex_active_items" };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._render();
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity (sensor.foodex_active_items)");
    }
    this._config = config;
    if (this._hass) this._render();
  }

  getCardSize() {
    return 4;
  }

  _render() {
    const entityId = this._config.entity;
    const stateObj = this._hass.states[entityId];

    if (!stateObj) {
      this.innerHTML = `
        <ha-card header="FoodEx">
          <div style="padding: 16px; color: var(--secondary-text-color);">
            Entity <b>${entityId}</b> not found.
          </div>
        </ha-card>`;
      return;
    }

    const items = (stateObj.attributes.items || []);
    const total = parseInt(stateObj.state, 10) || 0;

    // Categorize
    const expired = items.filter(i => i.days_left !== null && i.days_left !== undefined && i.days_left < 0);
    const expiring = items.filter(i => i.days_left !== null && i.days_left !== undefined && i.days_left >= 0 && i.days_left <= 3);
    const fresh = items.filter(i => i.days_left === null || i.days_left === undefined || i.days_left > 3);

    // Sort each group by days_left ascending
    const sortByDays = (a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999);
    expired.sort(sortByDays);
    expiring.sort(sortByDays);
    fresh.sort(sortByDays);

    const renderItem = (item) => {
      let badge = "";
      let badgeColor = "";
      const days = item.days_left;

      if (days === null || days === undefined) {
        badge = "No date";
        badgeColor = "var(--secondary-text-color)";
      } else if (days < 0) {
        badge = `Expired ${Math.abs(days)}d ago`;
        badgeColor = "var(--error-color, #db4437)";
      } else if (days === 0) {
        badge = "Today!";
        badgeColor = "var(--warning-color, #ff9800)";
      } else if (days <= 3) {
        badge = `${days}d left`;
        badgeColor = "var(--warning-color, #ff9800)";
      } else {
        badge = `${days}d left`;
        badgeColor = "var(--success-color, #43a047)";
      }

      const location = item.location ? `<span class="foodex-location">${this._escapeHtml(item.location)}</span>` : "";

      return `
        <div class="foodex-item">
          <div class="foodex-item-info">
            <span class="foodex-item-name">${this._escapeHtml(item.name || "Unknown")}</span>
            ${location}
          </div>
          <span class="foodex-badge" style="color: ${badgeColor};">${badge}</span>
        </div>`;
    };

    const renderSection = (title, icon, items, color) => {
      if (items.length === 0) return "";
      return `
        <div class="foodex-section">
          <div class="foodex-section-header" style="color: ${color};">
            <span>${icon} ${title}</span>
            <span class="foodex-count">${items.length}</span>
          </div>
          ${items.map(renderItem).join("")}
        </div>`;
    };

    this.innerHTML = `
      <ha-card>
        <div class="foodex-header">
          <div class="foodex-title">
            <span class="foodex-icon">🍏</span>
            <span>FoodEx Inventory</span>
          </div>
          <span class="foodex-total">${total} item${total !== 1 ? "s" : ""}</span>
        </div>

        <div class="foodex-body">
          ${total === 0
            ? `<div class="foodex-empty">No active items in your pantry.</div>`
            : `
              ${renderSection("Expired", "🔴", expired, "var(--error-color, #db4437)")}
              ${renderSection("Expiring Soon", "🟡", expiring, "var(--warning-color, #ff9800)")}
              ${renderSection("Fresh", "🟢", fresh, "var(--success-color, #43a047)")}
            `
          }
        </div>
      </ha-card>

      <style>
        :host {
          --foodex-radius: 12px;
        }
        ha-card {
          overflow: hidden;
        }
        .foodex-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
        }
        .foodex-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.1em;
          font-weight: 600;
        }
        .foodex-icon {
          font-size: 1.3em;
        }
        .foodex-total {
          font-size: 0.85em;
          opacity: 0.85;
          background: rgba(255,255,255,0.2);
          padding: 4px 10px;
          border-radius: 20px;
        }
        .foodex-body {
          padding: 12px 16px 16px;
        }
        .foodex-empty {
          text-align: center;
          padding: 24px 16px;
          color: var(--secondary-text-color);
          font-style: italic;
        }
        .foodex-section {
          margin-bottom: 12px;
        }
        .foodex-section:last-child {
          margin-bottom: 0;
        }
        .foodex-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 4px 6px;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.08));
          margin-bottom: 4px;
        }
        .foodex-count {
          background: currentColor;
          color: var(--card-background-color, #fff);
          font-size: 0.8em;
          min-width: 22px;
          height: 22px;
          border-radius: 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 6px;
          font-weight: 700;
        }
        .foodex-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 4px;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.04));
          transition: background 0.15s ease;
        }
        .foodex-item:last-child {
          border-bottom: none;
        }
        .foodex-item:hover {
          background: var(--secondary-background-color, rgba(0,0,0,0.03));
          border-radius: 8px;
        }
        .foodex-item-info {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }
        .foodex-item-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .foodex-location {
          font-size: 0.75em;
          background: var(--secondary-background-color, rgba(0,0,0,0.06));
          padding: 2px 8px;
          border-radius: 10px;
          color: var(--secondary-text-color);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .foodex-badge {
          font-size: 0.8em;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
          margin-left: 8px;
        }
      </style>
    `;
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define("foodex-card", FoodExCard);

// Register with HA's card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "foodex-card",
  name: "FoodEx Inventory",
  description: "Displays your FoodEx food inventory grouped by expiration status.",
  preview: true,
});

class TVHeadendEPGCard extends HTMLElement {
  setConfig(config) {
    if (!config.entry_id) {
      throw new Error("entry_id is required");
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.render();
    }
    this.load();
  }

  render() {
    this.innerHTML = `
      <ha-card header="TVHeadend EPG">
        <div class="epg-container"></div>
      </ha-card>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .epg-container {
        overflow: auto;
        max-height: 500px;
      }
      .epg-grid {
        position: relative;
        min-width: 1200px;
      }
      .epg-row {
        display: flex;
        border-bottom: 1px solid var(--divider-color);
      }
      .epg-channel {
        width: 120px;
        min-width: 120px;
        padding: 6px;
        font-weight: bold;
        background: var(--secondary-background-color);
        position: sticky;
        left: 0;
        z-index: 2;
      }
      .epg-events {
        position: relative;
        height: 48px;
        flex: 1;
      }
      .epg-event {
        position: absolute;
        top: 4px;
        bottom: 4px;
        background: var(--primary-color);
        color: white;
        border-radius: 4px;
        padding: 4px;
        font-size: 12px;
        cursor: pointer;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .epg-now {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: red;
        z-index: 5;
      }
    `;
    this.appendChild(style);

    this.content = this.querySelector(".epg-container");
  }

  async load() {
    if (!this._hass || !this.content) return;

    // trigger refresh when card becomes active
    this._hass.callService("tvheadend_epg", "refresh");

    const data = await this._hass.connection.sendMessagePromise({
      type: "tvheadend_epg/get",
      entry_id: this.config.entry_id,
      filters: this.config.filters || {}
    });

    this.renderEPG(data);
  }

  renderEPG(epg) {
    const PIXELS_PER_MIN = 4;
    const now = Date.now() / 1000;
    const start = now - 3600;
    const end = now + 3 * 3600;

    const channels = {};
    epg.forEach(e => {
      channels[e.channelName] ||= [];
      channels[e.channelName].push(e);
    });

    const grid = document.createElement("div");
    grid.className = "epg-grid";

    Object.entries(channels).forEach(([channel, events]) => {
      const row = document.createElement("div");
      row.className = "epg-row";

      const ch = document.createElement("div");
      ch.className = "epg-channel";
      ch.textContent = channel;
      row.appendChild(ch);

      const evc = document.createElement("div");
      evc.className = "epg-events";

      events.forEach(e => {
        if (e.stop < start || e.start > end) return;

        const el = document.createElement("div");
        el.className = "epg-event";
        el.style.left = ((e.start - start) / 60) * PIXELS_PER_MIN + "px";
        el.style.width = ((e.stop - e.start) / 60) * PIXELS_PER_MIN + "px";
        el.textContent = e.title;

        el.onclick = () => {
          if (confirm(`Felvétel indítása?\n${e.title}`)) {
            this._hass.callService("tvheadend_epg", "record", {
              event_id: e.eventId
            });
          }
        };

        evc.appendChild(el);
      });

      row.appendChild(evc);
      grid.appendChild(row);
    });

    const nowLine = document.createElement("div");
    nowLine.className = "epg-now";
    nowLine.style.left = ((now - start) / 60) * PIXELS_PER_MIN + "px";
    grid.appendChild(nowLine);

    this.content.innerHTML = "";
    this.content.appendChild(grid);
  }

  getCardSize() {
    return 6;
  }
}

customElements.define("tvheadend-epg-card", TVHeadendEPGCard);

"use strict";

Module.register("MMM-PhilipsHue", {
	defaults: {
		bridgeIp: "",
		username: "",
		pollInterval: 30000
	},

	/** @type {{ id: string, name: string, on: boolean, bri: number }[]} */
	rooms: [],

	/**
	 * Called when the module starts — sends config to node_helper to begin polling.
	 */
	start () {
		this.rooms = [];
		this.sendSocketNotification("HUE_INIT", this.config);
	},

	/**
	 * Receives socket messages from node_helper.
	 * @param {string} notification
	 * @param {*} payload
	 */
	socketNotificationReceived (notification, payload) {
		if (notification === "HUE_ROOMS") {
			this.rooms = payload;
			this.updateDom();
		}
		if (notification === "HUE_ERROR") {
			Log.error("MMM-PhilipsHue error:", payload);
		}
	},

	/**
	 * Receives MM-wide notifications — handles HUE_COMMAND from MMM-LocalAssistant.
	 * @param {string} notification
	 * @param {*} payload
	 */
	notificationReceived (notification, payload) {
		if (notification === "HUE_COMMAND") {
			this.sendSocketNotification("HUE_COMMAND", payload);
		}
	},

	/**
	 * Builds the room cards DOM.
	 * @returns {HTMLElement}
	 */
	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "hue-rooms";

		if (this.rooms.length === 0) {
			const msg = document.createElement("div");
			msg.className = "dimmed small";
			msg.textContent = "Connecting to Hue Bridge...";
			wrapper.appendChild(msg);
			return wrapper;
		}

		for (const room of this.rooms) {
			const card = document.createElement("div");
			card.className = `hue-room ${room.on ? "on" : "off"}`;

			const icon = document.createElement("span");
			icon.className = "hue-icon";
			icon.textContent = "💡";

			const name = document.createElement("span");
			name.className = "hue-name";
			name.textContent = room.name;

			const badge = document.createElement("span");
			badge.className = "hue-badge";
			badge.textContent = room.on ? "ON" : "OFF";

			const bar = document.createElement("div");
			bar.className = "hue-bar";
			const fill = document.createElement("div");
			fill.className = "hue-fill";
			fill.style.width = `${Math.round(room.bri / 254 * 100)}%`;
			bar.appendChild(fill);

			card.appendChild(icon);
			card.appendChild(name);
			card.appendChild(badge);
			card.appendChild(bar);

			card.addEventListener("click", () => {
				this.sendSocketNotification("HUE_COMMAND", { room: room.name, on: !room.on });
			});
			wrapper.appendChild(card);
		}

		return wrapper;
	},

	/**
	 * Returns module stylesheets.
	 * @returns {string[]}
	 */
	getStyles () {
		return ["MMM-PhilipsHue.css"];
	}
});

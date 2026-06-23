"use strict";

const NodeHelper = require("node_helper");
const { filterRooms, buildToggleTargets } = require("./hue-utils.js");

module.exports = NodeHelper.create({
	/** @type {{ bridgeIp: string, username: string, pollInterval: number }|null} */
	config: null,
	// filterRooms and buildToggleTargets are imported from hue-utils.js

	/** @type {NodeJS.Timeout|null} */
	pollTimer: null,

	/**
	 * Called when MagicMirror starts this helper.
	 */
	start () {
		this.config = null;
		this.pollTimer = null;
	},

	/**
	 * Handles socket notifications from the frontend module.
	 * @param {string} notification
	 * @param {object} payload
	 */
	socketNotificationReceived (notification, payload) {
		if (notification === "HUE_INIT") {
			if (this.pollTimer) clearInterval(this.pollTimer);
			this.config = payload;
			this.pollRooms();
			this.pollTimer = setInterval(() => this.pollRooms(), this.config.pollInterval);
		}
		if (notification === "HUE_COMMAND") {
			this.sendCommand(payload);
		}
	},

	/**
	 * Fetches all room states from the Hue Bridge and notifies the frontend.
	 */
	async pollRooms () {
		const { bridgeIp, username } = this.config;
		try {
			const res = await fetch(`http://${bridgeIp}/api/${username}/groups`);
			const groups = await res.json();
			this.sendSocketNotification("HUE_ROOMS", filterRooms(groups));
		} catch (err) {
			this.sendSocketNotification("HUE_ERROR", err.message);
		}
	},

	/**
	 * Sends an on/off command to one or all rooms on the Hue Bridge.
	 * @param {{ room: string, on: boolean }} param0
	 */
	async sendCommand ({ room, on }) {
		const { bridgeIp, username } = this.config;
		try {
			const res = await fetch(`http://${bridgeIp}/api/${username}/groups`);
			const groups = await res.json();
			const targets = buildToggleTargets(groups, room);
			await Promise.all(targets.map((id) =>
				fetch(`http://${bridgeIp}/api/${username}/groups/${id}/action`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ on })
				})
			));
			this.pollRooms();
		} catch (err) {
			this.sendSocketNotification("HUE_ERROR", err.message);
		}
	}
});

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
	config: null,
	pollTimer: null,

	/**
	 * @override
	 */
	start () {
		this.config = null;
		this.pollTimer = null;
	},

	/**
	 * @override
	 * @param {string} notification - The notification identifier.
	 * @param {object} payload - The payload of the notification.
	 */
	socketNotificationReceived (notification, payload) {
		if (notification === "VULNERA_START") {
			this.config = payload;
			this.fetchHealth();
			this.pollTimer = setInterval(() => this.fetchHealth(), this.config.refreshInterval);
		}
	},

	/**
	 * Fetch the health endpoint and forward the result to the frontend.
	 */
	async fetchHealth () {
		const timestamp = new Date().toLocaleTimeString("en-GB");
		try {
			const res = await fetch(this.config.url, { signal: AbortSignal.timeout(10000) });
			const body = await res.json();
			this.sendSocketNotification("VULNERA_STATUS", {
				httpStatus: res.status,
				status: body.status,
				checks: body.checks,
				timestamp
			});
		} catch {
			this.sendSocketNotification("VULNERA_STATUS", {
				httpStatus: 0,
				status: "error",
				checks: null,
				timestamp
			});
		}
	}
});

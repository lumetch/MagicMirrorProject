Module.register("MMM-Vulnera", {
	defaults: {
		url: "https://api.vulnera.ch/health",
		refreshInterval: 60 * 1000
	},

	healthData: null,

	/**
	 * @override
	 */
	start () {
		this.sendSocketNotification("VULNERA_START", this.config);
	},

	/**
	 * @override
	 * @param {string} notification - The notification identifier.
	 * @param {object} payload - The payload of the notification.
	 */
	socketNotificationReceived (notification, payload) {
		if (notification === "VULNERA_STATUS") {
			this.healthData = payload;
			this.updateDom();
		}
	},

	/**
	 * Derive display state from the health response.
	 * @param {object|null} data - The health payload received from node_helper.
	 * @returns {string} One of: "loading", "healthy", "degraded", "down", "error".
	 */
	getState (data) {
		if (!data) return "loading";
		if (data.httpStatus === 200) return "healthy";
		if (data.httpStatus === 503 && data.checks) {
			const allDown = data.checks.database === "unavailable" && data.checks.search === "unavailable";
			return allDown ? "down" : "degraded";
		}
		return "error";
	},

	/**
	 * @override
	 * @returns {HTMLElement}
	 */
	getDom () {
		const state = this.getState(this.healthData);
		const wrapper = document.createElement("div");
		wrapper.className = "vulnera-wrapper";

		const indicator = document.createElement("div");
		indicator.className = `vulnera-indicator ${state}`;
		wrapper.appendChild(indicator);

		const statusText = document.createElement("div");
		statusText.className = `vulnera-status-text ${state}`;
		statusText.textContent = {
			loading: "LOADING...",
			healthy: "HEALTHY",
			degraded: "DEGRADED",
			down: "DOWN",
			error: "ERROR"
		}[state];
		wrapper.appendChild(statusText);

		if (this.healthData && this.healthData.checks) {
			const checks = document.createElement("div");
			checks.className = "vulnera-checks";

			for (const [service, status] of Object.entries(this.healthData.checks)) {
				const row = document.createElement("div");
				row.className = "vulnera-check";

				const dot = document.createElement("span");
				dot.className = `vulnera-dot ${status === "ok" ? "ok" : "down"}`;

				const label = document.createElement("span");
				label.className = "vulnera-check-label";
				label.textContent = service.charAt(0).toUpperCase() + service.slice(1);

				const value = document.createElement("span");
				value.className = "vulnera-check-value";
				value.textContent = status === "ok" ? "OK" : "DOWN";

				row.appendChild(dot);
				row.appendChild(label);
				row.appendChild(value);
				checks.appendChild(row);
			}

			wrapper.appendChild(checks);
		}

		if (this.healthData && this.healthData.timestamp) {
			const ts = document.createElement("div");
			ts.className = "vulnera-timestamp";
			ts.textContent = `Last check: ${this.healthData.timestamp}`;
			wrapper.appendChild(ts);
		}

		return wrapper;
	},

	/**
	 * @override
	 * @returns {string[]}
	 */
	getStyles () {
		return ["MMM-Vulnera.css"];
	}
});

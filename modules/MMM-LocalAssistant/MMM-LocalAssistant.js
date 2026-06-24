"use strict";

Module.register("MMM-LocalAssistant", {
	defaults: {
		whisperPath: "/home/lumetch/whisper.cpp/build/bin/whisper-cli",
		whisperModel: "/home/lumetch/whisper.cpp/models/ggml-tiny.en.bin",
		wakeWordModel: "hey_jarvis_v0.1",
		wakeWordThreshold: 0.5,
		captureSeconds: 5,
		espeakVoice: "en-gb",
		micDevice: "default"
	},

	/** @type {HTMLElement|null} */
	overlay: null,

	/**
	 * Called on module start — injects overlay into DOM and initialises node_helper.
	 */
	start () {
		this.overlay = null;
		this.injectOverlay();
		this.sendSocketNotification("ASSISTANT_INIT", this.config);
	},

	/**
	 * Creates the Jarvis fullscreen overlay element and appends it to body.
	 */
	injectOverlay () {
		const overlay = document.createElement("div");
		overlay.id = "jarvis-overlay";
		overlay.innerHTML = `
			<div class="jarvis-rings">
				<div class="jarvis-ring"></div>
				<div class="jarvis-ring"></div>
				<div class="jarvis-ring"></div>
				<div class="jarvis-ring"></div>
			</div>
			<div class="jarvis-waveform">
				${"<div class=\"jarvis-bar\"></div>".repeat(9)}
			</div>
			<div class="jarvis-text">
				<div class="jarvis-label"></div>
				<div class="jarvis-transcript"></div>
				<div class="jarvis-response"></div>
			</div>
		`;
		document.body.appendChild(overlay);
		this.overlay = overlay;
	},

	/**
	 * Updates the overlay's state class and text content.
	 * @param {"idle"|"listening"|"processing"|"speaking"} state
	 * @param {{ text?: string, transcript?: string, response?: string }} [data]
	 */
	setState (state, data = {}) {
		this.overlay.className = state === "idle" ? "" : `visible ${state}`;

		const label = this.overlay.querySelector(".jarvis-label");
		const transcript = this.overlay.querySelector(".jarvis-transcript");
		const response = this.overlay.querySelector(".jarvis-response");

		label.textContent = state === "idle" ? "" : state.toUpperCase();
		transcript.textContent = data.text ? `"${data.text}"` : (data.transcript ? `"${data.transcript}"` : "");
		response.textContent = data.response || "";
	},

	/**
	 * Handles messages from node_helper.
	 * @param {string} notification
	 * @param {object} payload
	 */
	socketNotificationReceived (notification, payload) {
		if (notification === "ASSISTANT_LISTENING") {
			this.setState("listening");
		} else if (notification === "ASSISTANT_PROCESSING") {
			this.setState("processing", { text: payload.text });
		} else if (notification === "ASSISTANT_SPEAKING") {
			this.setState("speaking", { transcript: payload.transcript, response: payload.response });
		} else if (notification === "ASSISTANT_IDLE") {
			this.setState("idle");
		} else if (notification === "HUE_COMMAND") {
			this.sendNotification("HUE_COMMAND", payload);
		} else if (notification === "MONITOR_COMMAND") {
			this.sendNotification("REMOTE_ACTION", payload);
		}
	},

	/**
	 * Module DOM — hidden; all output is in the overlay.
	 * @returns {HTMLElement}
	 */
	getDom () {
		const el = document.createElement("div");
		el.style.display = "none";
		return el;
	},

	/**
	 * @returns {string[]}
	 */
	getStyles () {
		return ["MMM-LocalAssistant.css"];
	}
});

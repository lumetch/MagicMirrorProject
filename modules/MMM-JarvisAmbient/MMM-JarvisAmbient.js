"use strict";

Module.register("MMM-JarvisAmbient", {
	defaults: {},

	/**
	 * Returns the CSS file for this module.
	 * @returns {string[]}
	 */
	getStyles () {
		return ["MMM-JarvisAmbient.css"];
	},

	/**
	 * Returns the DOM element for the module: four concentric rings with a slow
	 * ambient pulse animation in light blue. Pure CSS — no timers, no socket.
	 * @returns {HTMLElement}
	 */
	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "jarvis-ambient";
		for (let i = 0; i < 4; i++) {
			const ring = document.createElement("div");
			ring.className = "jarvis-ambient-ring";
			wrapper.appendChild(ring);
		}
		return wrapper;
	}
});

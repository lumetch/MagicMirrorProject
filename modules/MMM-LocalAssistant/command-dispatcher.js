"use strict";

/** @typedef {{ type: string, payload?: object }} Command */

const RULES = [
	{
		pattern: /turn (on|off) all lights?/i,
		/**
		 * @param {RegExpMatchArray} m
		 * @returns {Command}
		 */
		handler: (m) => ({ type: "HUE_COMMAND", payload: { room: "all", on: m[1] === "on" } })
	},
	{
		pattern: /turn (on|off) (?:the )?(.+?) lights?/i,
		/**
		 * @param {RegExpMatchArray} m
		 * @returns {Command}
		 */
		handler: (m) => ({ type: "HUE_COMMAND", payload: { room: m[2].trim(), on: m[1] === "on" } })
	},
	{
		pattern: /what(?:'s| is) the weather/i,
		/** @returns {Command} */
		handler: () => ({ type: "QUERY_WEATHER" })
	},
	{
		pattern: /what(?:'s| is) my next meeting/i,
		/** @returns {Command} */
		handler: () => ({ type: "QUERY_CALENDAR" })
	},
	{
		pattern: /next train to (.+)/i,
		/**
		 * @param {RegExpMatchArray} m
		 * @returns {Command}
		 */
		handler: (m) => ({ type: "QUERY_TRANSIT", payload: { destination: m[1].trim() } })
	},
	{
		pattern: /(?:go to )?sleep/i,
		/** @returns {Command} */
		handler: () => ({ type: "MONITOR_OFF" })
	},
	{
		pattern: /wake up/i,
		/** @returns {Command} */
		handler: () => ({ type: "MONITOR_ON" })
	}
];

/**
 * Matches a transcribed speech string against command rules.
 * Returns the first matching command object, or null if no match.
 * @param {string} text - Transcribed speech text
 * @returns {Command|null}
 */
function dispatch (text) {
	for (const { pattern, handler } of RULES) {
		const match = text.match(pattern);
		if (match) return handler(match);
	}
	return null;
}

module.exports = { dispatch };

"use strict";

/**
 * Converts raw Hue Bridge groups JSON into a flat Room array (Room-type only).
 * @param {object} groups - Raw JSON from GET /api/{username}/groups
 * @returns {{ id: string, name: string, on: boolean, bri: number }[]}
 */
function filterRooms (groups) {
	return Object.entries(groups)
		.filter(([, g]) => g.type === "Room")
		.map(([id, g]) => ({
			id,
			name: g.name,
			on: g.state.any_on,
			bri: g.action.bri
		}));
}

/**
 * Returns Hue group IDs to toggle for a given room name or "all".
 * @param {object} groups - Raw JSON from GET /api/{username}/groups
 * @param {string} room - Room name (case-insensitive) or "all"
 * @returns {string[]} Array of group IDs
 */
function buildToggleTargets (groups, room) {
	if (room === "all") return Object.keys(groups);
	return Object.entries(groups)
		.filter(([, g]) => g.name.toLowerCase() === room.toLowerCase())
		.map(([id]) => id);
}

module.exports = { filterRooms, buildToggleTargets };

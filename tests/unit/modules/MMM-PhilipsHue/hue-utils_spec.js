// Pure utility functions live in hue-utils.js (no node_helper dependency),
// so they can be required directly in the test environment.
const { filterRooms, buildToggleTargets } = require("../../../../modules/MMM-PhilipsHue/hue-utils");

describe("MMM-PhilipsHue helper logic", () => {
	const sampleGroups = {
		1: { type: "Room", name: "Office", state: { any_on: true }, action: { bri: 200 } },
		2: { type: "Room", name: "Living Room", state: { any_on: false }, action: { bri: 0 } },
		3: { type: "Zone", name: "Outside", state: { any_on: false }, action: { bri: 0 } }
	};

	it("filterRooms returns only Room type groups", () => {
		const rooms = filterRooms(sampleGroups);
		expect(rooms).toHaveLength(2);
		expect(rooms[0]).toEqual({ id: "1", name: "Office", on: true, bri: 200 });
		expect(rooms[1]).toEqual({ id: "2", name: "Living Room", on: false, bri: 0 });
	});

	it("buildToggleTargets finds room by name (case-insensitive)", () => {
		const ids = buildToggleTargets(sampleGroups, "office");
		expect(ids).toEqual(["1"]);
	});

	it("buildToggleTargets returns all room ids when room is 'all'", () => {
		const ids = buildToggleTargets(sampleGroups, "all");
		expect(ids).toEqual(["1", "2", "3"]);
	});

	it("buildToggleTargets returns empty array for unknown room", () => {
		const ids = buildToggleTargets(sampleGroups, "garage");
		expect(ids).toEqual([]);
	});
});

const { dispatch } = require("../../../../modules/MMM-LocalAssistant/command-dispatcher");

describe("command-dispatcher", () => {
	it("turns on a named room (with 'the')", () => {
		expect(dispatch("turn on the office lights")).toEqual({
			type: "HUE_COMMAND",
			payload: { room: "office", on: true }
		});
	});

	it("turns off a named room (without 'the')", () => {
		expect(dispatch("turn off bedroom lights")).toEqual({
			type: "HUE_COMMAND",
			payload: { room: "bedroom", on: false }
		});
	});

	it("turns off all lights", () => {
		expect(dispatch("turn off all lights")).toEqual({
			type: "HUE_COMMAND",
			payload: { room: "all", on: false }
		});
	});

	it("turns on all lights", () => {
		expect(dispatch("turn on all lights")).toEqual({
			type: "HUE_COMMAND",
			payload: { room: "all", on: true }
		});
	});

	it("queries weather (contraction)", () => {
		expect(dispatch("what's the weather")).toEqual({ type: "QUERY_WEATHER" });
	});

	it("queries weather (full form)", () => {
		expect(dispatch("what is the weather")).toEqual({ type: "QUERY_WEATHER" });
	});

	it("queries calendar (contraction)", () => {
		expect(dispatch("what's my next meeting")).toEqual({ type: "QUERY_CALENDAR" });
	});

	it("queries calendar (full form)", () => {
		expect(dispatch("what is my next meeting")).toEqual({ type: "QUERY_CALENDAR" });
	});

	it("queries transit", () => {
		expect(dispatch("next train to Zurich HB")).toEqual({
			type: "QUERY_TRANSIT",
			payload: { destination: "Zurich HB" }
		});
	});

	it("go to sleep", () => {
		expect(dispatch("go to sleep")).toEqual({ type: "MONITOR_OFF" });
	});

	it("just sleep", () => {
		expect(dispatch("sleep")).toEqual({ type: "MONITOR_OFF" });
	});

	it("wake up", () => {
		expect(dispatch("wake up")).toEqual({ type: "MONITOR_ON" });
	});

	it("unknown command returns null", () => {
		expect(dispatch("tell me a joke")).toBeNull();
	});

	it("empty string returns null", () => {
		expect(dispatch("")).toBeNull();
	});
});

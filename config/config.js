var config = {
	address: "0.0.0.0",
	port: 8080,
	basePath: "/",
	ipWhitelist: [],
	useHttps: false,
	language: "en",
	locale: "en-US",
	logLevel: ["INFO", "LOG", "WARN", "ERROR"],
	timeFormat: 24,
	units: "metric",

	modules: [
		// ── Always-on utilities ──────────────────────────────────────
		{
			module: "alert"
		},
		{
			module: "updatenotification",
			position: "top_bar"
		},
		{
			module: "MMM-Remote-Control",
			config: {
				apiKey: ""
			}
		},
		{
			module: "MMM-LocalAssistant",
			position: "bottom_bar",
			config: {
				whisperPath: "/home/lumetch/whisper.cpp/build/bin/whisper-cli",
				whisperModel: "/home/lumetch/whisper.cpp/models/ggml-tiny.en.bin",
				wakeWordModel: "hey_jarvis_v0.1",
				wakeWordThreshold: 0.5,
				captureSeconds: 5,
				espeakVoice: "en-gb",
				micDevice: "default"
			}
		},

		// ── Page 1: Information ──────────────────────────────────────
		{
			module: "clock",
			position: "top_left",
			config: {
				timezone: "Europe/Zurich",
				showPeriod: false
			}
		},
		{
			module: "weather",
			position: "top_right",
			header: "Now",
			config: {
				weatherProvider: "openmeteo",
				type: "current",
				lat: 0.0000,     // FILL IN: your latitude  (e.g. 47.3769)
				lon: 0.0000,     // FILL IN: your longitude (e.g.  8.5417)
				units: "metric"
			}
		},
		{
			module: "calendar",
			header: "Calendar",
			position: "upper_third",
			config: {
				calendars: [
					{
						symbol: "calendar",
						url: "FILL_IN_GOOGLE_CALENDAR_ICAL_URL"
					}
				],
				maximumEntries: 5,
				maximumNumberOfDays: 14
			}
		},
		{
			module: "MMM-PublicTransportHafas",
			header: "SBB Departures",
			position: "middle_center",
			config: {
				stationID: "FILL_IN_SBB_STATION_ID",
				maxReachableDepartures: 4,
				timeToStation: 5
			}
		},
		{
			module: "newsfeed",
			position: "lower_third",
			config: {
				feeds: [
					{
						title: "SwissInfo",
						url: "https://www.swissinfo.ch/eng/rss/top_stories"
					},
					{
						title: "BBC World",
						url: "http://feeds.bbci.co.uk/news/world/rss.xml"
					}
				],
				showSourceTitle: true,
				showPublishDate: true
			}
		},
		{
			module: "weather",
			position: "bottom_left",
			header: "5-Day Forecast",
			config: {
				weatherProvider: "openmeteo",
				type: "forecast",
				lat: 0.0000,     // FILL IN: same as above
				lon: 0.0000,     // FILL IN: same as above
				units: "metric"
			}
		},
		{
			module: "compliments",
			position: "bottom_right",
			config: {
				compliments: {
					anytime: [
						"Looking sharp.",
						"Have a great day!",
						"The office awaits.",
						"You've got this.",
						"Making Switzerland proud."
					],
					morning: [
						"Good morning!",
						"Rise and shine.",
						"Ready for today?"
					],
					afternoon: [
						"Good afternoon!",
						"Keep going."
					],
					evening: [
						"Good evening.",
						"Time to unwind.",
						"You did great today."
					]
				}
			}
		},

		// ── Page 2: Smart Home ───────────────────────────────────────
		{
			module: "MMM-PhilipsHue",
			position: "upper_third",
			header: "Lights",
			config: {
				bridgeIp: "FILL_IN_HUE_BRIDGE_IP",
				username: "FILL_IN_HUE_USERNAME",
				pollInterval: 30000
			}
		},

		// ── Page management ──────────────────────────────────────────
		{
			module: "MMM-pages",
			config: {
				modules: [
					[
						"clock", "weather", "calendar",
						"MMM-PublicTransportHafas", "newsfeed",
						"compliments"
					],
					[
						"MMM-PhilipsHue"
					]
				],
				fixed: [
					"alert",
					"updatenotification",
					"MMM-Remote-Control",
					"MMM-LocalAssistant"
				],
				rotationTime: 60000
			}
		},
		{
			module: "MMM-ModuleScheduler",
			config: {
				global_schedule: [
					{
						from: "22:00",
						to: "07:00",
						action: "HIDE",
						modules: ["MMM-PublicTransportHafas"]
					}
				]
			}
		}
	]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }

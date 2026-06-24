"use strict";

const NodeHelper = require("node_helper");
const { dispatch } = require("./command-dispatcher");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

module.exports = NodeHelper.create({
	/** @type {object|null} */
	config: null,

	/** @type {boolean} */
	isCapturing: false,

	/** @type {import("child_process").ChildProcess|null} */
	wakeWordProcess: null,

	/**
	 * Module lifecycle — called when the helper starts.
	 */
	start () {
		this.config = null;
		this.isCapturing = false;
		this.wakeWordProcess = null;
	},

	/**
	 * Handles socket notifications from the frontend.
	 * @param {string} notification
	 * @param {object} payload
	 */
	socketNotificationReceived (notification, payload) {
		if (notification === "ASSISTANT_INIT") {
			this.config = payload;
			this.startWakeWordLoop();
		}
	},

	/**
	 * Returns SoX input-device arguments for the configured mic.
	 * @returns {string[]}
	 */
	micArgs () {
		const { micDevice } = this.config;
		return micDevice === "default" ? ["-d"] : ["-t", "alsa", micDevice];
	},

	/**
	 * Spawns the openWakeWord Python subprocess and listens for WAKE events on stdout.
	 */
	startWakeWordLoop () {
		const { wakeWordModel, wakeWordThreshold, micDevice } = this.config;
		const scriptPath = path.join(__dirname, "wake-word-listener.py");

		this.wakeWordProcess = spawn("python3", [
			scriptPath,
			wakeWordModel,
			String(wakeWordThreshold),
			micDevice
		]);

		this.wakeWordProcess.stdout.on("data", (data) => {
			if (data.toString().includes("WAKE") && !this.isCapturing) {
				this.onWakeWord();
			}
		});

		this.wakeWordProcess.stderr.on("data", (data) => {
			Log.info("MMM-LocalAssistant [wake-word]:", data.toString().trim());
		});

		this.wakeWordProcess.on("error", (err) => {
			Log.error("MMM-LocalAssistant: wake-word process error:", err.message);
		});

		this.wakeWordProcess.on("close", (code) => {
			if (!this.isCapturing) {
				Log.warn("MMM-LocalAssistant: wake-word process exited with code", code);
			}
		});
	},

	/**
	 * Kills the wake-word subprocess so SoX can exclusively access the mic.
	 * @returns {Promise<void>}
	 */
	stopWakeWordLoop () {
		return new Promise((resolve) => {
			if (!this.wakeWordProcess) {
				resolve();
				return;
			}
			this.wakeWordProcess.once("close", resolve);
			this.wakeWordProcess.kill("SIGTERM");
			this.wakeWordProcess = null;
		});
	},

	/**
	 * Handles a wake-word detection event: capture → transcribe → dispatch → speak.
	 */
	async onWakeWord () {
		if (this.isCapturing) return;
		this.isCapturing = true;
		this.sendSocketNotification("ASSISTANT_LISTENING", {});

		const audioFile = path.join(os.tmpdir(), "mm_capture.wav");
		const { captureSeconds } = this.config;

		try {
			await this.stopWakeWordLoop();
			await this.captureAudio(audioFile, captureSeconds);

			const text = await this.transcribe(audioFile);
			this.sendSocketNotification("ASSISTANT_PROCESSING", { text });

			const command = dispatch(text);
			const response = await this.executeCommand(command, text);

			this.sendSocketNotification("ASSISTANT_SPEAKING", { transcript: text, response });
			await this.speak(response);
		} catch (err) {
			Log.error("MMM-LocalAssistant: pipeline error:", err.message);
		} finally {
			this.isCapturing = false;
			this.sendSocketNotification("ASSISTANT_IDLE", {});
			try { fs.unlinkSync(audioFile); } catch (_) { /* ignore if file was never created */ }
			this.startWakeWordLoop();
		}
	},

	/**
	 * Records audio from the microphone for a fixed duration.
	 * @param {string} outputFile - Path to write the WAV file
	 * @param {number} seconds - Duration to capture
	 * @returns {Promise<void>}
	 */
	captureAudio (outputFile, seconds) {
		return new Promise((resolve, reject) => {
			const rec = spawn("sox", [
				...this.micArgs(),
				"-r", "16000",
				"-c", "1",
				outputFile,
				"trim", "0", String(seconds)
			]);
			rec.on("close", resolve);
			rec.on("error", reject);
		});
	},

	/**
	 * Transcribes a WAV file using whisper.cpp.
	 * @param {string} audioFile - Path to WAV file
	 * @returns {Promise<string>} Transcribed text
	 */
	transcribe (audioFile) {
		const { whisperPath, whisperModel } = this.config;
		return new Promise((resolve, reject) => {
			execFile(
				whisperPath,
				["-m", whisperModel, "-f", audioFile, "--no-timestamps"],
				(err, stdout) => {
					if (err) reject(err);
					else resolve(stdout.trim());
				}
			);
		});
	},

	/**
	 * Resolves a dispatched command to a response string and fires side-effects.
	 * @param {{ type: string, payload?: object }|null} command
	 * @param {string} rawText - Original transcription (for fallback message)
	 * @returns {Promise<string>} Text to speak aloud
	 */
	async executeCommand (command, rawText) {
		if (!command) {
			return "Sorry, I didn't understand that.";
		}
		if (command.type === "HUE_COMMAND") {
			this.sendSocketNotification("HUE_COMMAND", command.payload);
			const { room, on } = command.payload;
			const target = room === "all" ? "all lights" : `the ${room} lights`;
			return `${on ? "Turning on" : "Turning off"} ${target}.`;
		}
		if (command.type === "MONITOR_OFF") {
			this.sendSocketNotification("MONITOR_COMMAND", { action: "MONITOROFF" });
			return "Going to sleep. Goodnight.";
		}
		if (command.type === "MONITOR_ON") {
			this.sendSocketNotification("MONITOR_COMMAND", { action: "MONITORON" });
			return "Good morning!";
		}
		if (command.type === "QUERY_WEATHER") {
			return "Check the top of the mirror for current weather conditions.";
		}
		if (command.type === "QUERY_CALENDAR") {
			return "Check the calendar on the mirror for your next event.";
		}
		if (command.type === "QUERY_TRANSIT") {
			return "Check the departures board for your next train.";
		}
		return "I heard you, but I'm not sure how to help with that.";
	},

	/**
	 * Speaks a response string aloud via espeak-ng.
	 * @param {string} text
	 * @returns {Promise<void>}
	 */
	speak (text) {
		const { espeakVoice } = this.config;
		return new Promise((resolve, reject) => {
			const proc = spawn("espeak-ng", ["-v", espeakVoice, text]);
			proc.on("close", resolve);
			proc.on("error", reject);
		});
	}
});

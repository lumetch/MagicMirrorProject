"use strict";

const NodeHelper = require("node_helper");
const { Porcupine, BuiltinKeyword } = require("@picovoice/porcupine-node");
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
	soxProcess: null,

	/**
	 * Module lifecycle — called when the helper starts.
	 */
	start () {
		this.config = null;
		this.isCapturing = false;
		this.soxProcess = null;
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
	 * Starts the continuous Porcupine wake-word detection loop.
	 * Reads raw PCM from SoX and processes frame-by-frame.
	 */
	startWakeWordLoop () {
		const { porcupineAccessKey } = this.config;

		const porcupine = new Porcupine(
			porcupineAccessKey,
			[BuiltinKeyword.JARVIS],
			[0.5]
		);

		const frameSizeBytes = porcupine.frameLength * 2;

		this.soxProcess = spawn("sox", [
			"-d",
			"-r", String(porcupine.sampleRate),
			"-c", "1",
			"-b", "16",
			"-e", "signed-integer",
			"-t", "raw",
			"-"
		]);

		let buffer = Buffer.alloc(0);

		this.soxProcess.stdout.on("data", (chunk) => {
			if (this.isCapturing) return;
			buffer = Buffer.concat([buffer, chunk]);
			while (buffer.length >= frameSizeBytes) {
				const frame = new Int16Array(
					buffer.buffer,
					buffer.byteOffset,
					porcupine.frameLength
				);
				if (porcupine.process(frame) >= 0) {
					this.onWakeWord();
				}
				buffer = buffer.subarray(frameSizeBytes);
			}
		});

		this.soxProcess.on("error", (err) => {
			Log.error("MMM-LocalAssistant: SoX error:", err.message);
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
				"-d",
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
			return `Sorry, I didn't understand that.`;
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

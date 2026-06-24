#!/usr/bin/env node
"use strict";

/**
 * One-time Philips Hue Bridge pairing script.
 * Press the link button on the bridge, then run:
 *   node scripts/hue-pair.js <bridge-ip>
 */

const bridgeIp = process.argv[2];

if (!bridgeIp) {
	console.error("Usage: node scripts/hue-pair.js <bridge-ip>");
	console.error("       Find bridge IP with: curl https://discovery.meethue.com");
	process.exit(1);
}

(async () => {
	try {
		const res = await fetch(`http://${bridgeIp}/api`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ devicetype: "magicmirror#pi" })
		});
		const [result] = await res.json();

		if (result.success) {
			const { username } = result.success;
			console.log("\nPairing successful!");
			console.log(`Username: ${username}`);
			console.log("\nAdd this to your config.js MMM-PhilipsHue section:");
			console.log(`  username: "${username}"`);
		} else {
			console.error("\nError:", result.error.description);
			console.error("Make sure you pressed the link button on the Hue Bridge first, then retry.");
		}
	} catch (err) {
		console.error("Could not reach Hue Bridge:", err.message);
		console.error(`Tried: http://${bridgeIp}/api`);
	}
})();

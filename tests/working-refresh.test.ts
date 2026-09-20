import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { startWorkingRefresh } from "../extensions/open-tui/working-refresh.ts";

test("event mode refreshes once without starting periodic updates", async () => {
	let refreshes = 0;
	const stop = startWorkingRefresh("event", () => refreshes++, 5);

	await delay(20);
	stop();

	assert.equal(refreshes, 1);
});

test("realtime mode refreshes periodically and stops cleanly", async () => {
	let refreshes = 0;
	const stop = startWorkingRefresh("realtime", () => refreshes++, 5);

	await delay(20);
	stop();
	const stoppedAt = refreshes;
	await delay(15);

	assert.ok(stoppedAt > 1);
	assert.equal(refreshes, stoppedAt);
});

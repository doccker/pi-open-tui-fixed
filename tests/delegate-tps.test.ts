import assert from "node:assert/strict";
import test from "node:test";
import { createDelegateTps } from "../extensions/open-tui/delegate-tps.ts";
import type { LiveTps } from "../extensions/open-tui/telemetry.ts";

function setup() {
	const handlers = new Map<string, (data: unknown) => void>();
	const events = { on: (name: string, handler: (data: unknown) => void) => { handlers.set(name, handler); return () => {}; }, emit: () => {} };
	let renders = 0;
	const tracker = createDelegateTps(events as never, () => { renders++; });
	const send = (data: unknown) => handlers.get("delegate:tps")!(data);
	return { tracker, send, renders: () => renders };
}

const run = (id: string, tps: number, stale = false) => ({ id, agent: "worker", tps, stale });
const mainLive: LiveTps = { tps: 40, stale: false };
const mainStale: LiveTps = { tps: 40, stale: true };

test("delegate tps: no event leaves the main rate untouched", () => {
	const { tracker } = setup();
	assert.equal(tracker.merge(null), null);
	assert.deepEqual(tracker.merge(mainStale), mainStale);
});

test("delegate tps: live main-session rate wins over sub-agents", () => {
	const { tracker, send } = setup();
	send({ runs: [run("a", 100)] });
	assert.deepEqual(tracker.merge(mainLive), mainLive);
});

test("delegate tps: stale or missing main rate shows the live sub-agent sum", () => {
	const { tracker, send, renders } = setup();
	send({ runs: [run("a", 100), run("b", 42), run("c", 9, true)] });
	assert.equal(renders(), 1);
	assert.deepEqual(tracker.merge(mainStale), { tps: 142, stale: false, subagents: 2 });
	assert.deepEqual(tracker.merge(null), { tps: 142, stale: false, subagents: 2 });
});

test("delegate tps: all-stale sub-agents show their sum as stale", () => {
	const { tracker, send } = setup();
	send({ runs: [run("a", 30, true), run("b", 20, true)] });
	assert.deepEqual(tracker.merge(null), { tps: 50, stale: true, subagents: 2 });
});

test("delegate tps: empty runs and clear restore the main rate", () => {
	const { tracker, send } = setup();
	send({ runs: [run("a", 100)] });
	send({ runs: [] });
	assert.deepEqual(tracker.merge(mainStale), mainStale);
	send({ runs: [run("a", 100)] });
	tracker.clear();
	assert.equal(tracker.merge(null), null);
});

test("delegate tps: invalid payloads are ignored", () => {
	const { tracker, send, renders } = setup();
	send({ runs: [run("a", 100)] });
	const before = renders();
	for (const bad of [null, undefined, 5, "x", {}, { runs: "x" }, { runs: [null] }, { runs: [{ id: "a", agent: "w", tps: "1", stale: false }] },
		{ runs: [{ id: "a", agent: "w", tps: NaN, stale: false }] }, { runs: [{ id: "a", agent: "w", tps: -1, stale: false }] },
		{ runs: [{ id: "a", agent: "w", tps: 1 }] }, { runs: [{ agent: "w", tps: 1, stale: false }] }]) send(bad);
	assert.equal(renders(), before);
	assert.deepEqual(tracker.merge(null), { tps: 100, stale: false, subagents: 1 });
});

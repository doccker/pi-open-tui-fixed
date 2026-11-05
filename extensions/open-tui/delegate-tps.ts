import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LiveTps } from "./telemetry.ts";

/** Event published by the delegate extension: `{ runs: [{ id, agent, tps, stale }] }`. */
export const DELEGATE_TPS_EVENT = "delegate:tps";

interface DelegateRun {
	tps: number;
	stale: boolean;
}

function parseRuns(data: unknown): DelegateRun[] | null {
	if (typeof data !== "object" || data === null) return null;
	const runs = (data as { runs?: unknown }).runs;
	if (!Array.isArray(runs)) return null;
	const parsed: DelegateRun[] = [];
	for (const run of runs) {
		if (typeof run !== "object" || run === null) return null;
		const { id, agent, tps, stale } = run as Record<string, unknown>;
		if (typeof id !== "string" || typeof agent !== "string") return null;
		if (typeof tps !== "number" || !Number.isFinite(tps) || tps < 0) return null;
		if (typeof stale !== "boolean") return null;
		parsed.push({ tps, stale });
	}
	return parsed;
}

/**
 * Tracks sub-agent output speed reported over `delegate:tps` and folds it into
 * the footer's live TPS. Without the event the main-session value is untouched.
 */
export function createDelegateTps(events: ExtensionAPI["events"], requestRender: () => void) {
	let runs: DelegateRun[] = [];
	events.on(DELEGATE_TPS_EVENT, (data) => {
		const next = parseRuns(data);
		if (next === null) return;
		runs = next;
		requestRender();
	});
	return {
		clear: () => {
			runs = [];
		},
		/** Main live rate wins; otherwise sub-agent rates are summed. */
		merge: (main: LiveTps | null): LiveTps | null => {
			if (runs.length === 0 || (main !== null && !main.stale)) return main;
			const live = runs.filter((run) => !run.stale);
			const used = live.length > 0 ? live : runs;
			const tps = used.reduce((sum, run) => sum + run.tps, 0);
			return { tps, stale: live.length === 0, subagents: used.length };
		},
	};
}

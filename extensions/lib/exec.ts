/** Minimal process runner with env support (pi.exec has no env option). */

import { spawn } from "node:child_process";
import type { Exec, ExecResult } from "./python.ts";

const MAX_BUFFER = 8 * 1024 * 1024;

export const runProcess: Exec = (command, args, options = {}) =>
	new Promise<ExecResult>((resolvePromise) => {
		let stdout = "";
		let stderr = "";
		let killed = false;
		let settled = false;

		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env ?? process.env,
			windowsHide: true,
			shell: options.shell ?? false,
			stdio: [options.input !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
		});
		if (options.input !== undefined) {
			child.stdin?.on("error", () => {}); // the program may exit without reading its input
			child.stdin?.end(options.input);
		}

		const finish = (code: number) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", onAbort);
			resolvePromise({ stdout, stderr, code, killed });
		};

		const kill = () => {
			killed = true;
			child.kill();
		};
		const onAbort = () => kill();
		options.signal?.addEventListener("abort", onAbort, { once: true });
		const timer = options.timeout ? setTimeout(kill, options.timeout) : undefined;

		child.stdout?.on("data", (d: Buffer) => {
			if (stdout.length < MAX_BUFFER) stdout += d.toString("utf8");
		});
		child.stderr?.on("data", (d: Buffer) => {
			if (stderr.length < MAX_BUFFER) stderr += d.toString("utf8");
		});
		child.on("error", (err) => {
			stderr += `\n${err.message}`;
			finish(127);
		});
		child.on("close", (code) => finish(code ?? (killed ? 124 : 1)));
	});

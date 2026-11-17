/**
 * LaTeX → readable plain text for places that show raw text (Claude Code forms, where pi's Unicode
 * renderer is not available). Covers the common school/university notation; anything it does not
 * know stays as written. Exponents use caret form (x^2, e^(i·π)), consistent with mathExponents.
 */

const SYMBOLS: Record<string, string> = {
	cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡",
	sim: "~", propto: "∝", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅",
	forall: "∀", exists: "∃", neg: "¬", land: "∧", lor: "∨", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
	iff: "⇔", Leftrightarrow: "⇔", mapsto: "↦", infty: "∞", partial: "∂", nabla: "∇", sum: "Σ", prod: "Π", int: "∫", iint: "∬", oint: "∮",
	lim: "lim", sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln", exp: "exp", max: "max", min: "min", sup: "sup", inf: "inf", det: "det",
	alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι",
	kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ",
	psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
	R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", ldots: "…", dots: "…", cdots: "⋯", circ: "∘", deg: "°", perp: "⊥", parallel: "∥", angle: "∠",
	quad: "  ", qquad: "    ", ",": " ", ";": " ", ":": " ", "!": "", "{": "{", "}": "}", "|": "‖", "%": "%", "$": "$",
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };

/** Content of the brace group starting at s[i] === "{" and the index after it. */
function group(s: string, i: number): [string, number] {
	let depth = 0;
	for (let j = i; j < s.length; j++) {
		if (s[j] === "\\") {
			j++;
			continue;
		}
		if (s[j] === "{") depth++;
		else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
	}
	return [s.slice(i + 1), s.length];
}

/** Next argument: a brace group, a command, or one character. */
function arg(s: string, i: number): [string, number] {
	while (s[i] === " ") i++;
	if (s[i] === "{") return group(s, i);
	if (s[i] === "\\") {
		const m = s.slice(i).match(/^\\([A-Za-z]+|.)/);
		return m ? [m[0], i + m[0].length] : ["", i + 1];
	}
	return [s[i] ?? "", i + 1];
}

const simple = (t: string) => /^[\p{L}\p{N}.]+$/u.test(t);
const wrap = (t: string) => (simple(t) ? t : `(${t})`);

/** Convert one formula (without delimiters). */
export function texToPlain(tex: string): string {
	let out = "";
	let i = 0;
	while (i < tex.length) {
		const c = tex[i];
		if (c === "\\") {
			const m = tex.slice(i).match(/^\\([A-Za-z]+|.)/);
			if (!m) {
				i++;
				continue;
			}
			const name = m[1];
			i += m[0].length;
			if (name === "frac" || name === "dfrac" || name === "tfrac") {
				const [a, j] = arg(tex, i);
				const [b, k] = arg(tex, j);
				out += `${wrap(texToPlain(a))}/${wrap(texToPlain(b))}`;
				i = k;
			} else if (name === "sqrt") {
				let n = "";
				if (tex[i] === "[") {
					const end = tex.indexOf("]", i);
					n = texToPlain(tex.slice(i + 1, end));
					i = end + 1;
				}
				const [a, j] = arg(tex, i);
				out += `${n === "3" ? "∛" : n === "4" ? "∜" : n ? `${n}√` : "√"}${wrap(texToPlain(a))}`;
				i = j;
			} else if (name === "mathbb") {
				const [a, j] = arg(tex, i);
				out += BLACKBOARD[a] ?? a;
				i = j;
			} else if (["text", "mathrm", "mathbf", "mathit", "operatorname", "vb", "mathcal", "boldsymbol", "textbf", "emph"].includes(name)) {
				const [a, j] = arg(tex, i);
				out += name.startsWith("text") || name === "emph" ? a : texToPlain(a);
				i = j;
			} else if (["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "limits"].includes(name)) {
				// sizing only
			} else if (name === "abs" || name === "norm") {
				const [a, j] = arg(tex, i);
				const bar = name === "abs" ? "|" : "‖";
				out += `${bar}${texToPlain(a)}${bar}`;
				i = j;
			} else if (name === "vec" || name === "overrightarrow") {
				const [a, j] = arg(tex, i);
				out += `${texToPlain(a)}⃗`;
				i = j;
			} else if (name === "bar" || name === "overline") {
				const [a, j] = arg(tex, i);
				out += `${texToPlain(a)}̄`;
				i = j;
			} else if (name === "hat") {
				const [a, j] = arg(tex, i);
				out += `${texToPlain(a)}̂`;
				i = j;
			} else out += SYMBOLS[name] ?? `\\${name}`;
			continue;
		}
		if (c === "^" || c === "_") {
			const [a, j] = arg(tex, i + 1);
			const body = texToPlain(a);
			if (c === "^" && (body === "∘" || body === "°")) out += "°";
			else if (c === "^" && body === "'") out += "'";
			else out += `${c}${/^(?:\d+|[\p{L}])$/u.test(body) ? body : `(${body})`}`;
			i = j;
			continue;
		}
		if (c === "{" || c === "}") {
			i++;
			continue;
		}
		out += c === "~" ? " " : c;
		i++;
	}
	return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** Replace $…$ and $$…$$ formulas in text with plain text. */
export function mathToPlain(text: string): string {
	if (!text.includes("$")) return text;
	return text.replace(/\$\$([\s\S]+?)\$\$|(?<![\\$])\$(?!\$)([^$\n]+?)\$/g, (_m, display: string | undefined, inline: string | undefined) => texToPlain((display ?? inline ?? "").trim()));
}

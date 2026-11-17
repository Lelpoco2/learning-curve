/**
 * Math in plain-text places (quiz dialogs). The renderer is injected by the platform: pi renders
 * LaTeX as Unicode (math-display.ts); elsewhere text is shown as written.
 */

let renderer: (text: string) => string = (text) => text;

export function setMathRenderer(fn: (text: string) => string): void {
	renderer = fn;
}

export function mathText(text: string): string {
	return renderer(text);
}

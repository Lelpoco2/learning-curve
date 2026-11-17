---
name: visuals
description: Choose and produce visuals for lessons - Manim animations, matplotlib plots, Desmos graphs, TikZ diagrams, Mermaid, Excalidraw - and embed them in notes. Use when a concept is geometric, dynamic, or easier to see than to read.
---

# Visuals

One good visual beats many. Add one when the idea is spatial, dynamic (something changes),
or comparative. Follow the learner's preference (Learning Style summary).

## Choose

| Need | Use | How |
|---|---|---|
| Something that moves or transforms (limits, linear maps, waves, orbits, Fourier) | Manim animation | `manim_render` → mp4 in lesson `media/` |
| Precise static plot (functions, data, fields, phase portraits) | matplotlib | `plot_render` → png/svg in `media/` |
| Function graph to play with (sliders, zoom) | Desmos plugin | `desmos-graph` code block |
| Geometry, circuits, commutative diagrams, labelled figures | TikZJax plugin | `tikz` code block |
| Flow of reasoning, dependency of concepts, algorithms | Mermaid | `mermaid` code block (built in) |
| Freehand sketch the learner will edit | Excalidraw | suggest; do not generate |

Check availability in `<learning_context>`: tools, and "Obsidian plugins enabled".
Use a plugin block only when that plugin is enabled; otherwise use `plot_render` images
(they render everywhere) and, if the plugin would really help, suggest installing it with
`/learn-plugins`.

## Manim

- Short (5–30 s), one idea, slow enough to follow (`self.wait()` between steps).
- Build up: show the object, then the change, then the result highlighted.
- If LaTeX is NOT available, use `Text` (not `MathTex`/`Tex`).
- Path: `<lesson media>/<short-name>.mp4`; scene class in PascalCase; quality medium.
- Embed with the returned `![[…]]`, and add one caption line under it saying what to watch.

```python
from manim import *
class DotProductProjection(Scene):
    def construct(self):
        plane = NumberPlane(x_range=[-1, 5], y_range=[-1, 4])
        a = Arrow(plane.c2p(0, 0), plane.c2p(4, 1), buff=0, color=BLUE)
        b = Arrow(plane.c2p(0, 0), plane.c2p(2, 3), buff=0, color=YELLOW)
        self.play(Create(plane), GrowArrow(a), GrowArrow(b))
        foot = plane.c2p(*(11/17*np.array([4, 1])))
        proj = DashedLine(b.get_end(), foot)
        self.play(Create(proj)); self.wait(1)
```

## matplotlib (`plot_render`)

Code draws on `plt` (Agg backend, `np` imported); the tool saves the figure. Label axes,
use LaTeX labels (`r"$f(x)$"`), mark the key point the text talks about.
matplotlib mathtext is a LaTeX subset without the vault preamble: write `\mathbf{v}`,
`\mathbb{R}` instead of `\vb{v}`, `\R`; no `\begin{...}` environments.

## Desmos (Desmos plugin)

````
```desmos-graph
left=-5; right=5; top=5; bottom=-5
---
y=x^2
y=2x-1|red|dashed
(1,1)|label:tangency point
```
````

One equation per line (LaTeX). Per-equation options between `|`: color (red, blue, #hex),
style (solid/dashed/dotted; point/open/cross), restriction (`x>0`), `label:text`,
`hidden`. Settings before `---`: left/right/top/bottom, width/height, grid, degreeMode.

## TikZ (TikZJax plugin)

````
```tikz
\usepackage{pgfplots}
\pgfplotsset{compat=1.16}
\begin{document}
\begin{tikzpicture}
\begin{axis}[axis lines=middle, xlabel=$x$, ylabel=$y$]
\addplot[domain=-2:2, samples=100, thick] {x^3 - x};
\end{axis}
\end{tikzpicture}
\end{document}
```
````

Supported packages include tikz-cd, circuitikz, pgfplots, chemfig, amsmath, tikz-3dplot.
Always wrap in `\begin{document}…\end{document}`.

## Mermaid

Use for concept maps in topic indexes and for the logical thread of a derivation.

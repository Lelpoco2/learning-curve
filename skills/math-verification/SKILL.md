---
name: math-verification
description: How to verify mathematics and physics with the math_check tool (SymPy/NumPy/SciPy) before writing notes or grading answers - symbolic identities, derivatives, integrals, limits, equation solving, linear algebra, numeric answers, units. Use whenever a result, step or answer must be correct.
---

# Math verification

Rule: no computed result goes into a note, a solution or a grade without a check.
Models make arithmetic and algebra slips; the tool does not.

## What to verify

- Every numeric result and every final symbolic result.
- Non-trivial steps of derivations (each `=` that is not obvious).
- Learner answers in a different but equivalent form (simplify the difference).
- Physics: dimensions/units and orders of magnitude.
- Code (cs/programming lessons): every snippet, output and error message is produced by
  `code_run` in the subject's language, never written from memory. Complexity claims:
  solve the recurrence with `math_check`, and when useful time the code on growing inputs.

## Patterns

```python
from sympy import *
x, y, t = symbols('x y t', real=True)

# identity / equivalent forms
lhs = sin(x)**2 + cos(x)**2
assert simplify(lhs - 1) == 0; print("identity ok")

# calculus
print(diff(x**3*exp(x), x))
print(integrate(1/(1+x**2), (x, 0, 1)))      # pi/4
print(limit(sin(x)/x, x, 0))

# solve
print(solve(Eq(x**2 - 5*x + 6, 0), x))
print(dsolve(Eq(Function('f')(t).diff(t, 2) + Function('f')(t), 0)))

# linear algebra
A = Matrix([[2, 1], [1, 2]])
print(A.eigenvals(), A.det(), A.inv())

# learner answer equivalent to ours?
ours, theirs = (x+1)**2, x**2 + 2*x + 1
print(simplify(ours - theirs) == 0)

# numeric with tolerance
import math
print(math.isclose(9.81*2.0**2/2, 19.62, rel_tol=1e-9))
```

Units (physics): `from sympy.physics.units import meter, second, kilogram, newton, convert_to`
and `convert_to(expr, newton)` to check dimensions.

## Rules

- Print every value you rely on; use `assert` for claims.
- Exact arithmetic first (`Rational(1, 3)`, `sqrt(2)`, `pi`), floats only for final numerics.
- Declare symbol assumptions (`positive=True`, `real=True`) when they matter.
- If the check fails, find the error before writing. If something cannot be verified
  (proof steps, conceptual claims), say so explicitly in the note or to the learner.
- Do not show the tool output to the learner unless useful; show the reasoning.
- If math_check is unavailable (see `<learning_context>`), double-check by a second
  independent method by hand and tell the learner that tool verification is off.

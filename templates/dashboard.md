---
type: dashboard
tags: [learning/dashboard]
---

# Learning dashboard

> [!tip] In pi
> `/learn <topic>` start or resume · `/lesson` next lesson · `/quiz` check · `/review` due reviews · `/progress` refresh this page

<!-- lc:progress:begin -->
<!-- lc:progress:end -->

## Lessons in progress

```dataview
TABLE subject, topic, difficulty, updated
WHERE type = "lesson" AND status = "in-progress"
SORT updated DESC
```

## Open reinforcement notes

```dataview
LIST concept
WHERE type = "reinforcement" AND status = "open"
```

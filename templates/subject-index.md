---
type: subject
subject: "{{subject}}"
status: "{{status}}"
goal: "{{goal}}"
created: {{date}}
updated: {{date}}
tags: [learning/subject, {{subjectTag}}]
---

# {{subject}}

> [!abstract] Goal
> What this subject is for and what you will be able to do at the end.

## Starting point

<!-- Summary of the subject assessment: solid, shaky, new. Written by the tutor. -->

## Syllabus

<!-- Generated: topics in order (dependency, then difficulty). ↗ = topic shared with another subject. -->
<!-- lc:syllabus:begin -->
<!-- lc:syllabus:end -->

## Topic map

<!-- lc:map:begin -->
<!-- lc:map:end -->

## Why this order

<!-- The logical thread across topics. Written by the tutor. -->

## Final exam

<!-- lc:exam:begin -->
<!-- lc:exam:end -->

## All notes of this subject

```dataview
TABLE type, status, updated
WHERE subject = "{{subject}}" OR contains(subjects, "{{subject}}")
SORT type ASC, updated DESC
```

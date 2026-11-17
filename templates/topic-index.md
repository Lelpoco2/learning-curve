---
type: topic
subject: "{{subject}}"
topic: "{{topic}}"
subjects: [{{subjectsList}}]
status: "{{status}}"
created: {{date}}
updated: {{date}}
tags: [learning/topic, {{subjectTags}}, {{topicTag}}]
---

# {{topic}}

- [[{{studyPlanLink}}|Study plan]]{{flashcardsLine}}

## Subjects

<!-- lc:subjects:begin -->
- [[{{subjectLink}}|{{subject}}]] (home)
<!-- lc:subjects:end -->

## Lessons

<!-- lc:lessons:begin -->
<!-- lc:lessons:end -->

## Quizzes, tests and exercises

```dataview
TABLE type, score, passed, created
FROM "{{topicFolder}}"
WHERE contains(list("quiz", "test", "exercises", "retest"), type)
SORT created DESC
```

## Reinforcement notes

```dataview
LIST concept + " — " + status
FROM "{{topicFolder}}"
WHERE type = "reinforcement"
```

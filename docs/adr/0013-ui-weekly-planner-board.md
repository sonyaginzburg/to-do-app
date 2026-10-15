# ADR 0013: UI layout: weekly planner board with drag and drop (dnd-kit)

**Status:** Accepted

## Context
The product owner plans their week on paper: day columns, each todo placed in the day it will be done. A distinctive but clear UI was wanted. The data model already has a date-only `due_date`, so a day-based layout needs no new fields. The UI must stay accessible, testable with Playwright, and usable on phones.

## Problem it solves
How todos are presented and rescheduled.

## Decision
- A **weekly planner board**: Overdue, Mon-Sun (Monday start), Unscheduled (see spec section 1b).
- Move todos by **drag and drop (dnd-kit)**, the edit form's date picker, or a "Move to..." menu, with optimistic updates and rollback on failure.
- Fetch by **date range** (`dueFrom`/`dueTo`), plus `overdueBefore` and `unscheduled` scopes.
- Fixed in-column ordering: incomplete, then priority, then oldest created.
- One tag and one priority filter plus Hide completed; filters persist across weeks.
- Below 900px: a tab bar showing one column at a time, with drag disabled.

## Pros
- Reuses `due_date`, so no data model change; "move to a day" is a normal `PATCH`.
- Matches how the user really plans, and gives a more memorable demo than a plain list.
- Date-range queries are small and index-friendly (`(user_id, due_date)`), so they scale with 100k users.
- Overdue column keeps forgotten todos visible without the app changing user data.
- Non-drag alternatives keep the feature keyboard and touch accessible and give reliable test paths.

## Cons / tradeoffs
- More UI work than a list: drag and drop, optimistic updates, a second (tab) layout.
- Date logic is bug-prone (time zones, week boundaries); mitigated by plain dates, browser-supplied "today", and a fixed test clock.
- Fixed ordering means users cannot manually reorder within a day.
- Priority sorting is no longer user-selectable.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Simple list with sort and filter | Safest, but not distinctive and does not match how the user plans. |
| Priority Kanban (High/Medium/Low/Done) | Clashes with the priority field, pagination, sorting, and completion; the column meaning would fight the data model. |
| Status Kanban (To Do/In Progress/Done) | Needs a new `status` field and rewrites several stories. |
| Auto-roll overdue to today | Silently edits user data and loses the original date. |
| Overdue stays in its original day | Todos from past weeks disappear from view. |
| Manual drag-reorder within a day | Needs a position field, reorder API, and conflict handling; too much scope. |
| Drag only (no menu/picker) | Inaccessible by keyboard and unreliable on touch. |
| Horizontal scroll on phones / desktop only | Poor usability / looks unfinished on small screens. |

## Consequences
New API query scopes (spec section 4), new stories US11-US14, and Playwright tests with a fixed clock and a narrow viewport. Library: **dnd-kit** for drag and drop, chosen over HTML5 drag events because it supports keyboard and touch and works consistently with React.

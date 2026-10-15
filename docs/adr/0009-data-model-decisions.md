# ADR 0009: Data model decisions: per-user tags, fixed priority, hard delete with UI undo, offset pagination

**Status:** Accepted

Four small decisions recorded together.

## A. Tags are per-user

- **Problem:** Who owns tags?
- **Decision:** Each tag belongs to one user; names are unique per user.
- **Pros:** Privacy; one ownership rule (`user_id`) applies to all data; no shared-edit bugs; clean split by user if sharding is ever needed.
- **Cons:** Slight duplication of names across users.
- **Rejected:** Global shared tags. Rename/delete would affect other users, names could leak, and they need moderation.

## B. Priority is a fixed enum: low / medium / high

- **Pros:** Simple UI, one column, trivial sort/filter, clear tests.
- **Cons:** Not customizable.
- **Rejected:** Numeric 1-5 (ambiguous direction, false precision). Custom per-user levels (new table, settings UI, ordering logic; too much scope).

## C. Hard delete, with a 5-second client-side Undo

- **Decision:** `DELETE` permanently removes the row. The UI hides the todo and shows an Undo toast; the API call is only sent after 5 seconds without Undo.
- **Pros:** Simple queries and schema; small tables; real deletion for privacy.
- **Cons:** Closing the tab during the 5 seconds cancels the delete (fails safe: todo stays). Multiple tabs may briefly disagree.
- **Rejected:** Soft delete with restore endpoint (extra filter on every query, purge job, more tests).

## D. Offset pagination (`limit`, `offset`) for bounded lists

- **Update for the weekly board (ADR 0013):** the board fetches by date range, not by page. Offset pagination now applies only to the Overdue and Unscheduled lists ("Load more"), and caps the week fetch (limit max 200).
- **Pros:** Simple; easy to test.
- **Cons:** Slower on huge lists; items can shift if data changes while paging.
- **Why acceptable:** Every query is scoped to one user and indexed on `user_id`, so lists are small. Revisit with cursor pagination if a single list can reach millions of rows.
- **Rejected:** Cursor pagination (more complex than needed); no pagination (violates scaling requirement).

---
name: create-cards
description: >-
  Creates spaced-repetition flashcards as importable JSON for SpacedRepApp.
  Use when the user asks to generate flashcards, study cards, Anki-style
  cards, or JSON to import into SpacedRepApp / this spaced repetition app.
---

# Create cards for SpacedRepApp

Produce flashcards the user can import into SpacedRepApp.

## When to ask vs when to output JSON

1. If the user has **not** provided a topic, subject, or source notes: ask **one short question** for the topic and material. Do not output JSON yet.
2. Once you have enough input: respond with **only** a JSON object. No markdown fences, no commentary.
3. **Never** return an empty `"cards": []`. Default to **12** cards unless the user specifies another count.

```json
{ "cards": [ /* one or more card objects */ ] }
```

## Card shape

Each item in `cards`:

| Field | Required | Value |
|-------|----------|--------|
| `id` | yes | Unique UUID string |
| `level` | yes | `0` (Draft) |
| `data` | yes | `{ front, back }` |

Do **not** set `topicId` — the app assigns the open topic on import.

### Side shape

```json
{
  "side": "front",
  "blocks": [ /* ordered blocks */ ]
}
```

`side` must be `"front"` or `"back"`. Use the matching value on each side.

### Block types

**text** — rich HTML only (not Markdown):

```json
{ "type": "text", "html": "<p>Question?</p>" }
```

Allowed tags: `<p>`, `<strong>`, `<em>`, `<u>`, `<ul>`, `<ol>`, `<li>`, `<br>`. Escape `&`, `<`, `>` inside text.

**code** — language one of `js` | `ts` | `py` | `sql` | `sh`:

```json
{ "type": "code", "lang": "ts", "code": "const x = 1" }
```

**image** (optional) — public URL only:

```json
{ "type": "image", "content": { "src": "https://example.com/img.png" } }
```

Do **not** emit `audio` or base64/binary media buffers.

## Writing rules

1. One fact or concept per card.
2. Front = question or cue; back = answer or explanation (active recall).
3. Prefer short, clear wording.
4. Use `code` blocks for code; keep prose in `text` blocks.
5. Cover the user's material; do not invent unrelated topics.
6. Every card needs a unique `id` (UUID).

## Example

```json
{
  "cards": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "level": 0,
      "data": {
        "front": {
          "side": "front",
          "blocks": [
            { "type": "text", "html": "<p>What is spaced repetition?</p>" }
          ]
        },
        "back": {
          "side": "back",
          "blocks": [
            {
              "type": "text",
              "html": "<p>Reviewing material at increasing intervals.</p>"
            }
          ]
        }
      }
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "level": 0,
      "data": {
        "front": {
          "side": "front",
          "blocks": [
            {
              "type": "text",
              "html": "<p>How do you print Hello in Python?</p>"
            }
          ]
        },
        "back": {
          "side": "back",
          "blocks": [
            { "type": "code", "lang": "py", "code": "print(\"Hello\")" }
          ]
        }
      }
    }
  ]
}
```

## How the user imports

1. Save the JSON as a `.json` file.
2. Open a topic in SpacedRepApp → Settings → Import cards.
3. Choose the file. Cards land as Draft (`level` 0).

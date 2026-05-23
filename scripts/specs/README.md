# scripts/specs/ — bot specs that aren't built yet

Markdown specs for bots in the Kanzen roster that are deliberately NOT
built yet. Each spec documents architecture, env keys, schedule, money-
chain placement, kill-switches, and the build checklist. Build only when
prerequisites are met (see each file).

| File | Bot | Activate when |
|---|---|---|
| `bot-08-ad-creative.md` | Bot 8 · Ad Creative | ≥1 affiliate program is live AND has earned ≥1 commission |
| `bot-09-meta-poster.md` | Bot 9 · Meta Poster | Bot 8 has shipped first batch AND ledger destination decided |

When a spec gets built, move the spec INTO the script file (top-of-file
comment block) so the spec lives next to the code, and delete the .md.

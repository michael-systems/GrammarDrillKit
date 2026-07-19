# Phrasal Verbs integration checkpoint

Status: integrated and independently validated on branch `content/sol-ultra-1050`.

The next module in the required sequence is `conditionals`. Work is intentionally
paused at this boundary.

## Coverage

- Questions: 150
- Levels: easy 50, medium 50, hard 50
- Donor entries: 1–150 exactly once and in stable ID order
- Contexts: 10 contexts, 15 questions in each
- Question type: 150 multiple-choice questions with four unique options

Topic totals:

- movement-travel: 15
- entering-leaving: 13
- daily-routines: 15
- work-study: 15
- communication-information: 16
- relationships-social: 14
- problems-solutions: 15
- change-progress: 15
- objects-devices: 17
- plans-business: 15

The non-uniform topic totals reflect semantic reclassification found during
adversarial and blind review. The level-specific topic quotas in
`reports/content-blueprint.json` match the integrated content exactly.

## Editorial evidence

- Initial authored questions: 150
- Replacement candidates: 1
- Adversarial-editor decisions: 101 ACCEPT, 50 REWRITE, 0 REJECT
- Blind-examiner decisions across all cycles: 162 ACCEPT, 35 REWRITE, 1 REJECT
- Combined REWRITE decisions: 85
- Combined REJECT decisions: 1
- Fully replaced questions: 1 (`phrasal-verbs-012`)
- Unique donor entries corrected at least once: 51
- Final package result: 150/150 final ACCEPT

Corrected donor entries:

`002, 007, 008, 011, 012, 013, 024, 027, 028, 058, 062, 064, 066, 072,
073, 076, 081, 084, 085, 088, 090, 091, 093, 094, 101, 103, 105, 107,
108, 111, 112, 114, 116, 117, 120, 122, 124, 126, 128, 133, 134, 135,
136, 137, 139, 140, 141, 145, 147, 148, 149`.

Defect classes included second-answer ambiguity, regional ambiguity, form and
length clues, weak distractors, insufficient context, unnatural English,
translation mismatch, topic/context mismatch, cosmetic examples, and donor
provenance presentation.

Question 012 reached the three-cycle limit during final audit, received REJECT,
was discarded, and was replaced by a new candidate for the same learning slot.
The replacement separately passed author, adversarial-editor, and fresh blind
examiner stages.

## Independent semantic audit

- Questions rechecked: 150/150
- Donor-fidelity checks in the 001–100 audit: 800/800 passed
- Hard donor entries: 50/50, without gaps or duplication
- Exact duplicate prompts/examples: none found
- Repeated unordered option sets: three pairs, each occurring twice
- Heuristic pair review: all 6 affected questions accepted as semantically
  distinct and unambiguous

Reviewed repeated-option pairs:

- 001 / 068: `give up` versus `carry on`
- 058 / 126: `put on` versus `do up`
- 002 / 085: `pick up` versus `put down`

## Automated verification

- `node scripts/validate-content.mjs --module phrasal-verbs`: PASS
- Validator totals: 1 module, 150 questions, 0 errors, 3 reviewed heuristic warnings
- Six package validators: PASS, 0 errors, 0 warnings
- Six reconciled blind ledgers: PASS, 25 final ACCEPT slots each
- `node --test`: PASS, 40 passed, 0 failed
- Product-shell gate for the fixed `Made by M` credit: PASS

The strict all-content validator still targets the final 10-module/1050-question
state. At this checkpoint only Phrasal Verbs is complete; the remaining nine
modules retain `planned` status.

## Integrated and supporting files

- Production: `src/modules/phrasal-verbs.js`
- Registry: existing first-position `phrasal-verbs` registration retained
- Blueprint: `reports/content-blueprint.json`
- Module validator report: `reports/phrasal-verbs-validator-report.json`
- Progress checkpoint: `content-work/manifest.json`
- Reusable validators and editorial-ledger utilities: `scripts/`
- Phrasal module regression coverage: `tests/phrasal-verbs-module.test.mjs`
- Product credit correction: `index.html`, `styles.css`

No push, pull request, merge, or remote-branch mutation was performed.

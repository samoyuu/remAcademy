# About the learning system

*This app is indeed Claude Coded, however, it still revolves around manual synthesis and curation of flashcards.*

A MathAcademy-style prerequisite tracker for RemNote flashcards. It organizes your cards into
**Learning Points** (one atomic concept/definition/derivation/example/problem each), tracks
mastery from your own review grades, and automatically locks Problem-skill cards until their
prerequisite Learning Points are mastered.

Each learning point should be an atomic-level detail that revolves around 1-2 flashcards. They are organised
into categories that align with what you'll create flashcards for in a general science textbook, including
problems and exercises. The system aims to ensure you've mastered the relevant learning points before showing
you problems, to avoid having to backtrack on your learning and second-guessing what you have(n't) learned.
For me, I generate the knowledge graph via Claude, and I write flashcards based off of the learning points
generated when I go through a textbook or set of notes. This helps me stay focused on the content without
worrying about what to include/not include, and I find it generally does a good job of identifying the key 
learning points.

Thus, the philosophy of this plugin is to leverage LLMs to enable active learning. Instead of passively consuming
lecture notes and videos, the focus is on proactively mapping out the learning requirements and key
points of each topic. Combined with spaced repetition and deliberate practice in RemNote, 
the goal is to ensure a more thorough and deeper understanding of a subject.


## How it works

*Note that I've mainly used Claude to generate the knowledge graphs, so this is more for an agent to read!*

1. **Author a subject file** at `src/data/subjects/<Subject>.json` - a flat list of Learning
   Points (id, chapter/section, type, description) plus a `prerequisites` graph (which LP ids
   require which other LP ids to be mastered first). See `src/data/subjects/QM.json` for a real
   example.
2. **Import it**: run `LS: Import — <Subject>` (or `LS: Import Learning Points (All Subjects)`)
   from RemNote's command palette. This builds a Chapter → Section → Learning Point outline and
   tags each Learning Point with its metadata.
3. **Write your flashcards** under each Learning Point bullet, same as any other RemNote card.
4. **Recompute**: run `LS: Recompute All Learning Point Progress` (or hit Refresh in the
   dashboard). This is the only point where gating actually updates - it recomputes every
   Learning Point's mastery from its own cards, then locks/unlocks Problem-skill cards based on
   whether their prerequisites are mastered. Concept/Definition/Derivation/Example cards are
   always left unlocked.
5. **Review normally.** As you grade cards, each Learning Point's mastery updates automatically;
   run Recompute All again (e.g. at the start of a study session) to propagate newly-mastered
   prerequisites into newly-unlocked Problem-skill cards.

### Slow-track scheduling

Learning Points whose id looks like `<chapter>.P<n>` (e.g. `6.P3`), i.e. tagged as problems,
follow a slower scheduler (starting from 5 days, with a 2.5x multiplier) with less frequent
repetitions to avoid excessive repetitions of problems.
Everything else uses RemNote's normal scheduling.

## Commands

- `LS: Import Learning Points (All Subjects)` - import every file in `src/data/subjects/`.
- `LS: Import — <Subject>` - import just one subject file (auto-registered per file).
- `LS: Add Learning Point` - popup form to create a single Learning Point without editing JSON.
- `LS: Remove Learning Point (Focused Rem)` - deletes the currently-focused Learning Point and
  its child cards. Click into the Learning Point bullet first.
- `LS: Recompute All Learning Point Progress` - full rescan; also what the dashboard's Refresh
  button runs.

## Future plans

Not really.

This is a (fairly) simple implementation of the effective learning principles outlined in
the Math Academy Way, for my own purposes (self-learning university physics). Something as complex
as the adaptive learning system in MA is probably far too complicated to replicate and not worth
the effort and tokens. Instead, this is meant as a bridge from classical learning through textbooks
and lectures, and implement a basic structure to guide your own learning.

## Dashboard

A widget listing every Learning Point with its subject, mastery status/percentage,
prerequisites, and description, filterable by subject and searchable by id/text.

## Data privacy

This plugin makes no network requests and does not send any data to any third-party service. All
reads/writes go through RemNote's own plugin API, on your own knowledge base.

## Permissions

Requests `ReadCreateModifyDelete` on all Rem. Create/Modify are used to build the Learning Point
outline and write mastery properties; Delete is used only by the explicit
`LS: Remove Learning Point` command (RemNote never deletes anything on its own).

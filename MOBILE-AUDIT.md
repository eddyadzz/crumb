# Mobile audit checklist (run before each beta wave)

Test on a real budget Android (e.g. 360 × 740, Chrome, throttled to slow 3G).

## Per-screen checks

- [ ] Text readable at 360px without horizontal scroll
- [ ] Primary action reachable with a thumb (bottom third of screen)
- [ ] Tap targets ≥ 44px (buttons, steppers, list rows)
- [ ] No `overflow-x` scroll on cards/tables (tables wrap or scroll inside their own container)
- [ ] Modals scroll internally (max-h + overflow-y) and don't trap the page
- [ ] On-screen keyboard doesn't cover the focused input (forms use `Enter` to submit)
- [ ] Sticky elements (headers, sync pill) don't overlap the first control
- [ ] Charts and selects degrade gracefully when narrow

## Known-good patterns in this codebase

- Mobile bottom nav = daily loop (Home / Orders / Produce / Sell / Recipes); everything else in the More sheet
- Floor Mode `/floor` runs outside the app shell full-screen with `h-16`/`h-14` steppers
- Lists reflow `sm:grid-cols-*`, tables inside overflow containers (Pricing, Reports)
- Dialogs use `max-h-[90vh] overflow-y-auto`

## Known risks to verify on device

- Settings page is long — confirm per-card spacing holds on small screens
- Orders cards stack badge rows; check sum rows wrap at 360px
- Schedule month view: cells are compact tap targets (verify ≥40px effective hitbox)
- Reports Cost-Variance table inside its own scroll container — verify scrollbar visibility

## How to test

1. Chrome DevTools device mode: 360×740, DPR 3, slow 4G.
2. Real device: open every nav item once, complete one full order → produce → sell loop.
3. Note anything that needs a second attempt to tap; those go straight to the fix list.

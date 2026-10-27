# 29. Apple and Notion standards: what Greecon adopts, and how it is checked

Status: written 2026-10-27. The founder asked for the platform to be finished to "Apple standards" and "Notion principles".
Neither is a checklist, so this page says which parts are **real rules** for a monitoring product used by a hotel owner, a
farmer and a project manager on a phone, which parts are the taste of two companies making different things, and **how each
rule is measured** (`scripts/e2e/a11y-audit.cjs`). The sources, with what each says in its own words and how far to trust
it, are in [research/10-apple-notion.md](research/10-apple-notion.md). It builds on document 28 (what every screen is for)
and document 20 (how the product behaves); where it changes them, they have been changed.

Nothing here has been tested with a screen reader or on a real phone in sunlight (section 6 says so). It has been measured,
page by page, in a real browser, in each of the settings a person's own device can be in.

## 1. The decision

Apple publishes written guidelines; Notion publishes a help centre and one engineering article. Greecon takes from each the
parts that are **a rule a script can check, or a behaviour a person can see**, and leaves the rest.

| From | Taken | Left |
|---|---|---|
| **Apple** | Text that follows the person's size. Contrast in every setting. Targets a thumb can hit. A keyboard that reaches everything and shows where it is. Following the device's light/dark, contrast and motion settings, with no switch of our own. Feedback that matches how serious the news is, and never disappears by itself. An empty section that explains itself. | Liquid Glass and materials, SF Symbols, haptics, Siri, gestures (nothing here needs one), App Store accessibility labels |
| **Notion** | One box that finds anything by its name, opened from anywhere by one key. One pattern for one kind of thing, wherever it appears. A blank page that says what to do first. Templates as the way to start (site kinds already are). Progressive disclosure. | The workspace model, content search, recents and favourites (a client has tens of sites, not thousands of pages), the slash menu, inline editing, the in-app theme switch |

Where the two disagree, **Apple wins on appearance** (follow the system, no switch: a second setting is "more work, and a
way to think the app is broken") and **Notion wins on search** (a visible button *and* a key).

## 2. The rules

Each rule has a number, so that a commit, an audit finding and a page of the manual can point at it.

| # | Rule | Where it lives | How it is checked |
|---|---|---|---|
| **S1** | **Text follows the person's size.** Every size is in `rem`, the body is `1rem`, so the browser's text-size setting (and a phone's) enlarges all of it together, and at 200 % nothing is cut off, scrolls sideways or lands on other text. A drawing scales with its box. | `globals.css` (`body { font-size: 1rem }`) | audit: text at 200 % (sideways scroll, cut-off words, text on text, text that did not grow) |
| **S2** | **Contrast** 4.5:1 for text, 3:1 for controls and graphics, in the light, in the dark and with Increase Contrast; small text aims at 7:1 in the dark. Status is a word and a shape as well as a colour. | tokens in `globals.css` (`:root`, dark, contrast) | axe `color-contrast` in each setting; pairs computed from the tokens for what axe cannot read (drawings, text made by CSS) |
| **S3** | **Targets** at least 44 px on a phone (WCAG's own floor is 24), with room between them. A heading that opens a section is a target. | phone rules at the end of `globals.css` | audit: touch |
| **S4** | **The keyboard reaches everything and shows where it is.** A skip link first where anything repeats; a visible change at every stop; nothing under the bar at the foot of a phone; Escape closes a menu and the search and gives the focus back; no key traps. | `Frame`, `DismissMenus`, `:focus-visible`, `scroll-padding` | audit: Tab walk (a picture of each kind of control with and without focus), skip link, menu, search |
| **S5** | **Quick find.** Ctrl+K (Command+K), or `/`, or the Search button, opens one box. It finds a page (only those the person's role may open), a site, for Greecon's team a client or a request, and an action ("Add a site", "Onboard a client"), by what they remember of the name: any order, without accents or capitals. Results by relevance, the name first. | `QuickFind`, `lib/places.ts`, `app/quick-find/actions.ts`, `packages/shared/src/quick-find.ts` | unit tests of the matching; audit: it opens, is named and modal, holds the focus, and Escape closes it |
| **S6** | **Follow the device's light or dark**, live, with no switch of Greecon's own. A surface that is above another is *lighter* in the dark (Apple's "elevated"). The page says it supports both, so scrollbars and form controls follow, and the browser's bar takes the page's colour. Print is always light. | `color-scheme`, dark tokens, `viewport.themeColor` | audit: the page follows; axe in the dark; pictures of every page |
| **S7** | **Increase Contrast** is honoured: stronger lines and words, thicker focus mark. | `@media (prefers-contrast: more)` | axe and pictures in that setting |
| **S8** | **Reduce Motion** is honoured: nothing repeats, nothing longer than a short fade. The one animation that carries meaning, the energy flow, is also said in words. | `prefers-reduced-motion` rules | audit: what is still moving |
| **S9** | **Forced colours** (Windows high contrast): what colour said is also a line or a mark. | `@media (forced-colors: active)` | pictures, by eye |
| **S10** | **Feedback is as loud as the news.** Status is passive and next to what it describes; an alert is for what needs a person. A message stays until it is closed or the person goes on (nothing is dismissed by a timer). A refusal says why and what to do, in words that fit the reason (a suspended account, too many attempts, a platform that did not answer, each its own; a wrong password and an unknown address say the same, so that nothing is learned about which accounts exist). A consequential action names what it will do and asks once; what is not available is dimmed. | the patterns of document 28, section 5 | `a11y-audit.cjs` reads the source: every timer in the web app is one of three known ones (the search's short wait, "5 minutes ago" re-drawn, the page re-fetched), and any other is a finding; `field-trouble.cjs` runs a refusal and a consequential action in a browser |
| **S11** | **A place with nothing in it explains itself**: what would be here, why it is not, who is doing what next, and the one thing to do now. A section is never disabled or hidden because it is empty. | `FirstRun`, the site page's "Being set up", each page's empty line | `scripts/e2e/first-day.cjs` |
| **S12** | **Progressive disclosure.** The answer first; the working one click further; the machinery only for those who set things up. | document 28 | review |
| **S13** | **One pattern for one kind of thing.** A site is the same row in Sites, in the finder and on the Overview; one status badge, one table, one section; the same words for the same place. | shared components | audit: names (no "here", "more", "view"; the same words never go to two places) |
| **S14** | **Every page has a title, a language, one main heading and landmarks.** | `layout.tsx`, `Frame` | axe |

## 3. What was found, and what was done

The audit (`scripts/e2e/a11y-audit.cjs`) visits every page as the Greecon team, as a client's administrator and as the demo login, and the
public pages, on a desk and on a phone, in the light, in the dark, with Increase Contrast, with Reduce Motion, at 200 % text and at
320 px. The first run found **223 distinct findings**; by kind:

| Kind | Before | What it was | What was done |
|---|---|---|---|
| Dark mode | every page | the page stayed light when the device was dark; the page did not say it supports a dark scheme | dark tokens, `color-scheme`, `theme-color`; surfaces lighter when above |
| Quick find | missing | no search; no key | built (S5) |
| Text size | 36 kinds of text | the body was `16px`, so every size that inherited it ignored the person's text setting, and at 200 % titles stayed small beside chips that doubled: the hierarchy broke | the body is `1rem` (S1) |
| Keyboard | 45 | the bar at the foot of a phone covered whatever the Tab key scrolled to the bottom (WCAG 2.4.11); Escape did not close the person's menu or a row's "More"; no skip link was ever tested to work | `scroll-padding`; `DismissMenus`; tested |
| Touch | 17 | headings that open sections were 33 px, checkbox rows 24 px, a "People" summary 22 px (under WCAG's floor) | 44 px on a phone |
| Reflow at 320 px | 20 | a long address or domain in a card widened the page | cells break long words |
| Names and landmarks | 6 | "Details →" twice for two sites; "Reports" meaning two places; empty table headings; the demo banner outside any landmark | hidden words name the site; the Help sentence follows the person's role; headings say "Actions"; the banner is a landmark |
| Pages | 3 | Privacy had no bar for a signed-in person; Trends and Downloads were both "Reports" | Privacy draws inside the app; each tab is titled by its own name |

The second run, after the changes, found **20**, all but a few measurement artefacts that were then removed from the audit itself
(a skip link still sliding away when the next stop was measured; content inside a closed disclosure counted as on screen).
The third found **11**, all at 200 % text or 320 px: some real (the equipment cards on the site page ran over each other, the circle
that holds a person's initials was too small for them, the sidebar was a fixed 240 px, a long address widened the handover sheet) and
some the audit's own error (a phrase that wraps has a box that takes in the words beside it, so the check now measures each line of
words, and also reports words that spill out of their box). The final figures are in section 7.

### What trouble showed

The audit looks at pages as they are. Running trouble at the platform (`scripts/e2e/field-trouble.cjs`: a client suspended and turned
back on, a box gone silent) found what no page-by-page measurement could, because it is about what happens next
(finding 96 of document 18): a person at a suspended client was told their password was wrong; "Suspend this client" asked nothing though
it signs everyone out and stops the alert messages; a control that cannot be used looked like one that can; a row's menu was cut off by
its own table; and the text about a silent box said "at once" where the platform waits through the team's quiet hours. Each is fixed and
is now a step of that script.

## 4. What was not adopted, and what would change that

| Not adopted | Why | What would change it |
|---|---|---|
| An in-app light/dark switch | Apple: it is more work and makes people think the app is broken; the founder's customers have already chosen on their device | A customer asking for the opposite of their device, with a reason |
| Recents, favourites, "pin a site" | A client has a few sites; the finder reaches any by name in two key presses | An account with more than about ten sites |
| Content search, filters, sorting in the finder | There are no pages of content to search | A page of free text that people write (notes on a site) |
| The slash menu | Nothing is typed into a page | Notes or comments on a site |
| Liquid Glass, blur and transparency materials | They lower contrast and are a problem for Reduce Transparency; the design is flat and warm by brand (document 6) | None |
| Confirming twice (Apple's Assistive Access advice) for what is hard to recover | One clear confirmation that names the thing is kept; deletes ask once | A deletion people regret |
| An Outdoor mode (document 20, section 10) | Increase Contrast now gives text at higher contrast, but a phone in direct sun needs measuring on real phones | Midday legibility failing on real phones |
| Greenhouse climate (vapour-pressure deficit, ventilation) | No agronomist-set numbers exist in the sources (document 19) | Growers asking, with their own targets |

## 5. How to check it

```bash
npm run build
bash scripts/e2e/live-up.sh > /tmp/up.log 2>&1 && node scripts/e2e/pm-e2e.cjs     # a client with a site and a box to look at
PLAYWRIGHT_MODULE=… AXE_MODULE=… node scripts/e2e/a11y-audit.cjs [folder]          # the audit (A11Y_STRICT=1 makes a finding fail it)
node scripts/e2e/field-trouble.cjs                                                 # trouble at a customer: a client suspended and turned back on, a box gone silent
bash scripts/e2e/live-down.sh && bash scripts/e2e/live-up.sh > /tmp/up.log 2>&1 && node scripts/e2e/first-day.cjs   # an empty platform, a first day
node scripts/run-smoke.mjs smoke-sites.mjs                                          # four kinds of site from zero, with the real installer and a real box
```

`A11Y_SHOTS=1` keeps a picture of every page in each setting; `A11Y_ONLY=axe,keyboard` and `A11Y_PAGES=sites` narrow a run.
Neither Playwright nor axe-core is a dependency of the repository (`npm i -g playwright axe-core`).

## 6. Not checked, and said so

- **A screen reader.** axe checks names, roles and structure; it cannot say whether the page *reads* well. A pass with VoiceOver on an iPhone
  and NVDA on a desk is the first thing to do with the first customer's own phone.
- **A real phone in sunlight**, and **gloves and wet hands** (document 20, section 5).
- **Forced colours** was looked at in pictures, not measured.
- **The energy-flow drawing and the charts**: axe cannot read text inside drawings. Their colours were computed from the tokens, and the sentence beside the
  energy picture says everything the drawing does.
- **Albanian.** The interface is English (document 27, L12); the rules above hold for any language, but line lengths and the finder's matching were
  tested only on English words and on Albanian place names (Durrës, Vlorë, Lushnjë).

## 7. Result

Measured on 2026-10-27 on the built platform, with the project manager's hotel in place (a client with a site and a box that has gone
quiet), as the Greecon team, as a client's administrator, as the demo login, and signed out:

| What was looked at | |
|---|---|
| Pages | **38**: 9 as the demo, 9 as the team, 16 as a client's administrator, 4 public; each on a desk and on a phone |
| Settings | the light, the dark, Increase Contrast and forced colours (a picture of each page, 220 in all), Reduce Motion, text at 200 %, 320 px wide |
| Checks | axe (WCAG 2.2 A and AA, and best practice), a Tab walk of every page, quick find, contrast, touch targets, names, motion, text at 200 % (cut off, sideways, overlapping, spilling out of its box), reflow at 320 px, and the source for timers |
| **Distinct findings** | **0** (223 at the start of the work; 20, then 11, as the standards were built; the checks themselves were then made stricter, and found two more real faults, the top bar of a phone at 320 and 390 px and the numbered circle of the setup list at 200 %, which were fixed) |

The journeys that run beside it, on the same build: the project manager's whole job in a browser **82 of 82**; the Greecon team's **24 of 24**;
a customer's first day on an empty platform **33 of 33**; trouble at a customer (a client suspended and turned back on, a box gone silent)
**29 of 29**; every screen as three kinds of person, on a desk and on a phone, **no findings**. Four kinds of site from zero, with the real
installer and a real box, **all checks passed**.

What "0" does and does not say. It says that every page, in every setting of the person's own device listed above, passes the checks above. It
does not say that the pages are pleasant to use with a screen reader, in sunlight, with wet hands or in Albanian (section 6), and the checks are
a script's reading of a page: a rule it does not have, it cannot break. The colour of text inside a drawing (the energy picture, the charts)
was computed from the tokens, not measured, and is listed by the audit each time (`Contrast axe could not measure`).

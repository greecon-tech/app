# Greecon Platform: Apple Human Interface Guidelines and Notion Principles, Desk Research (10-apple-notion)

> **Desk research, 27 October 2026. Not reviewed by a designer or an accessibility specialist, and not legal, engineering or safety advice.**
> Written from public pages read on the date above. Quotations are short and exact; everything else is paraphrase, and
> inference is labelled. Where a source could not be read, the text says so. The decision this research led to is
> [29 Apple and Notion standards](../29-apple-notion-standards.md); how far the platform meets it is measured by
> `scripts/e2e/a11y-audit.cjs`.

Confidence tags: High / Medium / Low. Source IDs in [brackets] resolve in section F.

## A) What was asked, and how it was answered

The founder asked for the platform to be finished to "Apple standards" and "Notion principles". Neither is a checklist, so the
first job was to find what each one actually says in writing, then decide which parts are real rules for a monitoring product
used by a hotel owner, a farmer and a project manager on a phone, and which are the taste of two companies making different things.

- **Apple.** The Human Interface Guidelines are public. The pages for accessibility, dark mode, color, typography, motion, layout,
  tab bars and feedback were read in full on the date above [HIG-A] to [HIG-F]. They are written for Apple's own platforms;
  the *principles* transfer to a web app, the *components* (SF Symbols, Liquid Glass, Dynamic Type's system setting) do not.
- **Notion.** Notion publishes no design guidelines. What is public is its help center (what the product does and which keys it
  defines) [N-SEARCH] [N-KEYS] [N-SLASH] and one engineering article on its data model [N-BLOCKS]. Anything about *why* it feels the way it does
  comes from third-party analyses, which are marketing-adjacent (several are published by onboarding-tool vendors) and are
  tagged Low [N-3P]. Nothing below is attributed to Notion that Notion did not publish.
- **A measurable translation.** A standard that cannot be checked is a mood. Every adopted rule is paired with a number or a
  behaviour a script can test (section E), using WCAG 2.2 [WCAG22] where Apple points at it: Apple's own accessibility page
  quotes WCAG AA contrast values [HIG-A].

## B) Apple: what it says, and what transfers

**Accessibility [HIG-A] (High).**

| Apple says | Transfers as | Notes |
|---|---|---|
| "Ideally, give people the option to enlarge text by at least 200 percent" | Text sized in `rem`, layout intact at 200 % | Web equivalent of Dynamic Type: the person's browser or phone setting |
| Contrast: 4.5:1 up to 17 pt, 3:1 at 18 pt or bold | WCAG 2.2 AA (1.4.3, 1.4.11) | "If your app supports dark mode, make sure to check the minimum contrast in both light and dark appearances" |
| "If your app doesn't provide this minimum contrast by default, ensure it at least provides a higher contrast color scheme when ... Increase Contrast is turned on" | `prefers-contrast: more` | |
| "Convey information with more than color alone" | Status is a word and a shape as well as a colour | Already the rule (docs/20, four states) |
| iOS default control size 44 x 44 pt, minimum 28 x 28 pt; about 12 pt of space round a bezelled control | 44 px targets on a phone; WCAG 2.5.8 floor is 24 px | WCAG's own AAA target (2.5.5) is 44 px |
| "Let people use the keyboard alone to navigate and interact with your app"; "Avoid overriding system-defined keyboard shortcuts" | Everything reachable by Tab; a visible focus mark; shortcuts that do not collide with the browser's | Cmd/Ctrl+K and "/" are free in browsers |
| "Minimize use of time-boxed interface elements. Views and controls that auto-dismiss on a timer can be problematic ... Prefer dismissing views with an explicit action" | No toast that disappears on its own; a message stays until it is closed or the person moves on | WCAG 2.2.1 (timing) says the same |
| Reduce Motion: reduce "automatic and repetitive animations, including zooming, scaling, and peripheral motion"; replace transitions with fades | `prefers-reduced-motion` | The energy-flow picture is the one animation that matters |
| Assistive Access: "Identify the core functionality of your app and consider removing noncritical workflows"; "Break up multistep workflows so people can focus on a single interaction per screen"; "ask for confirmation twice" for what is hard to recover from | Already how the setup list and deletes work; kept as a rule | |

**Dark Mode [HIG-D] (High).**

- "Avoid offering an app-specific appearance setting ... they may think your app is broken because it doesn't respond to their
  systemwide appearance choice." So: follow the system, no toggle. (Notion does the opposite: it has its own switch, Cmd/Ctrl+Shift+L [N-KEYS]. This is a place where the two sources disagree; section D.)
- "Ensure that your app looks good in both appearance modes", including the *Auto* setting, which "switches ... as conditions change throughout the day, potentially while your app is running". So the page must restyle live, with no reload.
- Contrast: "no lower than 4.5:1"; "strive for a contrast ratio of 7:1, especially in small text".
- Depth in dark: "base" and "elevated" backgrounds: "the elevated colors are brighter, making foreground interfaces appear to advance". So a card or a menu is *lighter* than the page in the dark, the reverse of a shadow.
- "Soften the color of white backgrounds" for images; "avoid using hard-coded color values or colors that don't adapt". Increase Contrast in dark mode "can result in reduced visual contrast between dark text and a dark background": test the pair, not each alone.

**Color [HIG-C] (High).** "Avoid using the same color to mean different things"; "Make sure all your app's colors work well in light, dark, and increased contrast contexts"; "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information"; "Avoid using only color to indicate focus" (visionOS section, but the point holds). Status colours are semantic tokens, never one-off values.

**Typography [HIG-T] (High).** iOS default 17 pt, minimum 11 pt. "In general, avoid light font weights." "Keep text truncation to a minimum as font size increases"; "Increase the size of meaningful interface icons as font size increases." "Maintain the relative hierarchy and visual distinction of text elements when people adjust text sizes."

**Motion [HIG-M] (High).** "Add motion purposefully, supporting the experience without overshadowing it." "Make motion optional ... avoid using it as the only way to communicate important information." "Generally avoid adding motion to UI interactions that occur frequently." "Let people cancel motion ... don't make people wait for an animation to complete".

**Feedback [HIG-F] (High).** "The most effective feedback tends to match the significance of the information to the way it's delivered": status is passive and near the thing it describes; "alerts" interrupt and are for what is critical and actionable; "don't warn people when data loss is the expected result of their action"; "Show people when a command can't be carried out and help them understand why"; confirm completion only for what matters, "because people typically expect their action or task to succeed, they only need to know when it doesn't."

**Tab bars [HIG-B] (High).** "Use a tab bar to support navigation, not to provide actions." "Make sure the tab bar is visible when people navigate to different sections." "Don't disable or hide tab bar buttons, even when their content is unavailable ... If a section is empty, explain why its content is unavailable." "Include tab labels", "single words whenever possible". "Reserve badges for critical information so you don't dilute their impact." Fewer tabs are easier; "avoid overflow tabs". The platform's two bars of five labelled places already follow these; the point that is new is the *empty section explains itself*.

**Layout [HIG-L] (High).** "Order content by relative importance"; "Group related items"; "Use progressive disclosure to make layouts cleaner and easier to interact with". This is the answer-first rule already in docs/20.

**What does not transfer (inference, Medium).** Liquid Glass, SF Symbols, haptics, Siri and Shortcuts, gestures (the product has none a person must learn), Dynamic Type as a system API (the web equivalent is the browser's font setting and `rem`), App Store accessibility nutrition labels.

## C) Notion: what it publishes, and what transfers

**Search is the front door [N-SEARCH] (High).** Opened from "Search at the top of the sidebar, or press cmd/ctrl + P, or cmd/ctrl + K when your cursor isn't in a block". It searches "page titles and the content inside pages". "Opening the search window shows recently visited pages". Results are "Best Matches" first: "title matches usually outrank matches in page content" and recently edited ranks higher. It has filters (title only, created by, in, date). *Transfers:* a global key, a visible Search control, titles first, a useful empty state. *Does not:* content search, filters and recents are for a workspace of thousands of pages; this product has tens of sites.

**One key opens it from anywhere [N-KEYS] (High).** Notion defines Cmd/Ctrl+K and Cmd/Ctrl+P for search, `[` and `]` with the modifier for back and forward, and Cmd/Ctrl+Shift+L for light/dark. The page defines no shortcut for the sidebar or for listing the shortcuts (checked; "not listed").

**The slash menu [N-SLASH] (Medium).** "Press the slash key, then choose or type the content type" ("/image"); it exists to "add your content even faster". The help page says nothing more about filtering or principle. *Transfers:* "/" as a second way into the same finder. *Does not:* inserting content blocks (nothing is typed into pages here).

**Everything is a block [N-BLOCKS] (High).** "Everything you see in Notion is a block"; blocks have one structure (id, properties, type, children), changing the type "only alters how it's rendered", and permissions flow from the parent. *Transfers as a principle, not a feature:* one object model and one pattern for everything of a kind, so what a person learns once works everywhere. That is already how the product treats a site, a device and a reading (docs/02, docs/28); the new point is that *lists of things look and behave the same way wherever they appear* (a row in Sites, in Requests and in the finder is the same row).

**Templates and the blank page [N-3P] (Low; secondary).** Several analyses say the same thing: a blank page frightens, so Notion pairs minimal chrome with starter templates and a short first-run, and an empty state should "explain what belongs there, show how to fill it, and offer a starting action" (a summary of Nielsen Norman Group's view, quoted second-hand). *Transfers:* the product already has the templates (site kinds) and the setup list; what it lacked was that a **new, empty account says what happens next** (section of docs/29).

**What does not transfer (inference, Medium).** The workspace model (teamspaces, sharing, public pages), database views, AI, inline editing of page content, the in-app theme switch.

## D) Where the sources disagree, and what was decided

| Question | Apple | Notion | Decision |
|---|---|---|---|
| Dark and light | Follow the system; no app setting [HIG-D] | Own switch, Cmd/Ctrl+Shift+L [N-KEYS] | **Follow the system, no switch.** A hotel owner on a phone has already chosen; a second setting is "more work" and a way to think it is broken. Revisit only if a customer asks for the opposite of their system |
| Many entry points to search | A search field in the toolbar or a trailing search tab [HIG-B] | Sidebar button plus keys | **A visible button and the keys**, because a button is the only thing a first-time phone user will find |
| Feedback | Passive status, interrupt only for critical [HIG-F] | Quiet, inline | **Inline and persistent**; no timed pop-ups (also [HIG-A]) |
| Density | Spacious, 44 pt targets [HIG-A] | Compact, mouse-first | **Spacious on a phone, compact on a desk**: the product is used by thumb in a plant room and by mouse in an office |
| Onboarding | Learn by doing, minimal tours | Templates plus a short survey | **No tour. A new account explains itself where it is empty** |

## E) Measurable form (what a script can check)

| Rule | Check | Threshold |
|---|---|---|
| Contrast, light and dark | axe `color-contrast`, both schemes | 4.5:1 text, 3:1 large text and controls; no "could not be measured" left unreviewed |
| Text at 200 % | Set the root size to 200 %, then look for sideways scroll, cut-off words, text on text, and text that did not grow | none |
| Reflow | Page at 320 px | no sideways scroll outside a table or a code block |
| Targets | Phone | at least 44 px on every standalone control (24 px is the hard floor) |
| Keyboard | Tab walk | skip link first and working; a visible change at every stop; nothing hidden under a fixed bar; Escape closes the menu and the finder |
| Motion | `prefers-reduced-motion` | nothing repeating, nothing longer than 300 ms |
| Appearance | `prefers-color-scheme: dark`, `prefers-contrast: more`, `forced-colors: active` | the page restyles and stays legible in each |
| Names | All links and buttons | no "here", "more", "view" alone; the same words never go to two places |
| Structure | axe | language, title, one `h1`, landmarks, heading order |
| Feedback | Source scan | no timer closes a message |

## F) Sources

| ID | Source | Read | Used for |
|---|---|---|---|
| HIG-A | Apple, Human Interface Guidelines, Accessibility (developer.apple.com/design/human-interface-guidelines/accessibility) | 27 Oct 2026, Apple's public content endpoint | Section B |
| HIG-D | Same, Dark Mode | same | B |
| HIG-C | Same, Color | same | B |
| HIG-T | Same, Typography | same | B |
| HIG-M | Same, Motion | same | B |
| HIG-F | Same, Feedback | same | B |
| HIG-B | Same, Tab bars | same | B |
| HIG-L | Same, Layout | same | B |
| N-SEARCH | Notion Help Center, "Search" (notion.com/help/search) | 27 Oct 2026 | C |
| N-KEYS | Notion Help Center, "Keyboard shortcuts" (notion.com/help/keyboard-shortcuts) | same | C, D |
| N-SLASH | Notion Help Center, "Using slash commands" (notion.com/help/guides/using-slash-commands) | same | C |
| N-BLOCKS | Notion Blog, "The data model behind Notion's flexibility" (notion.com/blog/data-model-behind-notion) | same | C |
| N-3P | Third-party analyses of Notion's onboarding and empty states (Candu, Appcues, an onboarding newsletter, a UX Design article citing Nielsen Norman Group), found by search | same, search snippets only | C (Low confidence, not relied on for any rule) |
| WCAG22 | W3C, Web Content Accessibility Guidelines 2.2 (w3.org/TR/WCAG22) | cited from the literature, not fetched in this run | E: 1.4.3, 1.4.4, 1.4.10, 1.4.11, 2.2.1, 2.4.11, 2.5.8 |

**Not found.** Notion's own statement of design principles (it publishes none). Apple's guidance on web apps specifically (the
guidelines are for its platforms; transfer is by principle).

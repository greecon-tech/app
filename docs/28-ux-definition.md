# 28. The experience, defined: for Greecon's team and for clients

Status: written 2026-10-25 from a screen-by-screen look at the running platform (desktop and phone, as the team, as a
client's administrator and as the published demo login; `scripts/e2e/ux-tour.cjs` repeats the look). It builds on, and
does not replace, `docs/06-frontend-design-system.md` (the brand: colour, type, spacing, icons) and
`docs/20-design-and-interaction.md` (how the product behaves: answer first, four states, three priorities, safe
interaction). This page says **who sees what, where it lives, and what every screen is for.** Where it changes
document 20, document 20 has been changed to match (section 6, Navigation).

Nothing here has been tested with real users yet; document 20, section 9, says how to. It has been checked against
what a person can get wrong without a user: sideways scrolling on a phone, controls without names, small tap targets,
low contrast, and every journey in `scripts/e2e`.

## 1. Two products in one application

Greecon has two kinds of user whose days have nothing in common, and until now both got the same screens.

| | **Greecon's team** (the founder, the project manager) | **A client** (owner, administrator, operator, viewer, auditor) |
|---|---|---|
| Their question | "Is every customer all right, and what do I have to do today?" | "Is my site all right, what needs me, and what is it worth to me?" |
| Their day | Morning check at a desk, then a customer's plant room with a phone and a laptop | A glance on a phone, an email at night, now and then a look at the numbers |
| Their words | Clients, requests, setup, box | Sites, alerts, savings |
| What they must never see | Nothing is hidden from them, but nothing they do not need is in front of them | The machinery: assets, devices, registers, simulated controls |
| Sign-in | "Greecon team" | "Client login" (the choice is on the sign-in page and stays) |

When the team works **inside** a client's account (to set it up or to help), it sees that client's screens with a
banner that says so, plus the setup tools. The client's own people never see the setup tools unless their role may
change equipment (owner, administrator), and then they sit one step away from the everyday screens.

## 2. Principles added to the five in document 20

6. **Only what this person needs, here.** A screen is for one question. What belongs to another question, or another
   person, is somewhere else, not collapsed beneath.
7. **Greecon reads, it does not control.** No control, rule or "run" button appears while no command reaches
   equipment (`docs/27`, L13). A simulated control in front of a customer is a promise Greecon cannot keep.
8. **No placeholder is ever shown.** A feature that is not built is not in the interface ("billing planned", "alert
   routing placeholder"). The roadmap is in documents, not on screens.
9. **The phone is the first screen for clients and for the field.** Navigation is a bar of visible destinations at the
   bottom of the screen, targets are at least 44 points, tables become lists, and nothing scrolls sideways.
10. **Words a hotel owner uses.** "Account", not "tenant"; "box", not "edge"; "equipment", not "asset". The table in
    section 7 says which words are banned and what replaces them.

## 3. Who sees what

### 3.1 The map

```
Public                      Greecon team                         Client
  Sign in  ·  Request         Today          Overview               Overview
  access  ·  Privacy          Clients        Sites ── a site        Sites ── a site ── Equipment*
  Help                        Requests       Alerts                 Alerts
                              Team           Reports                Reports  (Downloads | Trends)
                              More ▸ Who is told, Audit log,         Settings (Who is told | People |
                                     Account, Help                            Account | Audit log)
                              (inside a client: that client's
                               screens + Setup list, Handover)       * owner, administrator, Greecon's team
```

### 3.2 Navigation, by audience

| Audience | Desktop (left bar) | Phone (bottom bar, always visible) |
|---|---|---|
| Greecon team, on its own console | Today · Clients · Requests (a count when some wait) · Team · Who is told · Audit log · Account · Help | Today · Clients · Requests · Team · More |
| Greecon team, inside a client | The client's navigation (below), under the banner "You are in X as Greecon staff", with "Back to the Greecon console" | The client's bottom bar, the banner above it |
| Client, any role | Overview · Sites · Alerts · Reports · Settings | Overview · Sites · Alerts · Reports · Settings |

A role sees only the destinations it may use: **Reports** needs the right to export (so a viewer or operator sees
**Trends** only, under the same name); **Settings** is always there (every person can change their own password), and
its tabs follow the role: **Who is told** and **People** for owner and administrator, **Audit log** for owner,
administrator and auditor, **Account** for everyone.

### 3.3 Routes: kept, renamed, moved, removed

| Route | Now | Why |
|---|---|---|
| `/` | Team: **Today**. Client: **Overview** | The team's home was a client's "getting started" text that sent people to a file path |
| `/platform` | **Clients** (a list, with "Onboard a client" on demand) | Five jobs were one long scroll |
| `/platform/requests` | New: **Requests** | The inbox had no page of its own |
| `/platform/team` | New: **Team** | Same |
| `/sites`, `/sites/[id]` | Kept; the site page is now what an owner needs | Was 5,900 pixels of forms |
| `/sites/[id]/equipment` | New: assets, devices, readings, boxes, per-reading limits | The machinery, for staff and administrators only |
| `/sites/[id]/setup`, `/sites/[id]/handover` | Kept | The project manager's tools |
| `/sites/new` | New: the form that makes a site from a template (was inside Admin) | A site is made from the Sites screen |
| `/alerts` | Kept; "Incidents" removed | Duplicated alerts with a status menu nobody could explain |
| `/reports`, `/analytics` | Kept as the tabs **Downloads** and **Trends** | Names say what is in them |
| `/settings` | **Account** (profile, password) for everyone | Was owner and administrator only, and held placeholders and a dashboard table |
| `/settings/people` | **Who is told** (path unchanged: the guides name it) | |
| `/admin` | **People** (users of the account; path unchanged) | "Admin" held users, sites and a roles table |
| `/audit` | **Audit log** | |
| `/help` | New: **Help** (public, and inside the shell) | A "Help" link that only opened an email |
| `/ack/[token]` | New: the page an "I have seen this" link in an alert message opens (public; one button) | Acknowledging meant signing in on a phone at night |
| `/monitoring`, `/automation` | Removed (they answer with the Overview) | A wall of readings the Overview and the site already show; simulated controls |
| `/devices`, `/maintenance` | Reached from a site's **Equipment** page, no longer in the navigation | Technical, for staff and administrators |

## 4. Page definitions

Each: the question it answers, what is on it in order, the one main action, how it behaves on a phone. Every page
also has the three states in section 6: empty, loading and failed.

### 4.1 Public

| Page | Question | Contents, in order | Main action |
|---|---|---|---|
| **Sign in** | "Am I in the right place?" | The two choices (Client login, Greecon team); email; password; one line on what Greecon is; "Forgot your password? Ask the owner of your account, or write to info@greecon.earth"; Request access · Privacy · Help | Continue |
| **Request access** | "How do I get Greecon?" | Company, your name, email, phone, what kind of site, where, anything else; what happens next | Send the request |
| **Privacy** | "What does Greecon keep about me?" | As written and reviewed (`docs/launch`, L19) | none |
| **Alert link** | "Have I seen this?" | The alert (priority, what, where), one button **Yes, I have seen it**, one sentence on what that does (it stops the reminders; it does not fix anything). Opening the page changes nothing: only the button acknowledges. A link that is expired or unknown says so and offers sign-in | Yes, I have seen it |
| **Help** | "What does this mean, and who do I call?" | How to read a status (the four shapes); an alert arrived: what to do first; who to call; where your data is and how to take it; the words Greecon uses; for the team, the guides | none |

### 4.2 Greecon's team

| Page | Question | Contents, in order | Main action |
|---|---|---|---|
| **Today** | "Is every customer all right, and what do I do today?" | One sentence of answer ("All 5 sites are fine" / "2 of 5 sites need a look"); **Needs a look**: sites that are not Stable, worst first, each with the client, the site, what is wrong, the box, the last reading; **Requests waiting** (the newest three); **Being set up** (sites not yet commissioned, by client); a line "N sites are fine" that opens the whole list | Open (a client's account) |
| **Clients** | "Which customers do we have, and which do I open?" | Search; "Onboard a client" (a panel that opens on demand: company, owner name, owner email); the table: client, sites, people, state; per row **Open for setup** and a "More" menu (the people, with the password reset; Suspend or Activate); Greecon's own accounts folded away | Open for setup |
| **Requests** | "Who has asked for Greecon?" | Each request: company, person, contact, site type, place, message, when; **Contacted**, **Onboarded**, **Declined** | Onboard (opens the Clients form filled in) |
| **Team** | "Who in Greecon can open customers' accounts?" | The people with access; adding a person (the owner only: name, email, a temporary password shown once); turn off, turn on, reset | Add to the team |
| **Who is told** | "Who hears Greecon's own morning message?" | As for a client (the list, the test message, quiet hours, the morning message time) | Save the list |
| **Audit log** | "What did we do, and when?" | The log, newest first | none |
| **Account** | "My own sign-in" | Name, email, role; change password | Change password |

### 4.3 A client

| Page | Question | Contents, in order | Main action |
|---|---|---|---|
| **Overview** | "Is everything all right, and what needs me?" | The answer (headline in words, shape and colour, how many sites report and when worked out, "How is this calculated?"); **Needs you** (open alerts: priority, what, where, since when, what to do first; "Open alerts"); **Sites** (one card each); **Energy now** (the flow picture of one site, named, with a row of buttons to choose when there are several); **Value** (what the solar kept on site and what water costs, at your own prices, with "Details") | Open the alerts |
| **Sites** | "Which of my sites need a look?" | One card per site: name, place, status, last reading, the three numbers that matter for its kind | Open a site; **Add a site** (owner, administrator) |
| **A site** | "How is this site, today?" | The answer for the site (word, shape, one sentence, age of the last reading); **Needs you here** (its open alerts); **Energy now** (the flow picture, animated from measured values); **Value** (its figure; prices behind "Your prices"); **Readings now** (the ones with something to say first, the rest behind "Show every reading"); **Trends** (up to six small charts, "All trends"); **Equipment** (each device: name, kind, state, last heard); **Recently cleared here**. For owner, administrator and Greecon's team: **Equipment and readings**, **Setup list** and **Handover sheet**, one step away | Acknowledge, on the Alerts page |
| **Alerts** | "What is wrong now, what do I do first, what has cleared?" | **Active**: a card each (priority word and shape, what, site, since when, what to do first, **Acknowledge**); **Recently cleared** | Acknowledge |
| **Reports: Downloads** | "Can I have my data?" | Readings, alerts, audit log, the account (as in `docs/launch/05-runbooks.md`, R11) | Download |
| **Reports: Trends** | "How has it been?" | Range (24 hours, 7 days, 30 days, quarter), site, charts by kind with their normal band | none |
| **Settings: Who is told** | "Who hears when something needs attention?" | The ordered list, a test message to each, quiet hours, the morning message, what was sent and what became of it | Save the list |
| **Settings: People** | "Who can sign in?" | The people with role and state; add a person (a temporary password shown once); turn off; what each role may do (a fold-out) | Add a person |
| **Settings: Account** | "My own sign-in" | Name, email, role, the account's name; change password; sign out | Change password |
| **Settings: Audit log** | "Who did what?" | The log | none |
| **Equipment and readings** (a site) | "What does the box read, and how?" | **Boxes** (and **Open the setup list**); **Equipment** (with Remove); **Readings** with their limits; **Where things are** (the map); "Add equipment or a reading by hand (advanced)" with the parts of the site; **Maintenance** (a link to the list); **The site itself** (rename, move, delete) | Open the setup list |

### 4.4 Rules that apply to every page

- The page title says where you are, in a client's words. The line beneath says what the page is for, in one sentence, and
  never promises something that is not there.
- Every number says how old it is (document 20, rule 4). Every status is a word, a shape and a colour.
- One main action per screen, on the right of the header on a desk and at the foot on a phone. Everything else is quiet.
- A destructive action (delete, suspend, turn off) names what it will do and asks once.
- A saved form says "Saved." next to the button. A refused one says why, in words, above the button, with `role="alert"`.

## 5. Patterns

| Pattern | Definition |
|---|---|
| **Shell** | Desktop: a left bar of 240 px (brand, destinations, a foot with the company, Help and Privacy), a header with the title and the person's menu, the page. Phone: a slim top bar (brand, page title, the person's menu) and the bottom bar of destinations (at least 56 px tall, icon and word, the current one marked by shape and weight as well as colour). |
| **The person's menu** | A small round mark with the initials; name and role beside it on a desk. Opens to Account, Help, Log out. It is a disclosure (`details`), so it works before the page's script has loaded. |
| **Header** | Title (one line), a sentence beneath, the main action at the right. No "Greecon Platform" over-line. |
| **Cards** | The status card (word, shape, the sentence, the age) and the stat tile (a number, its unit, its name, its age). Same radius, padding and border everywhere. |
| **Lists and tables** | A table on a desk, with the main column first. On a phone the same rows become cards: the name first, then the others as "label: value" lines. A table never scrolls sideways. |
| **Buttons** | Primary (filled green), secondary (outlined), quiet (text), danger (outlined red, asks once). At least 44 px high on a phone, 36 px on a desk. Never two lines of label. |
| **Status vocabulary** | Stable, Attention needed, Action required, Unknown, Simulated (document 20, section 2). Alert priority: Act now, Check today, For your information. |
| **Forms** | Label above, help text below the label, the field, the error under the field. Optional is said, required is not. A form that saves says "Saved." |
| **Disclosures** | Advanced and rarely used things sit in a `details` the person opens (prices, "How is this calculated?", the roles). Never anything needed to do the page's main job. |
| **Empty** | Says what would be here, why it is not, and the one thing to do ("No site yet. Add your first site."). |
| **Loading** | A skeleton of the page's blocks, not a spinner over a blank page. |
| **Failed** | "This page could not be loaded." What it means for the person, a **Try again**, and the address to write to. Never a stack trace or a code. |
| **Not found, not allowed** | One friendly page each, with the way back. A page a role may not use answers "You do not have access to this page" with the way back, not a bare "not found". |
| **Motion** | The energy flow moves with the measured power and stops when the power is zero; every other animation is a short fade. All of it stops for "reduce motion". |
| **Print** | The handover sheet and the setup list print cleanly; nothing else needs to. |

## 6. Quality bar, and how it is checked

| Measure | Bar | Checked by |
|---|---|---|
| Sideways scrolling | None on any page at 390 px | `ux-tour.cjs` |
| Controls with a name | All | `ux-tour.cjs` (and the journeys, which find them by name) |
| Tap targets on a phone | At least 44 px for buttons, links in the bars and form fields; 32 px at least for inline links in a sentence | `ux-tour.cjs` |
| Smallest text | 12 px | `ux-tour.cjs` |
| Contrast | 4.5:1 text, 3:1 shapes and borders (the tokens in `globals.css` are checked) | the tokens; not re-measured per page |
| Keyboard | Everything reachable, visible focus, a "Skip to the page" link first | the journeys use keyboard-reachable names; not a full audit |
| Console errors | None | `ux-tour.cjs` and the journeys |
| The journeys | The project manager's (70 steps) and the team's (22), updated for the new names | `scripts/e2e` |
| The demo build | The five role builds still export | `scripts/e2e/static-export.sh` |

Not yet done, and said so: a screen-reader pass, 200% text on every page, the Outdoor mode, sessions with real users
(document 20, sections 9 and 10).

## 7. Words

| Do not write | Write |
|---|---|
| Tenant | Account (the client's account) |
| Edge, edge connectivity, gateway | The box; Box connection |
| Asset, device, point, register (in a client's screens) | Equipment, reading. (Registers and addresses appear only on the Equipment and setup screens, which only staff and administrators open.) |
| `integrated_site`, any code word | The site kind's name: Hotel or guesthouse, Solar plant, Farm or greenhouse, Water tank and pump |
| Admin | People (the page of users), Settings (the rest) |
| Staff | Greecon's team |
| Automation, rule, run manually | Nothing: not in the interface while Greecon only reads |
| Placeholder, planned, coming soon, MVP | Nothing |
| Operator, viewer, auditor | Kept (they are roles), with a sentence in People on what each may do |
| "Greecon Platform" over a title | Nothing |

## 8. What was taken out, and what was put in

Taken out of the clients' interface, each because it was not for them or not true: the Automation page (simulated rules
and a "Run manually" button); the Monitoring page (the Overview and a site say the same thing); the "Latest readings"
wall on the Overview (it mixed readings of different sites under one heading, with "Edge connectivity" split across
lines); the dashboard-widget table in Settings; the "Alert routing placeholder" and "Billing: Stripe planned" cards; the
Incidents table on the Alerts page; the Roles table and the word "Tenant" on the Admin page; the asset, device and reading
forms and the manual-control panel on a site's page (moved to Equipment); the Devices and Maintenance tabs from the
navigation; a "Getting started" text that named a file in the repository.

Taken out of the team's way: the client navigation (the team has its own); the internal accounts from the clients list;
the always-open onboarding form; "Active — Suspend" as one control.

Put in: the team's **Today**, **Requests** and **Team**; the phone's bottom bar and top bar; the person's menu; the
**Account** page for every role; **Help**; the friendly pages for loading, failing, not found and not allowed; "Skip to
the page"; the answer "Forgot your password?" on the sign-in page; the site's **Equipment** page; **Add a site** on the
Sites screen; the table-to-list behaviour on a phone.

Left for later, with what would justify it: an Albanian interface (`docs/27`, L12); an Outdoor mode and a night mode
(document 20, section 10); a notification centre; push notifications; a per-user "my sites" filter for clients with many
sites; the savings comparison against last year's bills as a chart.

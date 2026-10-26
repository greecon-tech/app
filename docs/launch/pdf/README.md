# Greecon printable guides

A4, portrait, one file for each kind of reader. Every PDF has a cover, contents with page numbers and links, bookmarks, and page numbers in the footer. They are made from the launch documents and from the site packs in `docs/launch/packs/`; do not edit the PDFs, change the sources and rebuild.

| File | Who it is for | When to print it | Pages | Built |
|---|---|---|---|---|
| [00-Greecon-Complete-Deployment-Guide.pdf](00-Greecon-Complete-Deployment-Guide.pdf) | Everyone: the founder, the project manager and the electrician | Once, to keep in the office. For a job, print the pack or guide that fits it (04 to 07, 01 to 03) | 183 | 2026-10-26 |
| [01-Founder-Go-Live-Guide.pdf](01-Founder-Go-Live-Guide.pdf) | The founder (nothing technical is assumed) | Once, before the first customer. The last page tears off as the go-live checklist | 14 | 2026-10-26 |
| [02-Project-Manager-Field-Manual.pdf](02-Project-Manager-Field-Manual.pdf) | The project manager, for every site | Once for the office and the car; print the forms (Appendix A) for each site | 51 | 2026-10-26 |
| [03-Hardware-Reference.pdf](03-Hardware-Reference.pdf) | The project manager who buys and fits hardware, and the electrician | Once, to keep with the spares kit | 23 | 2026-10-26 |
| [04-Site-Pack-H-Hotel-or-Guesthouse.pdf](04-Site-Pack-H-Hotel-or-Guesthouse.pdf) | The project manager and the electrician at a hotel or guesthouse (kit H); the owner at handover | For each site of this kind: the whole pack, ticked off as the work is done | 27 | 2026-10-26 |
| [05-Site-Pack-S-Solar-Plant.pdf](05-Site-Pack-S-Solar-Plant.pdf) | The project manager and the electrician at a solar plant with grid connection (kit S); the owner at handover | For each site of this kind: the whole pack, ticked off as the work is done | 27 | 2026-10-26 |
| [06-Site-Pack-F-Farm-or-Greenhouse.pdf](06-Site-Pack-F-Farm-or-Greenhouse.pdf) | The project manager and the electrician at a farm or greenhouse with irrigation (kit F); the owner at handover | For each site of this kind: the whole pack, ticked off as the work is done | 27 | 2026-10-26 |
| [07-Site-Pack-W-Water-Tank-and-Pump-Station.pdf](07-Site-Pack-W-Water-Tank-and-Pump-Station.pdf) | The project manager and the electrician at a water tank and pump station (kit W); the owner at handover | For each site of this kind: the whole pack, ticked off as the work is done | 26 | 2026-10-26 |

**Rebuild:** `npm run docs:pdf` (or `npm run docs:pdf -- --only 01,04` for some of them). It needs pandoc, Chromium through Playwright and poppler, all on the build machine, and no network. Screen names are typed once, in `scripts/docs/ui-labels.json`; the setup-list step titles are checked against `apps/api/src/setup/setup-checklist.ts` at every build.

# 05. Runbooks: when something is wrong, and the routine that finds it first

**For:** the founder and the project manager. Each runbook says what you see, what to check, what to do, what
to tell the customer, and what to write down afterwards. Commands are in `code`; places in the app are in **bold**.

The product exists so that people hear about problems before their guests do. These pages exist so that **Greecon
hears about its own problems before its customers do.**

---

## 0. The routine

| When | What | How long |
|---|---|---|
| **Every morning** (the project manager; the founder when away) | Read the morning email from Greecon ("Greecon, Mon 19 Oct: ..."). Open **Clients → Sites across clients**, worst first. For anything not **Stable**, follow the runbook below. If everything is **Stable**, do nothing. | 5 min |
| **Same day** | A customer who is **Attention needed** or **Unknown**: phone them *before* they phone you ("we saw your box was offline since 03:10; we are looking into it"). | |
| **Every Friday** (founder) | The pipeline sheet ([04](04-sales-kit.md)); the hardware register; take the weekly backup (R13); look at Railway **Usage** | 30 min |
| **Every month** (founder) | Restore drill (R13); read the last month's alerts at each live site with the owner: *useful? too many?* (R5); look at the audit log for anything unexpected; check Resend and Twilio balances; update packages ([R14](#r14-when-the-founder-is-not-there) lists who can do what) | 2 hours |
| **Every six months** | Re-check the legal list ([22](../22-legal-and-compliance-map.md)); read the claims register ([21](../21-communication-system.md)) against what is being said; renew `security.txt` before 30 September 2027 | half a day |

**Who owns what.** The **founder** owns every incident about the platform or about security, and is the person
the outside uptime check calls. The **project manager** is the first person for a customer's site and deputises for the founder.
**Nobody promises a 24-hour response yet** (the customer promise is: acknowledged within four business hours,
Monday to Saturday). The platform does the night shift: Act now reaches the *customer's own* people at once.

**Severity.**

| | What | Target |
|---|---|---|
| **S1** | The platform is down; sign-in does not work for anyone; a possible leak of data | Acknowledge to affected customers within 30 minutes of finding out (a target, not a promise) |
| **S2** | One customer's site is silent or wrong (box offline, readings stale) | Same working day |
| **S3** | A wrong value, a message not received, a question | Within four business hours |

**While a clock runs.** Safety events, security incidents and personal-data incidents have legal clocks (4 hours,
24 hours, 72 hours) that depend on the law that applies to the *customer*. R12 says what to do, and the clocks are in
[21, section 4](../21-communication-system.md). Write down the **time you found out** first.

---

## R1. A customer's box is offline

**You see:** **Sites across clients** says *The box has not reported for N: it is offline*; or the customer's morning
message says readings are out of date.

**Check, in this order:**

1. **Is the whole site offline?** Phone the owner or manager. *"Is the power on in the plant room? Is the router's light on?"* A power cut at the site is the commonest cause, and ends by itself.
2. **Is it the site's internet?** If they have other internet things down, it is the router or the line. Ask them to restart the router. (The box keeps up to three days of readings and sends them when the internet returns. **Nothing is lost.**)
3. **Is it the box?** If power and internet are fine: on the box (keyboard and screen, or SSH on the site's network): `greecon-edge status` and `journalctl -u greecon-edge -n 50 --no-pager`. Read the last lines: they say what is wrong (cannot reach Greecon, a clock far out, the credential refused).
4. **Is it Greecon?** If every customer's box is offline at once, the platform is down: R7.

**Fix:** restart the service `sudo systemctl restart greecon-edge`; if the clock is out `sudo timedatectl set-ntp true`; if the credential was refused (`status 401`), make a new code: on the site's setup page, **Install a box, or replace this one**, then run the new line on the box. A box that has been off for hours reports in again by itself.

**Tell the customer:** what you saw and when, what you did, what they need to do. If nothing was lost, say so.

**Afterwards:** a line in the incident log (date, site, cause, minutes offline). If it is the *same site twice*, find the cause: a loose plug, a router that restarts nightly.

## R2. The box is online but a site has no readings, or a device "does not answer"

**You see:** the box is **Online** and the site is **Attention needed** or **Unknown**; the setup page says *NOT OK <device>: no answer from 192.168.1.50:502 (unit 2)*.

**Check:**

1. **Is the converter powered and on the network?** From the box: `ping 192.168.1.50` (its address on the setup page).
2. **Does one device fail or all of them?** All: the converter or the cable. One: that device (unit number, power, address).
3. **From the box:** `greecon-edge modbus-test --host <address> --unit <n> --type input --address 52 --data-type float32`. *Could not read: no answer* means the device or the cable; *has no register at that address* means the register is wrong (the device answers); a value means the path works.
4. **A meter powered from the grid** goes dark in a power cut: expected, and it returns with the power.

**Fix:** reseat the converter's power; check **A** and **B** are not swapped; check the unit number on the meter's display; check speed and parity match the converter's. If a device was replaced, **its unit number and settings must be set again.**

**Tell the customer:** which device, since when, and whether their alerts for it can be trusted meanwhile (they cannot while it does not answer: the platform shows *Unknown*, never *fine*).

## R3. A reading looks wrong

**You see:** a value that is zero, never changes, is ten or a thousand times too big or small, is negative where it cannot be, or has import and export swapped.

| Symptom | Likely cause | Fix |
|---|---|---|
| **Zero all the time** | A clamp on the wrong cable, a closed breaker upstream, the wrong register, or the inverter is limited to zero export | `modbus-test` against the meter's display; confirm the clamp is on the right phase |
| **Constant** | A frozen device, a wrong register kind (input vs holding) | `modbus-test` twice a minute apart |
| **x1000 too big** | Watts shown as kilowatts | In the register form: multiply by **0.001** |
| **Tank above 100 percent** | The reading at the top is wrong for the tank's height | Range ÷ height × 100 ([02](02-project-manager-manual.md), 7.4) |
| **Import and export swapped** | Clamps the wrong way round | The electrician turns them; repeat the direction check |
| **The pump shows running when stopped** | The contact is inverted | Swap the contact's normally-open and normally-closed wires, or use the opposite contact |

**Tell the customer** when a number they relied on was wrong, and for how long. **Do not edit history:** a wrong
reading stays as it was, with a note. The platform keeps what was measured.

## R4. A customer did not get a message, or got one that was wrong

**Check:**

1. **Who is told** at that customer (sign in, **Open for setup**): is the person on the list, with the right email and number *with the country code*?
2. The **log** on the same page: what was sent, to whom, when, and **what the email or text provider answered** ("Accepted for delivery", or why not). *Accepted* means the provider took it; it does not mean the person saw it.
3. **Email in spam?** Ask them to look, and to mark it not spam. **Text:** which network? (some operators replace a sender name; see [01, step 8](01-founder-go-live.md)).
4. **Quiet hours** hold Check today until morning; only Act now is sent at night.
5. **Hourly limits:** an account is limited to 60 emails and 20 texts an hour. A condition flapping all day should not hit it; if it did, find out why.
6. **Is the platform's messaging off?** The API's log at start-up says so ("Alert messages are OFF").

**Fix:** correct the list and send a test message to the person, and confirm it arrived.

## R5. Too many alerts

An alert nobody acts on trains people to ignore the next. The aim in steady state is **one alert or fewer per site per
day**, every one with an action.

1. List the alerts of the last two weeks with the owner. For each: *what did you do?* An alert with no action is a limit that is wrong or a reading that is noisy.
2. Change the **limits** (the tank's *Low below*, *Critical below*) to numbers the owner would act on. Do **not** mute an alert type. Fix its cause.
3. A reading that flaps around a limit: raise the gap between *Low* and *Critical*; the platform already raises one alert per condition and re-opens it within 15 minutes rather than raising a new one.
4. Write down what changed, so the next person knows why.

## R6. A person cannot sign in, or someone has left

- **Forgot the password:** the account's **owner** opens **Admin** and **Reset password** for that person (a temporary password is shown once; they choose their own at first sign-in).
- **A customer's owner is locked out and has no other administrator:** they phone Greecon. **Confirm by phone that it is them** (ask something only the owner would know: the site's name and address, the last alert, who else is on the list). The founder opens **Clients**, finds the client, opens **People** under **Users**, and presses **Reset password** for that person. A temporary password is shown once; give it to them by phone, not by email. It ends every session the person had open, and the reset is written in the customer's own audit trail under the staff member's name. Only the owner of Greecon's account can do it; a project manager can see the people and is told who to ask.
- **Wrong password too often:** sign-in is rate limited per account. Wait a few minutes.
- **A team member leaves:** the founder opens **Clients → Greecon team → Turn off**. Their session ends on their next click, and so does any customer account they had open. Then **change `JWT_SECRET`** if they knew anything secret ([01](01-founder-go-live.md)).
- **A customer's person leaves:** the customer's owner opens **Admin** and sets the person **Disabled**; it ends their session on their next click.
- **The founder is locked out:** [R14](#r14-when-the-founder-is-not-there).

## R7. The platform is down

**You see:** the outside check calls your phone; sign-in does not load; every customer's box shows offline at once.

1. **Railway status:** open railway.com's status page and the project. Is the **api** service *Crashed* or *Deploying*? Is **Postgres** *Crashed*?
2. **Open the api service's Deployments → View logs.** The last red line says why: a setting wrong, the database unreachable, out of memory.
3. **If a deploy just went out:** go back to the previous one (Deployments, the earlier one, **Redeploy**). The database is not rolled back, and does not need to be: new versions only add to it.
4. **If the database is down:** look at Railway's Postgres service; it restarts by itself; if it is full, R8.
5. **While it is down:** boxes keep their readings (about three days) and send them when the platform returns. **Customers' own equipment is not affected: Greecon only reads.** Say both, in these words.
6. **Tell customers** within 30 minutes of finding out (the template in [21](../21-communication-system.md): "[time, zone] Investigating. Since [time], Greecon's screens and messages are unavailable. Effect on your site: your equipment is not affected; the box keeps its readings and sends them when we are back. Next update by [time]."). Update at the promised time **even if nothing changed.**
7. **Afterwards:** a short written summary within five working days: what happened, how long, what was lost (nothing, if the boxes had it), what changes.

## R8. The database is full, or slow, or the bill jumped

- **Railway Usage** shows which service costs what. The database grows with readings: raw readings are kept by the platform; if it nears its volume size, increase the volume in Railway (Postgres service, **Settings → Volume**), then plan how long raw readings are kept (a decision for the founder: a retention rule is not built).
- **A box sending too much:** a box that cannot reach the platform keeps one reading a minute; a site with many devices sends more. `greecon-edge status` shows each device. A runaway is unusual: look at the audit log for the site.
- **Slow pages:** the chart history is bucketed (about 288 points); a very long window is refused with words rather than slow.

## R9. A bad software release

The platform and the box's software are built together and **boxes update themselves** from the platform. A box that
fails to start a new version three times **goes back to the one before it** and remembers not to try it again.

1. **Stop the spread:** on the **api** service set `EDGE_AUTO_UPDATE` to `false`. Boxes keep the version they have.
2. **Roll the platform back:** Railway, **Deployments**, the earlier one, **Redeploy**.
3. **Find the cause** in the log, fix it, release again, and turn `EDGE_AUTO_UPDATE` back on (remove the variable).
4. Look at **Sites across clients** for a box whose version differs from the others.

## R10. A box is replaced

A failed box, a stolen one, or a customer who moved the equipment.

1. On the site's setup page press **Install a box, or replace this one**. **Confirm.** A new line is shown, once.
2. Install the operating system on the new box, paste the line. The new box takes the old one's place; **the old
   one's credential stops working at once.**
3. Nothing else is entered again: addresses and registers are the site's, not the box's.
4. Write the change in the hardware register.

## R11. A customer asks for their data, or to leave, or to be deleted

- **A copy of their data:** they can do it themselves: **Reports**: every reading (hourly averages for any period; every reading for up to 31 days), the alerts, and the account's setup as one file. Every download is recorded in their audit trail. If they cannot, do it for them from inside their account and send it by a means you trust, **not by plain email if it holds readings of a named site that they would not want public**.
- **They stop at day 60 or day 90:** take the equipment away within 14 days; give them the files; set the client **Suspended** in **Clients** (it can be turned back on); keep the account until they confirm in writing that they have their data.
- **Deletion (they ask in writing, after they have their data):** this is the only time anything is deleted. The founder does it, in a transaction, after the files are with the customer and the request is in writing:

  ```
  -- in the Railway Postgres service, Data tab or psql with the public connection string
  BEGIN;
  DELETE FROM tenants WHERE id = '<the client's id, from Clients>';
  -- check "DELETE 1", then:
  COMMIT;
  ```

  One statement removes the account and everything under it: sites, devices, readings, alerts, people, messages sent, audit trail (tested).
  **Then restart the API service** (a redeploy) so that the platform's memory forgets them. **Write in the data-deletion log**
  (a sheet, outside the platform): who asked, when, what was deleted, when it was confirmed to them. Tell the customer that copies in **backups
  disappear when the backups expire** (Railway's daily ones within a week; the weekly dumps you keep: delete those that hold
  them as you rotate).

## R12. A security incident, or a vulnerability report

**A vulnerability report** arrives at `info@greecon.earth` (it is in `security.txt`): reply within two working days
with thanks; fix it; do not threaten the reporter; say when it is fixed.

**A suspected incident** (an account used by someone who should not have it; a key leaked; the platform behaving oddly):

1. **Write down the time you found out.** That starts the clocks.
2. **Contain:** turn off the account (Admin, or **Clients → Greecon team → Turn off** for a team member); change `JWT_SECRET` (signs everyone out); rotate any key that may have leaked (Resend, Twilio, the database password).
3. **Find out what** was seen or changed: the audit trail of the affected customer shows who did what, under whose name.
4. **Decide who must be told and by when**, with a lawyer where you can: the clocks depend on the customer. A customer classed as critical under Albania's Law 25/2024 needs your facts within **4 hours**; GDPR and Albania's Law 124/2024 want a processor to tell the controller **immediately** and the controller the authority within **72 hours**; the Cyber Resilience Act has 24 hours and 72 hours for actively exploited vulnerabilities. The full table is in [21, section 4](../21-communication-system.md), marked *to be confirmed with counsel*.
5. **Tell customers** with the template in [21](../21-communication-system.md) ("Security notice"): what is known, what is not, what to do, when the next update is. **Never** say "no evidence data was accessed" while the investigation is open, and never say "fully secure".
6. **Afterwards:** a written report within one month; what changed.

**What is built, and what is not** (so that nobody over-promises): a one-time-password for each new account; passwords checked
for length and against published ones; sign-in rate limited; sessions that end when a person is turned off or
changes their password; every staff action in a customer's account recorded under their name; all customer data separated by account and tested for it; a
download recorded in the audit trail. **Not built yet:** two-factor sign-in (the first security work after the
fifth site, and before any control of equipment); single sign-on; automated penetration testing. Say so when asked.

## R13. Backups and restoring

**The rule:** a backup that only lives next to the database does not survive losing it.

**Every day (automatic):** the Postgres service's **Backups** tab, a daily schedule (what your plan allows).

**Every Friday (by hand, the founder, ten minutes):**

```
# on your laptop, with the PostgreSQL tools installed; DATABASE_PUBLIC_URL is on the Postgres service's Variables tab
pg_dump "$DATABASE_PUBLIC_URL" --no-owner --format=custom --file="greecon-$(date +%F).dump"
```

Put the file in the company's shared drive (not the laptop), in a folder named `backups`. Keep eight weeks and delete older ones.

**Every month, the restore drill (so that you know it works before you need it):**

1. In Railway, add a **new** Postgres service named `restore-test` (never restore over the live one).
2. `pg_restore --no-owner --dbname="<its public URL>" greecon-<date>.dump`
3. Look at it: `psql "<its public URL>" -c "select count(*) from users; select count(*) from sites; select count(*) from telemetry_readings;"`. The numbers are about what you expect.
4. Delete the `restore-test` service.

**A real loss:** restore into a **new** Postgres service, point the **api** service's `DATABASE_URL` at it (a variable change, then a redeploy), check sign-in and a customer's site, then tell customers what the gap is. Boxes resend what they kept; the readings between the backup and the loss are recovered from them for up to three days.

## R14. When the founder is not there

- **Two people can sign in as Greecon staff**; the project manager can do R1 to R6 and R10 to R11. **Only the founder can**: change settings in Railway; add or remove team members; delete a customer; restore the database.
- **Put in the password manager's emergency access** the person the founder trusts most, and a sealed note: where the password manager is, who owns the Railway and GitHub accounts, who owns the domain.
- **Add a second person as a collaborator on Railway and as an owner on GitHub** as soon as one is hired. The platform never depends on one person's laptop.
- **No one edits the database by hand to reset a password.** A customer's locked-out person is reset from **Clients** (R6). If the founder himself is locked out, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` on the API to his address and a new password: it works only for an account that has **no** password, so first clear his password in Railway's Postgres **Data** tab (`UPDATE users SET password_hash = NULL WHERE lower(email) = 'eridon.manuka@greecon.earth';`), then set the two variables and redeploy, sign in, choose a new password in Settings, and remove the variables. Keep the password manager's emergency access so that this never happens.

## Contact sheet (fill in; print; keep in the password manager)

| Who | Phone | Email |
|---|---|---|
| Founder | | eridon.manuka@greecon.earth |
| Project manager | | |
| Electrician (first call) | | |
| Electrician (second) | | |
| Railway support | | station.railway.com |
| The lawyer | | |
| The insurer | | |
| Each customer's first person | (on its handover sheet) | |

The box is the small computer at the site. About every ten seconds it asks each device for its reading. It sends the readings to Greecon over the internet, keeps them while the internet is down, and says every 30 seconds that it is alive. It is also what looks for the equipment when a person presses **{{ui.find_equipment}}**. It runs one small program and needs very little: what is hard is coming back after a power cut, and that is what its specification is about.

## At a glance

@@GLANCE@@

## How it qualifies

Any make qualifies that meets every line below. Nothing about a box is special, so a failed one can be replaced by anyone, with any box that qualifies.

**It qualifies if:**

- {{cb}} It runs Linux on a processor of the x86-64, 64-bit ARM or 32-bit ARM kind: Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS (64-bit), with systemd. The installer checks this.
- {{cb}} It has 4 GB of memory or more and 32 GB of storage or more. That is the least the software runs on; the kit list buys 8 GB and 128 GB.
- {{cb}} Its storage is a real disk: an SSD or eMMC. Not an SD card.
- {{cb}} It has a real-time clock with a battery, and a BIOS setting of "power on after power loss" (often "Restore on AC Power Loss: Power On").
- {{cb}} It takes 9 to 36 V DC, or a plain 12 V, so that it can sit behind a DC UPS.
- {{cb}} It has no fan, and works from 0 to 50 °C or better: a plant room is hot and dusty.
- {{cb}} It has one Ethernet port. Two is nicer.

| Option | When | Planning estimate (EUR) | Note |
|-----------------|-------------------------|-----------|-------------------------|
| **Fanless x86 mini PC** (an Intel N100-class machine) | The default. Most sites | 180 to 300 | Check the clock battery and the power-on setting in the BIOS before buying many |
| **Raspberry Pi 5** (4 or 8 GB) | A bench box, or a small site, with a proper SSD on NVMe or USB 3 and a clock battery. Never an SD card | 120 to 200 with SSD and case | Starts by itself when power returns |
| **Industrial PC** (Advantech UNO, OnLogic, Seeed reTerminal DM class) | Hot, dusty or vibrating sites; customers who insist on industrial parts | 450 to 900 | The same software runs on it. Not needed to begin |

::: stop
**Do not buy** a box that starts from an SD card: it is the commonest reason these boxes fail, because an SD card corrupts on a power cut and wears out under constant writing. Do not buy one that has no clock battery, or that stays off when the power returns. Shop listings rarely say whether there is a clock battery: ask the vendor, in writing.
:::

## At each kind of site

Every site has one box. What changes is where it sits and what it reads.

@@SITES@@

Wherever it sits, the place is dry, has 30 cm free around the box, is away from heat, and is within reach of a socket that stays on and of a network cable.

## What it does by itself

- It reads every device about every ten seconds and sends what it reads.
- It keeps about three days of readings if the internet is down, for a site of up to about thirteen devices (a site with more devices keeps fewer days), and sends them in order when the internet returns. In a long outage it keeps one reading a minute for each reading, so that three days fit.
- It reports every 30 seconds, so that Greecon knows it is alive. Greecon's own team is told when a customer's box has been silent for a quarter of an hour.
- It takes new versions of its software from the platform, and goes back to the version before if a new one fails to start three times.
- It restarts if it fails.
- It only reads. It never writes to a meter or a module. Nothing on the internet can connect to it: it only makes outgoing connections.

## Settings, and where they are made

Everything is set at the office, on a desk, before the kit leaves. It takes about twenty minutes, then the install line.

| Setting | What to do |
|-------------------|------------------------------------------------------|
| The operating system | Debian 12 from the "netinst" image, with only "SSH server" and "standard system utilities". No desktop. One user with a long password, kept in the password manager against the site's name. Host name `greecon-<site>` |
| The clock | Time zone Europe/Tirane, and `timedatectl set-ntp true` |
| Security updates | `apt-get install -y unattended-upgrades`, and answer yes when it asks |
| The BIOS | Power on after power loss; no sleep; start from the disk only |
| The Greecon software | Paste the install line from the site's setup page (see *In the platform*) |

**What the installer changes,** so that nobody wonders: `/opt/greecon` (the software), `/etc/greecon` (the box's credential, readable by the service only), `/var/lib/greecon-edge` (what it remembers), one service called `greecon-edge`, one user called `greecon`, and one command, `greecon-edge`. Nothing else.

## Fitting

{{who:pm}}

- {{cb}} **Place:** in the enclosure if there is room, otherwise on a shelf beside it.
- {{cb}} **Power:** behind the UPS. A box that takes 9 to 36 V can share the 24 V supply; a box that takes 12 V keeps its own supply.
- {{cb}} **Network:** a cable to the customer's router or switch, or to the 4G router. Never a guest network. The box needs only outgoing HTTPS (port 443) to `api.greecon.earth` (and to `nodejs.org` when it is installed) and a time service (UDP 123). Nothing needs to come in.
- {{cb}} **Label** it with the site name and the date. Never write a code or a password on the box.

A box that was installed at the office keeps its credential when it is moved: unplug it, carry it to the site and plug it in, and it reports from the new place within a minute, with nothing typed again.

## In the platform

The box is step 3 of the setup list, **{{step:3}}**.

1. On the site's setup page press **{{ui.add_box}}**. A line appears that begins `curl -fsSL https://api...` and ends in a code like `GRC-XXXX-XXXX-XXXX`. It is shown once. The code works once, for seven days. Copy it and press **{{ui.i_have_copied_it}}**.
2. Open a terminal on the box (a keyboard and screen, or SSH) and paste the line exactly. It runs in seven numbered steps and finishes with `Done. Greecon can see this box.`
3. Refresh the setup page. The step says **{{ui.status_done}}**, with the box's name, its version and "Heard from N seconds ago". Nobody pressed anything to make it so: the platform saw the box.

::: stop
**The install line is the box's key.** Anyone with the line can install a box as this site until it is used or has expired. Treat it like a password: not in email or chat, and pasted straight into the box. If it is lost, or the seven days have passed, press **{{ui.replace_box}}** for a new one.
:::

**To replace a box** (failed, stolen or moved): press **{{ui.replace_box}}** and confirm. A new line is shown, once. Install the operating system on the new box and paste the line. The new box takes the old one's place, and the old one's credential stops working at once. Nothing else is entered again: the addresses and the registers belong to the site, not to the box.

## Acceptance test

**Before a box leaves the office:**

- {{cb}} The install line ran to `Done. Greecon can see this box.`
- {{cb}} The setup page shows the step done, with the box's name and "Heard from N seconds ago".
- {{cb}} `greecon-edge status` says when the platform last heard from the box, and does not say NOT REPORTING.
- {{cb}} The power was pulled and restored: the box started by itself.
- {{cb}} The box is labelled with the site name and the date.

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **Power cut.** Unplug the box for 30 seconds, plug it in. | Back reporting within 3 minutes, and the box says nothing about readings lost | | | {{pf}} |
| **Internet cut** (the first install, and any time the box or its software is new). Cut only the site's internet for ten minutes: unplug the router's uplink, or take the SIM out of the 4G router. Leave the box and the converter plugged into the router. | `greecon-edge status` shows a queue while it is out; the queue is empty a few minutes after the internet returns, and the readings from the gap are in the downloads | | | {{pf}} |
:::

**The commands a project manager uses on the box:**

| Command | What it does |
|--------------------------------------|------------------------------------------|
| `greecon-edge status` | How the box is: heard by Greecon, each device, the queue |
| `journalctl -u greecon-edge -n 50 --no-pager` | What the box has been saying |
| `greecon-edge find` | Looks at the network and says what answers. It only reads |
| `sudo systemctl restart greecon-edge` | Restarts the box's software |

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **The install line stops with `STOP:`** | The sentence says which: no internet, a firewall that blocks outgoing HTTPS on port 443, a clock so far out that secure connections fail, or a code already used or older than seven days | Do what it says. If it stopped before step 5, *Giving this box its credential*, run the same line again. From step 5 on the code is used up: run the line again with no code at the end, which repairs the box and keeps its credential |
| **The box says Offline** | A power cut at the site (the commonest cause, and it ends by itself), the site's internet, or the box | Phone the site: is the power on, is the router's light on? Then, on the box: `greecon-edge status` and `journalctl -u greecon-edge -n 50 --no-pager`. The last lines say what is wrong |
| **The box's log says the platform does not recognise this box's credential** | The box was replaced, or its code was used for another box | Press **{{ui.replace_box}}** and run the new line on the box |
| **The setup page says its clock is N minutes fast** | The box has no time service | `sudo timedatectl set-ntp true` |
| **Readings are missing after a long outage** | The queue holds about three days. It is for outages, not for a site that is never connected | Nothing is lost if the internet returns within that time. A site with no internet at all is not sold |

More is in {{ref:runbooks}}: R1 (a box is offline) and R10 (a box is replaced).

## Not yet proven

- The heartbeat, the three-day queue and the updates with their way back are tested in software. They have not yet been shown on a real box with the internet really cut: that is why the internet-cut test is done at the first install, and its result written down.
- Installing the operating system and pasting the install line are still done in a terminal. There is not yet a box that sets itself up the first time it is switched on.
- The prices are planning figures from shop listings seen in October 2026, not quotes.

@@BUYING@@

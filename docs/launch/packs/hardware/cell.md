The box needs the internet, and it needs nothing else from it than to call out. Where the customer has a router the box may use, that is the best way and nothing is bought. Where there is none, as in a field or a pump station away from the buildings, a 4G router with a data SIM is the site's way to the internet, and the box and the converter plug into it.

## At a glance

@@GLANCE@@

## How it qualifies

**It qualifies if:**

- {{cb}} It is a 4G router that fits a DIN rail and takes a data SIM.
- {{cb}} It has a network socket for the box and one for the converter, or a small switch is fitted behind it.
- {{cb}} The supply it needs is known before it shares the 24 V supply: read its label.
- {{cb}} The SIM is a data SIM on a plan of 5 GB a month or more. Greecon supplies the SIM, charged at cost.

::: check
**Check the signal where the router will sit,** at the survey: look at your phone there. A router in a steel enclosure in a pump house hears less than a phone in your hand.
:::

## At each kind of site

@@SITES@@

A site with no internet at all is not sold. The box keeps about three days of readings, which is for outages, not for a site that is never connected.

## How much data it uses

Plan for about **1.5 GB a month**. That assumes a hotel-size site (four devices, seven readings) sending one request every ten seconds, about 5 KB each with its headers (about 1.3 GB), and a report every 30 seconds (about 0.15 GB). A site with more devices sends more. It is an estimate: read the router's counter after a week and write the real figure down.

## Fitting

{{who:pm}}

- {{cb}} Put the SIM in, and mount the router on the rail in the enclosure.
- {{cb}} Plug the box and the converter into its sockets.
- {{cb}} Check the signal on the router's own lights or page, where it sits, with the enclosure closed.
- {{cb}} Label it with the site name. Keep the SIM's number and its plan in the hardware register, not on the router.

## In the platform

The router is not in the platform. What shows it is working is the box: step 3 of the setup list, **{{step:3}}**, says **{{ui.status_done}}**, and the box stays **Online**.

## Acceptance test

- {{cb}} With the box and the converter plugged into the router, the box comes **Online** within a minute.
- {{cb}} The internet-cut test of commissioning is done by taking the SIM out for ten minutes: `greecon-edge status` shows a queue, and the queue is empty a few minutes after the SIM is back.
- {{cb}} After a week, the router's data counter is read and written down, and the plan is checked against it.

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **The box is Offline, and the power is on** | No signal where the router sits, the plan's data is used up, or the SIM is not a data SIM | Look at the router's signal lights. Read its counter against the plan. A spare SIM is in the spares kit |
| **The box goes Offline and comes back, again and again** | A weak signal | Move the router's aerial outside the enclosure, as its manual allows. Readings are not lost: the box sends them when it is back |
| **The data runs out before the month does** | A site with more devices than the estimate assumes | Read the counter, and take a larger plan |

More is in {{ref:runbooks}}: R1 (a box is offline).

## Not yet proven

- The 1.5 GB a month is worked out, not measured. No Greecon site has yet run on a cellular router.

@@BUYING@@

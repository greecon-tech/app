The UPS keeps the box and the converter running through a short power cut. With it, a power cut looks like what it is: the box is alive and says that the meters do not answer. Without it, the box goes silent with everything else, and nobody can tell a power cut from a broken box until the power returns. It is not there to run the site, and it does not make Greecon a safety system.

## At a glance

@@GLANCE@@

## How it qualifies

Either of two kinds qualifies. Which one is bought decides what keeps working in a power cut.

| Kind | It feeds | In a power cut |
|-----------------|-----------------------------|--------------------------------------|
| **12 V DC UPS** | The box and the converter, at 12 V. The box must take 12 V; the converter takes 9 to 36 V | The box and the converter stay up. The 24 V supply is on the mains, so the modules and the transmitters go dark, and the box says that they do not answer |
| **600 VA line-interactive UPS** (mains in, mains out) | The box's own supply and the 24 V supply, which feeds the converter, the modules and the loops | The whole kit stays up. The tank and the pressure are still read. Meters powered from the grid go dark |

**It qualifies if:**

- {{cb}} It is one of the two kinds above, and what it must feed fits it: read the labels.
- {{cb}} **It comes back by itself.** After it has run flat and the mains returns, its output comes on again with nobody pressing a button. Test this on the desk.
- {{cb}} Its battery can be changed, and the date of the battery is written on it. A UPS battery wears out in a few years.
- {{cb}} A mains UPS has enough sockets that are backed by the battery. Many have some sockets that only protect against surges: the kit goes into the backed ones.

::: stop
**A UPS is for short cuts.** Nothing but the kit is plugged into it. When the grid is down, a meter powered from the grid is dark, and Greecon says that it does not answer. That is the honest picture ("we cannot tell"), not a fault.
:::

## At each kind of site

@@SITES@@

At a site with water (a hotel, a water station), the 600 VA kind is the better choice: the tank is still read while the power is down, which is when it matters most.

## What it is for

- **To tell a power cut from a broken box.** The box stays alive and reports. On the site's page the devices powered from the grid do not answer, and the box does.
- **To keep the box from being cut off in the middle of its work.** A box on a real disk survives that, but it is kinder not to test it every week.
- **Not to keep the internet up.** The box can only report while the site's router has power. Where the router is Greecon's 4G router, it goes behind the UPS. Where it is the customer's, ask whether it has a UPS of its own, and write the answer down. If it has none, the box keeps the readings and sends them when the internet returns.
- **Not for long cuts.** When the UPS runs flat the box stops. The BIOS setting "power on after power loss" ([sheet HW01](#hw-box)) is what brings it back when the power returns.

## Fitting

{{who:pm}} places it. {{who:e}} connects anything that is wired to the mains and not plugged in.

{{diagram:ref-power}}

The drawing shows a mains UPS, which feeds all three. A 12 V DC UPS feeds the box and the converter only: the 24 V supply is then on the mains.

- {{cb}} A mains UPS stands on a shelf beside or below the enclosure, with the air around it that its manual asks for, plugged into a socket that stays on.
- {{cb}} A 12 V DC UPS sits on the rail or beside it. The box and the converter take their power from its 12 V output.
- {{cb}} The kit is plugged into the sockets that the battery backs.
- {{cb}} The 4G router, where the kit has one, is behind the UPS too.
- {{cb}} **Label it** with the date of its battery. Nothing else is plugged into it.

## In the platform

The UPS is not in the platform, and Greecon does not read it. What shows it is working is the box: during a power cut it stays **Online** for as long as the site's internet has power.

## Acceptance test

**At the office, on the desk, with the kit running:**

- {{cb}} Pull the UPS's mains plug. The box and the converter stay on. With a mains UPS, the modules stay on too.
- {{cb}} Leave it until the UPS gives up, and **write down how many minutes that took.**
- {{cb}} Give it mains again. Its output returns by itself, the box starts by itself, and the box reports within three minutes.

**On the day, as part of commissioning:**

::: tests
| Check and how | Pass when | Greecon shows | Real | Result |
|----------------------|-----------------|--------|--------|--------|
| **A power cut on the kit.** Pull the UPS's plug for two minutes. Only the kit's power, never the site's. | The box stays Online. With a mains UPS, the readings of the water module keep arriving | | | {{pf}} |
:::

## What goes wrong

| What you see | Likely cause | What to do |
|-------------------|----------------------|------------------------------|
| **The box went Offline in a short power cut** | The UPS's battery is worn out; the box is in a socket that only protects against surges; or the site's router lost its power | Pull the UPS's plug on a quiet day and watch. Check which socket the box is in. Ask about the router |
| **After a long cut the box stayed off** | The box's BIOS is not set to power on after power loss, or the UPS does not come back by itself | Set the BIOS ([sheet HW01](#hw-box)). Run the UPS flat on the desk and see that it returns |
| **The UPS beeps, or shows a battery fault** | Its battery is worn out | Change the battery or the UPS, and write the new date on it |
| **The meters do not answer during a cut** | They are powered from the grid | Nothing. It is expected, and it ends by itself |

More is in {{ref:runbooks}}: R1 (a box is offline).

## Not yet proven

- **How long a UPS holds a kit has not been measured.** That is why the minutes are timed at the office and written down.
- No kit has yet been through a real power cut at a site.
- The standard list for a farm kit has no UPS, although every kit is meant to be powered on one. The decision is taken at the survey, and written down.
- The prices are planning figures, not quotes.

@@BUYING@@

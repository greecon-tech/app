Everything in this chapter is done at the office, before the site visit, and it makes install day shorter. About 30 minutes in Greecon and about two hours for the box. {{who:pm}}

### In Greecon

- {{cb}} **Sign in** at `https://app.greecon.earth/login` with **{{ui.greecon_team}}**. You land on **{{ui.today}}**.
- {{cb}} **A new customer:** if they asked through the web page, their request waits under **{{ui.requests_waiting}}** on **{{ui.today}}** (and on **{{ui.requests}}**): press **{{ui.onboard}}**. Otherwise open **{{ui.clients}}** and press **{{ui.onboard_a_client}}** (top right): company name, owner's name, owner's email, then **{{ui.onboard_client}}**. A box appears, **{{ui.client_onboarded}}**: it is the owner's temporary password, shown once. Write it on the handover page or tell it to the owner by phone. Do not send it by email. If a message says someone already has an account with that email, the person is already a customer: add the new site to the customer they already have.
- {{cb}} **Open the customer for setup:** in the customer's row on **{{ui.clients}}** press **{{ui.open_for_setup}}** (on **{{ui.today}}** the same button is **{{ui.open_account}}** for a site that needs a look and **{{ui.continue_setup}}** for a site being set up). You land on the customer's **{{ui.sites}}** page, with a banner saying you are there as Greecon staff, setting it up. Everything you do is recorded under your own name. The setup session lasts four hours: after that, sign in again with **{{ui.greecon_team}}** and press **{{ui.open_for_setup}}** again. What you saved is still there.
- {{cb}} **Make the site:** on **{{ui.sites}}** press **{{ui.add_a_site}}**. In the form (*{{ui.new_site_form}}*) choose **{{ui.what_kind_of_site}}**: **{{kit.template}}**. The page lists what the template will contain. Enter **{{ui.site_name}}** and **{{ui.where_it_is}}**, check **{{ui.currency_of_bills}}** (it starts as ALL) and **{{ui.site_clock}}** (Europe/Tirane), and press **{{ui.create_the_site}}**.
- {{cb}} **Get the install line:** you land on the setup page, titled **{{ui.set_up_site}}** and the site's name, which says `0 of N steps done`. Press **{{ui.add_box}}**. A line appears, beginning `curl -fsSL https://api...` and ending in a code like `GRC-XXXX-XXXX-XXXX`. Copy it with the copy button. It is shown once. The code works once, for seven days. Press **{{ui.i_have_copied_it}}**.

::: stop
**The install line is the box's key.** Anyone with the line can install a box as this site until it is used or has expired. Treat it like a password: not in email or chat, and pasted straight into the box. If it is lost, or the seven days have passed, press **{{ui.replace_box}}** on the same step; it asks you to confirm and shows a new line. The old line then stops working, and the box that uses the new line takes the place of the box now installed.
:::

### The box on your desk

- {{cb}} **Install the operating system** on the box: Debian 12, Ubuntu 22.04 or later, or Raspberry Pi OS 64-bit, with the SSH server on, one user with a long password, and the time zone set to Europe/Tirane. The twenty-minute recipe and the BIOS settings are in {{ref:hardware}}, section 4.3.
- {{cb}} **Connect the box** to your office network and open a terminal on it (a keyboard and screen, or SSH).
- {{cb}} **Paste the install line exactly.** It runs in seven numbered steps and tells you each one: checking the box (and that it can reach Greecon and agrees with it about the time), installing Node.js, making the places the software uses, fetching and checking the Greecon software, giving the box its own credential, starting the service, and waiting to hear that Greecon can see the box. It finishes with `Done. Greecon can see this box.`
- {{cb}} **Refresh the setup page.** **{{step:2}}** now says **{{ui.status_done}}**, with the box's name, its version and "Heard from N seconds ago". You did not press anything to make it so: the platform saw the box.
- {{cb}} **Label the box** with the site name and the date, and pack it. The box keeps its credential when it is moved: unplug it, carry it to the site, plug it in, and it reports from the new place without anything being typed again.
- {{cb}} **Pack the rest** of the kit from the shopping list, the tools, the spares kit and the printed pack.

::: tip
**If the line stops with `STOP:`** it says what to check and how. If it stopped before step 5, *Giving this box its credential*, fix the cause and run the same line again: the code has not been used yet. From step 5 on, the code is used up, and the same line would stop with "Greecon did not give the software to this box". Then run the line again with no code at the end: `curl -fsSL https://api.greecon.earth/edge/install.sh | sudo bash -s --`. That repairs the box and keeps its credential. If it answers "This box has no code and has not been installed before", the box never got its credential: press **{{ui.replace_box}}** and use the new line. The commonest stops are a box that cannot reach Greecon (no internet, a firewall that blocks outgoing HTTPS on port 443, or a clock so far out that secure connections fail), and a code already used or older than seven days. A clock only minutes out does not stop the install: it prints a warning, and the setup page later says its clock is N minutes fast.
:::

::: tip
**The first time, rehearse the whole job on a desk** with a laptop standing in for the meters: {{ref:manual}}, section 3.11. It takes an afternoon and finds the mistakes in the room instead of at the customer's.
:::

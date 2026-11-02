Welcome. This guide is for someone who has just joined Greecon and has never done this job. It assumes nothing. It follows one farm from the first phone call to the day the owner signs, in the order you do things, and says who does each part and what to tell the electrician, who may not know what Greecon is. Read it once from the start (about an hour), then keep it with you. The forms, drawings and tests for a farm follow it, in the last part of this PDF.

## How to use this guide

| What | Use it for |
|----------------------------|--------------------------------------------------|
| **This guide (08)** | The first read, and the map of the job. It holds the electrician's brief and, at the end, the complete farm pack with its forms |
| **09 The electrician's brief** | The same brief on its own, for you to send or hand to the electrician before install day |
| **02 Project Manager Field Manual** | The whole job for every kind of site. Read it when you want the full story, and for the desk rehearsal |
| **03 Hardware Reference** | Every part of a kit in detail: specification, settings, fitting, mistakes to avoid |

Three habits carry you through all of it: **write everything down at the time**, **photograph before you close anything**, and **say "I do not know yet" instead of guessing**. Greecon is built so that the platform tells you when something is not done.

## What Greecon does, in one minute

Greecon watches the water, the electricity and the fields of a small business and tells the right people when something needs attention. On a farm that means how full the water tank is, the pressure in the pipe, whether the pump is running, how wet the soil is and the air temperature.

It does this by **reading, never by controlling**. A small computer called **the box** is fitted at the farm. It reads the equipment through a cable and sends the numbers over the internet to Greecon's **platform**, the website at `app.greecon.earth`. The platform shows the owner whether everything is all right, and sends an email or a text message to the people on a list when it is not.

What the customer is buying is **knowing**: at three in the morning the tank is nearly empty and somebody is told, before the pump runs dry. Greecon does **not** switch the pump, it is **not** a safety system, and you never promise a saving or say "AI". You say what it measures and shows.

## The farm in this guide

We follow one example from start to finish so that every step has a real place. It is made up; your farm will differ in the details, never in the order.

> A small family farm. One greenhouse. A 10 m³ water tank with an electric pump in a small pump house, 40 metres from the greenhouse. A socket in the pump house, and no cable internet.

{{diagram:kit:system}}

| Where | What is fitted | Who fits it |
|---------------|---------------------------------------------|----------------|
| In the greenhouse | A **soil probe** (number 6) and a **weather sensor** (number 7), on one data cable back to the pump house | {{who:pm}} |
| In the tank | A **level transmitter** hung at the bottom, with a fixed cable | {{who:pm}} {{who:e}} |
| On the pipe | A **pressure transmitter** on an isolating valve (the wet connection is the plumber's) | The plumber |
| At the pump's starter | A spare contact, read as a **dry contact**, tells Greecon whether the pump is running | {{who:e}} |
| In the pump house | **One enclosure** holding the converter, the two modules, the 24 V power supply, a 4G router and, if there is room, the box | {{who:pm}} mounts, {{who:e}} powers |

Planning estimate for a kit like this one: {{kit.headline}}

## The parts and the words you will hear

| Word | What it means |
|----------------------|--------------------------------------------------------------------|
| **The platform** | The website where everything is seen and set up. Customers see their own sites; you see the customers you are setting up. |
| **The box** | The small computer at the site. It asks every device for its reading about every ten seconds, sends the numbers to the platform, and says "I am alive" every thirty seconds. If the internet is down it keeps about three days of readings and sends them in order when it returns. |
| **The converter** | A small unit that puts the equipment's data cable on the network, so that the box can reach every device. Greecon sets it at the office. |
| **A module** | A small unit that reads a signal and answers the box with a number. A farm has two: the **4 to 20 mA module** (reads the level, pressure and flow transmitters) and the **pump contact module** (reads whether the pump is running). |
| **A transmitter, a sensor, a probe** | A device that measures something and sends a signal: the water level, the pressure, the soil moisture, the air temperature. |
| **4 to 20 mA** | The standard signal a transmitter sends down two wires. 4 mA means the bottom of its range (an empty tank), 20 mA the top. The range is printed on its label, and it is the one thing the platform asks you for. |
| **The data cable (RS-485)** | One two-wire cable shared by all the devices, from device to device in a line. **No branches.** |
| **A unit number** | Each device on the data cable has its own number: **3, 5, 6 and 7** on a farm. They are set at the office, and you only check them on site. Two devices with the same number answer over each other. |
| **The lock-out** | The customer's own procedure for making a circuit dead and keeping it dead (a lock and a tag) while someone works. The electrician applies it. |
| **The setup list** | The page in the platform with the steps for one site. Most steps turn **Done** by themselves when the platform sees them work. |
| **The install line** | One line you paste into the box to give it to a site. It works **once**, for seven days, and it is secret. |
| **Commissioning** | Checking, once, on site, that what Greecon shows is what the real world is, and then confirming. |
| **Handover** | The owner gets a printed sheet, and you show them the screens and a real alert message arriving. |

## Who does what

| Who | Does | Never does |
|-------------|------------------------------------|---------------------------------|
| {{who:pm}} (you) | The survey, the office preparation, the box, the network, the converter, the data cable, the labels, the sensors in the field, the platform's setup list, commissioning and handover | Works inside a distribution board. Touches the solar panels' wiring, a tank that must be climbed into, wastewater or chemicals. Promises a saving. Says Greecon is a safety system |
| {{who:e}} | All the mains-voltage work: the supply to the enclosure, the pump's run contact, the 4 to 20 mA loops and their 24 V supply, anything inside a board, always under the customer's lock-out | Works on a live conductor for Greecon's sake. Connects anything of Greecon's to a control or a safety circuit |
| The plumber | The wet connections: the pressure transmitter on its valve, and the flow meter if there is one | |
| {{who:c}} (the farmer) | Names the people who are told, shows the way, provides a socket that stays on, starts and stops their own equipment, signs at the end | |
| **The founder** | Gives you your login, signs the papers with the customer, and answers when you are stuck | |

::: stop
**The rules that never bend.**

1. **Greecon only reads.** Never connect a wire from Greecon's equipment to a pump starter, an inverter's control, a valve or any safety circuit.
2. **Anything inside a distribution board is the electrician's work,** with the customer's lock-out on and you watching and writing it down. You never work on mains.
3. **You do the low-voltage and software side only:** the box, the network, the converter, the data cable, the labels and the sensors in the field.
4. **Never** touch the solar panels' wiring, a tank you must climb into, wastewater or chemicals. If the only place for a sensor is there, say it is not possible and write why.
5. **Greecon is not a safety system.** The float switches, relief valves and trips already in the customer's equipment stay the safety layer.
6. **The install line is a password.** Not in email or chat; pasted straight into the box.
7. **Write everything down, and photograph** every label, the wiring before it is closed, the converter's settings.
:::

## The job in nine steps

| | Step | Who | How long |
|-|-------------------------------------|--------------|-------------|
| 1 | **Get ready:** your login, a desk rehearsal | You | The first week |
| 2 | **First call and survey visit:** look, ask, photograph, decide go or no-go | You | 20 minutes, then 1 hour |
| 3 | **Papers:** the order form and the data terms are signed | The founder or you, with the customer | Before anything else |
| 4 | **Buy the kit:** one first, tested on the desk | You | |
| 5 | **Prepare at the office:** the customer and the site in the platform, the box, the numbers, the converter | You | About 30 minutes in the platform and 2 hours for the kit |
| 6 | **Brief the electrician and the customer:** send them what they need | You | Two or three days before |
| 7 | **Install day:** mount, wire, connect, power up | You, the electrician, the plumber, the farmer | 4 to 6 hours |
| 8 | **The setup list and commissioning:** the platform's steps, the real-world checks | You, with the electrician near | About 1 hour |
| 9 | **Handover, then looking after it** | You | 30 minutes, then day 1, 3 and 7 and a 5-minute morning check |

### Step 1. Get ready

A suggested first week (the founder may change it):

| Day | Do |
|-----|-----------------------------------------------------------------|
| 1 | Read this guide. Ask the founder for your login. Sign in at `https://app.greecon.earth/login` and choose **{{ui.greecon_team}}**; you will be asked to choose a password of your own. Never share it. Look at **{{ui.today}}** and **{{ui.clients}}**. **Ctrl+K** (or **/**) opens a search box that finds a client, a site or a page |
| 2 | The **desk rehearsal**: the whole job with a laptop standing in for the kit (Field Manual, PDF 02, section 13). It takes an afternoon and finds the mistakes in the room instead of at a customer's |
| 3 | Read the Hardware Reference (PDF 03) for the parts of a farm kit. Meet the electrician and the plumber the founder names, and fill in the contact sheet at the end of this part |
| 4 to 5 | Buy and bench-test one full kit (step 4). If you can, go with the founder to a survey |

### Step 2. First call and survey visit

The first call decides whether a visit is worth it. At the visit, bring this guide, the survey form from the last part of this PDF, a phone for photographs, a tape measure, a torch and a notebook. **No tools are needed and nothing is opened.** The survey takes about an hour, with the farmer and, if the plan needs one, the electrician.

Ask these, in this order, and write the answers on the survey form. Each answer decides what is measured and what it costs.

| Ask | Why |
|---------------------------------------|--------------------------------------------------|
| Who decides, and who gets called at night? Names, mobile numbers, emails | They become the list of people who are told. Each alert message has an *I have seen this* link, so nobody needs a login to acknowledge it |
| What went wrong in the last twelve months that cost money or a crop? In their words | It is the reason they buy, and what you will show them at handover |
| Which crop, which soil, how deep are the roots? Where in the greenhouse is typical, not the wettest or the driest spot? | It decides where the soil probe goes and what "time to water" means |
| Where are the tank, the pump and its starter? How tall is the tank? What is the pressure in the pipe? Has the starter a spare "running" contact? | The tank height and the pressure decide the transmitters. Without a spare running contact there is no pump contact module, and "the pump is running but no water is flowing" cannot be raised |
| Is there a network socket in the pump house, or a mobile signal (look at your phone there)? | The box needs the internet. A farm is more likely to need a 4G router |
| Is there a socket that stays on, in a place that is dry? | The box and the router need power that is never switched off |
| How far is the greenhouse from the pump house? | The data cable is planned at under 100 metres. Further needs a different plan: ask the founder before you promise anything |
| Who is the customer's electrician, and can they be there on install day? | The mains side is theirs, and Greecon cannot install without them |

**Look at and photograph:** the greenhouse (where the probe and the sensor go), the tank, the pump, the starter, any existing gauge, the pump house (a dry place for the enclosure with 30 cm free and no heat), and the route for the data cable (note any crossing of a power cable).

{{include:_shared/go-nogo.md}}

**At the end of the survey, book the electrician** for install day and tell them you will send a brief (step 6).

### Step 3. The papers

Nothing goes into a customer's building until **two papers** are signed: the **order form** and the **data terms** (what Greecon reads, who sees it, how long it is kept). Greecon keeps the papers; the platform cannot see a signature, so you write down in the platform who signed and on what date (the first step of the setup list). If a paper turns out to be wrong, you can reopen the step.

### Step 4. Buy the kit

Buy **one complete kit first**, test it on your desk, and only then buy more. The two modules (Waveshare) are approved models and the model named is the model you buy; for every other part it is the **specification** that matters, not the brand. Ask three suppliers for a quote on the specification and keep the quotes. The prices below are planning estimates from public shop prices in October 2026. They are not quotes.

{{bom}}

**{{kit.headline}}** One soil probe for each zone of the greenhouse. A second probe takes the next free number (8).

**What you bring on install day** (the spares kit goes in the car too):

{{tools}}

### Step 5. Prepare at the office

Do this at your desk, before you set foot on the farm. It makes install day shorter, and mistakes are cheap at a desk. The full ticked list is under **At the office** in the farm pack (last part). In short, and in this order:

1. **In the platform:** sign in, onboard the customer (or open the customer who asked), press **{{ui.open_for_setup}}**, and make the site from the template **{{kit.template}}**. Write down that the papers are signed. Print **{{ui.install_card_link}}**: it is your list for the visit, and its bottom holds three messages to copy to the customer.
2. **Add the box** and copy the **install line**. It is shown once and works once, for seven days. If you lose it, press **{{ui.replace_box}}** for a new one.
3. **The box on your desk:** install the operating system (Debian 12), connect it, paste the install line. It runs in seven numbered steps and finishes with `Done. Greecon can see this box.` Refresh the platform: **{{step:3}}** now says **{{ui.status_done}}** by itself. Label the box with the site name and the date and pack it.
4. **The numbers:** each device gets its own number on the data cable, set at the office, one at a time: the 4 to 20 mA module **3**, the pump contact module **5**, the soil probe **6**, the weather sensor **7**. Set the soil probe's and the weather sensor's numbers **before they are buried or mounted**. Everything on the cable runs at **9600 baud, 8 data bits, no parity, 1 stop bit**.
5. **The converter:** in its web page, mode **Modbus TCP to RTU (gateway)**, the same serial settings, port 502.
6. **Test the kit on the desk**, label every device with its number, and photograph the labels.

::: tip
**Why at the office?** Two devices with the same number on one cable answer over each other, and a probe that is already in the ground cannot have its number changed. A desk is the cheapest place to find a mistake.
:::

### Step 6. Brief the electrician and the customer

**Two or three days before install day:**

- **The electrician.** Send them **PDF 09, the electrician's brief** (in English and in Albanian), and **phone them** to go through it. Many electricians have never heard of Greecon: the brief says what it is, what is theirs to do, and what is not. Ask them three things: *does the pump's starter have a spare auxiliary contact? is there a circuit that stays on for the pump house? what is the customer's lock-out procedure?* Write the answers on the survey form.
- **The customer.** Send the first two messages from the install card: the first to the farmer, the second to whoever looks after their network. Each is in English with an Albanian draft folded under it. Have someone who writes Albanian every day read the draft before it is sent.
- **The day before:** check the signed papers, the electrician's number, the weather (the soil probe goes in the ground) and the kit, packed from the install card's list.

### Step 7. Install day

**Before anyone touches anything:** the signed papers are in your hand, the electrician is there, and the customer's lock-out is agreed. Then you and the electrician work at the same time, so that nobody waits. The detailed ticked table is under **Install day** in the farm pack. This is how the day can look for our example farm; yours will differ.

| Time | {{who:e}} | {{who:pm}} (you) |
|-------|-------------------------------------|-------------------------------------|
| 08:00 | Walks the site with you and the farmer | Walks with them; photographs everything before you start |
| 08:30 | **Applies the lock-out** on the circuit that feeds the pump house | Unpacks; checks each device's number on its label against the install card |
| 09:00 | Connects the mains to the 24 V supply in the enclosure; connects the starter's spare contact to input 1 of the pump contact module | Mounts the enclosure and in it the converter, the two modules, the supply, the router and the box |
| 10:30 | With the plumber, fits the level and pressure transmitters and wires their 4 to 20 mA loops (level on input 1, pressure on input 2) | Places the soil probe and the weather sensor in the greenhouse; **writes down the probe's depth and where it is** |
| 12:00 | Lunch | Runs the data cable from the converter through the sensors and the modules: one cable, no branches |
| 13:00 | Labels every wire at both ends; photographs inside | Checks the converter's label; puts the SIM in the 4G router and plugs in the box and the converter |
| 13:45 | **Closes up, and removes the lock-out** when you both agree the work is closed up | **Powers up:** the supply, the converter, the router, the box |
| 14:00 | Stays near the phone | Opens the customer for setup again and goes down the setup list (step 8) |

::: stop
**Stop and call the electrician, or the founder,** if: a wire is hot, a label is missing, two devices carry the same number, the farmer asks you to switch or control something, or you are unsure what a cable is. Do not guess and do not improvise on mains.
:::

### Step 8. The setup list and commissioning

On install day, after power-up, you open the customer for setup again (the four-hour session has ended) and go down the setup list. A farm has **eleven** of the twelve steps; the step for the direction of a grid meter is only for sites that have one. The platform turns most of them **Done** by itself.

1. **{{step:1}}**: done at the office.
2. **{{step:2}}** *(optional)*: the customer's prices and the typical month before.
3. **{{step:3}}**: done by itself once the box reports.
4. **{{step:4}}**: press **{{ui.find_equipment}}**. The box looks at the site's network for about a minute and fills in the addresses of what it finds, so nobody types an address. The soil probe and the weather sensor cannot be recognised on a network: their address is entered by hand, from the makers' manuals.
5. **{{step:5}}**: for each transmitter, give the **range printed on its label** (and how tall the tank is). Greecon works out the rest.
6. **{{step:6}}** and **{{step:7}}**: done by themselves. The platform checks that the numbers could be real.
7. **{{step:8}}**: the people to tell, in order, each with a test message you see arrive.
8. **{{step:10}}**: agree the limits with the farmer. **Greecon gives no irrigation advice until the farmer's own "start irrigating below" value is entered**, after the first week of readings. **Frost** works the same way: ask at what air temperature the crop is damaged, and enter it.
9. **{{step:11}}**: write the electrician's name and licence number, or that no electrical work was needed.
10. **{{step:12}}**: greyed out until everything above is done. Then you check the real world against the screen (the tank against a dipstick or the sight gauge, the pressure against the gauge, the pump with the farmer starting it) and press **{{ui.commission_this_site}}** with a note.

The commissioning table in the farm pack also has a **power-cut test** (unplug the box for 30 seconds: it must come back by itself) and an **internet-cut test** (cut the internet for ten minutes: the box keeps its readings and sends them when it returns). They prove the two promises Greecon makes about the box. Write the results down.

### Step 9. Handover, and then looking after it

About 30 minutes with the owner. Print the handover sheet, show them **{{ui.overview}}** (is everything all right, in one sentence), the site's own page, the people who are told, and a live test message arriving on a phone with its *I have seen this* link. Say again what Greecon does not do: it only reads, it is not a safety system, it promises no saving. Both of you sign the handover record.

After that, look after it: a call on **day 1, 3 and 7**, then the five-minute **morning check** on **{{ui.today}}**. If a farm goes quiet, the runbooks in the Field Manual say what to check, in order.

## When you are stuck

Call the founder when: the box will not come **Online** after the checks in the farm pack; a device is **Not found** or **Not sure which** after you have checked its number, speed and wires; anything makes you unsure of safety; the customer asks for something to be switched or controlled; or the electrician is unsure or unwilling. The three most likely problems with a farm are at the end of the farm pack. Never change a number on site to get out of trouble.

## Your contact sheet

::: {.form .short}
| Who | Name | Phone | Email |
|--------------------|-------------------|----------------|----------------------|
| The founder | | | |
| Electrician, first call | | | |
| Electrician, second | | | |
| The plumber | | | |
| The customer's first person | | | |
| The customer's network person (if any) | | | |
:::

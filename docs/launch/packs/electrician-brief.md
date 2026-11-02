You have been asked to help fit a small monitoring system on a farm. This brief says what it is, what is yours to do and what is not, in about ten minutes of reading. It is written for an electrician who has never heard of Greecon. **If anything in it conflicts with the customer's lock-out procedure, the makers' manuals, your own judgement or the law, those come first: stop, and call the project manager.** An Albanian draft follows the English.

## What this is

- **Greecon is a monitoring system.** It reads numbers (the level of a water tank, the pressure in a pipe, whether a pump is running, the moisture of the soil, the air temperature) and shows them to the farm's owner, who is sent a message when something needs attention.
- **It only reads.** Nothing of Greecon's is wired to anything that switches or protects. The pump, its starter and the farm's protection stay exactly as they are.
- **How it works.** The tank and pipe sensors send their signals to a small input module. The module and the two field sensors share one thin data cable. A small computer, "the box", collects the numbers and sends them over the internet. Everything except the sensors sits in **one enclosure in the pump house**.

## What changes in the customer's installation: the whole list

| | What | Where | Whose work |
|-|------------------------------------------|--------------|-------------------------|
| 1 | One new **enclosure** (IP54, IP65 outside) with a **24 V DC supply on a DIN rail**, fed from a circuit that stays on | Pump house | {{who:e}} the mains side; {{who:pm}} fits the devices inside |
| 2 | A **spare auxiliary contact of the pump's starter**, wired as a dry contact to input 1 of a small input module (the "pump contact module"). Optional: if the starter has no spare contact, this is left out | Pump starter | {{who:e}} |
| 3 | **Two or three 4 to 20 mA transmitters** (tank level, pipe pressure and, sometimes, flow), each wired to a second input module and powered from the 24 V supply in series (a "loop") | Tank, pipe | {{who:e}} the loops, with the plumber for the wet parts |
| 4 | **A socket** for the box's plug-in supply and the 4G router, on a circuit that stays on, if the pump house has none | Pump house | {{who:e}} if it is missing |

Nothing else in the customer's board is touched. There are no energy meters on a farm of this kind.

## Your tasks, in order

The project manager works at the same time as you, so that nobody waits. The left edge of each row is black for you and green for the project manager.

::: steps
| | # | Who | Do this |
|--|-|-----|--------------------------------------------|
| {{cb}} | 1 | {{who:e}} | **Before the day.** Read this brief. Tell the project manager: does the pump's starter have a spare auxiliary contact, and of what kind? Is there a circuit that stays on for the pump house? What is the customer's lock-out procedure? |
| {{cb}} | 2 | {{who:e}} {{who:pm}} | **Walk the site together,** with the farmer: where the enclosure goes, where the tank and pipe sensors go. The project manager photographs everything before you start. |
| {{cb}} | 3 | {{who:e}} | **Apply the customer's lock-out** on the circuit that feeds the pump house. |
| {{cb}} | 4 | {{who:e}} | **Connect the mains to the 24 V DIN supply** in the enclosure, as its manual shows, with a fuse or small breaker as needed. Figure F-6. |
| {{cb}} | 5 | {{who:e}} | **If there is a pump to watch:** connect a spare auxiliary contact of the starter, as a **dry contact**, to **input 1 of the pump contact module**, as the module's manual draws it (its DI COM is left unconnected). **Never** to a control circuit, and **never** to the module's relay outputs: the contact only reports. |
| {{cb}} | 6 | {{who:e}} | **Fit the transmitters with the plumber, and wire their 4 to 20 mA loops** with the 24 V supply in series, as the 4 to 20 mA module's manual draws it: **level on input 1, pressure on input 2, the flow meter (if any) on input 3.** The level transmitter hangs at the bottom of the tank, its vented cable fixed, and its wetted parts must be rated for drinking water if the tank holds drinking water. The pressure transmitter goes on the pipe through an isolating valve. Figure F-5. |
| {{cb}} | 7 | {{who:pm}} | Mounts the enclosure and in it the converter, the two modules, the 24 V supply, the router and the box. Runs the low-voltage data cable from the greenhouse to the enclosure. **You do not need to touch it.** |
| {{cb}} | 8 | {{who:e}} {{who:pm}} | **Label every wire at both ends** and **photograph the inside before closing:** the wiring and the labels. Figure F-4. |
| {{cb}} | 9 | {{who:e}} | **Close up, and remove the lock-out** only when you and the project manager agree the work is closed up. |
| {{cb}} | 10 | {{who:pm}} | Powers up the supply, the converter, the router and the box. |
| {{cb}} | 11 | {{who:e}} | **Stay until commissioning is done,** about an hour after power-up, in case a reading shows a wiring fault. If you cannot stay, tell the project manager before the day. |
| {{cb}} | 12 | {{who:e}} | **Give the project manager your name and licence number** (or say that no electrical work was needed). It is written in the customer's record and on the handover sheet. Greecon does not check licences: what you give is the record. |
:::

::: stop
**What you do not do.**

- Do not work on a live conductor. Use the customer's lock-out.
- Do not connect anything of Greecon's to a pump starter's control circuit, an inverter's control, a valve or any safety circuit.
- Do not use the relay outputs of the pump contact module. They are never used.
- Do not change a number, a speed or a setting on a module or on the converter. They are set at the office and only checked on site.
- Do not power a 4 to 20 mA loop from anywhere but the supply in the enclosure.
- Do not open, reset or reconfigure the box or the converter.
:::

{{diagram:kit:enclosure}}

{{diagram:kit:loop}}

{{diagram:kit:power}}

The drawings show how the parts connect, not terminal numbers: follow the makers' manuals for terminal numbers. The drawings' labels are in English.

## What we need from you in writing

::: {.form .pad}
| Field | Answer |
|---------------------|---------------------|
| Your name and licence number (or: no electrical work was needed) | |
| Date, and the farm | |
| Lock-out removed at (time), and by whom | |
| Anything done differently from this brief (for example, another contact of the starter, or no spare contact), and why | |
| Photographs of the inside before closing handed to the project manager | {{cb}} Yes |
:::

**If something is not as this brief says, stop and call the project manager. Do not improvise.**

Project manager: {{line}} Phone: {{line:short}}

Greecon: `info@greecon.earth`

*This brief is Greecon's own description of its kit. It has not been reviewed by a licensed electrician (decision L19). Your own judgement, the makers' manuals, the customer's lock-out procedure and the law come first.*

## Shqip: udhëzimi për elektricistin {.newpage #albanian-brief}

:::::: {lang="sq"}

::: tip
**Draft në shqip.** Duhet lexuar nga dikush që shkruan shqip çdo ditë para se t'i jepet elektricistit (vendimi L12). Versioni anglisht është ai i referencës. Figurat F-4, F-5 dhe F-6 janë më sipër; emrat në to janë në anglisht.
:::

Ju kanë kërkuar të ndihmoni në montimin e një sistemi të vogël monitorimi në një fermë. Ky udhëzim thotë çfarë është, çfarë është detyra juaj dhe çfarë jo, në rreth dhjetë minuta lexim. Është shkruar për një elektricist që nuk ka dëgjuar kurrë për Greecon. **Nëse diçka këtu bie ndesh me procedurën e bllokimit (lock-out) të klientit, me manualet e prodhuesve, me gjykimin tuaj ose me ligjin, ato kanë përparësi: ndaluni dhe thirrni menaxherin e projektit.**

### Çfarë është kjo

- **Greecon është një sistem monitorimi.** Lexon numra (nivelin e ujit në depo, presionin në tub, nëse pompa punon, lagështinë e tokës, temperaturën e ajrit) dhe ia tregon pronarit të fermës, të cilit i dërgohet një mesazh kur diçka kërkon vëmendje.
- **Vetëm lexon.** Asgjë e Greecon nuk lidhet me diçka që ndez, fik ose mbron. Pompa, starteri i saj dhe mbrojtjet e fermës mbeten saktësisht siç janë.
- **Si punon.** Sensorët e depos dhe të tubit dërgojnë sinjalet te një modul i vogël hyrjesh. Moduli dhe dy sensorët e fushës ndajnë një kabllo të hollë të dhënash. Një kompjuter i vogël, "kutia", mbledh numrat dhe i dërgon në internet. Gjithçka, përveç sensorëve, rri në **një dollap në shtëpizën e pompës**.

### Çfarë ndryshon në instalimin e klientit: lista e plotë

| | Çfarë | Ku | Puna e kujt |
|-|------------------------------------------|--------------|-------------------------|
| 1 | Një **dollap** i ri (IP54, IP65 jashtë) me një **furnizim 24 V DC në shinë DIN**, i ushqyer nga një qark që mbetet i ndezur | Shtëpiza e pompës | {{who:e}} ana e rrymës; menaxheri i projektit vendos pajisjet brenda |
| 2 | Një **kontakt rezervë ndihmës i starterit të pompës**, i lidhur si kontakt i thatë me hyrjen 1 të një moduli të vogël hyrjesh ("moduli i kontaktit të pompës"). Opsional: nëse starteri nuk ka kontakt rezervë, kjo lihet jashtë | Starteri i pompës | {{who:e}} |
| 3 | **Dy ose tre sensorë 4–20 mA** (niveli i depos, presioni i tubit dhe, ndonjëherë, rrjedha), secili i lidhur te një modul i dytë hyrjesh dhe i ushqyer nga furnizimi 24 V në seri ("lak") | Depoja, tubi | {{who:e}} lakun, me hidraulikun për pjesët e lagështa |
| 4 | **Një prizë** për furnizimin e kutisë dhe për routerin 4G, në një qark që mbetet i ndezur, nëse shtëpiza nuk ka | Shtëpiza e pompës | {{who:e}} nëse mungon |

Asgjë tjetër në tabelën e klientit nuk preket. Në një fermë të këtij lloji nuk montohen matës energjie.

### Detyrat tuaja, me radhë

Menaxheri i projektit punon në të njëjtën kohë me ju, që askush të mos presë.

1. **Para ditës.** Lexoni këtë udhëzim. Thojini menaxherit: a ka starteri i pompës kontakt rezervë ndihmës, dhe të çfarë lloji? A ka një qark që mbetet i ndezur për shtëpizën e pompës? Cila është procedura e bllokimit (lock-out) e klientit?
2. **Ecni bashkë në vend,** me fermerin: ku vendoset dollapi, ku vendosen sensorët e depos dhe të tubit. Menaxheri fotografon gjithçka para se të filloni.
3. **Vendosni bllokimin (lock-out) e klientit** në qarkun që ushqen shtëpizën e pompës.
4. **Lidhni rrymën me furnizimin 24 V DIN** në dollap, siç e tregon manuali i tij, me siguresë ose çelës automatik të vogël sipas nevojës. Figura F-6.
5. **Nëse ka pompë për të vëzhguar:** lidhni një kontakt rezervë ndihmës të starterit, si **kontakt i thatë**, me **hyrjen 1 të modulit të kontaktit të pompës**, siç e vizaton manuali i modulit (DI COM mbetet e palidhur). **Kurrë** me një qark komande dhe **kurrë** me daljet e relesë të modulit: kontakti vetëm raporton.
6. **Montoni sensorët me hidraulikun dhe lidhni lakun e secilit 4–20 mA** me furnizimin 24 V në seri, siç e vizaton manuali i modulit 4–20 mA: **niveli në hyrjen 1, presioni në hyrjen 2, matësi i rrjedhës (nëse ka) në hyrjen 3.** Sensori i nivelit varet në fund të depos, me kabllon me ajrim të fiksuar, dhe pjesët e tij të lagura duhet të jenë të miratuara për ujë të pijshëm nëse depoja mban ujë të pijshëm. Sensori i presionit vendoset në tub përmes një valvule izoluese. Figura F-5.
7. **Menaxheri i projektit** monton dollapin dhe brenda tij konvertuesin, dy modulet, furnizimin 24 V, routerin dhe kutinë, dhe shtrin kabllon e të dhënave me tension të ulët nga serra te dollapi. **Ju nuk keni nevojë ta prekni.**
8. **Etiketoni çdo tel në të dy skajet** dhe **fotografoni brendësinë para mbylljes:** lidhjet dhe etiketat. Figura F-4.
9. **Mbyllni dhe hiqni bllokimin (lock-out)** vetëm kur ju dhe menaxheri bini dakord që puna është mbyllur.
10. **Menaxheri** ndez furnizimin, konvertuesin, routerin dhe kutinë.
11. **Qëndroni derisa të përfundojë komisionimi,** rreth një orë pas ndezjes, në rast se një lexim tregon defekt në lidhje. Nëse nuk mund të qëndroni, thojini menaxherit para ditës.
12. **Jepini menaxherit emrin dhe numrin e licencës suaj** (ose thoni që nuk u desh punë elektrike). Shkruhet në dosjen e klientit dhe në fletën e dorëzimit. Greecon nuk e kontrollon licencën: ajo që jepni është regjistrimi.

::: stop
**Çfarë nuk bëni.**

- Mos punoni mbi përçues nën tension. Përdorni bllokimin (lock-out) e klientit.
- Mos lidhni asgjë të Greecon me qarkun e komandës së një starteri, me komandën e një inverteri, me një valvul ose me ndonjë qark sigurie.
- Mos përdorni daljet e relesë të modulit të kontaktit të pompës. Ato nuk përdoren kurrë.
- Mos ndryshoni një numër, një shpejtësi ose një cilësim në një modul ose në konvertues. Ato caktohen në zyrë dhe në vend vetëm kontrollohen.
- Mos ushqeni një lak 4–20 mA nga asgjë tjetër përveç furnizimit në dollap.
- Mos hapni, mos rivendosni dhe mos ricaktoni kutinë ose konvertuesin.
:::

### Çfarë na duhet me shkrim nga ju

Emri dhe numri i licencës suaj (ose: nuk u desh punë elektrike). Data dhe ferma. Ora kur u hoq bllokimi dhe nga kush. Çdo gjë e bërë ndryshe nga ky udhëzim (për shembull, një kontakt tjetër i starterit, ose pa kontakt rezervë) dhe pse. Fotografitë e brendësisë para mbylljes, të dorëzuara menaxherit. Fusha për t'i plotësuar janë në tabelën "What we need from you in writing", më sipër.

**Nëse diçka nuk është siç thotë ky udhëzim, ndaluni dhe thirrni menaxherin e projektit. Mos improvizoni.**

*Ky udhëzim është përshkrimi që Greecon bën vetë për kitin e vet. Nuk është rishikuar nga një elektricist i licencuar (vendimi L19). Gjykimi juaj, manualet e prodhuesve, procedura e bllokimit e klientit dhe ligji kanë përparësi.*

::::::

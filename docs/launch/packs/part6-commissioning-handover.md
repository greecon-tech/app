Commissioning is checking, once, on site, that what Greecon shows is what the real world is. Handover is the thirty minutes after it: the owner sees the product working on their own equipment, and is left with what they need. Do them in this order, on install day or the day after, with the electrician still there for the checks that need them. The checks are the ones for the site's kind; the four site packs ({{ref:packs}}) print them as a record with room for the two numbers, and Appendix A has a blank record for any site.

{{who:pm}} {{who:e}} {{who:c}}

::: stop
**Nobody starts, stops or opens equipment for a check except the owner's own person.** They know what else it affects. The project manager reads and compares; the electrician works on the mains side under the lock-out; Greecon only reads.
:::

@@MANUAL 9@@

@@MANUAL 10@@

## [6.3]{.num} What to leave with the customer

Leave the customer with these, and nothing more:

- {{cb}} **The printed handover sheet, signed.** It says where each device is, who is told, what was commissioned and by whom, and how to reach Greecon.
- {{cb}} **The box's label** on the box: the site name and the date. Never a code or a password written on the box.
- {{cb}} **A card** with `info@greecon.earth` and your phone number.
- {{cb}} **Their own logins.** The owner chose a password of their own at their first sign-in; each person on the **{{ui.who_is_told}}** list has a login of their own with the Operator role, so that they can press **{{ui.acknowledge}}**. The temporary passwords were told by phone, never by email.
- {{cb}} **The words** in section 6.2: what Greecon is and is not, how an alert reaches people, and that their data is theirs.

Do not leave: the install line or its code (it is the box's key, and it has been used), any password written down, or a promise of a saving.

**What you keep, for Greecon:** the survey form and every photograph (every meter's label, the wiring before the board was closed, the converter's settings, the box's label) in the shared drive, in a folder named for the customer; the commissioning record with its pairs of numbers, and the internet-cut result, which is the evidence for the statement that the box keeps its readings; and a line in the hardware register for each part: the make and model, the supplier, the date, the serial number or the batch, and the invoice.

## [6.4]{.num} When a check fails

A check that fails is not commissioned. Do not press **{{ui.commission_this_site}}** until it passes. Look, in this order, at what the table says; the longer answers are in Appendix C and in the runbook for a reading that looks wrong.

| Check that fails | Look at first |
|----------------|---------------------------------------------|
| A meter's display and Greecon differ by more than 5 percent | The register and its scale (W against kW: multiply by 0.001); on a meter with 5 A current transformers, the CT ratio set in the meter's menu; a clamp on the wrong phase or cable. Test the register from the box with `greecon-edge modbus-test` against the meter's display |
| Grid direction: export rises when the load is switched on | The clamps are the wrong way round: the electrician turns them, with the lock-out on, and you repeat the check |
| Solar reads more than a few watts at night, or nothing at midday | The solar meter's clamps are on the wrong cable; or the inverter is limited to zero export |
| The tank reading is off by more than 5 percentage points, or above 100 | The reading at the top (range ÷ tank height × 100); the transmitter at the bottom of the tank with its vented cable free; the 4 to 20 mA conversion |
| Pressure is off by more than 0.2 bar | The conversion's bottom and top; the transmitter's range; check the channel with the loop calibrator |
| Flow is off by more than 10 percent | The flow meter's range and conversion; its straight run in the pipe |
| The pump shows running when it is stopped (and the no-flow alert opens) | The pump's running contact is inverted: the electrician swaps its normally-open and normally-closed wires, or uses the opposite contact |
| The reading at 4, 12 and 20 mA is not the bottom, the middle and the top | Re-enter the register's values at 4 and at 20 mA from what you read with the calibrator |
| A test message did not arrive | The address, the number's country code, spam; look at **{{ui.what_was_sent}}** under **{{ui.who_is_told}}** |
| After a power cut the box is not back within 3 minutes | The BIOS "power on after power loss" setting; the clock; `greecon-edge status` and `journalctl -u greecon-edge -n 50 --no-pager` |
| After the internet cut the queue does not empty | `greecon-edge status` and the box's log say what it is waiting for; then the box is offline: see the runbook for an offline box |

Write down what was wrong and what you changed, on the commissioning record. A reading that was wrong stays as it was, with a note: do not edit history.

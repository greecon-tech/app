import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  MAX_NOTIFICATION_CONTACTS,
  alertPriority,
  alertPriorityWords,
  checkContacts,
  checkNotificationSettings,
  isTimeOfDay,
  isTimezone,
  maskDestination,
  normaliseEmail,
  normalisePhone
} from "./notifications";

describe("priorities", () => {
  it("calls critical Act now, warning Check today, and everything lower information", () => {
    expect(alertPriority("critical")).toBe("act_now");
    expect(alertPriority("warning")).toBe("check_today");
    expect(alertPriority("watch")).toBe("fyi");
    expect(alertPriority("info")).toBe("fyi");
    expect(alertPriority("anything else")).toBe("fyi");
  });

  it("uses the words of the communication plan and none of the sign-standard ones", () => {
    expect(Object.values(alertPriorityWords)).toEqual(["Act now", "Check today", "For your information"]);
  });
});

describe("phone numbers", () => {
  it("accepts the usual ways of writing an international number", () => {
    for (const written of ["+355 69 123 4567", "00355691234567", "+355-69-123-4567", " +355 (69) 123 4567 "]) {
      expect(normalisePhone(written), written).toBe("+355691234567");
    }
  });

  it("refuses a number without a country code, rather than guessing the country", () => {
    expect(normalisePhone("069 123 4567")).toBeUndefined();
    expect(normalisePhone("0691234567")).toBeUndefined();
  });

  it("refuses what is too short, too long or not a number", () => {
    for (const bad of ["+355", "+3556912345678901", "call me", "", "+0123456789", "+355 69 12x 4567"]) {
      expect(normalisePhone(bad), bad).toBeUndefined();
    }
  });
});

describe("email addresses", () => {
  it("lowercases and trims a good one", () => {
    expect(normaliseEmail("  Besa@Hotel-Adriatik.Example ")).toBe("besa@hotel-adriatik.example");
  });

  it("refuses what is not one, and more than one", () => {
    for (const bad of ["besa", "besa@", "@hotel.example", "besa@hotel", "a b@hotel.example", "a@hotel.example, b@hotel.example", "<a@hotel.example>", `${"a".repeat(250)}@hotel.example`]) {
      expect(normaliseEmail(bad), bad).toBeUndefined();
    }
  });
});

describe("times and time zones", () => {
  it("accepts 24-hour clock times only", () => {
    expect(["00:00", "07:30", "23:59"].every(isTimeOfDay)).toBe(true);
    for (const bad of ["7:30", "24:00", "07:60", "07.30", "", "7:30 am", 730]) expect(isTimeOfDay(bad), String(bad)).toBe(false);
  });

  it("knows real time zone names and refuses others", () => {
    expect(isTimezone("Europe/Tirane")).toBe(true);
    expect(isTimezone("UTC")).toBe(true);
    for (const bad of ["Mars/Olympus", "", "  ", "x".repeat(70), 3]) expect(isTimezone(bad), String(bad)).toBe(false);
  });
});

describe("hiding part of an address in the delivery log", () => {
  it("keeps enough to recognise it and no more", () => {
    expect(maskDestination("email", "besa@hotel-adriatik.example")).toBe("b••••@hotel-adriatik.example");
    expect(maskDestination("sms", "+355691234567")).toBe("+355 ••• ••• 567");
    expect(maskDestination("email", "nonsense")).toBe("•••");
  });
});

describe("the list of people", () => {
  it("tidies names, addresses and numbers, and keeps their order", () => {
    const { contacts, problems } = checkContacts([
      { name: "  Besa   Krasniqi ", email: "BESA@hotel.example", phone: "00355 69 123 4567" },
      { name: "Plumber", phone: "+355 68 765 4321" }
    ]);
    expect(problems).toEqual([]);
    expect(contacts).toEqual([
      { name: "Besa Krasniqi", email: "besa@hotel.example", phone: "+355691234567" },
      { name: "Plumber", phone: "+355687654321" }
    ]);
  });

  it("keeps an id it was given, so a person edited keeps their place in what was sent", () => {
    expect(checkContacts([{ id: "c-1", name: "A", email: "a@x.example" }]).contacts[0]).toEqual({ id: "c-1", name: "A", email: "a@x.example" });
  });

  it("says what to change, naming the person", () => {
    const { problems } = checkContacts([
      { name: "", email: "a@x.example" },
      { name: "Besa" },
      { name: "Arben", email: "not an address" },
      { name: "Drita", phone: "069 123 4567" },
      "nobody"
    ]);
    expect(problems).toEqual([
      "Person 1 needs a name of up to 80 characters.",
      "Besa needs an email address or a phone number.",
      'Arben: "not an address" is not an email address.',
      "Drita: write the phone number with its country code, for example +355 69 123 4567.",
      "Person 5 is not a person."
    ]);
  });

  it("refuses the same address or number twice, and a list that is too long", () => {
    expect(checkContacts([{ name: "A", email: "a@x.example" }, { name: "B", email: "A@x.example" }]).problems).toEqual(["a@x.example is on the list twice."]);
    expect(checkContacts([{ name: "A", phone: "+355691234567" }, { name: "B", phone: "+355 69 123 4567" }]).problems).toEqual(["+355691234567 is on the list twice."]);
    const many = Array.from({ length: MAX_NOTIFICATION_CONTACTS + 1 }, (_, index) => ({ name: `P${index}`, email: `p${index}@x.example` }));
    expect(checkContacts(many).problems).toEqual([`At most ${MAX_NOTIFICATION_CONTACTS} people can be on the list.`]);
  });

  it("refuses something that is not a list", () => {
    expect(checkContacts({ name: "A" }).problems).toEqual(["Send the people as a list."]);
  });
});

describe("notification settings", () => {
  it("takes what is given and keeps the rest", () => {
    const { settings, problems } = checkNotificationSettings({ quietFrom: "23:00", digestEnabled: false });
    expect(problems).toEqual([]);
    expect(settings).toEqual({ ...DEFAULT_NOTIFICATION_SETTINGS, quietFrom: "23:00", digestEnabled: false });
  });

  it("says what is wrong in the person's words", () => {
    const { problems } = checkNotificationSettings({ timezone: "Mars/Olympus", quietTo: "7am", digestAt: "25:00", digestEnabled: "yes" });
    expect(problems).toEqual([
      '"Mars/Olympus" is not a time zone. Use a name such as Europe/Tirane.',
      "Quiet hours end must be a time such as 07:30, in 24 hours.",
      "The daily message time must be a time such as 07:30, in 24 hours.",
      "The daily message is either on or off."
    ]);
  });

  it("does not change the settings it was based on", () => {
    const base = { ...DEFAULT_NOTIFICATION_SETTINGS };
    checkNotificationSettings({ quietFrom: "21:00" }, base);
    expect(base).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });
});

import { describe, expect, it } from "vitest";
import {
  AlertFacts,
  acknowledgedEmail,
  alertEmail,
  alertSms,
  clockTime,
  digestEmail,
  escalationEmail,
  escalationSms,
  resolvedEmail,
  shortDate,
  smsSafe,
  testEmail,
  testSms
} from "./messages";

const RAISED = Date.parse("2026-10-19T12:05:00Z"); // 14:05 in Tirane (UTC+2 in October)
const facts: AlertFacts = {
  title: "Tank level is critical",
  action: "Check the water supply and refill the tank as soon as it is safe to do so.",
  siteName: "Hotel Adriatik",
  priority: "act_now",
  raisedAtMs: RAISED,
  timezone: "Europe/Tirane"
};
const LINK = "https://app.greecon.example/alerts";

describe("clock and date", () => {
  it("shows the site's own time, 24 hours", () => {
    expect(clockTime(RAISED, "Europe/Tirane")).toBe("14:05");
    expect(clockTime(RAISED, "UTC")).toBe("12:05");
    expect(clockTime(Date.parse("2026-10-19T22:30:00Z"), "Europe/Tirane")).toBe("00:30");
  });

  it("writes the short date the same way every time", () => {
    expect(shortDate(RAISED, "Europe/Tirane")).toBe("Mon 19 Oct");
  });
});

describe("an Act now email", () => {
  const { subject, body } = alertEmail(facts, LINK);

  it("puts the priority, the fact and the site in the subject", () => {
    expect(subject).toBe("Act now: Tank level is critical, Hotel Adriatik");
  });

  it("gives the fact, the time on the site's clock, and the first step, in that order", () => {
    const lines = body.split("\n");
    expect(lines[0]).toBe("Act now: Tank level is critical.");
    expect(lines).toContain("Site: Hotel Adriatik");
    expect(lines).toContain("Raised: 14:05 (Europe/Tirane)");
    expect(lines).toContain("First step: Check the water supply and refill the tank as soon as it is safe to do so.");
    expect(body.indexOf("Raised:")).toBeLessThan(body.indexOf("First step:"));
  });

  it("links to the alert and says what Acknowledge does", () => {
    expect(body).toContain(`Open the alert in Greecon: ${LINK}`);
    expect(body).toContain("press Acknowledge there. That stops the message going on to the next person.");
  });

  it("says only what is true about what Greecon does for the equipment", () => {
    expect(body).toContain("Greecon watches your equipment and tells you. The protection built into your equipment remains the safety layer.");
    expect(body).not.toMatch(/protects|guarantee|safe\b(?! to do)/i);
  });

  it("has no exclamation marks, no capitals shouted, and no emoji", () => {
    expect(body).not.toMatch(/!/);
    expect(body).not.toMatch(/\b[A-Z]{4,}\b/);
    expect(body).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("leaves the link line out when there is no address for the web app", () => {
    expect(alertEmail(facts).body).not.toContain("Open the alert in Greecon");
  });
});

describe("a Check today email", () => {
  it("does not talk about the next person, because nobody is told after", () => {
    const { subject, body } = alertEmail({ ...facts, priority: "check_today", title: "Tank level is low", action: "Plan a refill before the level drops further." }, LINK);
    expect(subject).toBe("Check today: Tank level is low, Hotel Adriatik");
    expect(body).not.toContain("next person");
    expect(body).toContain("press Acknowledge there.");
  });
});

describe("an escalation", () => {
  const previous = { name: "Besa Krasniqi", toldAtMs: RAISED };

  it("says who was told and when, and that this person is next", () => {
    const { subject, body } = escalationEmail(facts, previous, LINK);
    expect(subject).toBe("Act now, not acknowledged: Tank level is critical, Hotel Adriatik");
    expect(body).toContain("Besa Krasniqi was told at 14:05 and has not answered. You are next.");
    expect(body).toContain("First step: Check the water supply");
  });

  it("is a short text as well", () => {
    const text = escalationSms(facts, previous, LINK);
    expect(text).toBe(
      `Act now, not acknowledged: Tank level is critical, Hotel Adriatik. Besa Krasniqi was told 14:05. You are next. Check the water supply and refill the tank as soon as it is safe to do so. ${LINK}`
    );
  });
});

describe("an Act now text", () => {
  it("carries the priority, the fact, the site, the time, the first step and the link", () => {
    expect(alertSms(facts, LINK)).toBe(`Act now: Tank level is critical, Hotel Adriatik, 14:05. ${facts.action} ${LINK}`);
  });

  it("is written without letters that would make it cost double", () => {
    const text = alertSms({ ...facts, siteName: "Hotel Adriatik, Durrës" }, LINK);
    expect(text).toContain("Durres");
    expect(text).not.toMatch(/[^\x20-\x7e]/);
  });

  it("drops the first step before it drops the link when it would be too long", () => {
    const text = alertSms({ ...facts, action: "x".repeat(400) }, LINK);
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text.endsWith(LINK)).toBe(true);
    expect(text).not.toContain("xxxx");
  });

  it("still ends with the link when even the lead is too long", () => {
    const text = alertSms({ ...facts, title: "t".repeat(500) }, LINK);
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text.endsWith(LINK)).toBe(true);
  });
});

describe("making text safe for a phone", () => {
  it("removes marks from letters and straightens quotes and dashes", () => {
    expect(smsSafe("Durrës – “Çam” hotel’s tank…")).toBe('Durres - "Cam" hotel\'s tank...');
  });

  it("replaces what it cannot write, and flattens line breaks", () => {
    expect(smsSafe("tank \u{1F4A7}\nlow")).toBe("tank ? low");
  });
});

describe("the other messages", () => {
  it("tells the others who acknowledged, when, and that it stops there", () => {
    const { subject, body } = acknowledgedEmail(facts, "Besa Krasniqi", Date.parse("2026-10-19T12:07:00Z"), LINK);
    expect(subject).toBe("Acknowledged: Tank level is critical, Hotel Adriatik");
    expect(body.split("\n")[0]).toBe("Acknowledged by Besa Krasniqi at 14:07. The message will not go on to anyone else.");
  });

  it("says resolved only with the time the readings cleared", () => {
    const { subject, body } = resolvedEmail(facts, Date.parse("2026-10-19T12:12:00Z"), LINK);
    expect(subject).toBe("Resolved: Tank level is critical, Hotel Adriatik");
    expect(body).toContain("The latest readings no longer show it (since 14:12).");
  });

  it("makes a test message plain about being only a test", () => {
    const withPhone = testEmail("Hotel Adriatik", true);
    expect(withPhone.subject).toBe("Greecon test message for Hotel Adriatik");
    expect(withPhone.body).toContain("Nothing is wrong and you do not need to do anything.");
    expect(withPhone.body).toContain("A text message was sent to your phone as well.");
    expect(testEmail("Hotel Adriatik", false).body).not.toContain("text message");
    expect(testSms("Hotel Adriatik")).toBe("Greecon test message for Hotel Adriatik. If you can read this, Act now alerts reach you by text. Nothing is wrong.");
  });
});

describe("the morning message", () => {
  const now = Date.parse("2026-10-19T05:30:00Z"); // 07:30 in Tirane
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  it("answers 'is everything all right?' first when it is", () => {
    const { subject, body } = digestEmail(
      {
        customer: "Hotel Adriatik",
        sites: [
          { name: "Hotel Adriatik", state: "stable", reasons: [], lastReadingAtUtc: minutesAgo(2) },
          { name: "Villa Vlora", state: "stable", reasons: [], lastReadingAtUtc: minutesAgo(5) }
        ]
      },
      now,
      "Europe/Tirane",
      "07:30",
      "https://app.greecon.example"
    );
    expect(subject).toBe("Greecon, Mon 19 Oct: Stable. All 2 sites are reporting and nothing needs doing.");
    const lines = body.split("\n");
    expect(lines[0]).toBe("Stable. All 2 sites are reporting and nothing needs doing.");
    expect(lines).toContain("Hotel Adriatik: Stable. Last reading 2 minutes ago.");
    expect(lines).toContain("Villa Vlora: Stable. Last reading 5 minutes ago.");
    expect(body).toContain("each morning at 07:30 (Europe/Tirane) for Hotel Adriatik");
  });

  it("leads with the worst state and names what is wrong at each site", () => {
    const { subject, body } = digestEmail(
      {
        customer: "Hotel Adriatik",
        sites: [
          { name: "Hotel Adriatik", state: "stable", reasons: [], lastReadingAtUtc: minutesAgo(1) },
          { name: "Villa Vlora", state: "attention", reasons: ["Tank level is low"], lastReadingAtUtc: minutesAgo(3) }
        ]
      },
      now,
      "Europe/Tirane",
      "07:30"
    );
    expect(subject).toBe("Greecon, Mon 19 Oct: Attention needed. 1 of 2 sites need a look.");
    expect(body).toContain("Villa Vlora: Attention needed. Tank level is low. Last reading 3 minutes ago.");
  });

  it("puts Action required above Attention needed and says when a site has never reported", () => {
    const { subject, body } = digestEmail(
      {
        customer: "x",
        sites: [
          { name: "A", state: "attention", reasons: ["Battery charge is low."] },
          { name: "B", state: "action", reasons: ["Tank level is critical"] }
        ]
      },
      now,
      "UTC",
      "07:30"
    );
    expect(subject).toContain("Action required. 2 of 2 sites need a look.");
    expect(body).toContain("A: Attention needed. Battery charge is low. No readings have arrived yet.");
  });

  it("does not call a site stable when it cannot tell", () => {
    const { subject } = digestEmail({ customer: "x", sites: [{ name: "A", state: "unknown", reasons: [] }] }, now, "UTC", "07:30");
    expect(subject).toContain("Unknown. 1 of 1 site needs a look.");
  });

  it("says so when there is nothing to report on", () => {
    expect(digestEmail({ customer: "x", sites: [] }, now, "UTC", "07:30").body.split("\n")[0]).toBe("No sites are set up yet.");
  });
});

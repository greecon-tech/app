import { describe, expect, it } from "vitest";
import { KIT_SERIAL, buildInstallCard, describeSerial, siteTemplates, templateByKey } from "./index";

const hotelDevices = () =>
  (templateByKey("hotel")?.devices ?? []).map((device) => ({ name: device.name, deviceType: device.deviceType, ...(device.profile ? { profileKey: device.profile } : {}) }));

describe("the card a project manager takes to the site", () => {
  const card = buildInstallCard({ siteName: "Hotel Adriatik", locationName: "Durrës", customer: "Adriatik Hotels", templateKey: "hotel", devices: hotelDevices() });

  it("lists the site's own devices in the order of the cable, each with the number to set on it", () => {
    expect(card.devices.map((device) => [device.name, device.unit])).toEqual([
      ["Grid meter", 1],
      ["Solar meter", 2],
      ["Water I/O module", 3],
      ["Pump contact module (optional)", 5]
    ]);
    expect(card.devices.map((device) => device.optional)).toEqual([false, false, false, true]);
    expect(card.devices.every((device) => device.known)).toBe(true);
  });

  it("never gives two devices one number, for any kind of site", () => {
    for (const template of siteTemplates) {
      const view = buildInstallCard({ siteName: "x", locationName: "y", templateKey: template.key, devices: template.devices.map((device) => ({ name: device.name, deviceType: device.deviceType, ...(device.profile ? { profileKey: device.profile } : {}) })) });
      const numbers = view.devices.flatMap((device) => (device.unit === undefined ? [] : [device.unit]));
      expect(new Set(numbers).size, template.key).toBe(numbers.length);
    }
  });

  it("says what each is, for a customer who asks, and how it is wired", () => {
    const grid = card.devices[0];
    expect(grid?.model).toBe("Eastron SDM630");
    expect(grid?.purpose).toContain("where the site meets the grid");
    expect(grid?.wiring.join(" ")).toContain("Check the direction");
    expect(card.devices[2]?.wiring.join(" ")).toContain("input 1");
  });

  it("gives one setting for the converter and for every device on the cable", () => {
    expect(card.serial).toBe("9600 baud, 8 data bits, no parity, 1 stop bit");
    expect(describeSerial(KIT_SERIAL)).toBe(card.serial);
    const rows = Object.fromEntries(card.converter.map((row) => [row.setting, row.value]));
    expect(rows["Mode"]).toContain("Modbus TCP to RTU (gateway)");
    expect(rows["TCP port"]).toBe("502");
    expect(rows["Serial speed"]).toBe(card.serial);
  });

  it("says where a meter is delivered at another speed, because the office sets it", () => {
    const single = buildInstallCard({ siteName: "Pump house", locationName: "Berat", templateKey: "water_station", devices: (templateByKey("water_station")?.devices ?? []).map((device) => ({ name: device.name, deviceType: device.deviceType, ...(device.profile ? { profileKey: device.profile } : {}) })) });
    const meter = single.devices.find((device) => device.name === "Pump meter (optional)");
    expect(meter?.delivered).toBe("2400 baud, 8 data bits, no parity, 1 stop bit");
    expect(card.devices[0]?.delivered).toBeUndefined();
  });

  it("lists what to bring from what the site has, and asks for what the kind of site needs", () => {
    expect(card.bring).toContain("Grid meter: Eastron SDM630");
    expect(card.bring).toContain("Pump contact module (optional): Modbus RTU IO 8CH (only if the site has one)");
    expect(card.bring.join(" ")).toContain("4 to 20 mA transmitters");
    expect(card.bring.join(" ")).toContain("signed order form");
    expect(card.ask).toEqual(templateByKey("hotel")?.checklist);
  });

  it("leaves out the transmitters and the supply for a site that has no 4 to 20 mA module", () => {
    const solar = buildInstallCard({ siteName: "Plant", locationName: "Vlorë", templateKey: "solar_grid", devices: (templateByKey("solar_grid")?.devices ?? []).map((device) => ({ name: device.name, deviceType: device.deviceType, ...(device.profile ? { profileKey: device.profile } : {}) })) });
    expect(solar.bring.join(" ")).not.toContain("4 to 20 mA transmitters");
  });

  it("is honest about equipment it does not know", () => {
    const farm = buildInstallCard({ siteName: "Farm", locationName: "Lushnjë", templateKey: "farm_irrigation", devices: (templateByKey("farm_irrigation")?.devices ?? []).map((device) => ({ name: device.name, deviceType: device.deviceType, ...(device.profile ? { profileKey: device.profile } : {}) })) });
    const soil = farm.devices.find((device) => device.name === "Soil probe");
    expect(soil).toMatchObject({ known: false, unit: 6 });
    expect(soil?.purpose).toContain("Use its own datasheet");
    expect(farm.devices.find((device) => device.name === "Weather sensor")).toMatchObject({ known: false, unit: 7 });
  });

  it("still makes a card for a site with no equipment yet, which is every blank site", () => {
    const blank = buildInstallCard({ siteName: "Blank", locationName: "Tiranë", devices: [] });
    expect(blank.devices).toEqual([]);
    expect(blank.bring.length).toBeGreaterThan(3);
    expect(blank.visit.length).toBeGreaterThan(5);
    expect(blank.messages).toHaveLength(3);
  });

  it("tells the visit in the order it happens, ending with the handover", () => {
    expect(card.visit[0]).toContain("signed order form");
    expect(card.visit.findIndex((line) => line.includes("Find equipment"))).toBeLessThan(card.visit.findIndex((line) => line.includes("range printed")));
    expect(card.visit.at(-1)).toContain("handover sheet");
  });

  it("says what the customer's network is asked for, and that nothing is opened inward", () => {
    expect(card.network.join(" ")).toContain("Nothing is opened inward");
    expect(card.network.join(" ")).toContain("only reads");
  });
});

describe("the messages to the customer", () => {
  const card = buildInstallCard({ siteName: "Hotel Adriatik", locationName: "Durrës", customer: "Adriatik Hotels", templateKey: "hotel", devices: hotelDevices() });

  it("are the same three for every site, each in English and in an Albanian draft", () => {
    expect(card.messages.map((message) => message.key)).toEqual(["before", "network", "after"]);
    for (const message of card.messages) {
      expect(message.english.length, message.key).toBeGreaterThan(200);
      expect(message.albanian.length, message.key).toBeGreaterThan(200);
      expect(message.when.length).toBeGreaterThan(10);
    }
  });

  it("name the site, and leave in brackets what only the person sending it knows", () => {
    for (const message of card.messages) {
      expect(message.english, message.key).toContain("Hotel Adriatik");
      expect(message.albanian, message.key).toContain("Hotel Adriatik");
      expect(message.english).toMatch(/\[[^\]]+\]/);
      expect(message.albanian).toMatch(/\[[^\]]+\]/);
    }
    expect(card.messages[0]?.english).toContain("Adriatik Hotels");
    expect(card.messages[0]?.english).toContain("[date]");
    expect(card.messages[0]?.albanian).toContain("[data]");
  });

  it("say the two things that must always be said: it only reads, and it is not a safety system", () => {
    expect(card.messages[0]?.english).toContain("never switches anything on or off");
    expect(card.messages[0]?.english).toContain("not a safety system");
    expect(card.messages[2]?.english).toContain("never controls anything");
    expect(card.messages[2]?.english).toContain("not a safety system");
    expect(card.messages[0]?.albanian.toLowerCase()).toContain("nuk është sistem sigurie");
    expect(card.messages[2]?.albanian.toLowerCase()).toContain("nuk është sistem sigurie");
  });

  it("tell the network administrator what the box does on the network, and that it only reads", () => {
    const network = card.messages[1];
    expect(network?.english).toContain("port 502");
    expect(network?.english).toContain("only reads");
    expect(network?.english).toContain("never looks outside the site's network");
    expect(network?.albanian).toContain("vetëm lexon");
  });

  it("carry no secret, no code and no password", () => {
    for (const message of card.messages) {
      for (const text of [message.english, message.albanian]) {
        expect(text).not.toMatch(/GRC-[A-Z0-9]{4}-/);
        expect(text.toLowerCase()).not.toContain("password");
        expect(text.toLowerCase()).not.toContain("fjalëkalim");
      }
    }
  });

  it("do not promise to switch the electricity off for a site that has no meters to fit", () => {
    const blank = buildInstallCard({ siteName: "Blank", locationName: "Tiranë", devices: [] });
    expect(blank.messages[0]?.english).not.toContain("switched off");
    expect(card.messages[0]?.english).toContain("switched off");
  });
});

import { GREECON_PUBLIC_EMAILS } from "./index";
import { SerialSettings, profileByKey } from "./device-profiles";
import { expectationOf } from "./discovery";
import { templateByKey } from "./site-templates";

// The card a project manager takes to the site: what to bring, what every device is set to, what the converter is set to, how it is
// wired, what to ask of the customer's network, the order of the visit, and the three messages to the customer that are always the same.
// Everything on it is worked out from the site's own equipment, so it never lists a device the site does not have and never forgets one
// it does. Pure, so the same site always gives the same card and it is tested without a screen.

/** Every device on one cable is set to the same speed and parity: the converter has one setting, and so does the cable. */
export const KIT_SERIAL: SerialSettings = { baud: 9600, dataBits: 8, parity: "none", stopBits: 1 };

export function describeSerial(serial: SerialSettings): string {
  return `${serial.baud} baud, ${serial.dataBits} data bits, ${serial.parity === "none" ? "no parity" : `${serial.parity} parity`}, ${serial.stopBits} stop ${serial.stopBits === 1 ? "bit" : "bits"}`;
}

export interface InstallCardInput {
  siteName: string;
  locationName: string;
  customer?: string;
  templateKey?: string;
  devices: ReadonlyArray<{ name: string; deviceType: string; profileKey?: string }>;
}

export interface InstallCardDevice {
  name: string;
  /** Left out where the site can be without it: it was marked optional in the template. */
  optional: boolean;
  /** Whether Greecon knows this equipment: where it does not, the maker's datasheet decides everything below. */
  known: boolean;
  /** "Eastron SDM630" */
  model: string;
  /** What it is for, in a sentence a project manager can say to a customer. */
  purpose: string;
  /** The number to set on it, which is its address on the cable. */
  unit?: number;
  /** What it is set to before it leaves the office, said only where that differs from how it is delivered. */
  delivered?: string;
  /** Where it goes and how it is wired, one line each. */
  wiring: string[];
}

export interface InstallCardMessage {
  key: "before" | "network" | "after";
  title: string;
  /** When it is sent, and to whom. */
  when: string;
  english: string;
  /** A draft for a person to read before it is sent: the interface is English, and what goes to a customer is theirs to word. */
  albanian: string;
}

export interface InstallCardView {
  siteName: string;
  locationName: string;
  customer?: string;
  templateName?: string;
  /** What to ask the customer for and what to look at on the survey, from the kind of site. */
  ask: string[];
  bring: string[];
  converter: Array<{ setting: string; value: string }>;
  serial: string;
  devices: InstallCardDevice[];
  cable: string[];
  network: string[];
  visit: string[];
  messages: InstallCardMessage[];
}

const CONVERTER: Array<{ setting: string; value: string }> = [
  { setting: "Mode", value: "Modbus TCP to RTU (gateway). Not “transparent”, not “raw TCP”, and not “Modbus RTU over TCP”: in those the box's requests reach the cable as noise and nothing answers." },
  { setting: "Serial speed", value: describeSerial(KIT_SERIAL) },
  { setting: "TCP port", value: "502" },
  { setting: "Address on the network", value: "A fixed one: a reservation for the converter in the customer's router, or set in the converter. Greecon finds it either way, but a fixed address does not change under it." }
];

const CABLE = [
  "One cable, daisy chain from the converter to the first device, on to the next. No branches: stars and tees cause the errors that look like random failures.",
  "Shielded twisted pair, the shield joined to ground at one end only, away from power cables.",
  "A to A and B to B at every device. A and B swapped is the commonest mistake: if nothing answers, swap the two wires at the converter.",
  "A 120 Ω resistor across A and B at each end of the cable, only for a run longer than about 50 m or if readings are unreliable.",
  "Every device has its own number and the same speed. They are set at the office; check the label on each, do not change them."
];

const NETWORK = [
  "One network socket for the box and one for the converter (or one port of a switch each), on the same network.",
  "Outgoing internet only: HTTPS (port 443) to api.greecon.earth, and a time service (UDP 123) or the router's own time. Nothing is opened inward: nobody outside connects to the box.",
  "Not on a guest network, and a fixed address for the converter where the customer can give one.",
  "When “Find equipment” is pressed in Greecon, the box looks at the site's own network for about a minute: it tries port 502 on the local addresses and only reads. It never writes to anything and never looks outside the site's network.",
  "On a cellular router, plan on about 1.5 GB a month for a site of this size."
];

const VISIT = [
  "Before touching anything: the signed order form and the data terms are in your hand, the electrician is there, and the customer's lock-out is agreed.",
  "Put the box and the converter in the plant room: power, and a network cable to the router. A box that was enrolled at the office comes online by itself within a minute; otherwise paste its install command (the setup page shows it once).",
  "The electrician fits the meters and the transmitters and wires the contact. You label everything and photograph the wiring, the labels and the displays.",
  "On the setup page, press Find equipment. The box looks at the network and the addresses are filled in. Where something is not found, the page says what to check.",
  "Give the range printed on each transmitter's label (and how tall the tank is). Nobody types a register.",
  "Check the direction of the grid meter with a known load, compare what Greecon shows with the displays you can see, and agree the alert limits with the customer.",
  "Send a test message to each person who is told, and ask them whether it arrived.",
  "Write down who the electrician was, then commission the site and give the customer the handover sheet."
];

function modelOf(profileKey: string | undefined, fallback: string): { model: string; known: boolean } {
  const profile = profileKey ? profileByKey(profileKey) : undefined;
  return profile ? { model: profile.model, known: true } : { model: fallback, known: false };
}

/** The card for a site. Devices are in the order of the cable: by the number each has. */
export function buildInstallCard(input: InstallCardInput): InstallCardView {
  const template = input.templateKey ? templateByKey(input.templateKey) : undefined;
  const devices: InstallCardDevice[] = input.devices.map((device) => {
    const expected = expectationOf(device, input.templateKey);
    const profile = expected.profileKey ? profileByKey(expected.profileKey) : undefined;
    const { model, known } = modelOf(profile?.key, device.name);
    const delivered = profile && (profile.serial.baud !== KIT_SERIAL.baud || profile.serial.parity !== KIT_SERIAL.parity || profile.serial.stopBits !== KIT_SERIAL.stopBits) ? describeSerial(profile.serial) : undefined;
    return {
      name: device.name,
      optional: /\(optional\)/i.test(device.name),
      known,
      model,
      purpose: profile?.description ?? "Greecon does not know this equipment on a network. Use its own datasheet for the address, the speed and the registers.",
      ...(expected.unitId !== undefined ? { unit: expected.unitId } : {}),
      ...(delivered ? { delivered } : {}),
      wiring: profile?.notes ?? []
    };
  });
  devices.sort((a, b) => (a.unit ?? 999) - (b.unit ?? 999));

  const profiles = devices.flatMap((device) => (device.known ? [device] : []));
  const hasAnalog = input.devices.some((device) => device.deviceType === "analog_io_module" || device.profileKey === "waveshare-ai8-water");
  const bring = [
    "The box, installed and tested at the office, and its power supply",
    "The converter, set at the office to the settings below",
    ...devices.map((device) => `${device.name}: ${device.model}${device.optional ? " (only if the site has one)" : ""}`),
    ...(hasAnalog ? ["The 4 to 20 mA transmitters the site needs, and a 24 V DC supply for their loop; the range is printed on each label"] : []),
    "Shielded twisted pair for the RS-485 cable, network patch cords, ferrules, labels",
    "A laptop, a loop calibrator (or a 4 to 20 mA source), a camera, and this card",
    "Copies of the signed order form and the data terms",
    "The electrician's name and number"
  ];

  const where = input.locationName;
  return {
    siteName: input.siteName,
    locationName: where,
    ...(input.customer ? { customer: input.customer } : {}),
    ...(template ? { templateName: template.name } : {}),
    ask: template?.checklist ?? [],
    bring: [...new Set(bring)],
    converter: CONVERTER,
    serial: describeSerial(KIT_SERIAL),
    devices,
    cable: CABLE,
    network: NETWORK,
    visit: VISIT,
    messages: messagesFor(input.siteName, where, input.customer, profiles.length > 0)
  };
}

// ---- The three messages that are always the same -------------------------------------------------------------------------------------

function messagesFor(site: string, place: string, customer: string | undefined, equipment: boolean): InstallCardMessage[] {
  // Read when a card is made, not when this file is loaded: the address is defined in index.ts, which loads this file first.
  const SUPPORT = GREECON_PUBLIC_EMAILS[0];
  const who = customer ? ` (${customer})` : "";
  const before: InstallCardMessage = {
    key: "before",
    title: "Before the installation day",
    when: "To the customer's contact, two or three days before.",
    english: [
      `Subject: Greecon installation at ${site} on [date]`,
      "",
      "Dear [contact name],",
      "",
      `Greecon will fit the monitoring equipment at ${site}${who}, ${place}, on [date], starting at about [time]. It takes about [half a day].`,
      "",
      "Please make sure that:",
      "• A licensed electrician will be there to work on the electrical board (or tell us if you would like us to bring one).",
      "• We can reach the plant room and someone can let us in.",
      "• There is a network socket, or a router, in the plant room, with internet access. We need only outgoing internet (https).",
      ...(equipment ? ["• The electricity may be switched off for a short time while the meters are fitted. Please tell us which hours suit you best."] : []),
      "",
      "Before the day, please send us your last electricity bills and, if the site has a water supply, the water bills, so that we can set the prices correctly.",
      "",
      "Greecon only reads what the equipment measures. It never switches anything on or off, and it is not a safety system.",
      "",
      `[your name] · [your phone] · ${SUPPORT}`
    ].join("\n"),
    albanian: [
      `Tema: Montimi i Greecon te ${site} më [data]`,
      "",
      "I/E nderuar [emri],",
      "",
      `Greecon do të montojë pajisjet e monitorimit te ${site}${who}, ${place}, më [data], rreth orës [ora]. Punimi zgjat rreth [gjysmë dite].`,
      "",
      "Ju lutemi të kujdeseni që:",
      "• Të jetë i pranishëm një elektricist i licencuar për punën në tabelën elektrike (ose na tregoni nëse doni ta sjellim ne).",
      "• Të kemi qasje te dhoma teknike dhe dikush të na hapë derën.",
      "• Në dhomën teknike të ketë një prizë rrjeti, ose një router, me internet. Na duhet vetëm interneti dalës (https).",
      ...(equipment ? ["• Rryma mund të ndërpritet për pak kohë kur montohen matësit. Na tregoni orët që ju përshtaten më mirë."] : []),
      "",
      "Para asaj dite, ju lutemi na dërgoni faturat e fundit të energjisë elektrike dhe, nëse vendi ka ujë të rrjetit, faturat e ujit, që t'i vendosim çmimet saktë.",
      "",
      "Greecon vetëm lexon atë që matin pajisjet. Nuk ndez dhe nuk fik asgjë, dhe nuk është sistem sigurie.",
      "",
      `[emri juaj] · [telefoni juaj] · ${SUPPORT}`
    ].join("\n")
  };

  const network: InstallCardMessage = {
    key: "network",
    title: "For the customer's network administrator",
    when: "To whoever looks after the customer's network, with the first message.",
    english: [
      `Subject: What the Greecon box needs on your network at ${site}`,
      "",
      "Hello,",
      "",
      "Greecon is fitting a small monitoring box and a serial-to-network converter. This is everything they need from your network:",
      "",
      "• One network socket for the box and one for the converter (or one switch port each).",
      "• Outgoing internet: HTTPS (port 443) to api.greecon.earth, and a time service (UDP 123) or the router's own time. Nothing has to be opened inward: nobody outside connects to the box.",
      "• Please do not put them on a guest network. A fixed address (a reservation in the router) for the converter is welcome.",
      "• When someone at the site presses “Find equipment” in Greecon, the box looks at the site's own network for about a minute: it tries port 502 (Modbus) on the local addresses and only reads. It never writes to anything and never looks outside the site's network.",
      "",
      `Questions: ${SUPPORT}`,
      "",
      "[your name]"
    ].join("\n"),
    albanian: [
      `Tema: Çfarë i duhet kutisë Greecon në rrjetin tuaj te ${site}`,
      "",
      "Përshëndetje,",
      "",
      "Greecon po instalon një kuti të vogël monitorimi dhe një konvertues nga serial në rrjet. Kjo është gjithçka që u duhet nga rrjeti juaj:",
      "",
      "• Një prizë rrjeti për kutinë dhe një për konvertuesin (ose nga një portë në switch).",
      "• Internet dalës: HTTPS (porta 443) drejt api.greecon.earth, dhe një shërbim ore (UDP 123) ose ora e vetë router-it. Nuk duhet hapur asgjë nga jashtë: askush nga jashtë nuk lidhet me kutinë.",
      "• Ju lutemi mos i vendosni në rrjetin e mysafirëve. Një adresë fikse (rezervim në router) për konvertuesin është e mirëpritur.",
      "• Kur dikush në vend shtyp «Find equipment» në Greecon, kutia kërkon në rrjetin e vetë vendit për rreth një minutë: provon portën 502 (Modbus) te adresat lokale dhe vetëm lexon. Nuk shkruan asgjë dhe nuk shikon jashtë rrjetit të vendit.",
      "",
      `Pyetje: ${SUPPORT}`,
      "",
      "[emri juaj]"
    ].join("\n")
  };

  const after: InstallCardMessage = {
    key: "after",
    title: "After the handover",
    when: "To the customer's contact, the day the site is commissioned, with the handover sheet.",
    english: [
      `Subject: Greecon is now watching ${site}`,
      "",
      "Dear [contact name],",
      "",
      `Greecon is now watching ${site}. You can sign in at https://app.greecon.earth with the email address we gave you. The handover sheet is attached: it says what was installed, what each reading means and which limits we agreed.`,
      "",
      "What you will receive: an email when something needs attention (and a text message for the most urgent ones, where that is set up), and a short message each day.",
      "",
      "When you get an alert: open the link, read what it says and what to check, and press “I have seen this”.",
      "",
      `If something looks wrong, or you want to change who is told or what the limits are, write to ${SUPPORT}.`,
      "",
      "Greecon only reads; it never controls anything. It is not a safety system and does not replace your own checks.",
      "",
      "[your name]"
    ].join("\n"),
    albanian: [
      `Tema: Greecon tani po e vëzhgon ${site}`,
      "",
      "I/E nderuar [emri],",
      "",
      `Greecon tani po e vëzhgon ${site}. Mund të hyni te https://app.greecon.earth me adresën e email-it që ju kemi dhënë. Fleta e dorëzimit është bashkëngjitur: tregon çfarë u montua, çfarë do të thotë çdo matje dhe me cilët kufij kemi rënë dakord.`,
      "",
      "Çfarë do të merrni: një email kur diçka kërkon vëmendje (dhe një SMS për më urgjentet, aty ku është caktuar), dhe një mesazh të shkurtër çdo ditë.",
      "",
      "Kur merrni një njoftim: hapni lidhjen, lexoni çfarë thotë dhe çfarë të kontrolloni, dhe shtypni «I have seen this».",
      "",
      `Nëse diçka duket gabim, ose doni të ndryshoni kë njoftojmë ose kufijtë, shkruani te ${SUPPORT}.`,
      "",
      "Greecon vetëm lexon; nuk kontrollon asgjë. Nuk është sistem sigurie dhe nuk zëvendëson kontrollet tuaja.",
      "",
      "[emri juaj]"
    ].join("\n")
  };
  return [before, network, after];
}

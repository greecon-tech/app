#!/usr/bin/env node
// A pretend meter, for rehearsing an installation on a desk before the first real site, and for the smoke
// tests. It speaks Modbus TCP, like the converter in front of a real meter, and answers as units 1, 2 and 3:
//
//   input registers 52-53 and 12-13   a power in watts as a 32-bit float, high word first (an Eastron
//                                     SDM630 and an SDM230 give their total active power there)
//   registers 0 to 3                  what a water input module might hold: tank level in tenths of a
//                                     percent, pressure in hundredths of a bar, flow in tenths of a
//                                     litre a minute, and 1 or 0 for the pump running
//
//   node scripts/pretend-meter.mjs                       listens on port 5020 for any machine on the network
//   node scripts/pretend-meter.mjs --port 502 --watts -1800 --tank 12
//   node scripts/pretend-meter.mjs --kit --port 502      the whole kit of a hotel, as the real equipment answers it (see startKit)
//
// In Greecon, give a device this computer's address, the port, and a unit number from 1 to 3; map a power
// reading to input register 52 (float32, scale 0.001) and the water readings to registers 0 to 3.
//
// With --kit nothing is typed in Greecon at all: press "Find equipment" and the box finds the grid meter (unit 1), the solar meter (2), the
// 4 to 20 mA module (3) and the pump contact module (5), and the only thing left to give is the range on each transmitter's label.

import { createServer } from "node:net";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const DEFAULT_VALUES = { watts: 4213.5, tank: 62, pressure: 3.1, flow: 14, pump: 1 };

export function registersFor({ watts, tank, pressure, flow, pump }) {
  const registers = new Map();
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, watts);
  for (const base of [52, 12]) {
    registers.set(base, view.getUint16(0));
    registers.set(base + 1, view.getUint16(2));
  }
  registers.set(0, Math.round(tank * 10));
  registers.set(1, Math.round(pressure * 100));
  registers.set(2, Math.round(flow * 10));
  registers.set(3, pump ? 1 : 0);
  return registers;
}

/** Two 16-bit registers holding a float32, high word first (what an Eastron meter reports). */
export function float32Words(value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value);
  return [view.getUint16(0), view.getUint16(2)];
}

/** One 16-bit register for a signed whole number (a temperature in tenths of a degree, below zero: 65 as 65, -35 as 65501). */
export const int16Word = (value) => Math.round(value) & 0xffff;

/**
 * Starts the pretend meter. Resolves with the port it listens on, a count of the requests it has answered, and a way to stop it.
 *
 * By default every unit answers with the same registers, from `watts`, `tank`, `pressure`, `flow` and `pump`. `maps` gives a unit
 * registers of its own, as separate pieces of equipment on one cable have: { 4: { 0: 243, 1: 118 } } makes unit 4 answer with 243 in
 * register 0 and 118 in register 1 (and nothing at any other address). `set` and `setFloat` change what a unit holds while it runs,
 * the way a tank empties or the sun sets.
 */
export function startMeter({ port = 0, host = "127.0.0.1", units = [1], maps = {}, onRequest, ...values } = {}) {
  const shared = registersFor({ ...DEFAULT_VALUES, ...values });
  const own = new Map(Object.entries(maps).map(([unit, registers]) => [Number(unit), new Map(Object.entries(registers).map(([address, word]) => [Number(address), word]))]));
  const answering = new Set([...units, ...own.keys()]);
  const registersOf = (unit) => own.get(unit) ?? shared;
  let requests = 0;
  const server = createServer((socket) => {
    let pending = Buffer.alloc(0);
    socket.on("error", () => undefined);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 8 && pending.length >= 6 + pending.readUInt16BE(4)) {
        const frame = pending.subarray(0, 6 + pending.readUInt16BE(4));
        pending = pending.subarray(frame.length);
        requests += 1;
        const unit = frame.readUInt8(6);
        const code = frame.readUInt8(7);
        // A unit number nobody has gets no answer at all, as on a real bus.
        if (!answering.has(unit)) continue;
        const start = frame.readUInt16BE(8);
        const count = frame.readUInt16BE(10);
        const header = Buffer.alloc(7);
        frame.copy(header, 0, 0, 2);
        let pdu;
        if (code !== 3 && code !== 4) {
          pdu = Buffer.from([code | 0x80, 1]);
        } else {
          const registers = registersOf(unit);
          const values = Array.from({ length: count }, (_, index) => registers.get(start + index));
          pdu = values.some((value) => value === undefined)
            ? Buffer.from([code | 0x80, 2])
            : Buffer.concat([Buffer.from([code, count * 2]), ...values.map((value) => Buffer.from([value >> 8, value & 0xff]))]);
        }
        header.writeUInt16BE(pdu.length + 1, 4);
        header.writeUInt8(unit, 6);
        socket.write(Buffer.concat([header, pdu]));
        onRequest?.({ unit, code, start, count, from: socket.remoteAddress, refused: (pdu[0] & 0x80) !== 0 });
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () =>
      resolve({
        port: server.address().port,
        requests: () => requests,
        close: () => server.close(),
        /** Puts a number in one register of a unit (which then has registers of its own). */
        set(unit, address, word) {
          if (!own.has(unit)) own.set(unit, new Map(shared));
          own.get(unit).set(address, word);
          answering.add(unit);
        },
        /** Puts a float32 in two registers, high word first. */
        setFloat(unit, address, value) {
          const [high, low] = float32Words(value);
          this.set(unit, address, high);
          this.set(unit, address + 1, low);
        },
        /** Makes a unit stop answering, as a meter does when its cable is pulled; `answerAgain` undoes it. */
        silence(unit) {
          answering.delete(unit);
        },
        answerAgain(unit) {
          answering.add(unit);
        }
      })
    );
  });
}

// ---- The kit, as the real equipment answers it ---------------------------------------------------------------------------------------

/** What a 4 to 20 mA transmitter reports on a Waveshare analog input module: the current in microamps. `top` is the range on the label (a 0 to 5 m
 * transmitter has top 5) and `value` what it measures now, in the same unit: 2.5 m of 5 is 12 mA. */
export const microampsFor = (top, value) => Math.round((4 + 16 * (value / top)) * 1000);

/**
 * The equipment Greecon buys, on one pretend converter, answering the way each piece does (the registers are the makers' own, see
 * packages/shared/src/device-profiles.ts), so that "Find equipment" can be rehearsed with nothing real:
 *
 *   unit 1, 2  Eastron meters. Input registers 0-1: the voltage; 52-53: the total power, 12-13: phase one's power (an SDM630 has both; an
 *              SDM230, `model: "SDM230"`, has only 12), a float32 in watts, high word first. Digital inputs: not supported (exception 1).
 *   unit 3     the 4 to 20 mA module. Input registers 0-7: each channel in microamps. Holding 0x4000: its own address.
 *   unit 5     the pump contact module. Discrete inputs 0-7. Holding 0x4000: its own address.
 *
 * `others` are units of equipment Greecon does not know (a battery, a soil probe): { 6: { holding: { 0: 243 } } } is a unit 6 that holds 243 in its
 * holding register 0 and refuses everything else, so it is there on the cable and is not recognised.
 *
 * A unit nobody has is silent, or (`absent: "exception"`) answered at once by the converter with Modbus exception 11. Reads only: any write
 * function code is answered with exception 1, as the equipment's own firmware would for a function it does not do here.
 */
export function startKit({
  port = 0,
  host = "127.0.0.1",
  meters = { 1: { watts: 1800 }, 2: { watts: 5200 } },
  analog = { 3: { channels: [12000, 8960, 5120] } },
  digital = { 5: { inputs: [1] } },
  others = {},
  absent = "exception",
  onRequest
} = {}) {
  const units = new Map();
  const voltsOf = new Map();
  const modelOf = new Map();
  const setMeter = (unit, { watts = 0, volts = 231, model = "SDM630" } = {}) => {
    voltsOf.set(unit, volts);
    modelOf.set(unit, model);
    const input = new Map();
    const [vh, vl] = float32Words(volts);
    input.set(0, vh).set(1, vl).set(2, 0);
    const [wh, wl] = float32Words(watts);
    // An SDM630 has the total at 52 and phase one's power at 12; an SDM230 has its total at 12 and nothing at 52.
    const [ph, pl] = float32Words(model === "SDM630" ? watts / 3 : watts);
    input.set(12, ph).set(13, pl);
    if (model === "SDM630") input.set(52, wh).set(53, wl);
    units.set(unit, { input, holding: new Map(), discrete: null });
  };
  for (const [unit, options] of Object.entries(meters)) setMeter(Number(unit), options);
  for (const [unit, { channels = [] }] of Object.entries(analog)) {
    const input = new Map(Array.from({ length: 8 }, (_, index) => [index, channels[index] ?? 0]));
    units.set(Number(unit), { input, holding: new Map([[0x4000, Number(unit)]]), discrete: null });
  }
  for (const [unit, { inputs = [] }] of Object.entries(digital)) {
    const discrete = new Map(Array.from({ length: 8 }, (_, index) => [index, inputs[index] ? 1 : 0]));
    units.set(Number(unit), { input: new Map(), holding: new Map([[0x4000, Number(unit)]]), discrete });
  }
  for (const [unit, { holding = {} }] of Object.entries(others)) {
    units.set(Number(unit), { input: new Map(), holding: new Map(Object.entries(holding).map(([address, word]) => [Number(address), word])), discrete: null });
  }
  let requests = 0;
  let silence = new Set();
  const server = createServer((socket) => {
    let pending = Buffer.alloc(0);
    socket.on("error", () => undefined);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 8 && pending.length >= 6 + pending.readUInt16BE(4)) {
        const frame = pending.subarray(0, 6 + pending.readUInt16BE(4));
        pending = pending.subarray(frame.length);
        requests += 1;
        const unit = frame.readUInt8(6);
        const code = frame.readUInt8(7);
        const header = Buffer.alloc(7);
        frame.copy(header, 0, 0, 2);
        header.writeUInt8(unit, 6);
        const answer = (pdu) => {
          header.writeUInt16BE(pdu.length + 1, 4);
          socket.write(Buffer.concat([header, pdu]));
          onRequest?.({ unit, code, from: socket.remoteAddress, refused: (pdu[0] & 0x80) !== 0 });
        };
        const tables = units.get(unit);
        if (!tables || silence.has(unit)) {
          if (absent === "exception" && !silence.has(unit)) answer(Buffer.from([code | 0x80, 11]));
          continue;
        }
        const start = frame.readUInt16BE(8);
        const count = frame.readUInt16BE(10);
        if (code === 2) {
          if (!tables.discrete) {
            answer(Buffer.from([code | 0x80, 1]));
            continue;
          }
          const bytes = Buffer.alloc(Math.ceil(count / 8));
          let missing = false;
          for (let index = 0; index < count; index += 1) {
            const bit = tables.discrete.get(start + index);
            if (bit === undefined) missing = true;
            else if (bit) bytes[Math.floor(index / 8)] |= 1 << index % 8;
          }
          answer(missing ? Buffer.from([code | 0x80, 2]) : Buffer.concat([Buffer.from([code, bytes.length]), bytes]));
        } else if (code === 3 || code === 4) {
          const registers = code === 3 ? tables.holding : tables.input;
          const words = Array.from({ length: count }, (_, index) => registers.get(start + index));
          answer(
            words.some((word) => word === undefined)
              ? Buffer.from([code | 0x80, 2])
              : Buffer.concat([Buffer.from([code, count * 2]), ...words.map((word) => Buffer.from([word >> 8, word & 0xff]))])
          );
        } else {
          answer(Buffer.from([code | 0x80, 1]));
        }
      }
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () =>
      resolve({
        host,
        port: server.address().port,
        requests: () => requests,
        close: () => server.close(),
        /** The power a meter reads now, in watts: positive is energy coming in. It stays the model it was. */
        setWatts(unit, watts, model = modelOf.get(unit) ?? "SDM630") {
          setMeter(unit, { watts, volts: voltsOf.get(unit) ?? 231, model });
        },
        /** One channel of the 4 to 20 mA module, counted from 1 as its terminals are, in microamps (see microampsFor). */
        setChannel(unit, channel, microamps) {
          units.get(unit)?.input.set(channel - 1, microamps);
        },
        /** A holding register of equipment Greecon does not know (see `others`). */
        setHolding(unit, address, word) {
          units.get(unit)?.holding.set(address, word);
        },
        /** The pump contact: 1 closed, 0 open. */
        setContact(unit, input, closed) {
          units.get(unit)?.discrete?.set(input - 1, closed ? 1 : 0);
        },
        /** Makes a unit stop answering, as a device does when its cable is pulled; `answerAgain` undoes it. */
        silence: (unit) => silence.add(unit),
        answerAgain: (unit) => silence.delete(unit)
      })
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // "--watts -1800" (power sent to the grid) reads as an option with no value to parseArgs; join them as "--watts=-1800".
  const raw = process.argv.slice(2);
  const args = [];
  for (let index = 0; index < raw.length; index += 1) {
    const next = raw[index + 1];
    if (raw[index]?.startsWith("--") && !raw[index].includes("=") && next !== undefined && /^-\d/.test(next)) {
      args.push(`${raw[index]}=${next}`);
      index += 1;
    } else {
      args.push(raw[index]);
    }
  }
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", default: "5020" },
      units: { type: "string", default: "1,2,3" },
      watts: { type: "string" },
      tank: { type: "string" },
      pressure: { type: "string" },
      flow: { type: "string" },
      pump: { type: "string" },
      kit: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });
  if (values.help) {
    console.log("Usage: node scripts/pretend-meter.mjs [--port 5020] [--units 1,2,3] [--watts 4213.5] [--tank 62] [--pressure 3.1] [--flow 14] [--pump 1]\n       node scripts/pretend-meter.mjs --kit [--port 502]   the whole kit of a hotel, for rehearsing Find equipment");
    process.exit(0);
  }
  if (values.kit) {
    const seenByKit = new Set();
    const kit = await startKit({
      port: Number(values.port),
      host: "0.0.0.0",
      onRequest: ({ unit, code, from, refused }) => {
        const key = `${from} unit ${unit} function ${code}${refused ? " refused" : ""}`;
        if (!seenByKit.has(key)) {
          seenByKit.add(key);
          console.log(`${new Date().toISOString().slice(11, 19)}  ${from} asked unit ${unit} (function ${code})${refused ? " and was refused" : ""}`);
        }
      }
    });
    console.log(`Pretend kit listening on port ${kit.port}: unit 1 grid meter, 2 solar meter, 3 4 to 20 mA module (tank 12 mA, pressure 8.96 mA, flow 5.12 mA), 5 pump contact (closed). Stop it with Ctrl+C.`);
    await new Promise(() => undefined);
  }
  const number = (name) => (values[name] === undefined ? undefined : Number(values[name]));
  for (const name of ["watts", "tank", "pressure", "flow", "pump"]) {
    if (values[name] !== undefined && !Number.isFinite(number(name))) {
      console.error(`--${name} must be a number.`);
      process.exit(2);
    }
  }
  const units = values.units.split(",").map((unit) => Number(unit.trim()));
  if (units.length === 0 || units.some((unit) => !Number.isInteger(unit) || unit < 1 || unit > 247)) {
    console.error("--units must be unit numbers from 1 to 247, separated by commas.");
    process.exit(2);
  }
  const seen = new Set();
  const meter = await startMeter({
    port: Number(values.port),
    host: "0.0.0.0",
    units,
    ...Object.fromEntries(["watts", "tank", "pressure", "flow", "pump"].filter((name) => values[name] !== undefined).map((name) => [name, number(name)])),
    onRequest: ({ unit, start, count, from, refused }) => {
      const key = `${from} unit ${unit} ${start}+${count}${refused ? " refused" : ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.log(`${new Date().toISOString().slice(11, 19)}  ${from} read ${count} register(s) from ${start} on unit ${unit}${refused ? " (and was told there is nothing there)" : ""}`);
      }
    }
  });
  console.log(`Pretend meter listening on port ${meter.port}, answering as unit(s) ${units.join(", ")}. Stop it with Ctrl+C.`);
}

import { createServer, Server, Socket } from "node:net";
import { AddressInfo } from "node:net";

// A Modbus TCP device for tests, speaking the real wire protocol over a real socket, so the driver is
// exercised the way it will be on site: frames that arrive in pieces, a unit that does not answer, a
// register that does not exist, a converter that drops the connection.

type RegisterTable = Map<number, number>;

interface Unit {
  holding: RegisterTable;
  input: RegisterTable;
}

export interface FakeModbusServer {
  host: string;
  port: number;
  /** Requests answered or refused so far, including those for a unit that does not exist. */
  requests: number;
  setRegister(unit: number, type: "holding" | "input", address: number, value: number): void;
  setFloat32(unit: number, type: "holding" | "input", address: number, value: number, wordOrder?: "big" | "little"): void;
  setUint32(unit: number, type: "holding" | "input", address: number, value: number, wordOrder?: "big" | "little"): void;
  /** Remove a unit: the converter forwards the request and nothing answers, so the request times out. */
  removeUnit(unit: number): void;
  /** Close every open connection, as a converter that is power-cycled would. */
  dropConnections(): void;
  /** Answer after this long. */
  setDelay(ms: number): void;
  connections(): number;
  close(): Promise<void>;
}

export async function startFakeModbusServer(units: number[] = [1]): Promise<FakeModbusServer> {
  const table = new Map<number, Unit>();
  for (const unit of units) table.set(unit, { holding: new Map(), input: new Map() });
  const sockets = new Set<Socket>();
  let delayMs = 0;
  const state = { requests: 0 };

  const respond = (socket: Socket, frame: Buffer) => {
    const send = () => {
      if (!socket.destroyed) socket.write(frame);
    };
    if (delayMs > 0) setTimeout(send, delayMs);
    else send();
  };

  const handle = (socket: Socket, request: Buffer) => {
    state.requests += 1;
    const transaction = request.subarray(0, 2);
    const unitId = request.readUInt8(6);
    const functionCode = request.readUInt8(7);
    const unit = table.get(unitId);
    if (!unit) return; // Nothing answers for a unit that is not there.

    const frame = (pdu: Buffer): Buffer => {
      const header = Buffer.alloc(7);
      transaction.copy(header, 0);
      header.writeUInt16BE(0, 2);
      header.writeUInt16BE(pdu.length + 1, 4);
      header.writeUInt8(unitId, 6);
      return Buffer.concat([header, pdu]);
    };
    const exception = (code: number) => respond(socket, frame(Buffer.from([functionCode | 0x80, code])));

    if (functionCode !== 3 && functionCode !== 4) return exception(1);
    const start = request.readUInt16BE(8);
    const quantity = request.readUInt16BE(10);
    const registers = functionCode === 3 ? unit.holding : unit.input;

    const data = Buffer.alloc(quantity * 2);
    for (let index = 0; index < quantity; index += 1) {
      const value = registers.get(start + index);
      if (value === undefined) return exception(2);
      data.writeUInt16BE(value, index * 2);
    }
    respond(socket, frame(Buffer.concat([Buffer.from([functionCode, data.length]), data])));
  };

  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      // A frame is the 6-byte header plus the length it announces: frames can arrive joined or in pieces.
      while (pending.length >= 6) {
        const total = 6 + pending.readUInt16BE(4);
        if (pending.length < total) break;
        handle(socket, pending.subarray(0, total));
        pending = pending.subarray(total);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const unitOf = (unit: number): Unit => {
    let found = table.get(unit);
    if (!found) {
      found = { holding: new Map(), input: new Map() };
      table.set(unit, found);
    }
    return found;
  };
  const registersOf = (unit: number, type: "holding" | "input") => (type === "holding" ? unitOf(unit).holding : unitOf(unit).input);

  const writeWords = (unit: number, type: "holding" | "input", address: number, bits: number, wordOrder: "big" | "little") => {
    const high = (bits >>> 16) & 0xffff;
    const low = bits & 0xffff;
    registersOf(unit, type).set(address, wordOrder === "big" ? high : low);
    registersOf(unit, type).set(address + 1, wordOrder === "big" ? low : high);
  };

  return {
    host: "127.0.0.1",
    port: (server.address() as AddressInfo).port,
    get requests() {
      return state.requests;
    },
    setRegister: (unit, type, address, value) => void registersOf(unit, type).set(address, value & 0xffff),
    setFloat32: (unit, type, address, value, wordOrder = "big") => {
      const view = new DataView(new ArrayBuffer(4));
      view.setFloat32(0, value);
      writeWords(unit, type, address, view.getUint32(0), wordOrder);
    },
    setUint32: (unit, type, address, value, wordOrder = "big") => writeWords(unit, type, address, value >>> 0, wordOrder),
    removeUnit: (unit) => void table.delete(unit),
    dropConnections: () => {
      for (const socket of sockets) socket.destroy();
    },
    setDelay: (ms) => {
      delayMs = ms;
    },
    connections: () => sockets.size,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      })
  };
}

import ModbusRTU from "modbus-serial";
import type { ModbusConnection, ModbusRegisterType } from "@greecon/shared";

// Reads registers from devices on the site's network. One TCP connection is kept per address and port
// (a converter in front of several meters is one connection, each meter its own unit number) and
// requests on it go one at a time, because that is all such a converter can do. A connection that
// fails is closed and opened again by the next request.

export interface RegisterReader {
  /** The 16-bit values of `count` registers starting at `address`, or an error saying why not. */
  read(connection: ModbusConnection, registerType: ModbusRegisterType, address: number, count: number): Promise<number[]>;
  /** Close the connections to addresses that are no longer in use. */
  keepOnly(addresses: ReadonlyArray<Pick<ModbusConnection, "host" | "port">>): Promise<void>;
  close(): Promise<void>;
}

/** Why a read failed, in terms a person at the site can act on. `transport` means the device or the
 * way to it is not answering: there is no point asking it for anything else this round. A refusal of
 * one register is the device answering, and the other registers may be fine. */
export class ModbusReadError extends Error {
  constructor(
    message: string,
    readonly kind: "transport" | "refused"
  ) {
    super(message);
    this.name = "ModbusReadError";
  }
}

export interface ReaderOptions {
  /** Longest to wait for an answer to one request. */
  requestTimeoutMs?: number;
  /** Longest to wait for a connection to open. */
  connectTimeoutMs?: number;
}

interface Entry {
  client: ModbusRTU;
  /** Whether the connection is believed to be open. The library's own flag still says open after the
   * connection has been closed, so this one is kept here: set when a connection opens, cleared when it
   * is closed or the other end closes it. */
  open: boolean;
  /** Requests are chained: the next starts when the one before has finished, however it ended. */
  tail: Promise<unknown>;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 2500;
const DEFAULT_CONNECT_TIMEOUT_MS = 4000;

/** Modbus exception codes a device answers a refused request with, in words. */
const EXCEPTIONS: Record<number, string> = {
  1: "does not support reading this kind of register (illegal function)",
  2: "has no register at that address (illegal data address)",
  3: "refused the request (illegal data value)",
  4: "reported an internal fault (slave device failure)",
  6: "is busy: try again",
  10: "could not be reached by its converter (gateway path unavailable)",
  11: "did not answer its converter (gateway target failed to respond)"
};

export class ModbusTcpReader implements RegisterReader {
  private readonly entries = new Map<string, Entry>();
  private readonly requestTimeoutMs: number;
  private readonly connectTimeoutMs: number;

  constructor(options: ReaderOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  }

  read(connection: ModbusConnection, registerType: ModbusRegisterType, address: number, count: number): Promise<number[]> {
    const entry = this.entryFor(connection);
    const run = async (): Promise<number[]> => {
      try {
        if (!entry.open) await this.open(entry, connection);
        entry.client.setID(connection.unitId);
        const result = registerType === "holding" ? await entry.client.readHoldingRegisters(address, count) : await entry.client.readInputRegisters(address, count);
        return result.data;
      } catch (error) {
        throw await this.explain(error, connection, registerType, address, entry);
      }
    };
    // Whatever happened to the request before, this one runs after it.
    const next = entry.tail.then(run, run);
    entry.tail = next.catch(() => undefined);
    return next;
  }

  async keepOnly(addresses: ReadonlyArray<Pick<ModbusConnection, "host" | "port">>): Promise<void> {
    const wanted = new Set(addresses.map((address) => keyOf(address)));
    for (const [key, entry] of this.entries) {
      if (wanted.has(key)) continue;
      this.entries.delete(key);
      await closeQuietly(entry.client);
    }
  }

  async close(): Promise<void> {
    const entries = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(entries.map((entry) => closeQuietly(entry.client)));
  }

  private entryFor(connection: ModbusConnection): Entry {
    const key = keyOf(connection);
    let entry = this.entries.get(key);
    if (!entry) {
      const client = new ModbusRTU();
      client.setTimeout(this.requestTimeoutMs);
      const created: Entry = { client, open: false, tail: Promise.resolve() };
      // A socket error with nobody listening would end the process. The request that was waiting on
      // it fails and says why; the connection is replaced on the next one.
      client.on("error", () => {
        created.open = false;
      });
      client.on("close", () => {
        created.open = false;
      });
      entry = created;
      this.entries.set(key, entry);
    }
    return entry;
  }

  private async open(entry: Entry, connection: ModbusConnection): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("connect timed out"), { code: "ETIMEDOUT", errno: "ETIMEDOUT" })), this.connectTimeoutMs);
    });
    try {
      await Promise.race([entry.client.connectTCP(connection.host, { port: connection.port }), timedOut]);
      entry.client.setTimeout(this.requestTimeoutMs);
      entry.open = true;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Turns what the library threw into one sentence, and closes a connection that cannot be trusted. */
  private async explain(error: unknown, connection: ModbusConnection, registerType: ModbusRegisterType, address: number, entry: Entry): Promise<ModbusReadError> {
    const where = `${connection.host}:${connection.port} (unit ${connection.unitId})`;
    const failure = error as { errno?: string | number; code?: string; modbusCode?: number; message?: string };
    const code = String(failure.code ?? failure.errno ?? "");

    if (typeof failure.modbusCode === "number") {
      const meaning = EXCEPTIONS[failure.modbusCode] ?? `answered with Modbus exception ${failure.modbusCode}`;
      const hint = failure.modbusCode === 2 ? ` Check the address: a manual that says ${registerType === "input" ? "3" : "4"}${String(address + 1).padStart(4, "0")} means address ${address}.` : "";
      return new ModbusReadError(`${where} ${meaning} for ${registerType} register ${address}.${hint}`, "refused");
    }

    // Any other failure leaves the connection in an unknown state: start again on the next request.
    entry.open = false;
    await closeQuietly(entry.client);

    if (code === "ETIMEDOUT" || /timed out/i.test(failure.message ?? "")) {
      return new ModbusReadError(`no answer from ${where}. Check the unit number, the cable and the converter's serial settings.`, "transport");
    }
    if (code === "ECONNREFUSED") {
      return new ModbusReadError(`${connection.host}:${connection.port} refused the connection. Check the port number and that the converter is switched on.`, "transport");
    }
    if (["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"].includes(code)) {
      return new ModbusReadError(`cannot reach ${connection.host}. Check the address and the network cable.`, "transport");
    }
    if (code === "ECONNRESET" || code === "EPIPE") {
      return new ModbusReadError(`the connection to ${connection.host}:${connection.port} was dropped.`, "transport");
    }
    return new ModbusReadError(`${where}: ${(failure.message ?? "unknown error").slice(0, 160)}`, "transport");
  }
}

function keyOf(address: Pick<ModbusConnection, "host" | "port">): string {
  return `${address.host.toLowerCase()}:${address.port}`;
}

async function closeQuietly(client: ModbusRTU): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      client.close(() => resolve());
    } catch {
      resolve();
    }
    // A close that never calls back (the connection was already gone) must not hold anything up.
    setTimeout(resolve, 100).unref();
  });
}

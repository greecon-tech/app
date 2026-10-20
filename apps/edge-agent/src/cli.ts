import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { describeAge, modbusDataTypes, modbusRegisterTypes, modbusWordOrders, readModbusValue, registersFor, validateConnection, validatePointSource } from "@greecon/shared";
import type { ModbusDataType, ModbusRegisterType, ModbusWordOrder, PointSource } from "@greecon/shared";
import { DEFAULT_IDENTITY_FILE, IdentityError, loadIdentity } from "./identity";
import { startMqttBridge } from "./mqtt-bridge";
import { ModbusReadError, ModbusTcpReader } from "./modbus/reader";
import { enrol, PlatformError } from "./platform-client";
import { EdgeRuntime, RuntimeLog, StatusFile } from "./runtime";
import { readJsonFile } from "./state-files";
import { AGENT_VERSION } from "./version";

const out = (line: string) => process.stdout.write(`${line}\n`);
const fail = (line: string) => process.stderr.write(`${line}\n`);

const HELP = `Greecon edge ${AGENT_VERSION}

  greecon-edge run                        Read the site's devices and report to Greecon (what the service runs)
  greecon-edge enrol --api URL --code C   Get this box's credential with the code from the site's setup page
  greecon-edge status                     Say how this box is doing; exits 1 if it is not reporting
  greecon-edge modbus-test --host H --unit N --type input|holding --address A --data-type T
                                          Read one register from a device, to check wiring and settings
  greecon-edge version
`;

const log: RuntimeLog = { info: out, warn: (line) => out(`WARNING ${line}`), error: (line) => fail(`ERROR ${line}`) };

export function stateDirectory(env: Record<string, string | undefined> = process.env): string {
  // systemd sets STATE_DIRECTORY from StateDirectory= and may join several directories with a colon.
  return env.STATE_DIRECTORY?.split(":")[0] || "/var/lib/greecon-edge";
}

export async function main(argv: string[], env: Record<string, string | undefined> = process.env): Promise<number> {
  const [command = "run", ...rest] = argv;
  switch (command) {
    case "run":
      return run(env);
    case "enrol":
      return enrolCommand(rest, env);
    case "status":
      return statusCommand(env);
    case "modbus-test":
      return modbusTest(rest);
    case "version":
    case "--version":
      out(AGENT_VERSION);
      return 0;
    case "help":
    case "--help":
    case "-h":
      out(HELP);
      return 0;
    default:
      fail(`Unknown command "${command}".\n\n${HELP}`);
      return 2;
  }
}

async function run(env: Record<string, string | undefined>): Promise<number> {
  let identity;
  try {
    identity = loadIdentity(env);
  } catch (error) {
    if (error instanceof IdentityError) {
      fail(error.message);
      return 1;
    }
    throw error;
  }

  // Sites with many devices can ask for a longer queue, at the cost of memory.
  const queued = Number(env.GREECON_BUFFER_MAX_MESSAGES);
  const runtime = new EdgeRuntime({
    identity,
    stateDir: stateDirectory(env),
    log,
    updateHome: env.GREECON_EDGE_HOME,
    ...(Number.isInteger(queued) && queued >= 1000 && queued <= 1_000_000 ? { bufferMaxMessages: queued } : {})
  });
  const bridge = env.MQTT_URL ? startMqttBridge(env.MQTT_URL, identity, runtime.outbox, log) : undefined;
  runtime.start();

  await new Promise<void>((resolve) => {
    const stop = () => resolve();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  });
  await bridge?.stop();
  await runtime.stop();
  return 0;
}

async function enrolCommand(args: string[], env: Record<string, string | undefined>): Promise<number> {
  const { values } = parseArgs({ args, options: { api: { type: "string" }, code: { type: "string" }, identity: { type: "string" } } });
  if (!values.api || !values.code) {
    fail("Usage: greecon-edge enrol --api https://api.greecon.earth --code GRC-XXXX-XXXX-XXXX");
    return 2;
  }
  const path = values.identity ?? env.GREECON_EDGE_CONFIG ?? DEFAULT_IDENTITY_FILE;
  try {
    const identity = await enrol(values.api, values.code);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ apiUrl: identity.apiUrl, tenantId: identity.tenantId, siteId: identity.siteId, gatewayId: identity.gatewayId, secret: identity.secret }, null, 2)}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);
    out(`Enrolled as "${identity.gatewayName}". The credential is saved in ${path} and is not shown.`);
    return 0;
  } catch (error) {
    fail(error instanceof PlatformError ? `Could not enrol: ${error.message}` : `Could not enrol: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function statusCommand(env: Record<string, string | undefined>): Promise<number> {
  const status = readJsonFile<StatusFile>(`${stateDirectory(env)}/status.json`);
  if (!status) {
    fail("This box has not written a status yet. Is the service running? Try: systemctl status greecon-edge");
    return 1;
  }
  const now = Date.now();
  const heard = status.heartbeat.lastOkAtUtc ? Math.max(0, (now - Date.parse(status.heartbeat.lastOkAtUtc)) / 1000) : undefined;
  const reporting = heard !== undefined && heard < 180;

  out(`Greecon edge ${status.agentVersion}, gateway ${status.gatewayId}, site ${status.siteId}`);
  out(heard === undefined ? "Platform: has not heard from this box yet." : `Platform: last heard ${describeAge(heard)} ago${reporting ? "" : " (NOT REPORTING)"}.`);
  if (status.heartbeat.lastError) out(`  Last problem: ${status.heartbeat.lastError}`);
  if (status.heartbeat.clockSkewSeconds !== undefined && Math.abs(status.heartbeat.clockSkewSeconds) > 120) out(`  This box's clock is ${Math.abs(status.heartbeat.clockSkewSeconds)} seconds ${status.heartbeat.clockSkewSeconds > 0 ? "fast" : "slow"}.`);
  if (status.heartbeat.updateAvailable) out(`  A newer version is available (${status.heartbeat.latestAgentVersion}).`);
  out(status.configVersion ? `Reading: configuration ${status.configVersion}, ${status.devices.length} device(s).` : "Reading: no configuration yet.");
  for (const device of status.devices) {
    out(device.ok ? `  ok      ${device.name}: ${device.readingsOk} reading(s)${device.readingsFailed > 0 ? `, ${device.readingsFailed} failed` : ""}` : `  NOT OK  ${device.name}: ${device.lastError ?? "not answering"}`);
  }
  out(`Queue: ${status.queue.pending} waiting${status.queue.oldestAgeSeconds !== undefined ? `, the oldest ${describeAge(status.queue.oldestAgeSeconds)} old` : ""}.`);
  return reporting ? 0 : 1;
}

async function modbusTest(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      host: { type: "string" },
      port: { type: "string", default: "502" },
      unit: { type: "string" },
      type: { type: "string" },
      address: { type: "string" },
      "data-type": { type: "string", default: "uint16" },
      "word-order": { type: "string", default: "big" },
      scale: { type: "string" },
      offset: { type: "string" }
    }
  });
  const connection = { kind: "modbus_tcp" as const, host: values.host ?? "", port: Number(values.port), unitId: Number(values.unit) };
  const source: PointSource = {
    kind: "modbus",
    registerType: values.type as ModbusRegisterType,
    address: Number(values.address),
    dataType: values["data-type"] as ModbusDataType,
    wordOrder: values["word-order"] as ModbusWordOrder,
    ...(values.scale !== undefined ? { scale: Number(values.scale) } : {}),
    ...(values.offset !== undefined ? { offset: Number(values.offset) } : {})
  };
  const problems = [...validateConnection(connection), ...validatePointSource(source)];
  if (problems.length > 0 || values.host === undefined || values.unit === undefined || values.address === undefined || values.type === undefined) {
    fail(
      [
        ...problems,
        `Usage: greecon-edge modbus-test --host 192.168.1.50 --unit 1 --type input|holding --address 52 --data-type ${modbusDataTypes.join("|")} [--port 502] [--word-order ${modbusWordOrders.join("|")}] [--scale 0.001] [--offset 0]`,
        `(--type is ${modbusRegisterTypes.join(" or ")}; the address counts from zero, so a manual's 30053 is address 52)`
      ].join("\n")
    );
    return 2;
  }

  const reader = new ModbusTcpReader();
  try {
    const words = await reader.read(connection, source.registerType, source.address, registersFor(source.dataType));
    const value = readModbusValue(words, source);
    out(`Raw registers: ${words.join(", ")}  (hex ${words.map((word) => word.toString(16).padStart(4, "0")).join(" ")})`);
    out(value === undefined ? "Value: the register does not hold a number." : `Value: ${value}`);
    return value === undefined ? 1 : 0;
  } catch (error) {
    fail(error instanceof ModbusReadError ? `Could not read: ${error.message}` : `Could not read: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await reader.close();
  }
}

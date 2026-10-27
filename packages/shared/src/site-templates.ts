import type { AssetType, CanonicalPointName, DeviceProtocol, PointCapability, SiteType } from "./index";
import type { PointSource } from "./modbus";

// The shapes of site Greecon is sold for, so a project manager starts from "a hotel with solar and a
// water tank" and not from a blank page: the equipment a site of that kind usually has, with the
// readings each piece gives. Nothing here is an installed fact. It is the plan, and the Setup checklist
// shows which of it has started to report.

export interface TemplatePoint {
  canonicalName: CanonicalPointName;
  label: string;
  unit: string;
  capability?: PointCapability;
  /** Present when the register is known. Absent means the person setting up maps it from the device's datasheet. */
  source?: PointSource;
}

export interface TemplateDevice {
  /** Local name used by the template to say which asset a device belongs to. */
  ref: string;
  name: string;
  deviceType: string;
  protocol: DeviceProtocol;
  driverType: string;
  assetRef?: string;
  /** A device profile whose readings replace `points`, with their registers filled in. */
  profile?: string;
  points: TemplatePoint[];
  /** Said to the person setting up, next to this device. */
  hint?: string;
}

export interface SiteTemplate {
  key: string;
  name: string;
  summary: string;
  siteType: SiteType;
  assets: Array<{ ref: string; name: string; type: AssetType }>;
  devices: TemplateDevice[];
  /** What to bring and what to ask the customer for, in the order it will be needed. */
  checklist: string[];
}

const modbus = { protocol: "modbus", driverType: "modbus-tcp" } as const;

const tank: TemplatePoint = { canonicalName: "water.tank.level.percent", label: "Tank level", unit: "%" };
const pressure: TemplatePoint = { canonicalName: "water.pressure.bar", label: "Line pressure", unit: "bar" };
const flow: TemplatePoint = { canonicalName: "water.flow.lpm", label: "Pump flow", unit: "lpm" };
const pumpStatus: TemplatePoint = { canonicalName: "water.pump.status", label: "Pump running", unit: "state" };

const waterModule = (assetRef: string): TemplateDevice => ({
  ref: "water-io",
  name: "Water I/O module",
  deviceType: "analog_io_module",
  ...modbus,
  assetRef,
  points: [tank, pressure, flow, pumpStatus],
  hint: "A Modbus input module takes the 4-20 mA signals of the level and pressure transmitters and the pump's run contact. Map each reading from the module's datasheet; for a 4-20 mA signal use the straight-line conversion (4 mA is the bottom of the transmitter's range, 20 mA the top)."
});

export const siteTemplates: readonly SiteTemplate[] = [
  {
    key: "hotel",
    name: "Hotel or guesthouse",
    summary: "Water tank and pump, solar on the roof, grid connection. The usual first site.",
    siteType: "integrated_site",
    assets: [
      { ref: "water", name: "Water supply", type: "PumpStation" },
      { ref: "solar", name: "Solar plant", type: "SolarSystem" },
      { ref: "grid", name: "Grid connection", type: "GridConnection" }
    ],
    devices: [
      { ref: "grid-meter", name: "Grid meter", deviceType: "grid_meter", ...modbus, assetRef: "grid", profile: "eastron-sdm630-grid", points: [] },
      { ref: "solar-meter", name: "Solar meter", deviceType: "production_meter", ...modbus, assetRef: "solar", profile: "eastron-sdm630-solar", points: [] },
      waterModule("water")
    ],
    checklist: [
      "Ask for the last twelve electricity bills (price per kWh, and the kWh bought each month) and the water bills.",
      "Find where the supply enters the building and where the inverter's AC output leaves it: that is where the meters go.",
      "Find the water tank, the pump and its starter, and where the level and pressure transmitters can be fitted.",
      "Confirm there is a network socket or cellular signal in the plant room."
    ]
  },
  {
    key: "solar_grid",
    name: "Solar plant with grid connection",
    summary: "A solar plant measured at the inverter output and at the grid connection, with an optional battery.",
    siteType: "energy_site",
    assets: [
      { ref: "solar", name: "Solar plant", type: "SolarSystem" },
      { ref: "grid", name: "Grid connection", type: "GridConnection" },
      { ref: "battery", name: "Battery", type: "BatterySystem" }
    ],
    devices: [
      { ref: "grid-meter", name: "Grid meter", deviceType: "grid_meter", ...modbus, assetRef: "grid", profile: "eastron-sdm630-grid", points: [] },
      { ref: "solar-meter", name: "Solar meter", deviceType: "production_meter", ...modbus, assetRef: "solar", profile: "eastron-sdm630-solar", points: [] },
      { ref: "load-meter", name: "Load meter (optional)", deviceType: "load_meter", ...modbus, assetRef: "grid", profile: "eastron-sdm630-load", points: [] },
      {
        ref: "battery",
        name: "Battery system (optional)",
        deviceType: "battery_system",
        ...modbus,
        assetRef: "battery",
        points: [
          { canonicalName: "energy.battery.soc.percent", label: "Battery charge", unit: "%" },
          { canonicalName: "energy.battery.power.kw", label: "Battery power", unit: "kW" }
        ],
        hint: "Delete this device if there is no battery. Otherwise map the state of charge and the power from the battery maker's Modbus table. Power is positive while charging."
      }
    ],
    checklist: [
      "Ask for the electricity price per kWh, what is paid for energy sent to the grid (if anything), and the last twelve bills.",
      "Find the inverter's AC output and the supply entry: the production and grid meters go there.",
      "Ask whether the plant is allowed to send energy to the grid. If not, say so in the site's prices.",
      "If there is a battery, find the maker's Modbus register table."
    ]
  },
  {
    key: "farm_irrigation",
    name: "Farm or greenhouse with irrigation",
    summary: "Soil moisture and weather at the field, with the water supply behind it.",
    siteType: "farm",
    assets: [
      { ref: "zone", name: "Irrigation zone", type: "IrrigationZone" },
      { ref: "weather", name: "Weather station", type: "WeatherStation" },
      { ref: "water", name: "Water supply", type: "PumpStation" }
    ],
    devices: [
      {
        ref: "soil",
        name: "Soil probe",
        deviceType: "soil_sensor",
        ...modbus,
        assetRef: "zone",
        points: [{ canonicalName: "agri.soil.moisture.percent", label: "Soil moisture", unit: "%" }],
        hint: "A wired RS-485 soil probe, or a probe on a radio gateway that speaks Modbus. Soil readings are only as good as the probe's depth and contact: note both in the handover. After the first week, ask the grower what reading means 'time to water' and enter it as the irrigation limit."
      },
      {
        ref: "weather",
        name: "Weather sensor",
        deviceType: "weather_station",
        ...modbus,
        assetRef: "weather",
        points: [
          { canonicalName: "agri.air.temperature.c", label: "Air temperature", unit: "C" },
          { canonicalName: "agri.humidity.percent", label: "Humidity", unit: "%" }
        ],
        hint: "Fit it in the shade, a metre or two above the crop, away from walls and the pump house. Below zero a temperature is a signed number: map it as a signed 16-bit value (int16), or a frosty morning reads as a hot afternoon. Ask the grower at what air temperature the crop is in danger of frost and enter it as the frost limit: the platform says nothing about frost until it is set."
      },
      waterModule("water")
    ],
    checklist: [
      "Ask which crop, which soil and how deep the roots are: the irrigation limit depends on them, and the platform gives no irrigation advice until it is set.",
      "Ask at what air temperature frost damages the crop, and in which weeks that matters: the frost alert uses the grower's own number, and says nothing until it is set.",
      "Walk the field with the grower and choose where the probe goes: representative of the zone, not at the wettest or driest spot.",
      "Find the pump, the tank and where the pressure and level transmitters can be fitted.",
      "Check the signal: a cellular router, or a network cable run to the pump house."
    ]
  },
  {
    key: "water_station",
    name: "Water tank and pump station",
    summary: "A tank, a pump and the pipe it feeds, with the pump's electricity use.",
    siteType: "water_facility",
    assets: [
      { ref: "water", name: "Pump station", type: "PumpStation" },
      { ref: "power", name: "Power supply", type: "GridConnection" }
    ],
    devices: [
      waterModule("water"),
      { ref: "pump-meter", name: "Pump meter (optional)", deviceType: "load_meter", ...modbus, assetRef: "power", profile: "eastron-sdm230-load", points: [] }
    ],
    checklist: [
      "Find the tank, the pump and its starter, and the pipe's pressure range: it decides the pressure transmitter's range.",
      "Ask what the pump does when the tank is low and when it is full, and who is told today.",
      "Check the signal: a cellular router, or a network cable to the plant room."
    ]
  },
  {
    key: "blank",
    name: "Empty site",
    summary: "Nothing assumed. Add the assets, devices and readings yourself.",
    siteType: "integrated_site",
    assets: [],
    devices: [],
    checklist: ["Decide what is to be measured, then add the devices and readings one by one."]
  }
];

export function templateByKey(key: string): SiteTemplate | undefined {
  return siteTemplates.find((template) => template.key === key);
}

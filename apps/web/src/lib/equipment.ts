const KIND_WORDS: Record<string, string> = {
  grid_meter: "Grid meter",
  production_meter: "Solar meter",
  load_meter: "Consumption meter",
  battery_system: "Battery",
  soil_sensor: "Soil sensor",
  weather_station: "Weather station",
  analog_io_module: "Sensor module"
};

/** What a piece of equipment is, in words a person would use ("Grid meter", not "grid_meter"). A kind Greecon has no word for is
 * still readable: the underscores go and the first letter is capital. */
export function equipmentKind(deviceType: string): string {
  const known = KIND_WORDS[deviceType];
  if (known) return known;
  const spaced = deviceType.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A site's kind as a word to show beside its place, or nothing. A site that does several things ("integrated") is not
 * described by a code word: its name and its place already say what it is. */
export function siteKindWords(type: string): string {
  const words: Record<string, string> = {
    farm: "Farm",
    greenhouse: "Greenhouse",
    water_facility: "Water facility",
    energy_site: "Energy site",
    integrated_site: "",
    demo_site: "Demo"
  };
  const known = words[type];
  if (known !== undefined) return known;
  const spaced = type.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

import { BadRequestException, Controller, Get, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { Readable } from "stream";
import { RequirePermissions } from "../../common/require-permissions.decorator";
import { RequestWithPrincipal } from "../../common/principal";
import { CsvStyle, isCsvStyle } from "../../exports/csv";
import { CsvDownload, ExportsService } from "../../exports/exports.service";

type Response = { setHeader(name: string, value: string): void };

const CSV = "text/csv; charset=utf-8";

/** Taking the account's data away as files. Every route is the account's own: nothing takes an account from the
 * request, only from who is asking, and each download is written to the account's audit trail. */
@Controller("exports")
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get("readings.csv")
  @RequirePermissions("report:export")
  async readings(
    @Query("siteId") siteId: string | undefined,
    @Query("days") days: string | undefined,
    @Query("resolution") resolution: string | undefined,
    @Query("style") style: string | undefined,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    if (!siteId) throw new BadRequestException("Say which site.");
    if (resolution !== undefined && resolution !== "hourly" && resolution !== "raw") throw new BadRequestException("Resolution is hourly or raw.");
    return this.csv(await this.exports.readings(request.principal, { siteId, days: parseDays(days, resolution === "raw" ? 7 : 31), resolution: resolution ?? "hourly", style: parseStyle(style) }), response);
  }

  @Get("alerts.csv")
  @RequirePermissions("report:export")
  async alerts(@Query("days") days: string | undefined, @Query("style") style: string | undefined, @Req() request: RequestWithPrincipal, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    return this.csv(await this.exports.alerts(request.principal, parseDays(days, 90), parseStyle(style)), response);
  }

  @Get("audit.csv")
  @RequirePermissions("report:export", "audit:read")
  async audit(@Query("style") style: string | undefined, @Req() request: RequestWithPrincipal, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    return this.csv(await this.exports.audit(request.principal, parseStyle(style)), response);
  }

  // The account's setup includes its people's addresses, so it is for those who manage the account.
  @Get("account.json")
  @RequirePermissions("settings:manage")
  async account(@Req() request: RequestWithPrincipal, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const { filename, json } = await this.exports.account(request.principal);
    this.headers(response);
    return new StreamableFile(Buffer.from(JSON.stringify(json, null, 2), "utf8"), { type: "application/json; charset=utf-8", disposition: attachment(filename) });
  }

  private csv(download: CsvDownload, response: Response): StreamableFile {
    this.headers(response);
    return new StreamableFile(Readable.from(download.chunks, { objectMode: false }), { type: CSV, disposition: attachment(download.filename) });
  }

  private headers(response: Response): void {
    // A download is made for the person who asked, now: nothing may keep a copy for the next.
    response.setHeader("Cache-Control", "no-store");
  }
}

const attachment = (filename: string): string => `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`;

function parseDays(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const days = Number(value);
  if (!Number.isInteger(days)) throw new BadRequestException("Days is a whole number.");
  return days;
}

function parseStyle(value: string | undefined): CsvStyle {
  if (value === undefined || value === "") return "standard";
  if (!isCsvStyle(value)) throw new BadRequestException("Style is standard or eu.");
  return value;
}

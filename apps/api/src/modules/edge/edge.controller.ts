import { Body, Controller, Get, Headers, NotFoundException, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RequestWithPrincipal } from "../../common/principal";
import { publicApiUrl } from "../../common/public-url";
import { EdgeBundleService } from "../../setup/edge-bundle";
import { renderInstallScript } from "../../setup/install-script";
import { SetupService } from "../../setup/setup.service";
import { EnrolDto } from "./edge.dto";

interface Reply {
  type(value: string): Reply;
  set(headers: Record<string, string>): Reply;
  send(body: string | Buffer): void;
}

type Request = RequestWithPrincipal & { protocol: string; get(name: string): string | undefined };

/** What a box at a site says to the platform. The first two need no credential (a box that has none
 * yet asks for one with its code); the rest need the box's own. */
@Controller("edge")
export class EdgeController {
  constructor(
    private readonly setup: SetupService,
    private readonly bundle: EdgeBundleService
  ) {}

  // Open to anyone, so limited hard: a code is 60 bits and used once, and ten tries a minute from one
  // address is all a person at a box could need.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("enrol")
  enrol(@Body() body: EnrolDto, @Req() request: Request) {
    return this.setup.enrol(body.code, publicApiUrl(process.env, request));
  }

  @Get("config")
  config(@Req() request: RequestWithPrincipal) {
    return this.setup.edgeConfig(request.principal);
  }

  // Not validated by a DTO class: it is checked field by field in the service, in words.
  @Post("heartbeat")
  heartbeat(@Body() body: Record<string, unknown>, @Req() request: RequestWithPrincipal) {
    return this.setup.heartbeat(request.principal, body);
  }

  // What the box found when it was asked to look at the site's network. Checked field by field in the service, in words.
  @Post("discovery")
  discovery(@Body() body: Record<string, unknown>, @Req() request: RequestWithPrincipal) {
    return this.setup.recordDiscovery(request.principal, body);
  }

  // The installer a project manager pastes onto a box. Public: it holds nothing secret, only this
  // platform's address, and it asks for a code before it gets anything.
  @Get("install.sh")
  installScript(@Req() request: Request, @Res() response: Reply) {
    response.type("text/x-shellscript").send(renderInstallScript(publicApiUrl(process.env, request)));
  }

  // The box's software, to a box being installed (an unused code) or a box updating itself (its credential).
  @Get("bundle.json")
  async bundleInfo(@Req() request: RequestWithPrincipal, @Headers("x-enrolment-code") code: string | undefined) {
    await this.setup.assertMayFetchSoftware(request.principal, code);
    const manifest = this.bundle.manifest();
    if (!manifest) throw new NotFoundException("This platform has no box software built into it.");
    return manifest;
  }

  @Get("bundle")
  async bundleFile(@Req() request: RequestWithPrincipal, @Headers("x-enrolment-code") code: string | undefined, @Res() response: Reply) {
    await this.setup.assertMayFetchSoftware(request.principal, code);
    const found = this.bundle.bundle();
    if (!found) throw new NotFoundException("This platform has no box software built into it.");
    response.type("application/javascript").set({ "x-bundle-sha256": found.manifest.sha256, "x-bundle-version": found.manifest.version }).send(found.bytes);
  }
}

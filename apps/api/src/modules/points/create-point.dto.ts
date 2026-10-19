import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { PointSource, canonicalPoints, pointCapabilities } from "@greecon/shared";

export class CreatePointDto {
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsIn(canonicalPoints)
  canonicalName!: (typeof canonicalPoints)[number];

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsIn(pointCapabilities)
  capability!: (typeof pointCapabilities)[number];

  @IsOptional()
  @IsObject()
  thresholdConfig?: Record<string, number>;

  // Which register the box reads this from. Checked in PlatformService, in words a person at the site can act on.
  @IsOptional()
  @IsObject()
  source?: PointSource;
}

import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { PointSource, canonicalPoints, pointCapabilities } from "@greecon/shared";

export class CreatePointDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  deviceId!: string;

  @IsIn(canonicalPoints)
  canonicalName!: (typeof canonicalPoints)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
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

import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { PointSource, pointCapabilities, qualityFlags } from "@greecon/shared";

export class UpdatePointDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsIn(pointCapabilities)
  capability?: (typeof pointCapabilities)[number];

  @IsOptional()
  @IsIn(qualityFlags)
  quality?: (typeof qualityFlags)[number];

  @IsOptional()
  @IsObject()
  thresholdConfig?: Record<string, number>;

  // null takes the register mapping away; left out, it is left as it is.
  @IsOptional()
  @IsObject()
  source?: PointSource | null;
}

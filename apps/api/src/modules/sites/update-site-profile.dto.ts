import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { CurrencyCode, currencyCodes } from "@greecon/shared";

// A field left out is left as it is; null clears it. The ranges are checked in PlatformService, so
// the same rules hold for anything that calls it.
export class UpdateSiteProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsIn(currencyCodes)
  currency?: CurrencyCode;

  @IsOptional()
  @IsNumber()
  importPricePerKwh?: number | null;

  @IsOptional()
  @IsNumber()
  exportPricePerKwh?: number | null;

  @IsOptional()
  @IsNumber()
  waterPricePerM3?: number | null;

  @IsOptional()
  @IsNumber()
  baselineMonthlyImportKwh?: number | null;

  @IsOptional()
  @IsNumber()
  baselineMonthlyWaterM3?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  baselineNote?: string | null;

  @IsOptional()
  @IsBoolean()
  zeroExport?: boolean;
}

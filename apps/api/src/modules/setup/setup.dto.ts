import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsLatitude, IsLongitude, Max, MaxLength, Min } from "class-validator";
import { CurrencyCode, currencyCodes, deviceProfiles, siteTemplates } from "@greecon/shared";

export class CreateSiteFromTemplateDto {
  @IsIn(siteTemplates.map((template) => template.key))
  templateKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  locationName!: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsIn(currencyCodes)
  currency?: CurrencyCode;
}

export class ConfirmSetupStepDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateDeviceFromProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsIn(deviceProfiles.map((profile) => profile.key))
  profileKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(247)
  unitId?: number;
}

export class ProvisionGatewayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class FindEquipmentDto {
  /** An address to look at instead of the whole network: for a converter whose address is known. Private addresses only (checked in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  host?: string;

  /** For a converter that does not use the usual port, 502. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}

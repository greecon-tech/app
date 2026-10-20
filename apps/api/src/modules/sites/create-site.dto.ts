import { IsIn, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { siteTypes } from "@greecon/shared";

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsIn(siteTypes)
  type!: (typeof siteTypes)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  locationName!: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

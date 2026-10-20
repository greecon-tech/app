import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { assetTypes } from "@greecon/shared";

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsIn(assetTypes)
  type!: (typeof assetTypes)[number];
}

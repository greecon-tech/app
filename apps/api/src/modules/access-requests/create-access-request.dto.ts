import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { RequestedSiteType, requestedSiteTypes } from "@greecon/shared";

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  company!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsIn(requestedSiteTypes)
  siteType!: RequestedSiteType;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  message?: string;

  /** A field no person ever sees or fills in. A form submitted by a script that fills every field
   * fills this one too, and the request is quietly discarded. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;
}

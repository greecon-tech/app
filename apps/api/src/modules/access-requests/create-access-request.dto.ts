import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ACCESS_REQUEST_LIMITS, RequestedSiteType, requestedSiteTypes } from "@greecon/shared";

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(ACCESS_REQUEST_LIMITS.name)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(ACCESS_REQUEST_LIMITS.company)
  company!: string;

  @IsEmail()
  @MaxLength(ACCESS_REQUEST_LIMITS.email)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(ACCESS_REQUEST_LIMITS.phone)
  phone?: string;

  @IsIn(requestedSiteTypes)
  siteType!: RequestedSiteType;

  @IsOptional()
  @IsString()
  @MaxLength(ACCESS_REQUEST_LIMITS.message)
  message?: string;

  /** The honeypot: a field no person sees or fills in, sent by the web form as `website`, empty (or left out) for a person.
   * The form keeps it out of a person's way without hiding it from a script: off screen rather than display:none (which
   * some scripts skip), aria-hidden, tabIndex -1 and autocomplete off. A script that fills in every field fills this one
   * too, and its request is then answered exactly as a real one is (`{ received: true }`), with nothing kept and nobody
   * told, so that it learns nothing. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;
}

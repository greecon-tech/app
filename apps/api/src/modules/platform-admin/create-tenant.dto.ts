import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  /** An identifier for the client, unique across clients. Left out, one is made from the name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ownerName!: string;

  @IsEmail()
  @MaxLength(254)
  ownerEmail!: string;
}

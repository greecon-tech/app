import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateGatewayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
}

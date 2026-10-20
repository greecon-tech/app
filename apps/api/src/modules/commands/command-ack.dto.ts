import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CommandAckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsIn(["accepted", "rejected", "executed", "failed"])
  status!: "accepted" | "rejected" | "executed" | "failed";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  result?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  failureReason?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  correlationId!: string;
}

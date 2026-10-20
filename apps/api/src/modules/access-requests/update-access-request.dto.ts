import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { AccessRequestStatus, accessRequestStatuses } from "@greecon/shared";

export class UpdateAccessRequestDto {
  @IsOptional()
  @IsIn(accessRequestStatuses)
  status?: AccessRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMaintenanceTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  incidentId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueAtUtc?: string;
}

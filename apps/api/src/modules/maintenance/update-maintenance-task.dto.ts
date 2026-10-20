import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

const maintenanceStatuses = ["open", "complete"] as const;

export class UpdateMaintenanceTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueAtUtc?: string;

  @IsOptional()
  @IsIn(maintenanceStatuses)
  status?: (typeof maintenanceStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionLog?: string;
}

import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class EdgeSyncDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  gatewayId!: string;

  @IsString()
  @IsIn(["started", "completed", "failed"])
  status!: "started" | "completed" | "failed";

  @IsInt()
  @Min(0)
  bufferedReadings!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  startedAtUtc!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  completedAtUtc?: string;
}

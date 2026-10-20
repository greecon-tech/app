import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested, MaxLength } from "class-validator";
import { canonicalPoints, qualityFlags } from "@greecon/shared";
import { ScalarValue } from "../../common/scalar-value.decorator";

export class TelemetryReadingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  timestampUtc!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  pointId!: string;

  @IsIn(canonicalPoints)
  canonicalName!: (typeof canonicalPoints)[number];

  @IsNotEmpty()
  @ScalarValue()
  value!: number | boolean | string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unit!: string;

  @IsIn(qualityFlags)
  quality!: (typeof qualityFlags)[number];

  @IsIn(["edge", "cloud", "simulator", "manual"])
  source!: "edge" | "cloud" | "simulator" | "manual";

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  ingestionTimestampUtc!: string;
}

export class TelemetryMessageDto {
  @IsIn(["telemetry"])
  messageType!: "telemetry";

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  deviceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TelemetryReadingDto)
  @ArrayMaxSize(1000)
  readings!: TelemetryReadingDto[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  publishedAtUtc!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  correlationId!: string;
}

/** How many messages one request may carry. A box sends everything one round of reading produced in
 * a single request, and catches up after an outage a hundred at a time. */
export const MAX_MESSAGES_PER_BATCH = 100;

export class TelemetryBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MESSAGES_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => TelemetryMessageDto)
  messages!: TelemetryMessageDto[];
}

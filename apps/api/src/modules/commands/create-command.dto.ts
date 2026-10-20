import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, ValidateNested, MaxLength } from "class-validator";
import { ManualOverrideDto } from "./manual-override.dto";
import { ScalarValue } from "../../common/scalar-value.decorator";

export class CreateCommandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  siteId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  targetDeviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  targetPointId!: string;

  @IsNotEmpty()
  @ScalarValue()
  requestedValue!: number | boolean | string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualOverrideDto)
  manualOverride?: ManualOverrideDto;
}

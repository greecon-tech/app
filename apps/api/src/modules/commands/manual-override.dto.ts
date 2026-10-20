import { IsInt, IsNotEmpty, IsString, Min, MaxLength } from "class-validator";

export class ManualOverrideDto {
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

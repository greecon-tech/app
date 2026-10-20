import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { CanonicalPointName, canonicalPoints } from "@greecon/shared";
import { ScalarValue } from "../../common/scalar-value.decorator";

export class RuleActionDto {
  @IsIn(["command", "alert", "recommendation"])
  type!: "command" | "alert" | "recommendation";

  @IsOptional()
  @IsIn(canonicalPoints)
  targetCanonicalName?: CanonicalPointName;

  @IsOptional()
  @ScalarValue()
  value?: number | boolean | string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

import { IsIn, IsNotEmpty, IsOptional } from "class-validator";
import { CanonicalPointName, StateKey, canonicalPoints, stateKeys } from "@greecon/shared";
import { ScalarValue } from "../../common/scalar-value.decorator";

export class RuleConditionDto {
  @IsOptional()
  @IsIn(canonicalPoints)
  point?: CanonicalPointName;

  @IsOptional()
  @IsIn(stateKeys)
  stateKey?: StateKey;

  @IsIn(["lt", "lte", "gt", "gte", "eq", "neq"])
  operator!: "lt" | "lte" | "gt" | "gte" | "eq" | "neq";

  @IsNotEmpty()
  @ScalarValue()
  value!: number | boolean | string;
}

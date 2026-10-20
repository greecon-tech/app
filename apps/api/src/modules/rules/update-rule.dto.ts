import { Type } from "class-transformer";
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested, MaxLength, ArrayMaxSize } from "class-validator";
import { RuleExecutionMode, RulePriorityLevel, ruleExecutionModes, rulePriorityLevels } from "@greecon/shared";
import { RuleActionDto } from "./rule-action.dto";
import { RuleConditionDto } from "./rule-condition.dto";

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(rulePriorityLevels)
  priority?: RulePriorityLevel;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  @ArrayMaxSize(20)
  conditions?: RuleConditionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  @ArrayMaxSize(20)
  constraints?: RuleConditionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  @ArrayMaxSize(20)
  actions?: RuleActionDto[];

  @IsOptional()
  @IsIn(ruleExecutionModes)
  executionMode?: RuleExecutionMode;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  explanationTemplate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rollbackBehavior?: string;
}

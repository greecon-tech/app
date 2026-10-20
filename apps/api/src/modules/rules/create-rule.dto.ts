import { Type } from "class-transformer";
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested, MaxLength, ArrayMaxSize } from "class-validator";
import { RuleExecutionMode, RulePriorityLevel, ruleExecutionModes, rulePriorityLevels } from "@greecon/shared";
import { RuleActionDto } from "./rule-action.dto";
import { RuleConditionDto } from "./rule-condition.dto";

export class CreateRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  siteId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsIn(rulePriorityLevels)
  priority!: RulePriorityLevel;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  triggerType!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  @ArrayMaxSize(20)
  conditions!: RuleConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  @ArrayMaxSize(20)
  constraints!: RuleConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  @ArrayMaxSize(20)
  actions!: RuleActionDto[];

  @IsIn(ruleExecutionModes)
  executionMode!: RuleExecutionMode;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  explanationTemplate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rollbackBehavior!: string;
}

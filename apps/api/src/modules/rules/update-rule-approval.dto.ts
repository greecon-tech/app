import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpdateRuleApprovalDto {
  @IsIn(["draft", "approved", "disabled"])
  approvalState!: "draft" | "approved" | "disabled";

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

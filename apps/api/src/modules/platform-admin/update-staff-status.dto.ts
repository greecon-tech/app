import { IsIn } from "class-validator";

const staffStatuses = ["active", "disabled"] as const;

export class UpdateStaffStatusDto {
  @IsIn(staffStatuses)
  status!: (typeof staffStatuses)[number];
}

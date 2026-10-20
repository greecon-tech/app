import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, ValidateNested, MaxLength } from "class-validator";
import { dashboardWidgetSizes } from "@greecon/shared";

class DashboardWidgetPreferenceDto {
  @IsString()
  @MaxLength(100)
  key!: string;

  @IsBoolean()
  visible!: boolean;

  @IsIn(dashboardWidgetSizes)
  size!: (typeof dashboardWidgetSizes)[number];
}

export class SaveDashboardPreferencesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetPreferenceDto)
  widgets!: DashboardWidgetPreferenceDto[];
}

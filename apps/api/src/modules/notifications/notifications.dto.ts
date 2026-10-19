import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

// Checked in full by the shared rules (checkContacts, checkNotificationSettings), which say what to change in a
// person's own words; these only keep out what is not the right shape at all.

export class SaveContactsDto {
  @IsArray()
  contacts!: unknown[];
}

export class SaveSettingsDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  quietFrom?: string;

  @IsOptional()
  @IsString()
  quietTo?: string;

  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @IsOptional()
  @IsString()
  digestAt?: string;
}

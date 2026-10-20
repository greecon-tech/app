import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ArrayMaxSize } from "class-validator";

// Checked in full by the shared rules (checkContacts, checkNotificationSettings), which say what to change in a
// person's own words; these only keep out what is not the right shape at all.

export class SaveContactsDto {
  @IsArray()
  @ArrayMaxSize(20)
  contacts!: unknown[];
}

export class SaveSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  quietFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  quietTo?: string;

  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  digestAt?: string;
}

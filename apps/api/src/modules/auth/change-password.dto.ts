import { IsNotEmpty, IsString, MaxLength } from "class-validator";

// The rules for a new password are in common/password-policy.ts, so they hold for every way a
// password is chosen and the reply says what to change.
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MaxLength(200)
  newPassword!: string;
}

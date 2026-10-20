import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { AccountEmail } from "../../common/account-email.decorator";

export class AddStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @AccountEmail()
  email!: string;
}

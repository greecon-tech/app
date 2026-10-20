import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { AccountEmail } from "../../common/account-email.decorator";

export class LoginDto {
  @AccountEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

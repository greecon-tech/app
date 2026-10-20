import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { userRoles } from "@greecon/shared";
import { AccountEmail } from "../../common/account-email.decorator";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @AccountEmail()
  email!: string;

  @IsIn(userRoles)
  role!: (typeof userRoles)[number];
}

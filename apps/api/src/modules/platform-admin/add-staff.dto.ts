import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AddStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;
}

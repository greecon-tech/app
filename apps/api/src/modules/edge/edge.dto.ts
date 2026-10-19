import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class EnrolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;
}

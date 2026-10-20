import { applyDecorators } from "@nestjs/common";
import { IsEmail, Matches, MaxLength } from "class-validator";

/** An email address that can belong to an account: valid, and plain ASCII (see common/email.ts for why). */
export function AccountEmail(): PropertyDecorator {
  return applyDecorators(
    IsEmail({ allow_utf8_local_part: false }),
    MaxLength(254),
    Matches(/^[\x21-\x7e]+$/, { message: "email must be written with plain letters, digits and symbols, without accents or other alphabets" })
  );
}

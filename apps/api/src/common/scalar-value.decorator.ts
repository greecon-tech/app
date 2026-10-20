import { registerDecorator, ValidationOptions } from "class-validator";

/** A value that is a number, true or false, or a short piece of text. A reading or a command's requested value
 * is one of these; without a limit on the text, a single value could be as large as the whole request. */
export function ScalarValue(maxTextLength = 200, validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: "scalarValue",
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate: (value: unknown) => (typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean" || (typeof value === "string" && value.length <= maxTextLength)),
        defaultMessage: () => `${String(propertyName)} must be a number, true or false, or text of at most ${maxTextLength} characters`
      }
    });
  };
}

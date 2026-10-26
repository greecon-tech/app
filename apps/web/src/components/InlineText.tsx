/** A sentence the platform wrote, with anything it put between backticks (a command to type) shown as code. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, index) => (index % 2 === 1 ? <code key={index}>{part}</code> : part))}
    </>
  );
}

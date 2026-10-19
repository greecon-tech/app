import { ReactNode } from "react";

export function Section({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="section" id={id}>
      <div className="section__header">
        <h2>{title}</h2>
        {aside ? <div>{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

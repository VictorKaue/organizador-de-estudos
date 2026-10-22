import type { CSSProperties, ReactNode } from "react";

interface Props {
  /** Largura mínima de cada coluna; a grade encaixa quantas couberem. */
  minimo?: string;
  children: ReactNode;
  className?: string;
}

/** Grade que se reorganiza sozinha (1 coluna no celular, várias no desktop). */
export function GradeResponsiva({ minimo = "11rem", children, className }: Props) {
  return (
    <div className={`ui-grade${className ? ` ${className}` : ""}`} style={{ "--ui-min": minimo } as CSSProperties}>
      {children}
    </div>
  );
}

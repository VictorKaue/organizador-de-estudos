import { engrenagem } from "./ornamentos";

/** Marca do app em cada estilo (o Solarpunk tem a dele em App.tsx). Usa as cores do estilo. */
export function LogoDoEstilo({ id }: { id: string }) {
  switch (id) {
    case "cyberpunk":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2l12 7v14l-12 7-12-7V9z" fill="var(--superficie)" stroke="var(--destaque)" strokeWidth="2" />
          <path d="M17.5 7 10 17.5h5.5L14.5 25 22 14.5h-5.5z" fill="var(--sol)" />
        </svg>
      );
    case "steampunk":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <path fillRule="evenodd" d={engrenagem(16, 16, 15, 12, 10, 7)} fill="var(--destaque)" />
          <circle cx="16" cy="16" r="5.4" fill="var(--superficie)" />
          <path d="M16 16V12M16 16l3 2" stroke="var(--sol)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "renascenca":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2c-3.6 4.2-3.6 9.2 0 13.4 3.6-4.2 3.6-9.2 0-13.4zM3.6 11.6c5-.8 8.6 2 10 6.8-5 .8-9.2-2-10-6.8zM28.4 11.6c-5-.8-8.6 2-10 6.8 5 .8 9.2-2 10-6.8z" fill="var(--destaque)" />
          <rect x="9" y="20.5" width="14" height="3" fill="var(--sol)" />
          <path d="M12.6 23.5h6.8l1.6 6.5H11z" fill="var(--destaque)" />
        </svg>
      );
    case "fazenda":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="23" cy="9" r="5" fill="var(--sol)" />
          <path d="M2 28V22C8 17 14 20 20 18s8-1 10 1v9z" fill="var(--destaque)" />
          <path d="M16 28V13" stroke="var(--terracota)" strokeWidth="1.8" strokeLinecap="round" />
          <ellipse cx="13" cy="15" rx="2.2" ry="3.4" transform="rotate(-26 13 15)" fill="var(--terracota)" />
          <ellipse cx="19" cy="15" rx="2.2" ry="3.4" transform="rotate(26 19 15)" fill="var(--terracota)" />
          <ellipse cx="16" cy="9.6" rx="2.2" ry="3.6" fill="var(--terracota)" />
        </svg>
      );
    case "fantasia":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M24 20.5A10 10 0 0 1 11.5 6.2 10 10 0 1 0 24 20.5z" fill="var(--sol)" />
          <path d="M22 4l1.6 4.4L28 10l-4.4 1.6L22 16l-1.6-4.4L16 10l4.4-1.6z" fill="var(--destaque)" />
        </svg>
      );
    case "universal":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M3 8c4-2 9-2 13 1v17c-4-3-9-3-13-1zM29 8c-4-2-9-2-13 1v17c4-3 9-3 13-1z" fill="var(--destaque)" />
        </svg>
      );
    case "apple":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="1" y="1" width="30" height="30" rx="7.5" fill="var(--destaque)" />
          <path d="M7 11c3-1.4 6.5-1.2 9 .8v11c-2.5-2-6-2.2-9-.8zM25 11c-3-1.4-6.5-1.2-9 .8v11c2.5-2 6-2.2 9-.8z" fill="#fff" />
        </svg>
      );
    case "liquid-glass":
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <radialGradient id="logo-vidro" cx="35%" cy="30%" r="80%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="0.45" stopColor="var(--destaque)" stopOpacity="0.8" />
              <stop offset="1" stopColor="var(--ceu)" stopOpacity="0.9" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="14" fill="url(#logo-vidro)" stroke="rgb(255 255 255 / 0.7)" strokeWidth="1.2" />
          <path d="M8.5 11.5c3-4 8.5-5 12-3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9" />
        </svg>
      );
    default:
      return null;
  }
}

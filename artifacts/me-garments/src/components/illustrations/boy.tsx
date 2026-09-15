import { SVGProps } from "react";

export function BoyCharacter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="100" cy="100" r="90" fill="hsl(var(--accent))" />
      {/* Hair */}
      <path d="M60 80C60 60 75 45 100 45C125 45 140 60 140 80V95H60V80Z" fill="hsl(var(--foreground))" />
      {/* Face */}
      <circle cx="100" cy="105" r="40" fill="#FFD1C1" />
      {/* Eyes */}
      <circle cx="85" cy="100" r="4" fill="hsl(var(--foreground))" />
      <circle cx="115" cy="100" r="4" fill="hsl(var(--foreground))" />
      {/* Smile */}
      <path d="M85 115Q100 125 115 115" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
      {/* Shirt */}
      <path d="M65 140C65 130 75 125 100 125C125 125 135 130 135 140V180H65V140Z" fill="hsl(var(--primary))" />
      {/* Collar */}
      <path d="M85 125L100 135L115 125" fill="#FFFFFF" />
    </svg>
  );
}

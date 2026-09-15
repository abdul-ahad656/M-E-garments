import { SVGProps } from "react";

export function GirlCharacter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="100" cy="100" r="90" fill="hsl(var(--accent))" />
      {/* Hair back */}
      <path d="M55 90C55 50 145 50 145 90V140H55V90Z" fill="#5A3A31" />
      {/* Face */}
      <circle cx="100" cy="105" r="38" fill="#FFDFC4" />
      {/* Hair front/bangs */}
      <path d="M62 90C62 70 80 60 100 60C120 60 138 70 138 90C125 75 100 75 100 75C100 75 75 75 62 90Z" fill="#5A3A31" />
      {/* Eyes */}
      <circle cx="86" cy="102" r="4" fill="hsl(var(--foreground))" />
      <circle cx="114" cy="102" r="4" fill="hsl(var(--foreground))" />
      {/* Cheeks */}
      <circle cx="75" cy="110" r="5" fill="#FFB7A1" opacity="0.6" />
      <circle cx="125" cy="110" r="5" fill="#FFB7A1" opacity="0.6" />
      {/* Smile */}
      <path d="M92 118Q100 125 108 118" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" />
      {/* Dress */}
      <path d="M70 140C70 132 80 128 100 128C120 128 130 132 130 140L145 180H55L70 140Z" fill="hsl(var(--primary))" />
      {/* Pattern */}
      <circle cx="100" cy="150" r="4" fill="#FFFFFF" opacity="0.8" />
      <circle cx="85" cy="165" r="4" fill="#FFFFFF" opacity="0.8" />
      <circle cx="115" cy="165" r="4" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}

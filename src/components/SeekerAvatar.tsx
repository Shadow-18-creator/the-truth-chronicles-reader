import { cn } from "@/lib/utils";

export const AVATAR_STYLES = [
  { id: "moonlit", name: "Moonlit", glyph: "☾", tone: "bg-primary/20 text-primary" },
  { id: "raven", name: "Raven", glyph: "♠", tone: "bg-accent/25 text-accent-foreground" },
  { id: "fox", name: "Fox", glyph: "狐", tone: "bg-gold/20 text-gold" },
  { id: "owl", name: "Owl", glyph: "◉", tone: "bg-mist/25 text-foreground" },
  { id: "wolf", name: "Wolf", glyph: "狼", tone: "bg-secondary text-secondary-foreground" },
  { id: "serpent", name: "Serpent", glyph: "蛇", tone: "bg-primary/15 text-primary" },
  { id: "stag", name: "Stag", glyph: "♢", tone: "bg-gold/15 text-gold" },
  { id: "moth", name: "Moth", glyph: "✦", tone: "bg-accent/20 text-accent-foreground" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];

type SeekerAvatarProps = {
  style?: string | null;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  glyphClassName?: string;
};

export function SeekerAvatar({
  style,
  imageUrl,
  alt = "Seeker portrait",
  className,
  glyphClassName,
}: SeekerAvatarProps) {
  if (imageUrl) {
    return <img src={imageUrl} alt={alt} className={cn("rounded-full object-cover", className)} />;
  }

  const avatar = AVATAR_STYLES.find((item) => item.id === style) ?? AVATAR_STYLES[0];
  return (
    <span
      aria-label={alt}
      className={cn("inline-flex items-center justify-center rounded-full border border-primary/30 font-display", avatar.tone, className)}
    >
      <span className={cn("leading-none", glyphClassName)} aria-hidden="true">{avatar.glyph}</span>
    </span>
  );
}
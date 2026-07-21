import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, BookOpen, MessagesSquare, Bookmark, ShieldCheck, LogOut, UserCircle2, Search, Pencil, Eye } from "lucide-react";

const navItems = [
  { to: "/chapters", label: "Chapters", icon: BookOpen },
  { to: "/chat", label: "Halls", icon: MessagesSquare },
  { to: "/watcher", label: "Talk to Watcher", icon: Eye },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/users", label: "Seekers", icon: Search },
];

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <Moon className="h-5 w-5 text-primary group-hover:rotate-12 transition-transform" />
          <span className="font-display text-lg md:text-xl tracking-[0.15em] uppercase text-glow leading-tight">
            The Boy Who Saw The Truth
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-sans transition-colors ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-sans transition-colors ${
                pathname.startsWith("/admin")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Scriptorium
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Your profile"
                    className="relative h-9 w-9 rounded-full overflow-hidden border border-primary/30 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <UserCircle2 className="h-6 w-6" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <UserCircle2 className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" search={{ edit: true }} className="cursor-pointer">
                      <Pencil className="h-4 w-4" />
                      Change Username
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gold-gradient text-gold-foreground hover:opacity-90 font-sans">
                Enter
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
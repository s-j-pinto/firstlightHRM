
import Link from "next/link";
import { HeartHand } from "@/components/icons";

export function AppHeader() {
  return (
    <header className="bg-background/80 backdrop-blur-sm sticky top-0 z-40 w-full border-b">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Link href="/" className="flex items-center space-x-2">
          <HeartHand className="h-7 w-7 text-accent" />
          <span className="font-bold text-xl font-headline text-foreground">
            Caregiver Connect
          </span>
        </Link>
      </div>
    </header>
  );
}

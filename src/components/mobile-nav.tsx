import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface NavLink {
    href: string;
    label: string;
}

/**
 * Below `sm` the header's primary nav is hidden, so this sheet carries the same links.
 * Both `links` and `currentPath` come in as props from `SiteHeader` — nothing is read
 * from the DOM during render, so the island's server and client markup match.
 */
export function MobileNav({ links, currentPath }: { links: NavLink[]; currentPath: string }) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="sm:hidden">
                    <MenuIcon className="size-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" aria-describedby={undefined}>
                <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                    {links.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            aria-current={currentPath.startsWith(link.href) ? 'page' : undefined}
                            className="border-b border-border py-3 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:text-foreground"
                        >
                            {link.label}
                        </a>
                    ))}
                    <a
                        href="/cv.pdf"
                        className="mt-5 rounded-full border border-foreground px-4 py-2 text-center text-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        Download CV
                    </a>
                </nav>
            </SheetContent>
        </Sheet>
    );
}

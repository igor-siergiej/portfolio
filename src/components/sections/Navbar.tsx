import { Menu } from 'lucide-react';
import { useState } from 'react';
import { GithubIcon, LogoIcon } from '@/components/sections/Icons';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { NavigationMenu, NavigationMenuItem, NavigationMenuList } from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { siteConfig } from '@/config/site';

interface RouteProps {
    href: string;
    label: string;
}

const routeList: RouteProps[] = [
    {
        href: '#features',
        label: 'Features',
    },
    {
        href: '#faq',
        label: 'FAQ',
    },
];

export const Navbar = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    return (
        <header className="sticky border-b-[1px] top-0 z-40 w-full bg-white dark:border-b-slate-700 dark:bg-background">
            <NavigationMenu className="mx-auto">
                <NavigationMenuList className="container h-14 px-4 w-screen flex justify-between ">
                    <NavigationMenuItem className="font-bold flex">
                        <a rel="noreferrer noopener" href="/" className="ml-2 font-bold text-xl flex">
                            <LogoIcon />
                            {siteConfig.name}
                        </a>
                    </NavigationMenuItem>

                    {/* mobile */}
                    <span className="flex md:hidden">
                        <ThemeToggle />

                        <Sheet open={isOpen} onOpenChange={setIsOpen}>
                            <SheetTrigger className="px-2">
                                {/* `sr-only` label must be a sibling, not a child, of the Menu icon: lucide-react
                                    renders `children` inside the icon's <svg>, and a <span> there is invalid SVG
                                    nesting that causes an SSR/client hydration mismatch */}
                                <Menu className="flex md:hidden h-5 w-5" onClick={() => setIsOpen(true)} />
                                <span className="sr-only">Menu Icon</span>
                            </SheetTrigger>

                            <SheetContent side={'left'}>
                                <SheetHeader>
                                    <SheetTitle className="font-bold text-xl">{siteConfig.name}</SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col justify-center items-center gap-2 mt-4">
                                    {routeList.map(({ href, label }: RouteProps) => (
                                        <a
                                            rel="noreferrer noopener"
                                            key={label}
                                            href={href}
                                            onClick={() => setIsOpen(false)}
                                            className={buttonVariants({ variant: 'ghost' })}
                                        >
                                            {label}
                                        </a>
                                    ))}
                                    {/* placeholder CTA — replace with this project's own GitHub link */}
                                    <a
                                        rel="noreferrer noopener"
                                        // biome-ignore lint/a11y/useValidAnchor: placeholder link, template consumer fills in real destination
                                        href="#"
                                        target="_blank"
                                        className={`w-[110px] border ${buttonVariants({
                                            variant: 'secondary',
                                        })}`}
                                    >
                                        <GithubIcon />
                                        Github
                                    </a>
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </span>

                    {/* desktop */}
                    <nav className="hidden md:flex gap-2">
                        {routeList.map((route: RouteProps) => (
                            <a
                                rel="noreferrer noopener"
                                href={route.href}
                                key={route.href}
                                className={`text-[17px] ${buttonVariants({
                                    variant: 'ghost',
                                })}`}
                            >
                                {route.label}
                            </a>
                        ))}
                    </nav>

                    <div className="hidden md:flex gap-2">
                        {/* placeholder CTA — replace with this project's own GitHub link */}
                        <a
                            rel="noreferrer noopener"
                            // biome-ignore lint/a11y/useValidAnchor: placeholder link, template consumer fills in real destination
                            href="#"
                            target="_blank"
                            className={`border ${buttonVariants({ variant: 'secondary' })}`}
                        >
                            <GithubIcon />
                            Github
                        </a>

                        <ThemeToggle />
                    </div>
                </NavigationMenuList>
            </NavigationMenu>
        </header>
    );
};

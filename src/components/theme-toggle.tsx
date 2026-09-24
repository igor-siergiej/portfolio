import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Renders both icons and lets the `dark` variant pick one, so the island's markup is
 * identical on the server and on hydration — reading the stored theme during render
 * produced a hydration mismatch whenever the resolved theme was dark. The pre-paint
 * inline script in `Layout.astro` owns applying the class; this only flips it.
 */
export function ThemeToggle() {
    const toggle = () => {
        const isDark = document.documentElement.classList.toggle('dark');
        window.localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    return (
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
            <Sun className="hidden size-4 dark:block" />
            <Moon className="size-4 dark:hidden" />
        </Button>
    );
}

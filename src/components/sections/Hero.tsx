import { HeroCards } from '@/components/sections/HeroCards';
import { GithubIcon } from '@/components/sections/Icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

export const Hero = () => {
    return (
        <section className="container grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10">
            <div className="text-center lg:text-start space-y-6">
                <main className="text-5xl md:text-6xl font-bold">
                    <h1 className="inline">{siteConfig.name}</h1>
                </main>

                <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">{siteConfig.description}</p>

                <div className="space-y-4 md:space-y-0 md:space-x-4">
                    <Button className="w-full md:w-1/3">Get Started</Button>

                    {/* placeholder CTA — replace with this project's own GitHub link */}
                    <a
                        rel="noreferrer noopener"
                        // biome-ignore lint/a11y/useValidAnchor: placeholder link, template consumer fills in real destination
                        href="#"
                        target="_blank"
                        className={`w-full md:w-1/3 ${buttonVariants({
                            variant: 'outline',
                        })}`}
                    >
                        Github Repository
                        <GithubIcon />
                    </a>
                </div>
            </div>

            {/* Hero cards sections */}
            <div className="z-10">
                <HeroCards />
            </div>

            {/* Shadow effect */}
            <div className="shadow" />
        </section>
    );
};

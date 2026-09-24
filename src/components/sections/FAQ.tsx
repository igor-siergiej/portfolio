import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { siteConfig } from '@/config/site';

export const FAQ = () => {
    return (
        <section id="faq" className="container py-24 sm:py-32">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked{' '}
                <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                    Questions
                </span>
            </h2>

            <Accordion type="single" collapsible className="w-full AccordionRoot">
                {siteConfig.faqs.map(({ question, answer }, index) => (
                    <AccordionItem key={question} value={`item-${index}`}>
                        <AccordionTrigger className="text-left">{question}</AccordionTrigger>

                        <AccordionContent>{answer}</AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            <h3 className="font-medium mt-4">
                Still have questions?{' '}
                <a
                    rel="noreferrer noopener"
                    // biome-ignore lint/a11y/useValidAnchor: placeholder link, template consumer fills in real destination
                    href="#"
                    className="text-primary transition-all border-primary hover:border-b-2"
                >
                    Contact us
                </a>
            </h3>
        </section>
    );
};

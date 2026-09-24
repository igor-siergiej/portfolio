import { describe, expect, it } from 'vitest';
import { estimateReadingMinutes } from './reading-time';

describe('estimateReadingMinutes', () => {
    it('rounds to the nearest minute at 200wpm', () => {
        const text = Array(400).fill('word').join(' ');
        expect(estimateReadingMinutes(text)).toBe(2);
    });

    it('floors at 1 minute for short text', () => {
        expect(estimateReadingMinutes('a few words')).toBe(1);
    });
});

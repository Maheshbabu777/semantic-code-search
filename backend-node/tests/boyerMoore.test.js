import { describe, expect, test } from 'vitest';
import { badCharTable, boyerMoore } from '../src/search/boyerMoore';

describe('BoyerMoore', () => {
    test('finds single match', () => {
        expect(boyerMoore('hello world', 'world')).toEqual([6]);
    });

    test('finds multiple matches', () => {
        expect(boyerMoore('ababab', 'ab')).toEqual([0, 2, 4]);
    });

    test('returns empty when no match', () => {
        expect(boyerMoore('hello', 'xyz')).toEqual([]);
    });

    test('handles empty pattern', () => {
        expect(boyerMoore('hello', '')).toEqual([]);
    });

    test('bad character table is correct', () => {
        expect(badCharTable('ababc')).toEqual({ a: 2, b: 3, c: 4 });
    });

});
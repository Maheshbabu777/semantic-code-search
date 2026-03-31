import { describe, expect, test } from 'vitest';
import { buildFailureTable, kmpSearch } from '../src/search/kmp';

describe('KMP', () => {
    test('finds single match', () => {
        expect(kmpSearch('hello world', 'world')).toEqual([6]);
    });

    test('finds multiple matches', () => {
        expect(kmpSearch('ababab', 'ab')).toEqual([0, 2, 4]);
    });

    test('returns empty when no match', () => {
        expect(kmpSearch('hello', 'xyz')).toEqual([]);
    });

    test('handles empty pattern', () => {
        expect(kmpSearch('hello', '')).toEqual([]);
    });

    test('failure table is correct', () => {
        expect(buildFailureTable('ababc')).toEqual([0, 0, 1, 2, 0]);
    });

});
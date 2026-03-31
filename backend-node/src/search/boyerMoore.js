export function badCharTable(pattern) {
    const table = {};
    const patLen = pattern.length;
    for (let i = 0; i < patLen; i++) {
        table[pattern[i]] = i;
    }
    return table;
}

export function boyerMoore(text, pattern) {
    const matches = [];
    const textLen = text.length;
    const patLen = pattern.length;
    if (textLen === 0 || patLen === 0 || patLen > textLen) return matches;
    const badChar = badCharTable(pattern);
    let s = 0;

    while (s <= textLen - patLen) {
        let j = patLen - 1;
        while (j >= 0 && pattern[j] === text[s + j]) {
            j--;
        }

        if (j < 0) {
            matches.push(s);
            s += (s + patLen < textLen) ? patLen - (badChar[text[s + patLen]] ?? -1) : 1;
        }
        else {
            s += Math.max(1, j - (badChar[text[s + j]] ?? -1));
        }
    }

    return matches;
}
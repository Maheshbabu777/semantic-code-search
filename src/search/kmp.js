export function buildFailureTable(pattern) {
    const table = new Array(pattern.length).fill(0);
    let len = 0;
    let i = 1;
    let patLen = pattern.length;

    while (i < patLen) {
        if (pattern[i] === pattern[len]) {
            len++;
            table[i] = len;
            i++;
        }
        else {
            if (len > 0) {
                len = table[len - 1];
            }
            else {
                table[i] = 0;
                i++;
            }
        }
    }

    return table;
}

export function kmpSearch(text, pattern) {
    if (!text || !pattern) return [];
    const matches = [];
    const table = buildFailureTable(pattern);
    let i = 0;
    let j = 0;
    let textLen = text.length;
    let patLen = pattern.length;

    while (i < textLen) {
        if (text[i] == pattern[j]) {
            i++;
            j++;
        }
        if (j === patLen) {
            matches.push(i - j);
            j = table[j - 1];
        }
        else if (i < textLen && text[i] !== pattern[j]) {
            (j !== 0) ? (j = table[j - 1]) : i++;
        }
    }

    return matches;

}

export function indexsToLocations(text, indexes) {
    const lines = text.split('\n');
    const lineStarts = [];
    let pos = 0;
    for (const line of lines) {
        lineStarts.push(pos);
        pos += line.length + 1;
    }

    return indexes.map(idx => {
        let line = lineStarts.findIndex((start, i) =>
            start <= idx && (lineStarts[i + 1] === undefined || lineStarts[i + 1] > idx)
        );

        return {
            index: idx,
            line: line + 1,
            column: idx - lineStarts[line] + 1
        };
    });
}
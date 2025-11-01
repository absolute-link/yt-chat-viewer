export function getChunksToLinesTransform() {
    let leftovers = '';
    return new TransformStream({
        transform: (chunk: string, controller: TransformStreamDefaultController<string>) => {
            const text = leftovers + chunk;
            leftovers = '';

            const lines = text.split(/\r?\n/g);
            while (lines.length > 1) {
                controller.enqueue(lines.shift());
            }

            const final = lines.shift();
            if (final) leftovers = final;
        }
    });
}

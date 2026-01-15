export const createRandomId = (prefix: string): string => {
    const date = Date.now();
    return `${prefix}_${date}_${Math.floor(Math.random() * 10000)}`;
}
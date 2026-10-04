/** Resolve independent reads without exposing transport or database errors. */
export async function loadIndependentSources(loaders) {
    const names = Object.keys(loaders);
    const reads = names.map(name => {
        try {
            return loaders[name]();
        } catch (error) {
            return Promise.reject(error);
        }
    });
    const results = await Promise.allSettled(reads);
    const values = {};
    const dataSources = {};
    const errors = [];
    results.forEach((result, index) => {
        const source = names[index];
        if (result.status === 'rejected') {
            values[source] = null;
            dataSources[source] = 'unavailable';
            errors.push({ source, message: 'Données temporairement indisponibles.' });
        } else {
            values[source] = result.value;
            dataSources[source] = result.value == null || (Array.isArray(result.value) && result.value.length === 0) ? 'empty' : 'available';
        }
    });
    return { values, dataSources, errors };
}

export function getSourceStatus(dataSources) {
    const states = Object.values(dataSources);
    if (states.length && states.every(state => state === 'unavailable')) return 'unavailable';
    return states.some(state => state === 'unavailable' || state === 'partial') ? 'partial' : 'available';
}

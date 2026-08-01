export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./mock-next-headers.mjs', import.meta.url).href,
    };
  }
  
  if (specifier.startsWith('@/')) {
    const resolvedUrl = new URL('../../src/' + specifier.slice(2) + '.ts', import.meta.url).href;
    return {
      format: 'module',
      shortCircuit: true,
      url: resolvedUrl,
    };
  }

  if (specifier.endsWith('.js') && specifier.includes('src/lib/actions')) {
    const tsSpecifier = specifier.replace(/\.js$/, '.ts');
    return nextResolve(tsSpecifier, context);
  }

  return nextResolve(specifier, context);
}

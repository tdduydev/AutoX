import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

const search = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
});

export const revalidate = false;

export const GET =
  process.env.NEXT_OUTPUT === 'export' ? search.staticGET : search.GET;

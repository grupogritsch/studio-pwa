
"use server";

import { revalidatePath } from 'next/cache';
import type { OccurrenceFormData } from './definitions';

export async function submitOccurrence(data: OccurrenceFormData & { scannedCode: string }) {
  console.log('Submitting data:', { ...data });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // In a real app, you would handle file upload and database saving.
  // We've moved storage to IndexedDB on the client side.

  console.log('Data processed for client-side storage via IndexedDB.');

  revalidatePath('/');
  return { success: true, message: 'Ocorrência registrada com sucesso!' };
}

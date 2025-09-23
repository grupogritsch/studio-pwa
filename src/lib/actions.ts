"use server";

import { revalidatePath } from 'next/cache';
import type { OccurrenceFormData } from './definitions';

export async function submitOccurrence(data: OccurrenceFormData) {
  console.log('Submitting data:', {
    ...data,
    photo: `File received: ${data.photo.name}, size: ${data.photo.size} bytes`
  });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In a real app, you would upload the photo to a storage service (like Firebase Storage)
  // and save the rest of the data, along with the photo URL, to a database (like Firestore).

  console.log('Data submitted successfully.');

  revalidatePath('/');
  return { success: true, message: 'Ocorrência registrada com sucesso!' };
}

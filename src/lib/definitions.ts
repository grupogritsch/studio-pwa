
import { z } from 'zod';

// This schema is for client-side validation with react-hook-form
export const OccurrenceFormSchema = z.object({
  occurrence: z.string(),
  photo: z.any().optional(),
  receiverName: z.string().optional(),
  receiverDocument: z.string().optional(),
});


// This type is for the actual data submission (e.g., to a server action)
export type OccurrenceFormData = z.infer<typeof OccurrenceFormSchema> & {
    photo?: File;
    latitude?: number;
    longitude?: number;
};

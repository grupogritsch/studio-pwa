import { getApiUrl, API_CONFIG } from "@/lib/config";

export class PhotoUploadService {
  /**
   * Upload base64 image via Django API that will upload to R2
   * @param base64Data - Base64 encoded image data
   * @param filename - Optional filename
   * @returns Promise<string> - R2 URL returned by Django
   */
  async uploadBase64ToR2(base64Data: string, filename?: string): Promise<string> {
    try {
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomId = Math.random().toString(36).substring(2, 8);
        filename = `ocorrencia_${timestamp}_${randomId}.jpg`;
      }

      console.log(`Uploading photo via Django API: ${filename}`);
      console.log(`Image size: ${(base64Data.length * 0.75 / 1024).toFixed(2)}KB`);

      // Send to Django API
      const response = await fetch(getApiUrl('/api/occurrence/upload-photo/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          image_data: base64Data,
          filename: filename
        })
      });

      console.log('Django API response status:', response.status);
      console.log('Django API response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Django API raw response:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Django API parsed response:', result);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
      }

      if (result.success && result.url) {
        console.log(`Photo uploaded successfully: ${result.url}`);
        return result.url;
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Error uploading photo via Django:', error);
      throw new Error(`Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload multiple base64 images via Django API
   * @param base64Images - Array of base64 encoded images
   * @returns Promise<string[]> - Array of R2 URLs
   */
  async uploadMultipleImages(base64Images: string[]): Promise<string[]> {
    const uploadPromises = base64Images.map((base64Data, index) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ocorrencia_${timestamp}_${index + 1}.jpg`;
      return this.uploadBase64ToR2(base64Data, filename);
    });

    try {
      const urls = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${urls.length} images via Django`);
      return urls;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const photoUploadService = new PhotoUploadService();
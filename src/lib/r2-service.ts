import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2 Configuration - usando as credenciais do Django
const R2_CONFIG = {
  accessKeyId: '1de9e9e0783dbaceb1641a400f51b333',
  secretAccessKey: '1eaca34c13c3b356780759660b71af525f8d639ac242d96c2107679479a6a863',
  bucketName: 'logistik',
  accountId: 'e8c6735d64c0de556addbdabf3cabfa5',
  endpoint: 'https://e8c6735d64c0de556addbdabf3cabfa5.r2.cloudflarestorage.com'
};

export class R2Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_CONFIG.endpoint,
      credentials: {
        accessKeyId: R2_CONFIG.accessKeyId,
        secretAccessKey: R2_CONFIG.secretAccessKey,
      },
      forcePathStyle: true, // Necessário para compatibilidade com R2
      tls: true,
    });
  }

  /**
   * Upload a compressed base64 image to Cloudflare R2
   * @param base64Data - Base64 encoded image data
   * @param filename - Optional filename (will generate if not provided)
   * @returns Promise<string> - Public URL of uploaded image
   */
  async uploadBase64Image(base64Data: string, filename?: string): Promise<string> {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64String, 'base64');

      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomId = Math.random().toString(36).substring(2, 8);
        filename = `photos/ocorrencia_${timestamp}_${randomId}.jpg`;
      } else if (!filename.startsWith('photos/')) {
        filename = `photos/${filename}`;
      }

      console.log(`Uploading to R2: ${filename}`);
      console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
      console.log(`Endpoint: ${R2_CONFIG.endpoint}`);
      console.log(`Bucket: ${R2_CONFIG.bucketName}`);

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: filename,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'max-age=31536000', // 1 year cache
        // Remover ACL pois R2 pode não suportar
      });

      console.log('Sending command to R2...');
      await this.s3Client.send(command);
      console.log('Command sent successfully');

      // Return public URL
      const publicUrl = `https://pub-${R2_CONFIG.accountId}.r2.dev/${filename}`;
      console.log(`Upload successful: ${publicUrl}`);

      return publicUrl;

    } catch (error) {
      console.error('Error uploading to R2:', error);
      throw new Error(`Failed to upload image to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload multiple base64 images to R2
   * @param base64Images - Array of base64 encoded images
   * @returns Promise<string[]> - Array of public URLs
   */
  async uploadMultipleImages(base64Images: string[]): Promise<string[]> {
    const uploadPromises = base64Images.map((base64Data, index) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ocorrencia_${timestamp}_${index + 1}.jpg`;
      return this.uploadBase64Image(base64Data, filename);
    });

    try {
      const urls = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${urls.length} images to R2`);
      return urls;
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  }

  /**
   * Get a presigned URL for uploading (if needed for future use)
   * @param filename - The filename for the upload
   * @returns Promise<string> - Presigned URL
   */
  async getPresignedUploadUrl(filename: string): Promise<string> {
    // This would be implemented if we need presigned URLs
    // For now, we're doing direct uploads
    throw new Error('Presigned URLs not implemented yet');
  }
}

// Export singleton instance
export const r2Service = new R2Service();
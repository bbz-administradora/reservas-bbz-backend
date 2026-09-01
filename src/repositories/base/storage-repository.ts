export interface IStorageAdapter {
  deleteFile(path: string): Promise<void>
  uploadFile(path: string, buffer: Buffer, contentType: string): Promise<void>
  deleteFiles(prefix: string): Promise<void>
  getPublicUrl(path: string): string
}

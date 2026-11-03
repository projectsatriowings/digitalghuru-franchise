declare module 'compression' {
  import { Request, Response, RequestHandler } from 'express';
  interface CompressionOptions {
    filter?: (req: Request, res: Response) => boolean;
    threshold?: number | string;
    level?: number;
    [key: string]: any;
  }
  interface CompressionFunction {
    (options?: CompressionOptions): RequestHandler;
    filter: (req: Request, res: Response) => boolean;
  }
  const compression: CompressionFunction;
  export default compression;
}

import fs from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Middleware } from "metro-config";

export default function createEnhanceMiddleware(manifestPath: string) {
  return function enhanceMiddleware(metroMiddleware: Middleware): Middleware {
    return (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: any) => void
    ) => {
      if (req.url === "/mf-manifest.json") {
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);

        const manifestContent = fs.readFileSync(manifestPath, "utf-8");

        res.end(manifestContent);
      } else {
        // @ts-ignore
        metroMiddleware(req, res, next);
      }
    };
  };
}

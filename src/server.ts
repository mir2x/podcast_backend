import http from "http";
import app from "./app";
import { connectDB } from "@connection/atlasDB";
import "dotenv/config";
import { logger } from "@shared/logger";

const PORT = process.env.PORT || 8000;
async function startServer() {
  try {
    await connectDB();
    const server = http.createServer(app);
    server.listen(PORT, () => {
      logger.info(`Server is running at PORT: ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start the server:", error);
  }
}

startServer();

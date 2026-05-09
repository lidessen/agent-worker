import { startServer } from "../shared/server";
import app from "./index.html";

startServer(app, {
  title: "✓ Server started successfully!",
  borderColor: "green",
});

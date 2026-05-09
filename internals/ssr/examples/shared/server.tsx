/** @jsxImportSource @semajsx/terminal */
import { print } from "@semajsx/terminal";

export interface ServerConfig {
  /**
   * Title to display in the banner
   */
  title: string;
  /**
   * Border color for the title banner
   * @default "green"
   */
  borderColor?: string;
  /**
   * Optional list of features/info to display
   */
  features?: string[];
}

/**
 * Start a Bun server with beautiful terminal output
 */
export function startServer(app: any, config: ServerConfig) {
  const server = Bun.serve({
    routes: {
      "/": app,
    },
  });

  printServerInfo(server, config);

  return server;
}

/**
 * Print server information to terminal
 */
function printServerInfo(server: ReturnType<typeof Bun.serve>, config: ServerConfig) {
  const { title, borderColor = "green", features = [] } = config;
  const url = server.url.toString();
  const hostname = server.hostname;
  const port = server.port;

  print(
    <box flexDirection="column">
      {/* Title Banner */}
      <box border="round" borderColor={borderColor} padding={1} marginBottom={1}>
        <text bold color={borderColor}>
          {title}
        </text>
      </box>

      {/* Server Info */}
      <box flexDirection="column" paddingLeft={1}>
        <box flexDirection="row" marginBottom={1}>
          <text bold>Local:</text>
          <text color="cyan">{url}</text>
        </box>

        <box flexDirection="row" marginBottom={1}>
          <text bold>Host:</text>
          <text color="cyan">{hostname}</text>
        </box>

        <box flexDirection="row">
          <text bold>Port:</text>
          <text color="yellow">{port}</text>
        </box>
      </box>

      {/* Optional Features */}
      {features.length > 0 && (
        <box marginTop={1} flexDirection="column" paddingLeft={1}>
          {features.map((feature) => (
            <box key={feature}>
              <text color="green">{feature}</text>
            </box>
          ))}
        </box>
      )}

      {/* Exit Instructions */}
      <box marginTop={1} paddingLeft={1}>
        <text dim>Press Ctrl+C to stop</text>
      </box>
    </box>,
  );
}

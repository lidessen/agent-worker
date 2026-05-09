/** @jsxImportSource @semajsx/dom */

/**
 * Context API Example: Async Components
 *
 * This example demonstrates how Context API works safely with async components.
 * Context is captured when the component is called, so it remains consistent
 * even after await.
 */

import { Context, context } from "../src/runtime";
import type { ComponentAPI } from "../src/runtime/types";

// User context
interface User {
  id: number;
  name: string;
}

const UserContext = context<User>("user");

// Config context
interface Config {
  apiUrl: string;
  timeout: number;
}

const ConfigContext = context<Config>("config");

// Simulate API fetch
async function fetchUserData(userId: number, apiUrl: string): Promise<any> {
  console.log(`Fetching data from ${apiUrl}/users/${userId}...`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return {
    userId,
    posts: 42,
    followers: 1337,
  };
}

// App component
function App() {
  const currentUser: User = {
    id: 123,
    name: "Alice",
  };

  const config: Config = {
    apiUrl: "https://api.example.com",
    timeout: 5000,
  };

  return (
    <Context
      provide={[
        [UserContext, currentUser],
        [ConfigContext, config],
      ]}
    >
      <div style={{ padding: "20px" }}>
        <h1>Context API - Async Component Example</h1>
        <UserProfile />
      </div>
    </Context>
  );
}

// Async component - context is safely captured
async function UserProfile(_props: any, ctx: ComponentAPI) {
  // Context is captured immediately when component is called
  const user = ctx.inject(UserContext);
  const config = ctx.inject(ConfigContext);

  if (!user) {
    return <div>No user logged in</div>;
  }

  if (!config) {
    return <div>No config available</div>;
  }

  console.log(`UserProfile rendering for: ${user.name}`);

  // Async operation - context remains captured
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Fetch data using captured context
  const userData = await fetchUserData(user.id, config.apiUrl);

  // Context values are still the same as when component was called
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "20px",
        margin: "20px 0",
      }}
    >
      <h2>User Profile: {user.name}</h2>
      <p>User ID: {user.id}</p>
      <p>Posts: {userData.posts}</p>
      <p>Followers: {userData.followers}</p>
      <p>API URL: {config.apiUrl}</p>
      <p>Timeout: {config.timeout}ms</p>
    </div>
  );
}

// Render example
if (typeof document !== "undefined") {
  const { render } = await import("../src/dom");
  const root = document.getElementById("root");
  if (root) {
    render(<App />, root);
  }
}

export { App };

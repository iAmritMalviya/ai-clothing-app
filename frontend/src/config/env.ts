interface ClientConfig {
  apiBaseUrl: string;
}

export const config: ClientConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
};

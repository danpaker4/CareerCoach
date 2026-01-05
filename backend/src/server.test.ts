import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StatusCodes } from "http-status-codes";
import { Server, type ServerConfig } from "./server";

describe("Server", () => {
  const config: ServerConfig = { port: 4321 };

  const server = new Server(config);

  beforeAll(async () => {
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should return 404 for invalid routes", async () => {
    const res = await server.app.inject({
      method: "GET",
      url: "/invalid-route",
    });
    expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  });
});


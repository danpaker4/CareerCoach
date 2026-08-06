import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config", () => ({
  ENV: {
    LANGFUSE_DASHBOARD_URL: "",
  },
}));

import { ENV } from "../../config";
import { Management } from "./Management";

const renderManagement = (): void => {
  render(
    <MemoryRouter>
      <Management />
    </MemoryRouter>,
  );
};

describe("Management", () => {
  beforeEach(() => {
    ENV.LANGFUSE_DASHBOARD_URL = "";
  });

  it("hides the Langfuse card when no dashboard URL is configured", () => {
    renderManagement();

    expect(screen.queryByRole("link", { name: /langfuse traces/i })).toBeNull();
  });

  it("renders a secure external Langfuse dashboard link when configured", () => {
    ENV.LANGFUSE_DASHBOARD_URL = "https://cloud.langfuse.com";
    renderManagement();

    const link = screen.getByRole("link", { name: /langfuse traces/i });
    expect(link.getAttribute("href")).toBe("https://cloud.langfuse.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });
});

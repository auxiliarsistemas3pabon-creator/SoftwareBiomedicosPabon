import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastContainer } from "./ToastContainer";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ToastContainer server rendering", () => {
  it("returns null when the document is unavailable", () => {
    vi.stubGlobal("document", undefined);

    expect(
      renderToString(
        <ToastContainer
          toasts={[{ id: "server-toast", title: "Aviso" }]}
          onDismiss={vi.fn()}
        />,
      ),
    ).toBe("");
  });
});

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleLogout } from "./useIdleLogout";

describe("useIdleLogout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cierra sesión tras el tiempo de inactividad", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(true, onIdle, 1000));
    vi.advanceTimersByTime(999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("la actividad reinicia el contador", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(true, onIdle, 1000));
    vi.advanceTimersByTime(800);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(800);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("no hace nada sin sesión activa", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout(false, onIdle, 1000));
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});

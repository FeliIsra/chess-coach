import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportDialog from "@/components/report-dialog";

const VALID_BODY =
  "Something is broken on the analysis screen and it never finishes loading.";

describe("ReportDialog", () => {
  const onClose = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    onClose.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ReportDialog open={false} onClose={onClose} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders form fields when open", () => {
    render(<ReportDialog open onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/what happened/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send report/i }),
    ).toBeDisabled();
  });

  it("disables submit until body meets minimum length", () => {
    render(<ReportDialog open onClose={onClose} />);
    const textarea = screen.getByLabelText(/what happened/i);
    fireEvent.change(textarea, { target: { value: "short" } });
    expect(
      screen.getByRole("button", { name: /send report/i }),
    ).toBeDisabled();

    fireEvent.change(textarea, { target: { value: VALID_BODY } });
    expect(
      screen.getByRole("button", { name: /send report/i }),
    ).not.toBeDisabled();
  });

  it("sends the expected payload on submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReportDialog open onClose={onClose} />);

    // Pick "feature".
    fireEvent.click(screen.getByLabelText(/^feature$/i));
    fireEvent.change(screen.getByLabelText(/what happened/i), {
      target: { value: VALID_BODY },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "u@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /send report/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/reports");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      type: "feature",
      body: VALID_BODY,
      email: "u@example.com",
      honeypot: "",
    });
    expect(typeof sent.page_url).toBe("string");

    await waitFor(() =>
      expect(screen.getByText(/thanks for the report/i)).toBeInTheDocument(),
    );
  });

  it("shows an error state when the API rejects the submission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Boom" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReportDialog open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/what happened/i), {
      target: { value: VALID_BODY },
    });
    fireEvent.click(screen.getByRole("button", { name: /send report/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Boom"),
    );
    // Form is still rendered (not the success view).
    expect(screen.getByLabelText(/what happened/i)).toBeInTheDocument();
  });

  it("flags an invalid email", () => {
    render(<ReportDialog open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/what happened/i), {
      target: { value: VALID_BODY },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    expect(
      screen.getByRole("button", { name: /send report/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/doesn't look like a valid email/i),
    ).toBeInTheDocument();
  });

  it("includes a hidden honeypot input that is not in the tab order", () => {
    render(<ReportDialog open onClose={onClose} />);
    const honeypot = document.getElementById(
      "report-honeypot",
    ) as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot!.tabIndex).toBe(-1);
    expect(honeypot!.getAttribute("autocomplete")).toBe("off");
    expect(honeypot!.name).toBe("honeypot");
  });

  it("calls onClose when the close button is clicked", () => {
    render(<ReportDialog open onClose={onClose} />);
    fireEvent.click(
      screen.getByRole("button", { name: /close report dialog/i }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});

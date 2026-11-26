import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { validateUIMessages } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ChatPanel } from "@/components/decision-chat/chat-panel";
import { COPY } from "@/lib/domain/copy-pl";
import { DecisionSchema, UpdatedDecisionInputSchema, type ChatUIMessage } from "@/lib/domain/schemas";

import { readUiStream } from "../../helpers/ui-stream";

// Every response is a real capture (tests/fixtures/captures). Only the transport is replayed: the
// recorded status, headers and body are returned verbatim. Request bodies are recorded for assertions.

const FIXTURES = join(process.cwd(), "tests", "fixtures", "captures");

const RouteCaptureSchema = z.object({
  capture: z.string(),
  response: z.object({
    status: z.number(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
  }),
});
type RouteCapture = z.infer<typeof RouteCaptureSchema>;

function loadCapture(folder: "api-chat" | "api-case", name: string): RouteCapture {
  return RouteCaptureSchema.parse(JSON.parse(readFileSync(join(FIXTURES, folder, `${name}.json`), "utf8")));
}

const SentBodySchema = z.object({
  messages: z.array(z.object({ role: z.string(), parts: z.array(z.looseObject({ type: z.string() })) })),
});

// The case stream holds the first message, caseId and caseToken that the chat captures were made with.
const CaseStartSchema = z.object({
  type: z.literal("data-case"),
  data: z.object({
    caseId: z.uuid(),
    caseToken: z.string().min(1),
    firstMessage: z.unknown(),
  }),
});

async function loadCaseStart() {
  const capture = loadCapture("api-case", "success-reklamacja-laptop-1");
  const chunks = await readUiStream(new Response(capture.response.body, { status: capture.response.status }));
  const event = chunks.find((chunk) => chunk.type === "data-case");
  const start = CaseStartSchema.parse(event);
  const [firstMessage] = await validateUIMessages<ChatUIMessage>({
    messages: [start.data.firstMessage],
    dataSchemas: { decision: DecisionSchema },
    tools: {
      issueUpdatedDecision: { inputSchema: UpdatedDecisionInputSchema, outputSchema: DecisionSchema },
    },
  });
  if (!firstMessage) throw new Error("data-case carries no firstMessage");
  return { caseId: start.data.caseId, caseToken: start.data.caseToken, firstMessage };
}

const start = await loadCaseStart();

/**
 * Replays the recorded responses in order. `hold` delays the body of every response until it resolves
 * (the verbatim body is delivered as one chunk), so tests can observe the streaming state.
 */
function replayCaptures(captures: readonly RouteCapture[], hold?: Promise<void>) {
  const bodies: unknown[] = [];
  const encoder = new TextEncoder();
  let index = 0;

  const fetchImpl: typeof fetch = async (_input, init) => {
    bodies.push(typeof init?.body === "string" ? JSON.parse(init.body) : undefined);
    const capture = captures[index];
    index += 1;
    if (!capture) throw new Error(`replayCaptures: no capture for request #${index}`);

    const { status, headers, body } = capture.response;
    if (hold === undefined) return new Response(body, { status, headers });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        await hold;
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    return new Response(stream, { status, headers });
  };

  return { fetchImpl, bodies };
}

function renderPanel(fetchImpl: typeof fetch) {
  return render(
    <div style={{ height: 600 }}>
      <ChatPanel
        caseId={start.caseId}
        caseToken={start.caseToken}
        firstMessage={start.firstMessage}
        fetchImpl={fetchImpl}
      />
    </div>,
  );
}

function getInput() {
  return screen.getByRole("textbox", { name: COPY.chat.inputLabel });
}

describe("ChatPanel", () => {
  it("renders the first message with its initial decision card (chat-panel: firstMessage)", () => {
    const { fetchImpl } = replayCaptures([]);
    renderPanel(fetchImpl);

    expect(screen.getByText(/ThinkBook 14/)).toBeInTheDocument();
    const card = screen.getByTestId("decision-card");
    expect(card).toHaveAttribute("data-decision-kind", "initial");
    expect(card).toHaveAttribute("data-decision-label", "wymaga_weryfikacji");
  });

  it("sends the request body with caseId, caseToken and trigger, then streams the reply (plain-answer.json)", async () => {
    const user = userEvent.setup();
    const hold = Promise.withResolvers<void>();
    const { fetchImpl, bodies } = replayCaptures([loadCapture("api-chat", "plain-answer")], hold.promise);
    renderPanel(fetchImpl);

    await user.type(getInput(), "Jaki model zgłosiłem?");
    await user.click(screen.getByRole("button", { name: COPY.chat.send }));

    // Held stream: the request is in flight, so the input is locked.
    await waitFor(() => expect(getInput()).toBeDisabled());
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      id: start.caseId,
      caseToken: start.caseToken,
      trigger: "submit-message",
    });
    const sent = SentBodySchema.parse(bodies[0]);
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[1]).toMatchObject({ role: "user", parts: [{ type: "text", text: "Jaki model zgłosiłem?" }] });

    hold.resolve();

    expect(await screen.findByText("Zgłosił(a) Pan/Pani laptop ThinkBook 14.")).toBeInTheDocument();
    await waitFor(() => expect(getInput()).toBeEnabled());
  });

  it("renders the updated decision card and the follow-up text (updated-decision.json)", async () => {
    const user = userEvent.setup();
    const { fetchImpl } = replayCaptures([loadCapture("api-chat", "updated-decision")]);
    renderPanel(fetchImpl);

    await user.type(
      getInput(),
      "Przypomniałem sobie, że tydzień przed awarią laptop spadł mi z biurka na podłogę i od tego czasu nie ładuje się.",
    );
    await user.click(screen.getByRole("button", { name: COPY.chat.send }));

    expect(await screen.findByText(COPY.decision.updatedTitle)).toBeInTheDocument();
    const updated = document.querySelector('[data-decision-kind="updated"]');
    expect(updated).not.toBeNull();
    expect(screen.getByText(/Zaktualizowano wstępną decyzję/)).toBeInTheDocument();
  });

  it("shows the error with retry and keeps the user message; retry regenerates (chat-failed-invalid-key.json)", async () => {
    const user = userEvent.setup();
    const { fetchImpl, bodies } = replayCaptures([
      loadCapture("api-chat", "chat-failed-invalid-key"),
      loadCapture("api-chat", "plain-answer"),
    ]);
    renderPanel(fetchImpl);

    await user.type(getInput(), "Jaki model zgłosiłem?");
    await user.click(screen.getByRole("button", { name: COPY.chat.send }));

    expect(await screen.findByText(COPY.chat.error)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(COPY.chat.error);
    expect(screen.getByText("Jaki model zgłosiłem?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: COPY.chat.retry }));

    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ id: start.caseId, caseToken: start.caseToken, trigger: "regenerate-message" });
    expect(await screen.findByText("Zgłosił(a) Pan/Pani laptop ThinkBook 14.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error and keeps the user message when the token is rejected (invalid-token-401.json)", async () => {
    const user = userEvent.setup();
    const { fetchImpl, bodies } = replayCaptures([loadCapture("api-chat", "invalid-token-401")]);
    renderPanel(fetchImpl);

    await user.type(getInput(), "Jaki model zgłosiłem?");
    await user.click(screen.getByRole("button", { name: COPY.chat.send }));

    expect(await screen.findByRole("alert")).toHaveTextContent(COPY.chat.error);
    expect(screen.getByRole("button", { name: COPY.chat.retry })).toBeInTheDocument();
    expect(screen.getByText("Jaki model zgłosiłem?")).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
  });

  it("does not send whitespace-only input", async () => {
    const user = userEvent.setup();
    const { fetchImpl, bodies } = replayCaptures([]);
    renderPanel(fetchImpl);

    await user.type(getInput(), "   ");
    await user.click(screen.getByRole("button", { name: COPY.chat.send }));

    expect(bodies).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

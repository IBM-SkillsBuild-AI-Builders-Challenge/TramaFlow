"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Trash2, Loader2, Zap } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useStoryStore } from "@/store/useStoryStore";
import { WORKSPACE_CONFIGS } from "@/types/workspace";
import type { ChatMessage } from "@/types/story";

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-0.5 text-[11px] text-slate-400 dark:text-slate-400">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white mt-0.5 ${
          isUser ? "bg-indigo-500" : "bg-violet-600"
        }`}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      <div
        className={`
          max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
          ${isUser
            ? "rounded-tr-sm bg-indigo-600 text-white"
            : "rounded-tl-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
          }
        `}
      >
        {message.content}
        {message.nodeAction && (
          <div className="mt-2 flex items-center gap-1 rounded-lg bg-violet-100 dark:bg-violet-900/40 px-2 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
            <Zap size={10} />
            {message.nodeAction.type === "PATCH_NODES"
              ? `${message.nodeAction.nodePatches?.length ?? 0} node(s) patched`
              : message.nodeAction.type === "PATCH_EDGES"
              ? `${message.nodeAction.edgePatches?.length ?? 0} edge(s) renamed`
              : `${message.nodeAction.nodes?.length ?? 0} node(s) pushed to canvas`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white mt-0.5">
        <Bot size={13} />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const messages      = useStoryStore((s) => s.messages);
  const isAiThinking  = useStoryStore((s) => s.isAiThinking);
  const addMessage    = useStoryStore((s) => s.addMessage);
  const setAiThinking = useStoryStore((s) => s.setAiThinking);
  const clearMessages = useStoryStore((s) => s.clearMessages);
  const applyNodeAction = useStoryStore((s) => s.applyNodeAction);
  const nodes         = useStoryStore((s) => s.nodes);
  const edges         = useStoryStore((s) => s.edges);
  const workspaceMode = useStoryStore((s) => s.workspaceMode);

  // Resolve config — fall back to story defaults if somehow mode is null
  const cfg = WORKSPACE_CONFIGS[workspaceMode ?? "story"].chat;

  const [input, setInput] = useState("");
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiThinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isAiThinking) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    setInput("");
    setAiThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: trimmed },
          ],
          graphContext: { nodes, edges },
          // Pass the active workspace mode so the API selects the right prompt
          mode: workspaceMode ?? "story",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: data.message,
        timestamp: Date.now(),
        nodeAction: data.nodeAction ?? undefined,
      };
      addMessage(assistantMessage);
      if (data.nodeAction) applyNodeAction(data.nodeAction);
    } catch (err) {
      addMessage({
        id: uuidv4(),
        role: "system",
        content: `⚠️ ${err instanceof Error ? err.message : "Could not reach the AI."}`,
        timestamp: Date.now(),
      });
      console.error(err);
    } finally {
      setAiThinking(false);
    }
  }, [input, messages, nodes, edges, isAiThinking, workspaceMode, addMessage, setAiThinking, applyNodeAction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cfg.agentName}</p>
            <p className="text-[11px] text-slate-400">{cfg.agentSub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ready
          </span>
          <button
            onClick={clearMessages}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
              <Bot size={28} className="text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {cfg.emptyTitle}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {cfg.emptyBody}
            </p>
            <div className="flex flex-col gap-2 w-full mt-2">
              {cfg.suggestions.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                  className="
                    rounded-xl border px-3 py-2 text-left text-xs
                    border-slate-200 dark:border-slate-600
                    bg-white dark:bg-slate-800
                    text-slate-600 dark:text-slate-300
                    hover:border-violet-300 hover:text-violet-700
                    dark:hover:border-violet-600 dark:hover:text-violet-400
                    transition-colors
                  "
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isAiThinking && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div className="
          flex items-end gap-2 rounded-xl px-3 py-2
          border border-slate-200 dark:border-slate-600
          bg-slate-50 dark:bg-slate-900
          focus-within:border-violet-400 transition-colors
        ">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={cfg.placeholder}
            rows={1}
            disabled={isAiThinking}
            className="flex-1 resize-none bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isAiThinking}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isAiThinking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useAndroidTV } from "./useAndroidTV";

export function useKeyboardImeControls() {
  const {
    sendKey,
    sendText,
    sendTextWithCursor,
    sendShortcut,
    imeOpen,
    imeLabel,
    imeValue,
    imeCursorStart,
    imeCursorEnd,
    setImeOpen,
    getImeValue,
  } = useAndroidTV();

  const [imeText, setImeText] = useState("");
  const [imeSending, setImeSending] = useState(false);
  const imeInputRef = useRef<HTMLTextAreaElement>(null);
  const isTypingRef = useRef(false);
  const lastSentTextRef = useRef("");
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!imeOpen) return;

    let active = true;
    setImeText(imeValue);
    lastSentTextRef.current = imeValue;

    // Set cursor position from TV
    setTimeout(() => {
      if (active && imeInputRef.current) {
        imeInputRef.current.focus();
        imeInputRef.current.setSelectionRange(imeCursorStart, imeCursorEnd);
      }
    }, 80);

    return () => {
      active = false;
    };
  }, [imeOpen, imeValue, imeCursorStart, imeCursorEnd]);

  useEffect(() => {
    // Only update imeText from TV if we're not typing and the value is different
    // This prevents overwriting user input with TV's echo
    if (imeOpen && !isTypingRef.current && imeValue !== imeText) {
      setImeText(imeValue);
      lastSentTextRef.current = imeValue;
    }
  }, [imeOpen, imeValue]);

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  const openIme = useCallback(async () => {
    const state = await getImeValue();
    setImeText(state.value);
    lastSentTextRef.current = state.value;
    // Focus and set cursor position after state update
    setTimeout(() => {
      if (imeInputRef.current) {
        imeInputRef.current.focus();
        imeInputRef.current.setSelectionRange(state.start, state.end);
      }
    }, 80);
    setImeOpen(true);
  }, [getImeValue, setImeOpen]);

  const closeIme = useCallback(() => {
    setImeOpen(false);
  }, [setImeOpen]);

  const handleImeSend = useCallback(async () => {
    setImeSending(true);
    try {
      await sendText(imeText);
      await sendKey("TEXT_ENTER");
    } finally {
      setImeSending(false);
      setImeOpen(false);
    }
  }, [imeText, sendKey, sendText, setImeOpen]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      isTypingRef.current = true;
      const newText = e.target.value;
      const cursorStart = e.target.selectionStart;
      const cursorEnd = e.target.selectionEnd;
      setImeText(newText);

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }

      sendTimeoutRef.current = setTimeout(() => {
        // Only send if text actually changed from what we last sent
        if (newText !== lastSentTextRef.current) {
          void sendTextWithCursor(newText, cursorStart, cursorEnd);
          lastSentTextRef.current = newText;
        }
      }, 30);

      setTimeout(() => {
        isTypingRef.current = false;
      }, 200);
    },
    [sendTextWithCursor],
  );

  const handleFocus = useCallback(() => {
    // Don't reset isTypingRef here - it causes a race condition where focusing
    // the textarea immediately allows TV's echo to overwrite local text.
    // The isTypingRef is managed by handleChange which resets after 200ms.
  }, []);

  const handleBlur = useCallback(() => {
    isTypingRef.current = false;
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
    // Send final update on blur if there's unsent changes
    if (imeText !== lastSentTextRef.current) {
      const cursorStart = imeInputRef.current?.selectionStart || 0;
      const cursorEnd = imeInputRef.current?.selectionEnd || 0;
      void sendTextWithCursor(imeText, cursorStart, cursorEnd);
      lastSentTextRef.current = imeText;
    }
  }, [imeText, sendTextWithCursor]);

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      const cursorStart = target.selectionStart;
      const cursorEnd = target.selectionEnd;
      // Only send cursor position if text hasn't changed
      void sendTextWithCursor(imeText, cursorStart, cursorEnd);
    },
    [imeText, sendTextWithCursor],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.ctrlKey || e.metaKey) {
        const shortcutMap: Record<
          string,
          "SELECT_ALL" | "COPY" | "PASTE" | "CUT" | "UNDO" | "REDO"
        > = {
          a: "SELECT_ALL",
          c: "COPY",
          v: "PASTE",
          x: "CUT",
          z: "UNDO",
          y: "REDO",
        };

        const shortcut = shortcutMap[e.key.toLowerCase()];
        if (shortcut) {
          if (shortcut === "SELECT_ALL") {
            setTimeout(() => {
              const start = imeInputRef.current?.selectionStart || 0;
              const end = imeInputRef.current?.selectionEnd || 0;
              void sendShortcut(shortcut);
              void sendTextWithCursor(imeText, start, end);
            }, 10);
          } else {
            setTimeout(() => {
              void sendShortcut(shortcut);
            }, 10);
          }
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleImeSend();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeIme();
      }
    },
    [closeIme, handleImeSend, imeText, sendShortcut, sendTextWithCursor],
  );

  return {
    imeOpen,
    imeLabel,
    imeText,
    imeSending,
    imeInputRef,
    openIme,
    closeIme,
    handleImeSend,
    handleChange,
    handleFocus,
    handleBlur,
    handleSelect,
    handleKeyDown,
  };
}

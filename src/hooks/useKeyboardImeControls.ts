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
    setImeOpen,
    getImeValue,
  } = useAndroidTV();

  const [imeText, setImeText] = useState("");
  const [imeSending, setImeSending] = useState(false);
  const imeInputRef = useRef<HTMLTextAreaElement>(null);
  const isTypingRef = useRef(false);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!imeOpen) return;

    let active = true;
    setImeText(imeValue);
    void getImeValue().then((value) => {
      if (active && !isTypingRef.current) {
        setImeText(value);
      }
    });
    setTimeout(() => imeInputRef.current?.focus(), 80);

    return () => {
      active = false;
    };
  }, [getImeValue, imeOpen, imeValue]);

  useEffect(() => {
    if (imeOpen && !isTypingRef.current && imeValue !== imeText) {
      setImeText(imeValue);
    }
  }, [imeOpen, imeText, imeValue]);

  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
    };
  }, []);

  const openIme = useCallback(async () => {
    const value = await getImeValue();
    setImeText(value);
    setImeOpen(true);
  }, [getImeValue, setImeOpen]);

  const closeIme = useCallback(() => {
    setImeOpen(false);
  }, [setImeOpen]);

  const handleImeSend = useCallback(async () => {
    setImeSending(true);
    try {
      await sendText(imeText);
      await sendKey("ENTER");
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
        void sendTextWithCursor(newText, cursorStart, cursorEnd);
      }, 50);

      setTimeout(() => {
        isTypingRef.current = false;
      }, 500);
    },
    [sendTextWithCursor],
  );

  const handleFocus = useCallback(() => {
    isTypingRef.current = false;
  }, []);

  const handleBlur = useCallback(() => {
    isTypingRef.current = false;
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
    }
    const cursorStart = imeInputRef.current?.selectionStart || 0;
    const cursorEnd = imeInputRef.current?.selectionEnd || 0;
    void sendTextWithCursor(imeText, cursorStart, cursorEnd);
  }, [imeText, sendTextWithCursor]);

  const handleSelect = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      const cursorStart = target.selectionStart;
      const cursorEnd = target.selectionEnd;
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

import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from "react";
import { kurusBuyuktur, toKurus } from "@shared/lib/moneyKurus";
import {
  formatCurrencyInputTR,
  formatMoneyTypingTR,
  moneyCaretFromSignificant,
  moneySignificantCount,
  parseCurrencyInputTR,
} from "../lib/format";

type Props = {
  id?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  allowZero?: boolean;
  maxValue?: number;
  "aria-label"?: string;
};

function formatMaxForTyping(maxValue: number): string {
  const k = toKurus(maxValue);
  const intPart = Math.floor(Math.abs(k) / 100);
  const dec = Math.abs(k) % 100;
  const sign = k < 0 ? "-" : "";
  if (dec === 0) return formatMoneyTypingTR(`${sign}${intPart}`);
  return formatMoneyTypingTR(`${sign}${intPart},${String(dec).padStart(2, "0")}`);
}

function applyMax(formatted: string, maxValue: number | undefined): string {
  if (maxValue == null || !Number.isFinite(maxValue)) return formatted;
  if (!formatted.trim()) return formatted;
  const n = parseCurrencyInputTR(formatted);
  if (n == null) return formatted;
  if (!kurusBuyuktur(n, maxValue)) return formatted;
  return formatMaxForTyping(maxValue);
}

export function MoneyInput({
  id,
  className = "pm-input pm-input--money",
  value,
  onChange,
  disabled,
  readOnly,
  placeholder = "0,00",
  allowZero = false,
  maxValue,
  "aria-label": ariaLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const [draft, setDraft] = useState(value);
  const pendingCaretRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  function commitTyping(raw: string, caretInRaw: number) {
    const significant = moneySignificantCount(raw, caretInRaw);
    let formatted = formatMoneyTypingTR(raw);
    const beforeClamp = formatted;
    formatted = applyMax(formatted, maxValue);
    const nextCaret =
      formatted === beforeClamp ? moneyCaretFromSignificant(formatted, significant) : formatted.length;

    pendingCaretRef.current = nextCaret;
    setDraft(formatted);
    onChange(formatted);

    const caret = nextCaret;
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el || document.activeElement !== el) return;
      if (pendingCaretRef.current !== caret) return;
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* ignore */
      }
      pendingCaretRef.current = null;
    });
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    commitTyping(el.value, el.selectionStart ?? el.value.length);
  }

  function handleBlur(_e: FocusEvent<HTMLInputElement>) {
    focusedRef.current = false;
    pendingCaretRef.current = null;
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft("");
      onChange("");
      return;
    }
    let n = parseCurrencyInputTR(trimmed);
    if (n == null) return;
    if (!allowZero && n <= 0) {
      setDraft("");
      onChange("");
      return;
    }
    if (maxValue != null && Number.isFinite(maxValue) && kurusBuyuktur(n, maxValue)) {
      n = maxValue;
    }
    const pretty = formatCurrencyInputTR(n);
    setDraft(pretty);
    onChange(pretty);
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    focusedRef.current = true;
    setDraft(value);
    const n = parseCurrencyInputTR(value);
    if (n != null && (allowZero || n > 0) && /,\d{2}$/.test(value.trim())) {
      e.target.select();
    }
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      className={className}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}

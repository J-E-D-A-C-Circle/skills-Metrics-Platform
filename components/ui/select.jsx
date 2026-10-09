'use client';
// Shadcn-style Select, written for this project (no Radix dependency; the brief allows xlsx only).
// It is a drop-in replacement for a native <select>: it accepts <option>/<optgroup> children or an
// `options` array, and calls onChange with { target: { value } } like the native element. Use
// onValueChange(value) for the shadcn-style API. The trigger takes the `style` you would have given
// the <select>; the list opens in a portal so drawers and dialogs never clip it.
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GREEN = '#0d3b2a';
const textOf = n => (n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(textOf).join('') : typeof n === 'object' ? textOf(n.props && n.props.children) : String(n));

// Flattens <option>/<optgroup> children into rows: { kind: 'item' | 'label' | 'sep', ... }.
function fromChildren(children, out) {
  React.Children.forEach(children, ch => {
    if (!React.isValidElement(ch)) return;
    if (ch.type === React.Fragment) { fromChildren(ch.props.children, out); return; }
    if (ch.type === 'optgroup') { if (out.length) out.push({ kind: 'sep' }); out.push({ kind: 'label', label: ch.props.label }); fromChildren(ch.props.children, out); return; }
    if (ch.type === 'option') {
      const label = textOf(ch.props.children);
      out.push({ kind: 'item', value: String(ch.props.value ?? label), label, disabled: !!ch.props.disabled });
    }
  });
  return out;
}
// options: ['a', 'b'] · [[value, label], …] · [{ value, label, icon, disabled, group }, …]
function fromOptions(options) {
  const out = []; let group;
  options.forEach(o => {
    const it = Array.isArray(o) ? { value: o[0], label: o[1] } : o && typeof o === 'object' ? o : { value: o, label: o };
    if (it.group && it.group !== group) { if (out.length) out.push({ kind: 'sep' }); out.push({ kind: 'label', label: it.group }); group = it.group; }
    out.push({ kind: 'item', value: String(it.value), label: textOf(it.label ?? it.value), icon: it.icon, disabled: !!it.disabled });
  });
  return out;
}

export function Select({ value, defaultValue, onChange, onValueChange, options, children, placeholder = 'Select…', disabled, title, style, contentStyle, name, id, 'aria-label': ariaLabel, ...rest }) {
  const rows = useMemo(() => (options ? fromOptions(options) : fromChildren(children, [])), [options, children]);
  const items = rows.filter(r => r.kind === 'item');
  const [inner, setInner] = useState(defaultValue != null ? String(defaultValue) : undefined);
  const cur = value != null ? String(value) : inner;
  const selected = items.find(i => i.value === cur);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const [ring, setRing] = useState(false);
  const trig = useRef(null), list = useRef(null), typed = useRef({ s: '', t: 0 });
  const uid = useId(), listId = 'sel-' + uid.replace(/:/g, '');

  const commit = it => {
    if (!it || it.disabled) return;
    if (it.value !== cur) {
      if (value == null) setInner(it.value);
      onValueChange && onValueChange(it.value);
      onChange && onChange({ target: { value: it.value, name }, currentTarget: { value: it.value, name } });
    }
  };
  const enabled = i => items[i] && !items[i].disabled;
  const step = (from, dir) => { let i = from; for (let n = 0; n < items.length; n++) { i = (i + dir + items.length) % items.length; if (enabled(i)) return i; } return from; };
  const show = () => { if (disabled || !items.length) return; const i = items.findIndex(x => x.value === cur); setActive(i >= 0 ? i : step(-1, 1)); setOpen(true); };
  const hide = refocus => { setOpen(false); if (refocus && trig.current) trig.current.focus(); };
  const typeahead = key => {
    const now = Date.now(); typed.current = { s: (now - typed.current.t < 600 ? typed.current.s : '') + key.toLowerCase(), t: now };
    const s = typed.current.s, start = open ? active : items.findIndex(x => x.value === cur);
    for (let n = 1; n <= items.length; n++) { const i = (start + (s.length > 1 ? 0 : n) + items.length) % items.length; if (enabled(i) && items[i].label.toLowerCase().startsWith(s)) return i; }
    return -1;
  };

  // Place the list under the trigger (or above it when there is more room there), at least as wide as the trigger.
  const place = () => {
    const el = trig.current; if (!el) return;
    const r = el.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth;
    const below = vh - r.bottom - 8, above = r.top - 8, up = below < 200 && above > below;
    const maxW = Math.max(r.width, Math.min(440, vw - 16));
    // Near the right edge, line the list up with the trigger's right side so it stays on screen.
    const flip = r.left + maxW > vw - 8;
    const left = flip ? undefined : Math.max(8, r.left), right = flip ? Math.max(8, vw - r.right) : undefined;
    setPos({ left, right, minWidth: Math.max(r.width, 140), maxWidth: Math.min(maxW, (flip ? r.right : vw - r.left) - 8), maxHeight: Math.min(320, (up ? above : below) - 4), top: up ? undefined : r.bottom + 4, bottom: up ? vh - r.top + 4 : undefined, up });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!trig.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false); };
    let raf = 0; const move = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    document.addEventListener('pointerdown', away, true); window.addEventListener('resize', move); window.addEventListener('scroll', move, true);
    const f = requestAnimationFrame(() => list.current && list.current.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(f); cancelAnimationFrame(raf); document.removeEventListener('pointerdown', away, true); window.removeEventListener('resize', move); window.removeEventListener('scroll', move, true); };
  }, [open]);
  useEffect(() => { if (open && list.current) { const el = list.current.querySelector('[data-active="true"]'); el && el.scrollIntoView({ block: 'nearest' }); } }, [open, active, pos]);

  const onTriggerKey = e => {
    if (disabled) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = typeahead(e.key); if (i >= 0) commit(items[i]); }
  };
  const onListKey = e => {
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(true); return; }
    if (k === 'Tab') { setOpen(false); return; }
    e.stopPropagation();
    if (k === 'ArrowDown') { e.preventDefault(); setActive(step(active, 1)); }
    else if (k === 'ArrowUp') { e.preventDefault(); setActive(step(active, -1)); }
    else if (k === 'Home') { e.preventDefault(); setActive(step(-1, 1)); }
    else if (k === 'End') { e.preventDefault(); setActive(step(items.length, -1)); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); commit(items[active]); hide(true); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = typeahead(k); if (i >= 0) setActive(i); }
  };

  const shown = selected ? selected.label : cur && !items.length ? cur : '';
  const sizer = items.length <= 80 ? items : [];
  return (
    <>
      <button ref={trig} type="button" id={id} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-label={ariaLabel} title={title} disabled={disabled}
        onClick={e => { e.preventDefault(); open ? hide(false) : show(); }} onKeyDown={onTriggerKey}
        onFocus={e => { try { setRing(e.currentTarget.matches(':focus-visible')); } catch (er) { setRing(true); } }} onBlur={() => setRing(false)} data-state={open ? 'open' : 'closed'} {...rest}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', height: '36px', minWidth: '0', maxWidth: '100%', padding: '0 10px 0 12px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px',
          background: '#fff', color: '#111827', font: '400 13.5px Inter,sans-serif', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: '0 1px 2px rgba(15,35,65,.05)', outline: 'none', boxSizing: 'border-box',
          transition: 'box-shadow .15s, border-color .15s', ...(style || {}), ...(open || ring ? { borderColor: style && style.border === '0' ? undefined : GREEN, boxShadow: '0 0 0 3px rgba(13,59,42,.14)' } : null), ...(disabled ? { opacity: 0.55 } : null) }}>
        <span style={{ display: 'grid', flex: '1 1 auto', minWidth: '0', textAlign: 'inherit' }}>
          <span style={{ gridArea: '1/1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: shown ? 'inherit' : '#9ca3af' }}>{shown || placeholder}</span>
          {sizer.map(i => <span key={i.value} aria-hidden="true" style={{ gridArea: '1/1', visibility: 'hidden', height: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>{i.label}</span>)}
        </span>
        <i className="icon-chevron-down" aria-hidden="true" style={{ fontSize: '14px', opacity: 0.55, flex: 'none', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}></i>
      </button>
      {name ? <input type="hidden" name={name} value={cur || ''} /> : null}
      {open && pos ? createPortal(
        <div ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={ariaLabel || title} aria-activedescendant={active >= 0 ? listId + '-' + active : undefined} onKeyDown={onListKey} onMouseDown={e => e.preventDefault()}
          style={{ position: 'fixed', zIndex: 1000, left: pos.left, right: pos.right, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth, maxWidth: pos.maxWidth, maxHeight: pos.maxHeight, overflowY: 'auto', padding: '4px', boxSizing: 'border-box',
            background: '#fff', border: '1px solid rgba(15,35,65,.1)', borderRadius: '12px', boxShadow: '0 12px 32px rgba(15,35,65,.16), 0 2px 6px rgba(15,35,65,.06)', outline: 'none',
            font: '400 13.5px Inter,sans-serif', color: '#111827', letterSpacing: 'normal', textTransform: 'none', textAlign: 'left', animation: 'sm-select-in .12s ease-out', transformOrigin: pos.up ? 'bottom' : 'top', ...(contentStyle || {}) }}>
          {rows.map((r, k) => {
            if (r.kind === 'sep') return <div key={'s' + k} role="separator" style={{ height: '1px', background: 'rgba(15,35,65,.08)', margin: '4px -4px' }} />;
            if (r.kind === 'label') return <div key={'l' + k} style={{ padding: '6px 10px 4px', font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{r.label}</div>;
            const i = items.indexOf(r), on = r.value === cur, act = i === active;
            return (
              <div key={'i' + k} id={listId + '-' + i} role="option" aria-selected={on} aria-disabled={r.disabled || undefined} data-active={act}
                onMouseMove={() => { if (!r.disabled && !act) setActive(i); }} onClick={() => { if (r.disabled) return; commit(r); hide(true); }}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 30px 7px 10px', borderRadius: '8px', cursor: r.disabled ? 'default' : 'pointer', userSelect: 'none',
                  background: act ? '#eef6f1' : 'transparent', color: r.disabled ? '#9ca3af' : act ? GREEN : '#111827', fontWeight: on ? 600 : 400, lineHeight: 1.35 }}>
                {r.icon ? <i className={r.icon} aria-hidden="true" style={{ fontSize: '14px', color: on || act ? GREEN : '#6b7280', flex: 'none' }}></i> : null}
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{r.label}</span>
                {on ? <i className="icon-check" aria-hidden="true" style={{ position: 'absolute', right: '9px', fontSize: '14px', color: GREEN }}></i> : null}
              </div>);
          })}
        </div>, document.body) : null}
    </>
  );
}

export default Select;
